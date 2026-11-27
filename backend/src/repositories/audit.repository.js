import { computeActorPublicRef, computeAuditHash } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";

export async function appendAuditLog(
  tx,
  { ticketId, actorId, actorRole, actorDisplayLabel, action, fromStatus = null, toStatus, note = null, timestampMs = BigInt(Date.now()) }
) {
  const lastLog = await tx.auditLog.findFirst({
    where: { ticketId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { currentHash: true },
  });

  const prevHash = lastLog ? lastLog.currentHash : "GENESIS";
  const actorPublicRef = computeActorPublicRef(actorId);
  const currentHash = computeAuditHash({
    ticketId,
    actorPublicRef,
    action,
    timestampMs,
    prevHash,
  });

  return tx.auditLog.create({
    data: {
      ticketId,
      actorPublicRef,
      actorRole,
      actorDisplayLabel,
      action,
      fromStatus,
      toStatus,
      note,
      timestampMs,
      prevHash,
      currentHash,
    },
  });
}

export async function getOrderedAuditLogs(ticketId) {
  return prisma.auditLog.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}
