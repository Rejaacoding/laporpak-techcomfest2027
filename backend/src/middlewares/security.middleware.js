import { LIMITS } from "../shared/constants.js";
import { haversineMeters } from "../lib/geo.js";
import { redis } from "../lib/redis.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { getTrustedClientIp } from "./auth.middleware.js";

export function assertCitizenStanding(user, { allowZeroScoreForReport = false } = {}) {
  const now = new Date();
  if (user.frozenUntil && new Date(user.frozenUntil) > now) {
    throw new AppError(403, "FROZEN_ACTIVE", undefined, {
      details: { frozenUntil: user.frozenUntil },
    });
  }
  if (user.cooldownUntil && new Date(user.cooldownUntil) > now) {
    throw new AppError(429, "COOLDOWN_ACTIVE", undefined, {
      details: { cooldownUntil: user.cooldownUntil },
    });
  }
  if (!allowZeroScoreForReport && user.trustScore <= 0) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Skor kepercayaan akunmu 0.0. Buat laporan valid hingga tuntas agar skor naik sebelum memvalidasi."
    );
  }
}

export async function assertWargaHourlyRateLimit(user, isJuryMode) {
  if (isJuryMode || user.role !== "WARGA") return;
  const hourKey = `rl:warga:1h:${user.id}`;
  const count = await redis.incrWithTtl(hourKey, 3600);
  if (count > LIMITS.RATE_LIMIT_WARGA_PER_HOUR) {
    const strikeKey = `rl:warga:strike:${user.id}`;
    const strikes = await redis.incrWithTtl(strikeKey, 3600 * 2);
    if (strikes >= 2) {
      const cooldownUntil = new Date(Date.now() + 24 * 3600 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { cooldownUntil },
      });
      throw new AppError(429, "COOLDOWN_ACTIVE", undefined, { details: { cooldownUntil } });
    }
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Batas 5 laporan per jam tercapai. Tunggu 1 jam sebelum mengirim laporan lagi."
    );
  }
}

export function assertGpsAccuracy(gpsAccuracyMeters) {
  if (typeof gpsAccuracyMeters !== "number" || gpsAccuracyMeters > LIMITS.MAX_GPS_ACCURACY_METERS) {
    throw new AppError(422, "GPS_INACCURATE", undefined, {
      details: { gpsAccuracyMeters, maxAllowedMeters: LIMITS.MAX_GPS_ACCURACY_METERS },
    });
  }
}

export function assertNoImpossibleTravel(user, lat, lng, gpsAccuracyMeters, isJuryMode) {
  if (isJuryMode) return;
  if (gpsAccuracyMeters > LIMITS.MAX_GPS_ACCURACY_METERS) return;
  if (
    user.lastGpsLat == null ||
    user.lastGpsLng == null ||
    user.lastGpsAt == null ||
    user.lastGpsAccuracy == null ||
    user.lastGpsAccuracy > LIMITS.MAX_GPS_ACCURACY_METERS
  ) {
    return;
  }

  const elapsedMs = Date.now() - new Date(user.lastGpsAt).getTime();
  if (elapsedMs < 5000) return;

  const distM = haversineMeters(user.lastGpsLat, user.lastGpsLng, lat, lng);
  if (distM < 500) return;

  const speedKmh = (distM / 1000) / (elapsedMs / 3600000);
  if (speedKmh > LIMITS.IMPOSSIBLE_TRAVEL_KMH) {
    throw new AppError(422, "IMPOSSIBLE_TRAVEL", undefined, {
      details: { speedKmh: Math.round(speedKmh), maxKmh: LIMITS.IMPOSSIBLE_TRAVEL_KMH },
    });
  }
}

export function makeIpRateLimiter({ prefix, maxRequests, windowSeconds, errorMessage }) {
  return async (req, _res, next) => {
    try {
      const rawIp = req.clientIp || getTrustedClientIp(req) || "unknown";
      const ip = String(rawIp).replace(/[^a-zA-Z0-9.:_-]/g, "_");
      const key = `rl:ip:${prefix}:${ip}`;
      const count = await redis.incrWithTtl(key, windowSeconds);
      if (count > maxRequests) {
        return next(new AppError(429, "RATE_LIMITED", errorMessage));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export const enforceJurySessionBruteForceGuard = makeIpRateLimiter({
  prefix: "jury_session",
  maxRequests: 10,
  windowSeconds: 900,
  errorMessage: "Terlalu banyak percobaan token juri. Tunggu 15 menit sebelum mencoba lagi.",
});

export const enforceSignedMediaRateLimit = makeIpRateLimiter({
  prefix: "media_signed_url",
  maxRequests: 60,
  windowSeconds: 60,
  errorMessage: "Terlalu banyak permintaan membuka gambar. Tunggu sebentar lalu muat ulang.",
});

export const enforceRadiusCheckRateLimit = makeIpRateLimiter({
  prefix: "check_radius",
  maxRequests: 60,
  windowSeconds: 60,
  errorMessage: "Terlalu banyak pengecekan lokasi. Tunggu beberapa detik lalu coba lagi.",
});

export const enforceCaptureNonceRateLimit = makeIpRateLimiter({
  prefix: "capture_nonce",
  maxRequests: 30,
  windowSeconds: 60,
  errorMessage: "Terlalu banyak permintaan kupon kamera. Tunggu sebentar lalu coba lagi.",
});

export const enforceCronRateLimit = makeIpRateLimiter({
  prefix: "cron_sla",
  maxRequests: 5,
  windowSeconds: 300,
  errorMessage: "Terlalu banyak permintaan evaluasi SLA terjadwal.",
});
