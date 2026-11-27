import { LIMITS } from "../shared/constants.js";
import { prisma } from "../lib/prisma.js";
import { invalidatePublicCaches, redis } from "../lib/redis.js";
import { AppError } from "../lib/errors.js";
import { assertJuryDemoIsolation } from "../middlewares/guard.middleware.js";
import { evaluateActiveTicketsBatch } from "./lazy-eval.service.js";

export async function getRaporData({ category } = {}) {
  const cacheKey = `cache:rapor:${category || "all"}`;
  const cached = await redis.getJson(cacheKey);
  if (cached) return cached;

  await evaluateActiveTicketsBatch();

  const [departments, tickets, ratings] = await Promise.all([
    prisma.department.findMany({ orderBy: { integrityScore: "desc" } }),
    prisma.ticket.findMany({
      where: {
        ...(category ? { category } : {}),
      },
      select: {
        id: true,
        departmentId: true,
        category: true,
        status: true,
        publicLat: true,
        publicLng: true,
        isChronicOverdue: true,
      },
    }),
    prisma.departmentRating.findMany({
      include: {
        user: { select: { aliasName: true } },
        ticket: { select: { code: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const countsByDept = new Map();
  for (const t of tickets) {
    const stat = countsByDept.get(t.departmentId) || {
      total: 0,
      outOfScope: 0,
      rejectedSpam: 0,
    };
    stat.total += 1;
    if (t.status === "OUT_OF_SCOPE") stat.outOfScope += 1;
    if (t.status === "REJECTED_SPAM") stat.rejectedSpam += 1;
    countsByDept.set(t.departmentId, stat);
  }

  const ratingsByDept = new Map();
  for (const r of ratings) {
    if (category && r.ticket?.category !== category) continue;
    const list = ratingsByDept.get(r.departmentId) || [];
    list.push({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      citizenAlias: r.user?.aliasName || "Warga",
      ticketCode: r.ticket?.code || r.ticketId,
      createdAt: r.createdAt,
    });
    ratingsByDept.set(r.departmentId, list);
  }

  const departmentCards = departments.map((d) => {
    const agg = countsByDept.get(d.id) || { total: 0, outOfScope: 0, rejectedSpam: 0 };
    const deptRatings = ratingsByDept.get(d.id) || [];
    const ratingCount = deptRatings.length;
    const averageRating =
      ratingCount > 0
        ? Math.round((deptRatings.reduce((s, r) => s + r.stars, 0) / ratingCount) * 10) / 10
        : null;
    const slaOnTimeRatio = d.totalResolved > 0 ? Math.round((d.onTimeResolved / d.totalResolved) * 100) / 100 : 1;
    const outOfScopeRatio = agg.total > 0 ? Math.round((agg.outOfScope / agg.total) * 1000) / 1000 : 0;
    const rejectedSpamRatio = agg.total > 0 ? Math.round((agg.rejectedSpam / agg.total) * 1000) / 1000 : 0;

    return {
      id: d.id,
      code: d.code,
      name: d.name,
      shortName: d.shortName,
      integrityScore: d.integrityScore,
      totalTickets: agg.total,
      totalResolved: d.totalResolved,
      onTimeResolved: d.onTimeResolved,
      slaOnTimeRatio,
      overdueCount: d.overdueCount,
      chronicOverdueCnt: d.chronicOverdueCnt,
      isChronicWarning: d.chronicOverdueCnt > 0,
      escalatedCount: d.escalatedCount,
      outOfScopeCount: agg.outOfScope,
      outOfScopeRatio,
      outOfScopeWarning: outOfScopeRatio > LIMITS.OUT_OF_SCOPE_WARNING_RATIO,
      rejectedSpamCount: agg.rejectedSpam,
      rejectedSpamRatio,
      rejectedSpamWarning: rejectedSpamRatio > LIMITS.REJECTED_SPAM_WARNING_RATIO,
      averageRating,
      ratingCount,
      recentRatings: deptRatings.slice(0, 3),
    };
  });

  const clusterPoints = tickets
    .filter((t) => t.status !== "REJECTED_SPAM")
    .map((t) => ({
      id: t.id,
      category: t.category,
      status: t.status,
      lat: t.publicLat,
      lng: t.publicLng,
    }));

  const payload = {
    scoreExplanation: "Mulai nilai 80; selesai tepat waktu +2, tutup otomatis 0, terlambat -3/-6, naik ke pengawasan -5.",
    departments: departmentCards,
    clusterPoints,
  };

  await redis.setJson(cacheKey, payload, LIMITS.RAPOR_CACHE_TTL_SECONDS);
  return payload;
}

export async function rateClosedTicket({ req, ticketId, body }) {
  const user = req.user;
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, code: true, departmentId: true, status: true, isDemoData: true },
  });
  if (!ticket) throw new AppError(404, "NOT_FOUND");

  assertJuryDemoIsolation(req, ticket.isDemoData);

  if (ticket.status !== "CLOSED") {
    throw new AppError(
      409,
      "VERSION_CONFLICT",
      "Rating kepuasan hanya dapat diberikan pada laporan berstatus Tuntas Terverifikasi."
    );
  }

  try {
    const created = await prisma.departmentRating.create({
      data: {
        ticketId: ticket.id,
        departmentId: ticket.departmentId,
        userId: user.id,
        stars: body.stars,
        comment: body.comment,
        isDemoData: Boolean(ticket.isDemoData || req.isJuryMode),
      },
    });
    await invalidatePublicCaches();
    return {
      id: created.id,
      ticketId: created.ticketId,
      departmentId: created.departmentId,
      stars: created.stars,
      comment: created.comment,
      citizenAlias: user.aliasName,
      createdAt: created.createdAt,
    };
  } catch (err) {
    if (err?.code === "P2002") {
      throw new AppError(409, "VERSION_CONFLICT", "Kamu sudah memberikan ulasan bintang untuk laporan ini.");
    }
    throw err;
  }
}
