import { SCORE_RULES, clamp } from "../shared/constants.js";

function roundOneDecimal(n) {
  return Math.round(n * 10) / 10;
}

export async function applyTrustReward(tx, userId) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "WARGA") return null;

  let nextScore = user.trustScore;
  let graduated = user.hasGraduatedToOne;

  if (!graduated && user.violationCount === 0 && nextScore < SCORE_RULES.TRUST_GRADUATED) {
    nextScore = SCORE_RULES.TRUST_GRADUATED;
    graduated = true;
  }

  nextScore = roundOneDecimal(
    clamp(nextScore + SCORE_RULES.TRUST_CONTRIBUTION_BONUS, SCORE_RULES.TRUST_MIN, SCORE_RULES.TRUST_MAX)
  );

  return tx.user.update({
    where: { id: userId },
    data: {
      trustScore: nextScore,
      hasGraduatedToOne: graduated,
    },
  });
}

export async function applyViolationPenalty(tx, userId) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "WARGA") return null;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;
  const rawWindow = Array.isArray(user.violationWindow) ? user.violationWindow : [];
  const recentWindow = rawWindow.filter((ts) => typeof ts === "number" && ts >= thirtyDaysAgo);
  recentWindow.push(now);

  const nextViolationCount = user.violationCount + 1;
  const isFirstViolationOnNewAccount = user.violationCount === 0 && user.trustScore <= SCORE_RULES.TRUST_INITIAL;

  let nextScore;
  if (isFirstViolationOnNewAccount) {
    // PRD v3.4 #8: pelanggaran ke-1 akun baru (0.5) turun ke lantai 0.1 agar tidak langsung freeze 7 hari
    nextScore = SCORE_RULES.TRUST_FIRST_VIOLATION_FLOOR;
  } else {
    nextScore = roundOneDecimal(
      clamp(user.trustScore + SCORE_RULES.TRUST_VIOLATION_PENALTY, SCORE_RULES.TRUST_MIN, SCORE_RULES.TRUST_MAX)
    );
  }

  const cooldownUntil = new Date(now + 24 * 3600 * 1000);
  const shouldFreeze =
    (nextViolationCount >= 2 && nextScore <= 0.0) || recentWindow.length >= 3;
  const frozenUntil = shouldFreeze ? new Date(now + 7 * 24 * 3600 * 1000) : user.frozenUntil;

  return tx.user.update({
    where: { id: userId },
    data: {
      trustScore: nextScore,
      violationCount: nextViolationCount,
      violationWindow: recentWindow,
      cooldownUntil,
      frozenUntil,
    },
  });
}

export async function recordUserGpsAction(tx, userId, { lat, lng, accuracy }) {
  if (lat == null || lng == null || accuracy == null) return;
  await tx.user.update({
    where: { id: userId },
    data: {
      lastGpsLat: lat,
      lastGpsLng: lng,
      lastGpsAccuracy: accuracy,
      lastGpsAt: new Date(),
    },
  });
}
