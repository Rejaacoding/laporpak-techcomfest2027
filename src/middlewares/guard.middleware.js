import { LIMITS } from "../shared/constants.js";
import { redis } from "../lib/redis.js";
import { AppError } from "../lib/errors.js";

export async function enforceJuryMutationRateLimit(req, _res, next) {
  try {
    if (!req.isJuryMode || !req.jurySession) return next();
    const key = `rl:jury:${req.jurySession.sid}`;
    const count = await redis.incrWithTtl(key, 600);
    if (count > LIMITS.JURY_MUTATIONS_PER_10M) {
      return next(
        new AppError(
          429,
          "RATE_LIMITED",
          "Batas uji simulasi juri (30 aksi per 10 menit) tercapai. Tunggu beberapa menit lalu lanjutkan."
        )
      );
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

export function assertJuryDemoIsolation(req, targetIsDemoData) {
  if (req.isJuryMode && !targetIsDemoData) {
    throw new AppError(403, "JURY_REAL_DATA_BLOCKED");
  }
}

export function blockJuryPartnerActivation(req, _res, next) {
  if (req.isJuryMode) {
    return next(new AppError(403, "FORBIDDEN", "Sesi simulasi juri tidak diizinkan mengakses aktivasi mitra."));
  }
  return next();
}
