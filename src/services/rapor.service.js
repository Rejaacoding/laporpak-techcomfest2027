import { LIMITS } from "../shared/constants.js";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { evaluateActiveTicketsBatch } from "./lazy-eval.service.js";

export async function getRaporData({ category } = {}) {
  const cacheKey = `cache:rapor:${category || "all"}`;
  const cached = await redis.getJson(cacheKey);
  if (cached) return cached;

  await evaluateActiveTicketsBatch();

  const [departments, tickets] = await Promise.all([
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

  const departmentCards = departments.map((d) => {
    const agg = countsByDept.get(d.id) || { total: 0, outOfScope: 0, rejectedSpam: 0 };
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
    scoreExplanation: "Mulai skor 80; selesai tepat waktu +2, tutup otomatis 0, terlambat -3/-6, eskalasi -5.",
    departments: departmentCards,
    clusterPoints,
  };

  await redis.setJson(cacheKey, payload, LIMITS.RAPOR_CACHE_TTL_SECONDS);
  return payload;
}
