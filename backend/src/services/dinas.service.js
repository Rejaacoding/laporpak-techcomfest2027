import { CATEGORIES, DEPARTMENTS, LIMITS, TICKET_STATUSES } from "../shared/constants.js";
import { prisma } from "../lib/prisma.js";
import { getPublicCacheVersion, invalidatePublicCaches, redis } from "../lib/redis.js";
import { AppError } from "../lib/errors.js";
import { assertJuryDemoIsolation } from "../middlewares/guard.middleware.js";
import { assertGpsAccuracy } from "../middlewares/security.middleware.js";
import { appendAuditLog } from "../repositories/audit.repository.js";
import { adjustDepartmentScore } from "../repositories/department.repository.js";
import {
  getDistanceMetersToTicket,
  lockTicketForUpdate,
} from "../repositories/ticket.repository.js";
import { applyTrustReward, applyViolationPenalty } from "../repositories/user.repository.js";
import { evaluateActiveTicketsBatch, evaluateTicketLazy } from "./lazy-eval.service.js";
import {
  cleanupStorageKeys,
  runServerNsfwModeration,
  uploadBeritaAcara,
  uploadFieldPhoto,
  validateBeritaAcaraBuffer,
  validateFieldPhotoBuffer,
} from "./media.service.js";
import { quarantinePublicObject } from "../lib/supabase.js";
import { verifyAndPeekNonce } from "./ticket.service.js";

function assertInitialWindowOpen(ticket, actionLabel) {
  if (ticket.status !== "OPEN") {
    throw new AppError(409, "VERSION_CONFLICT", `${actionLabel} hanya tersedia saat laporan masih berstatus Laporan Masuk.`);
  }
  const windowHours = Math.min(24, ticket.slaInitialHours * 0.5);
  const elapsedMs = Date.now() - new Date(ticket.syncedAt).getTime();
  if (elapsedMs > windowHours * 3600 * 1000) {
    throw new AppError(
      409,
      "VERSION_CONFLICT",
      `Batas waktu ${actionLabel} (${windowHours} jam sejak laporan masuk) sudah berakhir.`
    );
  }
}

export async function listDinasTickets({ departmentId, query }) {
  const ver = await getPublicCacheVersion();
  const cacheKey = `cache:v${ver}:dinas:${departmentId}:${query.status || "all"}:${query.category || "all"}`;
  const cached = await redis.safeGetJson(cacheKey);
  if (cached) return cached;

  await evaluateActiveTicketsBatch();

  const rows = await prisma.ticket.findMany({
    where: {
      departmentId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
    },
    include: {
      reporter: { select: { aliasName: true } },
    },
    take: 200,
  });

  const priorityRank = {
    OVERDUE: 1,
    ESCALATED: 2,
    DISPUTED: 3,
    OPEN: 4,
    IN_PROGRESS: 5,
    PENDING_VALIDATION: 6,
    CLOSED: 7,
    AUTO_CLOSED: 8,
    OUT_OF_SCOPE: 9,
    REJECTED_SPAM: 10,
  };

  rows.sort((a, b) => {
    const rankDiff = (priorityRank[a.status] || 99) - (priorityRank[b.status] || 99);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
  });

  const payload = rows.map((t) => ({
    id: t.id,
    code: t.code,
    title: t.title,
    description: t.description,
    category: t.category,
    categoryLabel: CATEGORIES[t.category]?.label || t.category,
    tier: CATEGORIES[t.category]?.tier || "STANDAR",
    status: t.status,
    statusLabel: TICKET_STATUSES[t.status]?.label || t.status,
    publicLat: t.publicLat,
    publicLng: t.publicLng,
    beforePhotoUrl: t.isNsfwPendingReview ? null : t.beforePhotoUrl,
    afterPhotoUrl: t.afterPhotoUrl,
    isNsfwPendingReview: t.isNsfwPendingReview,
    reporterAlias: t.reporter.aliasName,
    slaDeadline: t.slaDeadline,
    syncedAt: t.syncedAt,
    disputedAt: t.disputedAt,
    supportCount: t.supportCount,
    transferCount: t.transferCount,
    appealUsed: t.appealUsed,
    isChronicOverdue: t.isChronicOverdue,
    isFastResolveAnomaly: t.isFastResolveAnomaly,
    outOfScopeAgency: t.outOfScopeAgency,
    outOfScopeReason: t.outOfScopeReason,
    rejectedSpamReason: t.rejectedSpamReason,
    isDemoData: t.isDemoData,
  }));

  await redis.safeSetJson(cacheKey, payload, 60);
  return payload;
}

async function prepareOfficerPhoto({ req, ticketId, actionType, body }) {
  assertGpsAccuracy(body.gpsAccuracyMeters);
  const noncePayload = await verifyAndPeekNonce({
    captureNonce: body.captureNonce,
    userId: req.user.id,
    deviceFingerprint: req.deviceFingerprint,
    actionType,
    ticketId,
  });
  const parsedPhoto = validateFieldPhotoBuffer(body.photoBase64);
  const moderation = await runServerNsfwModeration(parsedPhoto.buffer, body.clientNsfwScore);
  if (moderation.verdict === "RETRY") throw new AppError(422, "NSFW_RETRY");
  if (moderation.verdict === "BLOCK") throw new AppError(422, "NSFW_BLOCKED");

  const nonceKey = `nonce:${noncePayload.jti}`;
  const acquired = await redis.setNx(nonceKey, "1", LIMITS.NONCE_CONSUMED_TTL_SECONDS);
  if (!acquired) throw new AppError(409, "VERSION_CONFLICT");

  return { nonceKey, parsedPhoto, moderation };
}

export async function executeDinasAction({ req, ticketId, action, body }) {
  const officer = req.user;
  const actorDept =
    DEPARTMENTS[officer.departmentId] ||
    (await prisma.department.findUniqueOrThrow({ where: { id: officer.departmentId } }));
  await evaluateTicketLazy(ticketId);

  // Aksi berfoto (resolve, counter-dispute, resolve-escalated) memvalidasi media & nonce sebelum TX
  let nonceKey = null;
  let uploadedKeys = [];
  let uploadedAfter = null;
  let uploadedBerita = null;

  if (action === "resolve" || action === "counter-dispute" || action === "resolve-escalated") {
    const actionMap = {
      resolve: "RESOLVE_TICKET",
      "counter-dispute": "APPEAL_TICKET",
      "resolve-escalated": "RESOLVE_ESCALATED",
    };
    const prep = await prepareOfficerPhoto({ req, ticketId, actionType: actionMap[action], body });
    nonceKey = prep.nonceKey;

    let parsedBerita = null;
    if (action === "resolve-escalated") {
      parsedBerita = validateBeritaAcaraBuffer(body.beritaAcaraBase64);
    }

    try {
      const [afterRes, beritaRes] = await Promise.all([
        uploadFieldPhoto(ticketId, prep.parsedPhoto, {
          isNsfwPendingReview: prep.moderation.isNsfwPendingReview,
        }),
        parsedBerita ? uploadBeritaAcara(ticketId, parsedBerita) : Promise.resolve(null),
      ]);
      uploadedAfter = afterRes;
      uploadedKeys.push(uploadedAfter.key);

      if (beritaRes) {
        uploadedBerita = beritaRes;
        uploadedKeys.push(uploadedBerita.key);
      }
    } catch (err) {
      await redis.del(nonceKey).catch(() => {});
      await cleanupStorageKeys(uploadedKeys).catch(() => {});
      throw err;
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ticket = await lockTicketForUpdate(tx, ticketId);
      if (!ticket) throw new AppError(404, "NOT_FOUND");
      assertJuryDemoIsolation(req, ticket.isDemoData);

      if (ticket.departmentId !== officer.departmentId) {
        throw new AppError(403, "FORBIDDEN", "Petugas hanya dapat memproses laporan milik instansinya sendiri.");
      }

      if (action === "process") {
        if (ticket.status !== "OPEN") {
          throw new AppError(409, "VERSION_CONFLICT", "Hanya laporan berstatus Laporan Masuk yang bisa dimulai.");
        }
        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: "IN_PROGRESS", version: { increment: 1 } },
        });
        await appendAuditLog(tx, {
          ticketId: ticket.id,
          actorId: officer.id,
          actorRole: "ADMIN_DINAS",
          actorDisplayLabel: actorDept.shortName,
          action: "DINAS_START_PROCESS",
          fromStatus: "OPEN",
          toStatus: "IN_PROGRESS",
          note: `${actorDept.shortName} mulai mengerjakan perbaikan di lapangan.`,
        });
        return { id: updated.id, status: updated.status };
      }

      if (action === "transfer") {
        assertInitialWindowOpen(ticket, "Oper Tiket");
        if (ticket.transferCount >= 1) {
          throw new AppError(409, "VERSION_CONFLICT", "Oper Tiket hanya diperbolehkan maksimal 1 kali per laporan.");
        }
        if (body.targetDepartmentId === ticket.departmentId) {
          throw new AppError(422, "VALIDATION_ERROR", "Instansi tujuan Oper Tiket harus berbeda dari instansi saat ini.");
        }
        const targetDept = await tx.department.findUnique({ where: { id: body.targetDepartmentId } });
        if (!targetDept) throw new AppError(404, "NOT_FOUND", "Instansi tujuan tidak ditemukan.");

        const minBufferDeadline = new Date(Date.now() + 12 * 3600 * 1000);
        const nextDeadline =
          new Date(ticket.slaDeadline) > minBufferDeadline ? new Date(ticket.slaDeadline) : minBufferDeadline;

        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            departmentId: targetDept.id,
            transferCount: { increment: 1 },
            transferredFromId: ticket.departmentId,
            transferReason: body.reason,
            slaDeadline: nextDeadline,
            version: { increment: 1 },
          },
        });
        await appendAuditLog(tx, {
          ticketId: ticket.id,
          actorId: officer.id,
          actorRole: "ADMIN_DINAS",
          actorDisplayLabel: actorDept.shortName,
          action: "DINAS_TRANSFER_TICKET",
          fromStatus: "OPEN",
          toStatus: "OPEN",
          note: `Dioper dari ${actorDept.shortName} ke ${targetDept.shortName}: ${body.reason}`,
        });
        return { id: updated.id, status: updated.status, departmentId: updated.departmentId, slaDeadline: updated.slaDeadline };
      }

      if (action === "out-of-scope") {
        if (ticket.status !== "OPEN") {
          throw new AppError(409, "VERSION_CONFLICT", "Rujukan Di Luar Wewenang hanya dapat dilakukan pada status Laporan Masuk.");
        }
        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "OUT_OF_SCOPE",
            outOfScopeAgency: body.agency,
            outOfScopeReason: body.reason,
            version: { increment: 1 },
          },
        });
        await adjustDepartmentScore(tx, ticket.departmentId, 0, { outOfScopeCount: 1 });
        await appendAuditLog(tx, {
          ticketId: ticket.id,
          actorId: officer.id,
          actorRole: "ADMIN_DINAS",
          actorDisplayLabel: actorDept.shortName,
          action: "DINAS_OUT_OF_SCOPE",
          fromStatus: "OPEN",
          toStatus: "OUT_OF_SCOPE",
          note: `Kewenangan ${body.agency}: ${body.reason}`,
        });
        return { id: updated.id, status: updated.status, agency: body.agency };
      }

      if (action === "reject-spam") {
        assertInitialWindowOpen(ticket, "Tolak Laporan Spam");
        const quarantineUntil = body.isNsfwContent
          ? null
          : new Date(Date.now() + LIMITS.QUARANTINE_DAYS * 24 * 3600 * 1000);

        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "REJECTED_SPAM",
            rejectedSpamReason: body.reason,
            beforePhotoUrl: "",
            quarantineDeleteAt: quarantineUntil,
            version: { increment: 1 },
          },
        });
        await adjustDepartmentScore(tx, ticket.departmentId, 0, { rejectedSpamCount: 1 });
        await applyViolationPenalty(tx, ticket.reporterId);
        await appendAuditLog(tx, {
          ticketId: ticket.id,
          actorId: officer.id,
          actorRole: "ADMIN_DINAS",
          actorDisplayLabel: actorDept.shortName,
          action: "DINAS_REJECT_SPAM",
          fromStatus: "OPEN",
          toStatus: "REJECTED_SPAM",
          note: `Ditolak sebagai spam/tidak relevan: ${body.reason}`,
        });
        return {
          id: updated.id,
          status: updated.status,
          hardDeleteKey: body.isNsfwContent ? ticket.beforePhotoKey : null,
          quarantineKey: body.isNsfwContent ? null : ticket.beforePhotoKey,
        };
      }

      if (action === "resolve") {
        if (ticket.status !== "IN_PROGRESS" && ticket.status !== "OVERDUE") {
          throw new AppError(409, "VERSION_CONFLICT", "Laporan hanya bisa diselesaikan dari status Sedang Ditangani atau Melewati Tenggat.");
        }
        const distM = await getDistanceMetersToTicket(tx, {
          ticketId: ticket.id,
          lat: body.lat,
          lng: body.lng,
        });
        if (distM == null || distM > LIMITS.DINAS_RESOLVE_RADIUS_METERS) {
          throw new AppError(
            422,
            "TOO_FAR_DINAS",
            `Posisi petugas berjarak ${distM ?? "?"} m dari titik laporan (wajib <= 75 m).`
          );
        }

        const now = new Date();
        const remainingSlaMs = Math.max(0, new Date(ticket.slaDeadline).getTime() - now.getTime());
        const nextRound = ticket.validationStartedAt || ticket.disputeCount > 0 ? ticket.validationRound + 1 : 1;
        const resolveDurationMinutes = (now.getTime() - new Date(ticket.syncedAt).getTime()) / 60000;
        const isFastResolveAnomaly = resolveDurationMinutes < LIMITS.FAST_RESOLVE_ANOMALY_MINUTES;

        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "PENDING_VALIDATION",
            afterPhotoUrl: uploadedAfter.publicUrl,
            afterPhotoKey: uploadedAfter.key,
            repairCapturedAt: now,
            repairDistanceMeters: distM,
            resolvedByUserId: officer.id,
            resolvedIpSubnet: req.ipSubnetHash || null,
            isFastResolveAnomaly: ticket.isFastResolveAnomaly || isFastResolveAnomaly,
            remainingSlaMs,
            validationStartedAt: now,
            validationRound: nextRound,
            isAppealRound: false,
            version: { increment: 1 },
          },
        });
        await appendAuditLog(tx, {
          ticketId: ticket.id,
          actorId: officer.id,
          actorRole: "ADMIN_DINAS",
          actorDisplayLabel: actorDept.shortName,
          action: "DINAS_RESOLVE_SUBMITTED",
          fromStatus: ticket.status,
          toStatus: "PENDING_VALIDATION",
          note: `Petugas mengunggah foto perbaikan (${distM} m dari titik laporan).${
            isFastResolveAnomaly ? " [Anomali: selesai <10 menit — warga diimbau cek foto lebih teliti.]" : ""
          } Masuk masa Uji Publik 48–72 jam.`,
        });
        return {
          id: updated.id,
          status: updated.status,
          repairDistanceMeters: distM,
          validationRound: nextRound,
          isFastResolveAnomaly: updated.isFastResolveAnomaly,
        };
      }

      if (action === "reprocess-disputed") {
        if (ticket.status !== "DISPUTED") {
          throw new AppError(409, "VERSION_CONFLICT", "Proses Perbaikan Ulang hanya berlaku untuk laporan berstatus Dibantah Warga.");
        }
        const newDeadline = new Date(
          Date.now() + Math.max(0, ticket.remainingSlaMs ?? 0) + LIMITS.REWORK_BONUS_HOURS * 3600 * 1000
        );
        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "IN_PROGRESS",
            isAppealRound: false,
            slaDeadline: newDeadline,
            version: { increment: 1 },
          },
        });
        await appendAuditLog(tx, {
          ticketId: ticket.id,
          actorId: officer.id,
          actorRole: "ADMIN_DINAS",
          actorDisplayLabel: actorDept.shortName,
          action: "DINAS_REPROCESS_DISPUTED",
          fromStatus: "DISPUTED",
          toStatus: "IN_PROGRESS",
          note: `${actorDept.shortName} memilih Jalur A: memperbaiki ulang di lapangan (SLA ditambah 24 jam).`,
        });
        return { id: updated.id, status: updated.status, slaDeadline: updated.slaDeadline };
      }

      if (action === "counter-dispute") {
        if (ticket.status !== "DISPUTED") {
          throw new AppError(409, "VERSION_CONFLICT", "Ajukan Banding Bukti hanya berlaku saat status Dibantah Warga.");
        }
        if (ticket.appealUsed) {
          throw new AppError(409, "VERSION_CONFLICT", "Ajukan Banding Bukti hanya boleh dipakai maksimal 1 kali per laporan.");
        }
        const distM = await getDistanceMetersToTicket(tx, {
          ticketId: ticket.id,
          lat: body.lat,
          lng: body.lng,
        });
        if (distM == null || distM > LIMITS.DINAS_RESOLVE_RADIUS_METERS) {
          throw new AppError(
            422,
            "TOO_FAR_DINAS",
            `Posisi petugas berjarak ${distM ?? "?"} m dari titik laporan (wajib <= 75 m).`
          );
        }
        const now = new Date();
        const nextRound = ticket.validationRound + 1;
        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "PENDING_VALIDATION",
            afterPhotoUrl: uploadedAfter.publicUrl,
            afterPhotoKey: uploadedAfter.key,
            repairCapturedAt: now,
            repairDistanceMeters: distM,
            resolvedByUserId: officer.id,
            resolvedIpSubnet: req.ipSubnetHash || null,
            validationStartedAt: now,
            validationRound: nextRound,
            isAppealRound: true,
            appealUsed: true,
            version: { increment: 1 },
          },
        });
        await appendAuditLog(tx, {
          ticketId: ticket.id,
          actorId: officer.id,
          actorRole: "ADMIN_DINAS",
          actorDisplayLabel: actorDept.shortName,
          action: "DINAS_COUNTER_DISPUTE",
          fromStatus: "DISPUTED",
          toStatus: "PENDING_VALIDATION",
          note: `${actorDept.shortName} mengajukan Banding Bukti foto sudut terbaru (${distM} m). Penilaian dilanjutkan oleh warga lain.`,
        });
        return { id: updated.id, status: updated.status, validationRound: nextRound, isAppealRound: true };
      }

      if (action === "resolve-escalated") {
        if (ticket.status !== "ESCALATED") {
          throw new AppError(409, "VERSION_CONFLICT", "Penyelesaian Berita Acara hanya untuk laporan berstatus Eskalasi Pengawasan.");
        }
        const distM = await getDistanceMetersToTicket(tx, {
          ticketId: ticket.id,
          lat: body.lat,
          lng: body.lng,
        });
        if (distM == null || distM > LIMITS.DINAS_RESOLVE_RADIUS_METERS) {
          throw new AppError(
            422,
            "TOO_FAR_DINAS",
            `Posisi petugas berjarak ${distM ?? "?"} m dari titik laporan (wajib <= 75 m).`
          );
        }

        const now = new Date();
        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "CLOSED",
            afterPhotoUrl: uploadedAfter.publicUrl,
            afterPhotoKey: uploadedAfter.key,
            repairCapturedAt: now,
            repairDistanceMeters: distM,
            beritaAcaraUrl: uploadedBerita.publicUrl,
            beritaAcaraKey: uploadedBerita.key,
            closedResolutionNote: "Diselesaikan via Berita Acara Eskalasi",
            version: { increment: 1 },
          },
        });

        await adjustDepartmentScore(tx, ticket.departmentId, 0, { totalResolved: 1 });

        // PRD v3.4 #8: Pelapor + pembantah putaran 1 & 2 mendapat +0.1 trustScore
        const disputers = await tx.ticketValidation.findMany({
          where: { ticketId: ticket.id, type: "DISPUTE_FALSE" },
          select: { validatorId: true },
        });
        const rewardIds = [...new Set([ticket.reporterId, ...disputers.map((d) => d.validatorId)])];
        await Promise.all(rewardIds.map((uid) => applyTrustReward(tx, uid)));

        await appendAuditLog(tx, {
          ticketId: ticket.id,
          actorId: officer.id,
          actorRole: "ADMIN_DINAS",
          actorDisplayLabel: actorDept.shortName,
          action: "DINAS_RESOLVE_ESCALATED",
          fromStatus: "ESCALATED",
          toStatus: "CLOSED",
          note: `Diselesaikan via Berita Acara Eskalasi & foto lapangan (${distM} m). Penalti -5 poin bersifat permanen.`,
        });

        return {
          id: updated.id,
          status: updated.status,
          closedResolutionNote: updated.closedResolutionNote,
          beritaAcaraUrl: updated.beritaAcaraUrl,
        };
      }

      throw new AppError(404, "NOT_FOUND", "Aksi dinas tidak dikenali.");
    }, { maxWait: 10000, timeout: 30000 });

    // Hard-delete segera jika spam mengandung NSFW, atau pindah ke bucket privat 7 hari jika non-NSFW
    if (result.hardDeleteKey) {
      await cleanupStorageKeys([result.hardDeleteKey]);
    } else if (result.quarantineKey) {
      const movedKey = await quarantinePublicObject(result.quarantineKey);
      if (movedKey && movedKey !== result.quarantineKey) {
        await prisma.ticket.update({ where: { id: result.id }, data: { beforePhotoKey: movedKey } }).catch(() => {});
      }
    }

    await invalidatePublicCaches();
    return result;
  } catch (err) {
    if (nonceKey) await redis.del(nonceKey).catch(() => {});
    if (uploadedKeys.length > 0) await cleanupStorageKeys(uploadedKeys).catch(() => {});
    throw err;
  }
}
