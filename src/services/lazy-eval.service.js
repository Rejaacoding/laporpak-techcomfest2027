import { LIMITS, SCORE_RULES } from "../shared/constants.js";
import { prisma } from "../lib/prisma.js";
import { invalidatePublicCaches } from "../lib/redis.js";
import { appendAuditLog } from "../repositories/audit.repository.js";
import { adjustDepartmentScore } from "../repositories/department.repository.js";
import { applyTrustReward } from "../repositories/user.repository.js";

const SYSTEM_ACTOR_ID = "SYSTEM_LAPORPAK";
const SYSTEM_ACTOR_LABEL = "Sistem LaporPAK!";

export async function evaluateTicketLazy(ticketId) {
  const now = new Date();
  let mutated = false;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  // 1. OPEN / IN_PROGRESS melewati slaDeadline -> OVERDUE
  if (
    (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") &&
    now > new Date(ticket.slaDeadline)
  ) {
    const changed = await prisma.$transaction(async (tx) => {
      const fresh = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (
        !fresh ||
        fresh.version !== ticket.version ||
        (fresh.status !== "OPEN" && fresh.status !== "IN_PROGRESS")
      ) {
        return false;
      }

      const isHighPenalty = fresh.supportCount >= LIMITS.SUPPORT_STEP_SIZE;
      const shouldPenalize = !fresh.overduePenalized;
      const penaltyDelta = shouldPenalize
        ? isHighPenalty
          ? SCORE_RULES.DEPT_OVERDUE_HIGH_SUPPORT_PENALTY
          : SCORE_RULES.DEPT_OVERDUE_PENALTY
        : 0;

      const overdueMs = now.getTime() - new Date(fresh.slaDeadline).getTime();
      const chronicThresholdMs = fresh.slaInitialHours * 3600 * 1000;
      const becomesChronic = !fresh.isChronicOverdue && overdueMs > chronicThresholdMs;

      const updated = await tx.ticket.updateMany({
        where: { id: fresh.id, version: fresh.version },
        data: {
          status: "OVERDUE",
          overduePenalized: true,
          overdueHighPenalty: fresh.overdueHighPenalty || isHighPenalty,
          everOverdue: true,
          isChronicOverdue: fresh.isChronicOverdue || becomesChronic,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) return false;

      if (shouldPenalize || becomesChronic) {
        await adjustDepartmentScore(tx, fresh.departmentId, penaltyDelta, {
          overdueCount: shouldPenalize ? 1 : 0,
          chronicOverdueCnt: becomesChronic ? 1 : 0,
        });
      }

      await appendAuditLog(tx, {
        ticketId: fresh.id,
        actorId: SYSTEM_ACTOR_ID,
        actorRole: "SYSTEM",
        actorDisplayLabel: SYSTEM_ACTOR_LABEL,
        action: "LAZY_OVERDUE",
        fromStatus: fresh.status,
        toStatus: "OVERDUE",
        note: shouldPenalize
          ? `Tenggat SLA terlampaui. Skor instansi dipotong ${penaltyDelta} poin.`
          : "Tenggat SLA terlampaui kembali.",
      });
      return true;
    }, { maxWait: 5000, timeout: 15000 });
    if (changed) mutated = true;
  }

  // 2. OVERDUE aktif melewati >100% SLA awal -> kunci sticky isChronicOverdue
  const postOverdue = mutated ? await prisma.ticket.findUnique({ where: { id: ticketId } }) : ticket;
  if (postOverdue && postOverdue.status === "OVERDUE" && !postOverdue.isChronicOverdue) {
    const overdueMs = now.getTime() - new Date(postOverdue.slaDeadline).getTime();
    if (overdueMs > postOverdue.slaInitialHours * 3600 * 1000) {
      const changed = await prisma.$transaction(async (tx) => {
        const updated = await tx.ticket.updateMany({
          where: { id: postOverdue.id, version: postOverdue.version, isChronicOverdue: false },
          data: { isChronicOverdue: true, version: { increment: 1 } },
        });
        if (updated.count === 0) return false;
        await adjustDepartmentScore(tx, postOverdue.departmentId, 0, { chronicOverdueCnt: 1 });
        await appendAuditLog(tx, {
          ticketId: postOverdue.id,
          actorId: SYSTEM_ACTOR_ID,
          actorRole: "SYSTEM",
          actorDisplayLabel: SYSTEM_ACTOR_LABEL,
          action: "FLAG_CHRONIC_OVERDUE",
          fromStatus: "OVERDUE",
          toStatus: "OVERDUE",
          note: "Keterlambatan aktif melewati 100% SLA awal — ditandai kronis permanen di rapor.",
        });
        return true;
      });
      if (changed) mutated = true;
    }
  }

  // 3. DISPUTED lewat 24 jam tanpa respons dinas -> paksa Jalur A deterministik (#14)
  if (
    postOverdue &&
    postOverdue.status === "DISPUTED" &&
    postOverdue.disputedAt &&
    now.getTime() > new Date(postOverdue.disputedAt).getTime() + LIMITS.DISPUTE_RESPONSE_HOURS * 3600 * 1000
  ) {
    const changed = await prisma.$transaction(async (tx) => {
      const fresh = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!fresh || fresh.status !== "DISPUTED" || fresh.version !== postOverdue.version) return false;

      const reworkStartMs = new Date(fresh.disputedAt).getTime() + LIMITS.DISPUTE_RESPONSE_HOURS * 3600 * 1000;
      const newDeadline = new Date(
        reworkStartMs + Math.max(0, fresh.remainingSlaMs ?? 0) + LIMITS.REWORK_BONUS_HOURS * 3600 * 1000
      );

      const updated = await tx.ticket.updateMany({
        where: { id: fresh.id, version: fresh.version, status: "DISPUTED" },
        data: {
          status: "IN_PROGRESS",
          isAppealRound: false,
          slaDeadline: newDeadline,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) return false;

      await appendAuditLog(tx, {
        ticketId: fresh.id,
        actorId: SYSTEM_ACTOR_ID,
        actorRole: "SYSTEM",
        actorDisplayLabel: SYSTEM_ACTOR_LABEL,
        action: "AUTO_REWORK_DISPUTED",
        fromStatus: "DISPUTED",
        toStatus: "IN_PROGRESS",
        note: "Dinas tidak merespons dalam 24 jam — sistem otomatis mengembalikan ke pengerjaan ulang.",
      });
      return true;
    });
    if (changed) mutated = true;
  }

  // 4. PENDING_VALIDATION lewat 72 jam -> AUTO_CLOSED (bonus dinas 0 netral, #8)
  if (
    postOverdue &&
    postOverdue.status === "PENDING_VALIDATION" &&
    postOverdue.validationStartedAt &&
    now.getTime() >
      new Date(postOverdue.validationStartedAt).getTime() +
        LIMITS.PUBLIC_VALIDATION_AUTO_CLOSE_HOURS * 3600 * 1000
  ) {
    const changed = await prisma.$transaction(async (tx) => {
      const fresh = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!fresh || fresh.status !== "PENDING_VALIDATION" || fresh.version !== postOverdue.version) {
        return false;
      }

      const updated = await tx.ticket.updateMany({
        where: { id: fresh.id, version: fresh.version, status: "PENDING_VALIDATION" },
        data: {
          status: "AUTO_CLOSED",
          closedResolutionNote: "Ditutup otomatis setelah 72 jam uji publik tanpa bantahan.",
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) return false;

      await adjustDepartmentScore(tx, fresh.departmentId, SCORE_RULES.DEPT_AUTO_CLOSED_BONUS, {
        totalResolved: 1,
      });
      await applyTrustReward(tx, fresh.reporterId);

      await appendAuditLog(tx, {
        ticketId: fresh.id,
        actorId: SYSTEM_ACTOR_ID,
        actorRole: "SYSTEM",
        actorDisplayLabel: SYSTEM_ACTOR_LABEL,
        action: "LAZY_AUTO_CLOSED",
        fromStatus: "PENDING_VALIDATION",
        toStatus: "AUTO_CLOSED",
        note: "Lewat 72 jam tanpa bantahan warga. Tiket ditutup otomatis (bonus skor dinas 0 netral).",
      });
      return true;
    });
    if (changed) mutated = true;
  }

  if (mutated) {
    await invalidatePublicCaches();
  }
  return prisma.ticket.findUnique({ where: { id: ticketId } });
}

export async function evaluateActiveTicketsBatch() {
  const now = new Date();
  const disputeCutoff = new Date(now.getTime() - LIMITS.DISPUTE_RESPONSE_HOURS * 3600 * 1000);
  const autoCloseCutoff = new Date(
    now.getTime() - LIMITS.PUBLIC_VALIDATION_AUTO_CLOSE_HOURS * 3600 * 1000
  );

  const candidates = await prisma.ticket.findMany({
    where: {
      OR: [
        { status: { in: ["OPEN", "IN_PROGRESS"] }, slaDeadline: { lt: now } },
        { status: "OVERDUE", isChronicOverdue: false },
        { status: "DISPUTED", disputedAt: { lt: disputeCutoff } },
        { status: "PENDING_VALIDATION", validationStartedAt: { lt: autoCloseCutoff } },
      ],
    },
    select: { id: true },
    take: 50,
  });

  for (const row of candidates) {
    await evaluateTicketLazy(row.id);
  }
}
