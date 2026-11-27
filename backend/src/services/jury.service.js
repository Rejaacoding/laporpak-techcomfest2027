import { prisma } from "../lib/prisma.js";
import { getJurySecret, safeEqual, signJurySession } from "../lib/crypto.js";
import { invalidatePublicCaches } from "../lib/redis.js";
import { AppError } from "../lib/errors.js";
import { JURY_ROLE_USER_MAP } from "../middlewares/auth.middleware.js";
import { evaluateTicketLazy } from "./lazy-eval.service.js";
import { seedDemoData } from "../../../prisma/seed-core.js";

export function createJurySession(juryToken) {
  const expected = getJurySecret();
  if (!safeEqual(juryToken, expected)) {
    throw new AppError(401, "UNAUTHORIZED", "Token simulasi juri tidak valid.");
  }
  const session = signJurySession("WARGA_PELAPOR");
  return {
    ...session,
    availableRoles: Object.keys(JURY_ROLE_USER_MAP),
  };
}

export async function simulateTicketTimeShift({ ticketId, shiftHours }) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError(404, "NOT_FOUND");
  if (!ticket.isDemoData) {
    throw new AppError(403, "JURY_REAL_DATA_BLOCKED");
  }

  const deltaMs = shiftHours * 3600 * 1000;
  const shiftBack = (dt) => (dt ? new Date(new Date(dt).getTime() - deltaMs) : null);

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      syncedAt: shiftBack(ticket.syncedAt),
      slaDeadline: shiftBack(ticket.slaDeadline),
      validationStartedAt: shiftBack(ticket.validationStartedAt),
      disputedAt: shiftBack(ticket.disputedAt),
      version: { increment: 1 },
    },
  });

  const updated = await evaluateTicketLazy(ticket.id);
  await invalidatePublicCaches();

  return {
    id: updated.id,
    code: updated.code,
    status: updated.status,
    slaDeadline: updated.slaDeadline,
    validationStartedAt: updated.validationStartedAt,
    disputedAt: updated.disputedAt,
    isChronicOverdue: updated.isChronicOverdue,
    shiftedHours: shiftHours,
  };
}

export async function resetDemoData() {
  const summary = await seedDemoData(prisma, { resetOnlyDemo: true });
  await invalidatePublicCaches();
  return summary;
}
