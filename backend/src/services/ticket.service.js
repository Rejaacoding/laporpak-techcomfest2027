import crypto from "node:crypto";
import {
  CATEGORIES,
  LIMITS,
  SCORE_RULES,
  TICKET_STATUSES,
  roundPublicCoord,
} from "../shared/constants.js";
import { prisma } from "../lib/prisma.js";
import { computeAuditHash, signCaptureNonce, verifyCaptureNonce } from "../lib/crypto.js";
import { isInsideServiceArea } from "../lib/geo.js";
import { getPublicCacheVersion, invalidatePublicCaches, redis } from "../lib/redis.js";
import { AppError } from "../lib/errors.js";
import { assertJuryDemoIsolation } from "../middlewares/guard.middleware.js";
import {
  assertCitizenStanding,
  assertGpsAccuracy,
  assertNoImpossibleTravel,
  assertWargaHourlyRateLimit,
} from "../middlewares/security.middleware.js";
import { appendAuditLog, getOrderedAuditLogs } from "../repositories/audit.repository.js";
import { adjustDepartmentScore } from "../repositories/department.repository.js";
import {
  countActiveDemoTickets,
  countUserActiveAndDailyTickets,
  findNearbyActiveTickets50m,
  getDistanceMetersToTicket,
  insertTicketWithPostgis,
} from "../repositories/ticket.repository.js";
import { applyViolationPenalty, recordUserGpsAction } from "../repositories/user.repository.js";
import { evaluateActiveTicketsBatch, evaluateTicketLazy } from "./lazy-eval.service.js";
import {
  cleanupStorageKeys,
  runServerNsfwModeration,
  uploadFieldPhoto,
  validateFieldPhotoBuffer,
} from "./media.service.js";

function formatTicketPin(t) {
  return {
    id: t.id,
    code: t.code,
    title: t.title,
    category: t.category,
    categoryLabel: CATEGORIES[t.category]?.label || t.category,
    tier: CATEGORIES[t.category]?.tier || "STANDAR",
    status: t.status,
    statusLabel: TICKET_STATUSES[t.status]?.label || t.status,
    publicLat: t.publicLat,
    publicLng: t.publicLng,
    beforePhotoUrl: t.isNsfwPendingReview ? null : t.beforePhotoUrl,
    isNsfwPendingReview: Boolean(t.isNsfwPendingReview),
    slaDeadline: t.slaDeadline,
    remainingSlaMs: t.remainingSlaMs,
    supportCount: t.supportCount,
    isChronicOverdue: t.isChronicOverdue,
    isDemoData: t.isDemoData,
    department: t.department
      ? { id: t.department.id, code: t.department.code, shortName: t.department.shortName }
      : null,
    createdAt: t.createdAt,
  };
}

export async function checkRadiusPreCamera({ lat, lng, category, isJuryMode = false }) {
  const ver = await getPublicCacheVersion();
  const gridLat = roundPublicCoord(lat);
  const gridLng = roundPublicCoord(lng);
  const cacheKey = `cache:v${ver}:radius:${gridLat}:${gridLng}:${category || "all"}:${isJuryMode ? 1 : 0}`;
  const cached = await redis.safeGetJson(cacheKey);
  if (cached) return cached;

  const insideServiceArea = isJuryMode ? true : isInsideServiceArea(lat, lng);
  const rawNearby = await findNearbyActiveTickets50m(prisma, { lat, lng });

  const sameCategoryRows = category
    ? rawNearby.filter((r) => r.category === category && r.distanceMeters <= LIMITS.SAME_CATEGORY_RADIUS_METERS)
    : [];
  const global30mRows = rawNearby.filter((r) => r.distanceMeters <= LIMITS.GLOBAL_RADIUS_METERS);

  const sameCategoryFull = Boolean(category) && sameCategoryRows.length >= LIMITS.SAME_CATEGORY_MAX_ACTIVE;
  const globalFull = global30mRows.length >= LIMITS.GLOBAL_MAX_ACTIVE;
  const isQuotaFull = sameCategoryFull || globalFull;
  const canOpenCamera = insideServiceArea && !isQuotaFull;

  let guidanceText = "Lokasi aman. Silakan buka kamera langsung untuk memotret kerusakan.";
  if (!insideServiceArea) {
    guidanceText = "Lokasi pin berada di luar wilayah layanan Surabaya & Sidoarjo. Geser pin ke dalam garis batas peta.";
  } else if (isQuotaFull) {
    guidanceText = "Titik sekitar sudah memiliki laporan aktif serupa. Klik Dukung Prioritas di bawah agar penanganan lebih cepat!";
  } else if (rawNearby.length > 0) {
    guidanceText = `Ada ${rawNearby.length} laporan aktif di sekitar titik ini. Kamu bisa dukung laporan tetangga atau lanjut buat laporan baru.`;
  }

  const payload = {
    insideServiceArea,
    sameCategoryCount50m: sameCategoryRows.length,
    sameCategoryLimit: LIMITS.SAME_CATEGORY_MAX_ACTIVE,
    globalCount30m: global30mRows.length,
    globalLimit: LIMITS.GLOBAL_MAX_ACTIVE,
    isQuotaFull,
    canOpenCamera,
    guidanceText,
    nearbyTickets: rawNearby.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      category: r.category,
      categoryLabel: CATEGORIES[r.category]?.label || r.category,
      status: r.status,
      statusLabel: TICKET_STATUSES[r.status]?.label || r.status,
      distanceMeters: r.distanceMeters,
      supportCount: r.supportCount,
      slaDeadline: r.slaDeadline,
    })),
  };

  await redis.safeSetJson(cacheKey, payload, 15);
  return payload;
}

export function issueCaptureNonce({ user, deviceFingerprint, actionType, ticketId }) {
  return signCaptureNonce({
    userId: user.id,
    deviceFingerprint,
    actionType,
    ticketId: ticketId || null,
  });
}

export async function verifyAndPeekNonce({ captureNonce, userId, deviceFingerprint, actionType, ticketId = null }) {
  const payload = verifyCaptureNonce(captureNonce);
  if (!payload) {
    throw new AppError(401, "NONCE_INVALID");
  }
  if (
    payload.userId !== userId ||
    payload.deviceFingerprint !== deviceFingerprint ||
    payload.actionType !== actionType ||
    (ticketId && payload.ticketId !== ticketId)
  ) {
    throw new AppError(401, "NONCE_INVALID", "Kupon foto tidak cocok dengan akun, perangkat, atau aksi yang diminta.");
  }
  const alreadyUsed = await redis.exists(`nonce:${payload.jti}`);
  if (alreadyUsed) {
    throw new AppError(401, "NONCE_INVALID", "Kupon foto sudah pernah digunakan. Silakan ambil foto ulang.");
  }
  return payload;
}

export async function createTicket({ req, body }) {
  const user = req.user;
  const idempotencyKey = req.header("idempotency-key")?.trim() || null;

  // Langkah 1 (#29): Cek Idempotency-Key lebih dulu sebelum validasi atau SETNX
  if (idempotencyKey) {
    const existing = await prisma.ticket.findUnique({
      where: { idempotencyKey },
      include: {
        department: { select: { id: true, code: true, name: true, shortName: true, integrityScore: true } },
        reporter: { select: { aliasName: true } },
      },
    });
    if (existing) {
      return { ticket: formatTicketPin(existing), idempotentReplay: true };
    }
  }

  // Langkah 2: Cek tanda tangan Nonce & EXISTS (BELUM SETNX)
  const noncePayload = await verifyAndPeekNonce({
    captureNonce: body.captureNonce,
    userId: user.id,
    deviceFingerprint: req.deviceFingerprint,
    actionType: "CREATE_TICKET",
  });

  // Langkah 3: Seluruh validasi aturan bisnis, kuota, spasial, media & NSFW
  assertCitizenStanding(user, { allowZeroScoreForReport: true });
  assertGpsAccuracy(body.gpsAccuracyMeters);

  if (!req.isJuryMode && !isInsideServiceArea(body.lat, body.lng)) {
    throw new AppError(422, "OUT_OF_SERVICE_AREA");
  }

  assertNoImpossibleTravel(user, body.lat, body.lng, body.gpsAccuracyMeters, req.isJuryMode);

  if (req.isJuryMode) {
    const demoActive = await countActiveDemoTickets(prisma);
    if (demoActive >= LIMITS.JURY_MAX_ACTIVE_DEMO_TICKETS) {
      throw new AppError(
        409,
        "QUOTA_ACCOUNT_ACTIVE",
        "Batas maksimal 50 tiket simulasi demo aktif tercapai. Jalankan Reset Demo di Panel Juri."
      );
    }
  } else {
    const { activeCount, dailyCount } = await countUserActiveAndDailyTickets(prisma, user.id);
    if (activeCount >= LIMITS.MAX_ACTIVE_TICKETS_PER_CITIZEN) {
      throw new AppError(409, "QUOTA_ACCOUNT_ACTIVE");
    }
    if (dailyCount >= LIMITS.MAX_TICKETS_PER_24H_CITIZEN) {
      throw new AppError(429, "QUOTA_ACCOUNT_DAILY");
    }
  }

  const radiusCheck = await checkRadiusPreCamera({
    lat: body.lat,
    lng: body.lng,
    category: body.category,
    isJuryMode: req.isJuryMode,
  });
  if (radiusCheck.isQuotaFull) {
    throw new AppError(409, "QUOTA_RADIUS_FULL", undefined, {
      details: { nearbyTickets: radiusCheck.nearbyTickets },
    });
  }

  const parsedPhoto = validateFieldPhotoBuffer(body.photoBase64);
  const moderation = await runServerNsfwModeration(parsedPhoto.buffer, body.clientNsfwScore);
  if (moderation.verdict === "RETRY") {
    throw new AppError(422, "NSFW_RETRY");
  }
  if (moderation.verdict === "BLOCK") {
    await prisma.$transaction((tx) => applyViolationPenalty(tx, user.id));
    throw new AppError(422, "NSFW_BLOCKED");
  }

  // Hitung rate limit 5/jam hanya setelah validasi GPS/kuota/media lolos agar user awam tidak boros kuota
  await assertWargaHourlyRateLimit(user, req.isJuryMode);

  // Langkah 4: Baru konsumsi Nonce secara atomik (SETNX) tepat sebelum upload & commit DB
  const nonceKey = `nonce:${noncePayload.jti}`;
  const acquired = await redis.setNx(nonceKey, "1", LIMITS.NONCE_CONSUMED_TTL_SECONDS);
  if (!acquired) {
    throw new AppError(409, "VERSION_CONFLICT", "Permintaan foto sedang diproses. Jangan klik ganda.");
  }

  const ticketId = `tkt_${crypto.randomBytes(8).toString("hex")}`;
  const code = `LPK-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
  const catMeta = CATEGORIES[body.category];
  const syncedAt = new Date();
  const slaDeadline = new Date(syncedAt.getTime() + catMeta.slaHours * 3600 * 1000);
  let uploadedKey = null;

  try {
    // Langkah 5: Upload ke Storage (private prefix bila isNsfwPendingReview)
    const uploaded = await uploadFieldPhoto(ticketId, parsedPhoto, {
      isNsfwPendingReview: moderation.isNsfwPendingReview,
    });
    uploadedKey = uploaded.key;

    // Langkah 6: Transaksi Prisma atomik + re-cek kuota spasial + AuditLog GENESIS
    const created = await prisma.$transaction(async (tx) => {
      const txNearby = await findNearbyActiveTickets50m(tx, { lat: body.lat, lng: body.lng });
      const txSameCat = txNearby.filter(
        (r) => r.category === body.category && r.distanceMeters <= LIMITS.SAME_CATEGORY_RADIUS_METERS
      );
      const txGlobal = txNearby.filter((r) => r.distanceMeters <= LIMITS.GLOBAL_RADIUS_METERS);
      if (
        txSameCat.length >= LIMITS.SAME_CATEGORY_MAX_ACTIVE ||
        txGlobal.length >= LIMITS.GLOBAL_MAX_ACTIVE
      ) {
        throw new AppError(409, "QUOTA_RADIUS_FULL", undefined, {
          details: { nearbyTickets: txNearby },
        });
      }

      const row = await insertTicketWithPostgis(tx, {
        id: ticketId,
        code,
        title: body.title,
        description: body.description,
        category: body.category,
        status: "OPEN",
        departmentId: catMeta.defaultDepartmentId,
        reporterId: user.id,
        isDemoData: Boolean(req.isJuryMode || user.isDemoData),
        lat: body.lat,
        lng: body.lng,
        publicLat: roundPublicCoord(body.lat),
        publicLng: roundPublicCoord(body.lng),
        gpsAccuracyMeters: body.gpsAccuracyMeters,
        beforePhotoUrl: uploaded.publicUrl,
        beforePhotoKey: uploaded.key,
        isNsfwPendingReview: moderation.isNsfwPendingReview,
        isLowQualityOverride: Boolean(body.isLowQualityOverride),
        syncedAt,
        slaInitialHours: catMeta.slaHours,
        slaDeadline,
        idempotencyKey,
      });

      await appendAuditLog(tx, {
        ticketId: row.id,
        actorId: user.id,
        actorRole: "WARGA",
        actorDisplayLabel: user.aliasName,
        action: "TICKET_CREATED",
        fromStatus: null,
        toStatus: "OPEN",
        note: `Laporan baru kategori ${catMeta.label} masuk antrean ${row.department.shortName}.`,
      });

      await recordUserGpsAction(tx, user.id, {
        lat: body.lat,
        lng: body.lng,
        accuracy: body.gpsAccuracyMeters,
      });

      return row;
    }, { maxWait: 10000, timeout: 30000 });

    // Langkah 7: Hapus cache Redis & kembalikan hasil
    await invalidatePublicCaches();
    return { ticket: formatTicketPin(created), idempotentReplay: false };
  } catch (err) {
    // Kompensasi rollback (#29): kembalikan nonce & bersihkan file yatim saat gagal commit
    await redis.del(nonceKey).catch(() => {});
    if (uploadedKey) {
      await cleanupStorageKeys([uploadedKey]).catch(() => {});
    }
    throw err;
  }
}

export async function listPublicTickets(query) {
  const ver = await getPublicCacheVersion();
  const cacheKey = `cache:v${ver}:tickets:${query.category || "all"}:${query.status || "all"}:${query.departmentId || "all"}`;
  const cached = await redis.safeGetJson(cacheKey);
  if (cached) return cached;

  await evaluateActiveTicketsBatch();

  const where = {
    status: query.status ? query.status : { not: "REJECTED_SPAM" },
    ...(query.category ? { category: query.category } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
  };
  if (query.status === "REJECTED_SPAM") {
    return [];
  }

  const rows = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      department: { select: { id: true, code: true, shortName: true } },
    },
    take: 200,
  });

  const formatted = rows.map(formatTicketPin);
  await redis.safeSetJson(cacheKey, formatted, LIMITS.MAP_CACHE_TTL_SECONDS);
  return formatted;
}

function isTicketCacheableSnapshot(ticket) {
  if (!ticket) return false;
  const nowMs = Date.now();
  const bufferMs = 60_000;
  if (["CLOSED", "AUTO_CLOSED", "OUT_OF_SCOPE", "REJECTED_SPAM", "ESCALATED"].includes(ticket.status)) {
    return true;
  }
  if (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") {
    return new Date(ticket.slaDeadline).getTime() > nowMs + bufferMs;
  }
  if (ticket.status === "DISPUTED" && ticket.disputedAt) {
    const reworkAt = new Date(ticket.disputedAt).getTime() + LIMITS.DISPUTE_RESPONSE_HOURS * 3600 * 1000;
    return reworkAt > nowMs + bufferMs;
  }
  if (ticket.status === "PENDING_VALIDATION" && ticket.validationStartedAt) {
    const startMs = new Date(ticket.validationStartedAt).getTime();
    const coolingAt = startMs + LIMITS.PUBLIC_COOLING_WINDOW_HOURS * 3600 * 1000;
    const autoCloseAt = startMs + LIMITS.PUBLIC_VALIDATION_AUTO_CLOSE_HOURS * 3600 * 1000;
    return Math.abs(nowMs - coolingAt) > bufferMs && autoCloseAt > nowMs + bufferMs;
  }
  return false;
}

export async function getTicketDetail({ ticketId, query, user }) {
  const ver = await getPublicCacheVersion();
  const detailCacheKey = `cache:v${ver}:detail:${ticketId}`;
  let ticket = await redis.safeGetJson(detailCacheKey);

  if (!ticket) {
    await evaluateTicketLazy(ticketId);

    ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        department: { select: { id: true, code: true, name: true, shortName: true, integrityScore: true } },
        reporter: { select: { aliasName: true } },
        validations: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            validationRound: true,
            type: true,
            weightAtVote: true,
            effectiveWeight: true,
            isCollusionSuspect: true,
            distanceMeters: true,
            createdAt: true,
            validatorId: true,
            validator: { select: { aliasName: true } },
          },
        },
        supports: {
          select: { userId: true, createdAt: true },
        },
        ratings: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            userId: true,
            stars: true,
            comment: true,
            createdAt: true,
            user: { select: { aliasName: true } },
          },
        },
        auditLogs: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            actorRole: true,
            actorDisplayLabel: true,
            action: true,
            fromStatus: true,
            toStatus: true,
            note: true,
            timestampMs: true,
            currentHash: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new AppError(404, "NOT_FOUND");
    }

    if (isTicketCacheableSnapshot(ticket)) {
      const serializable = {
        ...ticket,
        auditLogs: ticket.auditLogs.map((l) => ({ ...l, timestampMs: Number(l.timestampMs) })),
      };
      await redis.safeSetJson(detailCacheKey, serializable, 30);
    }
  }

  let userDistanceMeters = null;
  if (query.lat != null && query.lng != null) {
    userDistanceMeters = await getDistanceMetersToTicket(prisma, {
      ticketId: ticket.id,
      lat: query.lat,
      lng: query.lng,
    });
  }

  const activeConfirmations = ticket.validations.filter(
    (v) => v.validationRound === ticket.validationRound && v.type === "CONFIRM_RESOLVED"
  );
  const validConfirmations = activeConfirmations.filter((v) => (v.effectiveWeight ?? v.weightAtVote) > 0);
  const currentWeight =
    Math.round(validConfirmations.reduce((acc, v) => acc + (v.effectiveWeight ?? v.weightAtVote), 0) * 10) / 10;

  let validationPhase = null;
  let elapsedValidationHours = 0;
  let coolingEndsAt = null;
  if (ticket.status === "PENDING_VALIDATION" && ticket.validationStartedAt) {
    elapsedValidationHours = (Date.now() - new Date(ticket.validationStartedAt).getTime()) / (3600 * 1000);
    validationPhase = elapsedValidationHours >= LIMITS.PUBLIC_VALIDATION_PHASE1_HOURS ? "REPORTER_48_72" : "PUBLIC_0_48";
    coolingEndsAt = new Date(
      new Date(ticket.validationStartedAt).getTime() + LIMITS.PUBLIC_COOLING_WINDOW_HOURS * 3600 * 1000
    ).toISOString();
  }

  const earlySupporterIds = new Set(
    (ticket.supports || [])
      .filter((s) => !ticket.repairCapturedAt || new Date(s.createdAt) <= new Date(ticket.repairCapturedAt))
      .map((s) => s.userId)
  );
  const hasEarlySupporter = validConfirmations.some((v) => earlySupporterIds.has(v.validatorId));
  const useTightTarget = validationPhase === "PUBLIC_0_48" && !hasEarlySupporter;
  const targetWeight = useTightTarget ? LIMITS.NO_ANCHOR_QUORUM_MIN_WEIGHT : LIMITS.QUORUM_MIN_WEIGHT;
  const minValidators = useTightTarget ? LIMITS.NO_ANCHOR_QUORUM_MIN_VALIDATORS : LIMITS.QUORUM_MIN_VALIDATORS;
  const isCoolingHold =
    ticket.status === "PENDING_VALIDATION" &&
    elapsedValidationHours < LIMITS.PUBLIC_COOLING_WINDOW_HOURS &&
    currentWeight >= targetWeight &&
    validConfirmations.length >= minValidators;

  const ratingItems = (ticket.ratings || []).map((r) => ({
    id: r.id,
    stars: r.stars,
    comment: r.comment,
    citizenAlias: r.user?.aliasName || "Warga",
    createdAt: r.createdAt,
  }));
  const ratingAverage =
    ratingItems.length > 0
      ? Math.round((ratingItems.reduce((s, r) => s + r.stars, 0) / ratingItems.length) * 10) / 10
      : null;
  const hasRated = Boolean(user && (ticket.ratings || []).some((r) => r.userId === user.id));

  const uiFlags = await buildUiFlags({ ticket, user, userDistanceMeters, queryAccuracy: query.accuracy, validationPhase });

  return {
    id: ticket.id,
    code: ticket.code,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    categoryLabel: CATEGORIES[ticket.category]?.label || ticket.category,
    tier: CATEGORIES[ticket.category]?.tier || "STANDAR",
    status: ticket.status,
    statusLabel: TICKET_STATUSES[ticket.status]?.label || ticket.status,
    publicLat: ticket.publicLat,
    publicLng: ticket.publicLng,
    reporterAlias: ticket.reporter.aliasName,
    department: ticket.department,
    beforePhotoUrl: ticket.isNsfwPendingReview ? null : ticket.beforePhotoUrl,
    afterPhotoUrl: ticket.afterPhotoUrl,
    repairCapturedAt: ticket.repairCapturedAt,
    repairDistanceMeters: ticket.repairDistanceMeters,
    isFastResolveAnomaly: ticket.isFastResolveAnomaly,
    beritaAcaraUrl: ticket.beritaAcaraUrl,
    isNsfwPendingReview: ticket.isNsfwPendingReview,
    isLowQualityOverride: ticket.isLowQualityOverride,
    slaInitialHours: ticket.slaInitialHours,
    syncedAt: ticket.syncedAt,
    slaDeadline: ticket.slaDeadline,
    remainingSlaMs: ticket.remainingSlaMs,
    validationStartedAt: ticket.validationStartedAt,
    coolingEndsAt,
    disputedAt: ticket.disputedAt,
    validationRound: ticket.validationRound,
    disputeCount: ticket.disputeCount,
    isAppealRound: ticket.isAppealRound,
    appealUsed: ticket.appealUsed,
    transferCount: ticket.transferCount,
    isChronicOverdue: ticket.isChronicOverdue,
    supportCount: ticket.supportCount,
    outOfScopeAgency: ticket.outOfScopeAgency,
    outOfScopeReason: ticket.outOfScopeReason,
    rejectedSpamReason: ticket.rejectedSpamReason,
    closedResolutionNote: ticket.closedResolutionNote,
    isDemoData: ticket.isDemoData,
    quorum: {
      currentWeight,
      targetWeight,
      uniqueValidators: validConfirmations.length,
      minValidators,
      hasEarlySupporter,
      isCoolingHold,
      coolingEndsAt,
      phase: validationPhase,
    },
    ratings: {
      average: ratingAverage,
      count: ratingItems.length,
      hasRated,
      canRate: Boolean(user && user.role === "WARGA" && ticket.status === "CLOSED" && !hasRated),
      items: ratingItems,
    },
    timeline: ticket.auditLogs.map((l) => ({
      id: l.id,
      actorRole: l.actorRole,
      actorDisplayLabel: l.actorDisplayLabel,
      action: l.action,
      fromStatus: l.fromStatus,
      toStatus: l.toStatus,
      toStatusLabel: TICKET_STATUSES[l.toStatus]?.label || l.toStatus,
      note: l.note,
      timestampMs: Number(l.timestampMs),
      currentHash: l.currentHash,
      createdAt: l.createdAt,
    })),
    uiFlags,
  };
}

async function buildUiFlags({ ticket, user, userDistanceMeters, queryAccuracy, validationPhase }) {
  const disabledReasons = {};
  const flags = {
    canSupport: false,
    canVoteConfirm: false,
    canDispute: false,
    canConfirmAsReporter48_72: false,
    canProcess: false,
    canTransfer: false,
    canRejectSpam: false,
    canOutOfScope: false,
    canResolve: false,
    canReprocessDisputed: false,
    canAppeal: false,
    canResolveEscalated: false,
    userDistanceMeters,
    disabledReasons,
  };

  if (!user) {
    disabledReasons.support = "Masuk ke akun warga untuk mendukung prioritas laporan.";
    disabledReasons.confirm = "Masuk ke akun warga untuk ikut mengecek hasil perbaikan.";
    disabledReasons.dispute = "Masuk ke akun warga untuk mengajukan Klaim Palsu.";
    return flags;
  }

  if (user.role === "WARGA") {
    const isReporter = user.id === ticket.reporterId;
    const alreadySupported = (ticket.supports || []).some((s) => s.userId === user.id);

    if (ticket.status !== "OPEN" && ticket.status !== "IN_PROGRESS") {
      disabledReasons.support = "Dukungan prioritas hanya aktif saat laporan masuk atau sedang ditangani.";
    } else if (isReporter) {
      disabledReasons.support = "Pelapor tidak dapat mendukung laporannya sendiri.";
    } else if (alreadySupported) {
      disabledReasons.support = "Kamu sudah mendukung prioritas laporan ini.";
    } else {
      flags.canSupport = true;
    }

    if (ticket.status === "PENDING_VALIDATION") {
      const alreadyVotedRound = ticket.validations.some(
        (v) => v.validationRound === ticket.validationRound && v.validatorId === user.id
      );
      const isPrevDisputerBlocked =
        ticket.isAppealRound &&
        ticket.validations.some(
          (v) =>
            v.validationRound === ticket.validationRound - 1 &&
            v.type === "DISPUTE_FALSE" &&
            v.validatorId === user.id
        );

      const gpsBad =
        (queryAccuracy != null && queryAccuracy > LIMITS.MAX_GPS_ACCURACY_METERS) ||
        (userDistanceMeters != null && userDistanceMeters > LIMITS.CITIZEN_VALIDATE_RADIUS_METERS);

      if (isPrevDisputerBlocked) {
        disabledReasons.confirm = "Pada putaran banding bukti, penilaian diserahkan ke warga lain agar objektif.";
        disabledReasons.dispute = "Pembantah putaran pertama tidak dapat membantah ulang di putaran banding.";
      } else if (alreadyVotedRound) {
        disabledReasons.confirm = "Suaramu pada putaran uji publik ini sudah tercatat.";
        disabledReasons.dispute = "Kamu sudah memberikan suara pada putaran ini.";
      } else {
        if (isReporter) {
          if (validationPhase === "REPORTER_48_72" && ticket.disputeCount === 0) {
            flags.canConfirmAsReporter48_72 = true;
            flags.canVoteConfirm = true;
          } else if (ticket.disputeCount > 0) {
            disabledReasons.confirm = "Karena laporan sempat disengketakan, penutupan wajib disetujui warga sekitar.";
          } else {
            disabledReasons.confirm = "Menunggu cek warga sekitar selama 48 jam pertama agar adil; kamu tetap bisa Klaim Palsu bila perbaikan fiktif (<= 100 m).";
          }
        } else if (user.trustScore < SCORE_RULES.TRUST_MIN_CONFIRM) {
          disabledReasons.confirm = "Skor akunmu di bawah 0.5. Tuntaskan laporan valid agar skor kembali aktif.";
        } else if (gpsBad) {
          disabledReasons.confirm = `Kamu berjarak ${userDistanceMeters ?? "?"} m dari lokasi (wajib <= 100 m, akurasi <= 50 m).`;
        } else {
          flags.canVoteConfirm = true;
        }

        if (user.trustScore < SCORE_RULES.TRUST_MIN_DISPUTE) {
          disabledReasons.dispute = `Skor kamu ${user.trustScore}. Tuntaskan 1 laporan atau validasi 'Sudah Beres' agar naik ke 1.0 dan membuka hak Klaim Palsu.`;
        } else if (gpsBad) {
          disabledReasons.dispute = `Kamu berjarak ${userDistanceMeters ?? "?"} m dari lokasi (wajib <= 100 m, akurasi <= 50 m).`;
        } else {
          flags.canDispute = true;
        }
      }
    }
  }

  if (user.role === "ADMIN_DINAS" && user.departmentId === ticket.departmentId) {
    const windowMs = Math.min(24, ticket.slaInitialHours * 0.5) * 3600 * 1000;
    const withinInitialWindow = Date.now() - new Date(ticket.syncedAt).getTime() <= windowMs;

    if (ticket.status === "OPEN") {
      flags.canProcess = true;
      flags.canOutOfScope = true;
      if (ticket.transferCount === 0 && withinInitialWindow) {
        flags.canTransfer = true;
      } else {
        disabledReasons.transfer =
          ticket.transferCount > 0
            ? "Oper Tiket hanya diizinkan maksimal 1 kali per laporan."
            : "Batas waktu Oper Tiket sejak laporan masuk sudah lewat.";
      }
      if (withinInitialWindow) {
        flags.canRejectSpam = true;
      } else {
        disabledReasons.rejectSpam = "Batas waktu Tolak Spam sejak laporan masuk sudah lewat.";
      }
    }
    if (ticket.status === "IN_PROGRESS" || ticket.status === "OVERDUE") {
      flags.canResolve = true;
    }
    if (ticket.status === "DISPUTED") {
      flags.canReprocessDisputed = true;
      if (!ticket.appealUsed) {
        flags.canAppeal = true;
      } else {
        disabledReasons.appeal = "Ajukan Banding Bukti sudah pernah dipakai (maksimal 1 kali).";
      }
    }
    if (ticket.status === "ESCALATED") {
      flags.canResolveEscalated = true;
    }
  }

  return flags;
}

export async function supportTicket({ req, ticketId }) {
  const user = req.user;
  await evaluateTicketLazy(ticketId);

  const result = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError(404, "NOT_FOUND");
    assertJuryDemoIsolation(req, ticket.isDemoData);
    assertCitizenStanding(user);

    if (ticket.reporterId === user.id) {
      throw new AppError(403, "FORBIDDEN", "Pelapor tidak dapat menekan Dukung Prioritas pada laporannya sendiri.");
    }
    if (ticket.status !== "OPEN" && ticket.status !== "IN_PROGRESS") {
      throw new AppError(
        409,
        "VERSION_CONFLICT",
        "Dukung Prioritas hanya tersedia saat status Laporan Masuk atau Sedang Ditangani."
      );
    }

    const existing = await tx.ticketSupport.findUnique({
      where: { ticketId_userId: { ticketId, userId: user.id } },
    });
    if (existing) {
      throw new AppError(409, "VERSION_CONFLICT", "Kamu sudah mendukung prioritas laporan ini.");
    }

    await tx.ticketSupport.create({ data: { ticketId, userId: user.id } });

    const nextCount = ticket.supportCount + 1;
    const nextTier = Math.floor(nextCount / LIMITS.SUPPORT_STEP_SIZE);
    let nextDeadline = new Date(ticket.slaDeadline);
    let slaCutApplied = false;

    if (nextTier > ticket.supportCutTier) {
      const nowMs = Date.now();
      const sisaMs = nextDeadline.getTime() - nowMs;
      if (sisaMs > LIMITS.SUPPORT_SLA_FLOOR_MS) {
        const cutMs = Math.max(LIMITS.SUPPORT_SLA_FLOOR_MS, Math.floor(sisaMs * LIMITS.SUPPORT_SLA_CUT_FACTOR));
        nextDeadline = new Date(nowMs + cutMs);
        slaCutApplied = true;
      }
    }

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        supportCount: nextCount,
        supportCutTier: Math.max(ticket.supportCutTier, nextTier),
        slaDeadline: nextDeadline,
        version: { increment: 1 },
      },
    });

    if (slaCutApplied) {
      await appendAuditLog(tx, {
        ticketId: ticket.id,
        actorId: user.id,
        actorRole: "WARGA",
        actorDisplayLabel: user.aliasName,
        action: "SUPPORT_SLA_ACCELERATED",
        fromStatus: ticket.status,
        toStatus: ticket.status,
        note: `Dukungan mencapai ${nextCount} warga — sisa waktu SLA dipangkas 15% lebih cepat.`,
      });
    }

    return {
      ticketId: updated.id,
      supportCount: updated.supportCount,
      slaDeadline: updated.slaDeadline,
      slaCutApplied,
      highPenaltyActive: updated.supportCount >= LIMITS.SUPPORT_STEP_SIZE,
    };
  }, { maxWait: 10000, timeout: 30000 });

  await invalidatePublicCaches();
  return result;
}

export async function verifyTicketAuditChain(ticketId) {
  // Intentionally uncached: must verify live HMAC chain against PostgreSQL so out-of-band DB tampering is caught immediately.
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, code: true } });
  if (!ticket) throw new AppError(404, "NOT_FOUND");

  const logs = await getOrderedAuditLogs(ticketId);
  let expectedPrev = "GENESIS";
  let verifiedChain = true;
  let tamperedAtIndex = null;

  const entries = logs.map((log, index) => {
    const recomputed = computeAuditHash({
      ticketId: log.ticketId,
      actorPublicRef: log.actorPublicRef,
      action: log.action,
      timestampMs: log.timestampMs,
      prevHash: log.prevHash,
    });
    const isLinkValid = log.prevHash === expectedPrev && recomputed === log.currentHash;
    if (!isLinkValid && verifiedChain) {
      verifiedChain = false;
      tamperedAtIndex = index;
    }
    expectedPrev = log.currentHash;

    return {
      index,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      actorRole: log.actorRole,
      actorDisplayLabel: log.actorDisplayLabel,
      actorPublicRef: log.actorPublicRef,
      note: log.note,
      timestampMs: Number(log.timestampMs),
      prevHash: log.prevHash,
      currentHash: log.currentHash,
      valid: isLinkValid,
    };
  });

  const summaryText = verifiedChain
    ? `Seluruh ${entries.length} catatan riwayat utuh dan tersegel kriptografi — belum pernah diubah diam-diam di database.`
    : `Peringatan: terdeteksi ketidaksesuaian segel digital pada catatan ke-${(tamperedAtIndex ?? 0) + 1}.`;

  return {
    ticketCode: ticket.code,
    verifiedChain,
    totalEntries: entries.length,
    tamperedAtIndex,
    summaryText,
    entries,
  };
}
