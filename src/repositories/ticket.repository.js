import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function findNearbyActiveTickets50m(db, { lat, lng }) {
  return db.$queryRaw(Prisma.sql`
    SELECT
      id, code, title, category, status, "supportCount", "slaDeadline",
      ROUND(ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ))::int AS "distanceMeters"
    FROM "Ticket"
    WHERE status NOT IN ('CLOSED', 'AUTO_CLOSED', 'OUT_OF_SCOPE', 'REJECTED_SPAM')
      AND ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        50
      )
    ORDER BY "distanceMeters" ASC
    LIMIT 15
  `);
}

export async function getDistanceMetersToTicket(db, { ticketId, lat, lng }) {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT ROUND(ST_Distance(
      location,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    ))::int AS "distanceMeters"
    FROM "Ticket"
    WHERE id = ${ticketId}
  `);
  return rows[0]?.distanceMeters ?? null;
}

export async function lockTicketForUpdate(tx, ticketId) {
  await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '3s'`);
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE
  `);
  if (rows.length === 0) return null;
  return tx.ticket.findUnique({
    where: { id: ticketId },
    include: {
      department: true,
      reporter: { select: { id: true, aliasName: true, trustScore: true } },
    },
  });
}

export async function insertTicketWithPostgis(tx, data) {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "Ticket" (
      id, code, title, description, category, status,
      "departmentId", "reporterId", "isDemoData",
      "publicLat", "publicLng", "gpsAccuracyMeters", location,
      "beforePhotoUrl", "beforePhotoKey",
      "isNsfwPendingReview", "isLowQualityOverride",
      "syncedAt", "slaInitialHours", "slaDeadline",
      "idempotencyKey", version, "createdAt", "updatedAt"
    ) VALUES (
      ${data.id}, ${data.code}, ${data.title}, ${data.description},
      ${data.category}::"TicketCategory", ${data.status || "OPEN"}::"TicketStatus",
      ${data.departmentId}, ${data.reporterId}, ${Boolean(data.isDemoData)},
      ${data.publicLat}, ${data.publicLng}, ${data.gpsAccuracyMeters},
      ST_SetSRID(ST_MakePoint(${data.lng}, ${data.lat}), 4326)::geography,
      ${data.beforePhotoUrl}, ${data.beforePhotoKey},
      ${Boolean(data.isNsfwPendingReview)}, ${Boolean(data.isLowQualityOverride)},
      ${data.syncedAt}, ${data.slaInitialHours}, ${data.slaDeadline},
      ${data.idempotencyKey || null}, 1, ${data.createdAt || new Date()}, ${data.createdAt || new Date()}
    )
    RETURNING id
  `);
  return tx.ticket.findUniqueOrThrow({
    where: { id: rows[0].id },
    include: {
      department: { select: { id: true, code: true, name: true, shortName: true, integrityScore: true } },
      reporter: { select: { aliasName: true } },
    },
  });
}

export async function countUserActiveAndDailyTickets(db, userId) {
  const since24h = new Date(Date.now() - 24 * 3600 * 1000);
  const [activeCount, dailyCount] = await Promise.all([
    db.ticket.count({
      where: {
        reporterId: userId,
        status: { notIn: ["CLOSED", "AUTO_CLOSED", "OUT_OF_SCOPE", "REJECTED_SPAM"] },
      },
    }),
    db.ticket.count({
      where: {
        reporterId: userId,
        createdAt: { gte: since24h },
      },
    }),
  ]);
  return { activeCount, dailyCount };
}

export async function countActiveDemoTickets(db = prisma) {
  return db.ticket.count({
    where: {
      isDemoData: true,
      status: { notIn: ["CLOSED", "AUTO_CLOSED", "OUT_OF_SCOPE", "REJECTED_SPAM"] },
    },
  });
}
