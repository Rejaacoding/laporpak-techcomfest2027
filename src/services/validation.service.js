import { LIMITS, SCORE_RULES } from "../shared/constants.js";
import { prisma } from "../lib/prisma.js";
import { invalidatePublicCaches, redis } from "../lib/redis.js";
import { AppError } from "../lib/errors.js";
import { assertJuryDemoIsolation } from "../middlewares/guard.middleware.js";
import {
  assertCitizenStanding,
  assertGpsAccuracy,
  assertNoImpossibleTravel,
} from "../middlewares/security.middleware.js";
import { appendAuditLog } from "../repositories/audit.repository.js";
import { adjustDepartmentScore } from "../repositories/department.repository.js";
import {
  getDistanceMetersToTicket,
  lockTicketForUpdate,
} from "../repositories/ticket.repository.js";
import {
  applyTrustReward,
  applyViolationPenalty,
  recordUserGpsAction,
} from "../repositories/user.repository.js";
import { evaluateTicketLazy } from "./lazy-eval.service.js";
import {
  cleanupStorageKeys,
  runServerNsfwModeration,
  uploadFieldPhoto,
  validateFieldPhotoBuffer,
} from "./media.service.js";
import { verifyAndPeekNonce } from "./ticket.service.js";

export async function validateTicket({ req, ticketId, body }) {
  const user = req.user;
  await evaluateTicketLazy(ticketId);

  // Pra-validasi media & nonce di luar transaksi DB untuk DISPUTE_FALSE (#29)
  let nonceKey = null;
  let uploadedEvidence = null;
  let parsedPhoto = null;

  if (body.type === "DISPUTE_FALSE") {
    assertCitizenStanding(user);
    if (user.trustScore < SCORE_RULES.TRUST_MIN_DISPUTE) {
      throw new AppError(
        403,
        "FORBIDDEN",
        `Skor kamu ${user.trustScore}. Tuntaskan 1 laporan atau validasi 'Sudah Beres' agar naik ke 1.0 dan membuka hak Klaim Palsu.`
      );
    }
    if (!body.captureNonce || !body.photoBase64) {
      throw new AppError(422, "VALIDATION_ERROR", "Klaim Palsu wajib menyertakan foto kamera langsung di lokasi.");
    }
    assertGpsAccuracy(body.gpsAccuracyMeters);
    assertNoImpossibleTravel(user, body.lat, body.lng, body.gpsAccuracyMeters, req.isJuryMode);

    const noncePayload = await verifyAndPeekNonce({
      captureNonce: body.captureNonce,
      userId: user.id,
      deviceFingerprint: req.deviceFingerprint,
      actionType: "DISPUTE_TICKET",
      ticketId,
    });

    parsedPhoto = validateFieldPhotoBuffer(body.photoBase64);
    const moderation = await runServerNsfwModeration(parsedPhoto.buffer, body.clientNsfwScore);
    if (moderation.verdict === "RETRY") throw new AppError(422, "NSFW_RETRY");
    if (moderation.verdict === "BLOCK") {
      await prisma.$transaction((tx) => applyViolationPenalty(tx, user.id));
      throw new AppError(422, "NSFW_BLOCKED");
    }

    nonceKey = `nonce:${noncePayload.jti}`;
    const acquired = await redis.setNx(nonceKey, "1", LIMITS.NONCE_CONSUMED_TTL_SECONDS);
    if (!acquired) throw new AppError(409, "VERSION_CONFLICT");

    try {
      uploadedEvidence = await uploadFieldPhoto(ticketId, parsedPhoto, {
        isNsfwPendingReview: moderation.isNsfwPendingReview,
      });
    } catch (err) {
      await redis.del(nonceKey).catch(() => {});
      throw err;
    }
  }

  // Pra-hitung riwayat perilaku warga untuk #35 di luar transaksi agar tidak membebani durasi lock DB
  let sleeperHistoryFlag = false;
  if (body.type === "CONFIRM_RESOLVED" && !req.isJuryMode) {
    const ticketMeta = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { departmentId: true },
    });
    if (ticketMeta) {
      const [priorSameDeptVotes, validOwnReports] = await Promise.all([
        prisma.ticketValidation.count({
          where: {
            validatorId: user.id,
            type: "CONFIRM_RESOLVED",
            ticket: { departmentId: ticketMeta.departmentId },
          },
        }),
        prisma.ticket.count({
          where: {
            reporterId: user.id,
            status: { not: "REJECTED_SPAM" },
          },
        }),
      ]);
      sleeperHistoryFlag =
        priorSameDeptVotes >= LIMITS.COLLUSION_REPEAT_THRESHOLD - 1 && validOwnReports === 0;
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ticket = await lockTicketForUpdate(tx, ticketId);
      if (!ticket) throw new AppError(404, "NOT_FOUND");

      assertJuryDemoIsolation(req, ticket.isDemoData);
      assertCitizenStanding(user);

      if (ticket.status !== "PENDING_VALIDATION") {
        throw new AppError(409, "VERSION_CONFLICT");
      }

      const elapsedHours = ticket.validationStartedAt
        ? (Date.now() - new Date(ticket.validationStartedAt).getTime()) / (3600 * 1000)
        : 0;
      const isReporter = user.id === ticket.reporterId;
      const isPhase2 = elapsedHours >= LIMITS.PUBLIC_VALIDATION_PHASE1_HOURS;

      // PRD v3.4 #1/#16: Pada putaran banding (isAppealRound == true), pembantah Putaran 1 dilarang vote/bantah ke-2
      if (ticket.isAppealRound) {
        const prevDisputer = await tx.ticketValidation.findFirst({
          where: {
            ticketId: ticket.id,
            validationRound: ticket.validationRound - 1,
            type: "DISPUTE_FALSE",
          },
        });
        if (prevDisputer && prevDisputer.validatorId === user.id) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Pembantah putaran pertama tidak dapat menilai atau membantah ulang di putaran banding."
          );
        }
      }

      const isReporterFreeConfirm =
        body.type === "CONFIRM_RESOLVED" && isReporter && isPhase2 && ticket.disputeCount === 0;

      if (body.type === "CONFIRM_RESOLVED") {
        if (isReporter && !isReporterFreeConfirm) {
          throw new AppError(
            403,
            "FORBIDDEN",
            ticket.disputeCount > 0
              ? "Tiket pernah disengketakan — penutupan wajib melalui kuorum warga sekitar."
              : "Menunggu cek warga sekitar selama 48 jam pertama agar penilaian adil."
          );
        }
        if (user.trustScore < SCORE_RULES.TRUST_MIN_CONFIRM) {
          throw new AppError(403, "FORBIDDEN", "Skor kepercayaan minimal 0.5 untuk menekan Sudah Beres.");
        }
      }

      let distanceMeters = 0;
      if (!isReporterFreeConfirm) {
        assertGpsAccuracy(body.gpsAccuracyMeters);
        assertNoImpossibleTravel(user, body.lat, body.lng, body.gpsAccuracyMeters, req.isJuryMode);
        if (body.lat == null || body.lng == null) {
          throw new AppError(422, "VALIDATION_ERROR", "Koordinat GPS wajib dikirim untuk validasi di lokasi.");
        }
        distanceMeters = await getDistanceMetersToTicket(tx, {
          ticketId: ticket.id,
          lat: body.lat,
          lng: body.lng,
        });
        if (distanceMeters == null || distanceMeters > LIMITS.CITIZEN_VALIDATE_RADIUS_METERS) {
          throw new AppError(
            422,
            "TOO_FAR_VALIDATE",
            `Kamu berjarak ${distanceMeters ?? "?"} m dari titik laporan (wajib <= 100 m).`
          );
        }
      }

      // Cek duplikasi akun atau deviceFingerprint pada putaran aktif (#2)
      const dup = await tx.ticketValidation.findFirst({
        where: {
          ticketId: ticket.id,
          validationRound: ticket.validationRound,
          OR: [{ validatorId: user.id }, { deviceFingerprint: req.deviceFingerprint }],
        },
      });
      if (dup) {
        throw new AppError(409, "VERSION_CONFLICT", "Akun atau perangkat ini sudah memberi suara pada putaran aktif.");
      }

      // PRD v3.5 #35: Behavioral Collusion Guard (non-jury & non-reporterFreeConfirm)
      let isCollusionSuspect = false;
      let effectiveWeight = user.trustScore;
      if (body.type === "CONFIRM_RESOLVED" && !isReporterFreeConfirm && !req.isJuryMode) {
        const elapsedMinutesSinceResolve = ticket.validationStartedAt
          ? (Date.now() - new Date(ticket.validationStartedAt).getTime()) / 60000
          : 999;
        const sameSubnetFast = Boolean(
          ticket.resolvedIpSubnet &&
            req.ipSubnetHash &&
            ticket.resolvedIpSubnet === req.ipSubnetHash &&
            elapsedMinutesSinceResolve < LIMITS.COLLUSION_FAST_WINDOW_MINUTES
        );

        if (sameSubnetFast || sleeperHistoryFlag) {
          isCollusionSuspect = true;
          effectiveWeight = 0.0;
        }
      }

      await tx.ticketValidation.create({
        data: {
          ticketId: ticket.id,
          validatorId: user.id,
          validationRound: ticket.validationRound,
          type: body.type,
          weightAtVote: user.trustScore,
          effectiveWeight,
          deviceFingerprint: req.deviceFingerprint,
          ipSubnetHash: req.ipSubnetHash || null,
          isCollusionSuspect,
          evidencePhotoUrl: uploadedEvidence?.publicUrl || null,
          evidencePhotoKey: uploadedEvidence?.key || null,
          gpsAccuracyMeters: body.gpsAccuracyMeters ?? 0,
          distanceMeters,
        },
      });

      if (!isReporterFreeConfirm) {
        await recordUserGpsAction(tx, user.id, {
          lat: body.lat,
          lng: body.lng,
          accuracy: body.gpsAccuracyMeters,
        });
      }

      // === CABANG 1: SUDAH BERES (CONFIRM_RESOLVED) ===
      if (body.type === "CONFIRM_RESOLVED") {
        const [roundConfirmations, allEarlySupports] = await Promise.all([
          tx.ticketValidation.findMany({
            where: {
              ticketId: ticket.id,
              validationRound: ticket.validationRound,
              type: "CONFIRM_RESOLVED",
            },
          }),
          tx.ticketSupport.findMany({
            where: {
              ticketId: ticket.id,
              ...(ticket.repairCapturedAt
                ? { createdAt: { lte: ticket.repairCapturedAt } }
                : {}),
            },
            select: { userId: true },
          }),
        ]);
        const validConfirmations = roundConfirmations.filter(
          (v) => (v.effectiveWeight ?? v.weightAtVote) > 0
        );
        const totalWeight = validConfirmations.reduce(
          (sum, v) => sum + (v.effectiveWeight ?? v.weightAtVote),
          0
        );

        // PRD v3.5 #34: Jangkar Saksi Awal di Fase 1 (non-juri)
        const earlySupporterIds = new Set(allEarlySupports.map((s) => s.userId));
        const hasEarlySupporter = validConfirmations.some((v) =>
          earlySupporterIds.has(v.validatorId)
        );

        const useTightQuorum = !isReporterFreeConfirm && !req.isJuryMode && !isPhase2 && !hasEarlySupporter;
        const requiredWeight = useTightQuorum
          ? LIMITS.NO_ANCHOR_QUORUM_MIN_WEIGHT
          : LIMITS.QUORUM_MIN_WEIGHT;
        const requiredValidators = useTightQuorum
          ? LIMITS.NO_ANCHOR_QUORUM_MIN_VALIDATORS
          : LIMITS.QUORUM_MIN_VALIDATORS;

        const quorumReached =
          isReporterFreeConfirm ||
          (totalWeight >= requiredWeight && validConfirmations.length >= requiredValidators);

        // PRD v3.5 #33: Masa Tunggu Eksposur Publik Minimum 6 Jam (di-bypass pada sesi Juri)
        const coolingEndsAt = ticket.validationStartedAt
          ? new Date(
              new Date(ticket.validationStartedAt).getTime() +
                LIMITS.PUBLIC_COOLING_WINDOW_HOURS * 3600 * 1000
            )
          : null;
        const coolingHold =
          quorumReached &&
          !isReporterFreeConfirm &&
          !req.isJuryMode &&
          elapsedHours < LIMITS.PUBLIC_COOLING_WINDOW_HOURS;

        if (!quorumReached || coolingHold) {
          const auditNote = isCollusionSuspect
            ? `Indikasi kolusi terdeteksi — suara dicatat transparan dengan bobot efektif 0.0 (${totalWeight.toFixed(1)} / ${requiredWeight.toFixed(1)} poin).`
            : coolingHold
              ? `Kuorum warga terpenuhi (${totalWeight.toFixed(1)} poin, ${validConfirmations.length} warga) — menunggu masa tayang publik minimal ${LIMITS.PUBLIC_COOLING_WINDOW_HOURS} jam sebelum dikunci.`
              : `Validasi 'Sudah Beres' tercatat (${totalWeight.toFixed(1)} / ${requiredWeight.toFixed(1)} poin, ${validConfirmations.length} warga sah).`;

          await appendAuditLog(tx, {
            ticketId: ticket.id,
            actorId: user.id,
            actorRole: "WARGA",
            actorDisplayLabel: user.aliasName,
            action: isCollusionSuspect
              ? "VOTE_COLLUSION_ZEROED"
              : coolingHold
                ? "VOTE_QUORUM_COOLING_HOLD"
                : "VOTE_CONFIRM_RESOLVED",
            fromStatus: "PENDING_VALIDATION",
            toStatus: "PENDING_VALIDATION",
            note: auditNote,
          });
          return {
            status: "PENDING_VALIDATION",
            closed: false,
            coolingHold,
            coolingEndsAt: coolingEndsAt ? coolingEndsAt.toISOString() : null,
            quorumWeight: Math.round(totalWeight * 10) / 10,
            targetWeight: requiredWeight,
            uniqueValidators: validConfirmations.length,
            minValidators: requiredValidators,
            hasEarlySupporter,
            isCollusionSuspect,
          };
        }

        // Kuorum tercapai / konfirmasi 1-tap Pelapor jam 48-72 -> CLOSED
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: "CLOSED",
            closedResolutionNote: isReporterFreeConfirm
              ? "Diselesaikan atas konfirmasi Pelapor Utama pada jendela jam ke-48–72."
              : "Diselesaikan melalui kuorum verifikasi warga sekitar.",
            version: { increment: 1 },
          },
        });

        const cleanOnTime = !ticket.everOverdue && !ticket.everDisputed && !ticket.everEscalated;
        await adjustDepartmentScore(
          tx,
          ticket.departmentId,
          cleanOnTime ? SCORE_RULES.DEPT_ON_TIME_BONUS : 0,
          { totalResolved: 1, onTimeResolved: cleanOnTime ? 1 : 0 }
        );

        // Hadiah +0.1 trustScore hanya untuk pelapor & validator sah (effectiveWeight > 0)
        const rewardIds = new Set([ticket.reporterId, ...validConfirmations.map((v) => v.validatorId)]);
        for (const uid of rewardIds) {
          await applyTrustReward(tx, uid);
        }

        // PRD v3.4 #1/#20: Penalti pembantah Putaran 1 HANYA jika isAppealRound == true dan ditutup oleh >=2 warga sah lain
        if (ticket.isAppealRound && !isReporterFreeConfirm && validConfirmations.length >= 2) {
          const prevDisputer = await tx.ticketValidation.findFirst({
            where: {
              ticketId: ticket.id,
              validationRound: ticket.validationRound - 1,
              type: "DISPUTE_FALSE",
              isPenalized: false,
            },
          });
          if (prevDisputer) {
            await applyViolationPenalty(tx, prevDisputer.validatorId);
            await tx.ticketValidation.update({
              where: { id: prevDisputer.id },
              data: { isPenalized: true },
            });
          }
        }

        await appendAuditLog(tx, {
          ticketId: ticket.id,
          actorId: user.id,
          actorRole: "WARGA",
          actorDisplayLabel: user.aliasName,
          action: "TICKET_CLOSED_VERIFIED",
          fromStatus: "PENDING_VALIDATION",
          toStatus: "CLOSED",
          note: isReporterFreeConfirm
            ? "Pelapor Utama mengonfirmasi perbaikan tuntas (jendela 48–72 jam)."
            : `Kuorum warga terpenuhi (${totalWeight.toFixed(1)} poin, ${validConfirmations.length} warga) — laporan tuntas.`,
        });

        return {
          status: "CLOSED",
          closed: true,
          coolingHold: false,
          quorumWeight: Math.round(totalWeight * 10) / 10,
          targetWeight: requiredWeight,
          uniqueValidators: validConfirmations.length,
          hasEarlySupporter,
          isCollusionSuspect,
        };
      }

      // === CABANG 2: KLAIM PALSU (DISPUTE_FALSE) ===
      const nextDisputeCount = ticket.disputeCount + 1;
      const isEscalated = nextDisputeCount >= 2;
      const nextStatus = isEscalated ? "ESCALATED" : "DISPUTED";

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: nextStatus,
          disputeCount: nextDisputeCount,
          disputedAt: isEscalated ? ticket.disputedAt : new Date(),
          everDisputed: true,
          everEscalated: ticket.everEscalated || isEscalated,
          version: { increment: 1 },
        },
      });

      if (isEscalated) {
        await adjustDepartmentScore(tx, ticket.departmentId, SCORE_RULES.DEPT_ESCALATED_PENALTY, {
          escalatedCount: 1,
        });
      }

      await appendAuditLog(tx, {
        ticketId: ticket.id,
        actorId: user.id,
        actorRole: "WARGA",
        actorDisplayLabel: user.aliasName,
        action: isEscalated ? "DISPUTE_ESCALATED" : "DISPUTE_ROUND_1",
        fromStatus: "PENDING_VALIDATION",
        toStatus: nextStatus,
        note:
          body.note ||
          (isEscalated
            ? "Bantahan sah ke-2 warga — status naik ke Eskalasi Pengawasan (penalti -5 poin permanen)."
            : "Bantahan sah ke-1 warga dengan foto lapangan — dinas wajib merespons maksimal 24 jam."),
      });

      return {
        status: nextStatus,
        disputeCount: nextDisputeCount,
        escalated: isEscalated,
      };
    }, { maxWait: 10000, timeout: 30000 });

    await invalidatePublicCaches();
    return result;
  } catch (err) {
    if (nonceKey) await redis.del(nonceKey).catch(() => {});
    if (uploadedEvidence?.key) await cleanupStorageKeys([uploadedEvidence.key]).catch(() => {});
    throw err;
  }
}
