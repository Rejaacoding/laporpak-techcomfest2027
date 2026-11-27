import { LIMITS } from "../shared/constants.js";
import { randomMediaKey } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { redis } from "../lib/redis.js";
import {
  createStorageSignedUrl,
  deleteStorageObjects,
  uploadStorageObject,
} from "../lib/supabase.js";

function stripDataUrlPrefix(b64) {
  const str = String(b64 || "").trim();
  const idx = str.indexOf("base64,");
  return idx !== -1 ? str.slice(idx + 7) : str;
}

function detectMagicType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg", kind: "IMAGE" };
  }
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { ext: "webp", contentType: "image/webp", kind: "IMAGE" };
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { ext: "png", contentType: "image/png", kind: "PNG" };
  }
  if (buf.toString("ascii", 0, 5) === "%PDF-") {
    return { ext: "pdf", contentType: "application/pdf", kind: "PDF" };
  }
  return null;
}

function parseImageDimensions(buf, ext) {
  try {
    if (ext === "webp" && buf.length >= 30) {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8 " && buf.length >= 30) {
        const width = buf.readUInt16LE(26) & 0x3fff;
        const height = buf.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      if (chunk === "VP8L" && buf.length >= 25) {
        const bits = buf.readUInt32LE(21);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { width, height };
      }
      if (chunk === "VP8X" && buf.length >= 30) {
        const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { width, height };
      }
    }
    if (ext === "jpg") {
      let offset = 2;
      while (offset + 9 < buf.length) {
        if (buf[offset] !== 0xff) break;
        const marker = buf[offset + 1];
        const segLen = buf.readUInt16BE(offset + 2);
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          return { width, height };
        }
        if (segLen < 2) break;
        offset += 2 + segLen;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function validateFieldPhotoBuffer(photoBase64) {
  const buf = Buffer.from(stripDataUrlPrefix(photoBase64), "base64");
  if (buf.length === 0 || buf.length > LIMITS.MAX_PHOTO_BYTES) {
    throw new AppError(
      422,
      "MEDIA_INVALID",
      `Ukuran foto lapangan wajib <= ${Math.round(LIMITS.MAX_PHOTO_BYTES / 1024)} KB.`
    );
  }
  const magic = detectMagicType(buf);
  if (!magic || (magic.ext !== "webp" && magic.ext !== "jpg")) {
    throw new AppError(
      422,
      "MEDIA_INVALID",
      "Format foto tidak sah. Gunakan kamera langsung aplikasi (WebP/JPEG)."
    );
  }
  const dims = parseImageDimensions(buf, magic.ext);
  if (dims && (dims.width > LIMITS.MAX_PHOTO_DIM_PX || dims.height > LIMITS.MAX_PHOTO_DIM_PX)) {
    throw new AppError(
      422,
      "MEDIA_INVALID",
      `Dimensi foto terlalu besar (${dims.width}x${dims.height}px, maksimal ${LIMITS.MAX_PHOTO_DIM_PX}px).`
    );
  }
  return { buffer: buf, ext: magic.ext, contentType: magic.contentType, dims };
}

export function validateBeritaAcaraBuffer(docBase64) {
  const buf = Buffer.from(stripDataUrlPrefix(docBase64), "base64");
  if (buf.length === 0 || buf.length > LIMITS.MAX_BERITA_ACARA_BYTES) {
    throw new AppError(422, "MEDIA_INVALID", "Ukuran dokumen Berita Acara wajib <= 5 MB.");
  }
  const magic = detectMagicType(buf);
  if (!magic || !["pdf", "jpg", "png"].includes(magic.ext)) {
    throw new AppError(
      422,
      "MEDIA_INVALID",
      "Dokumen Berita Acara hanya menerima file PDF, JPG, atau PNG yang sah."
    );
  }
  return { buffer: buf, ext: magic.ext, contentType: magic.contentType };
}

export async function runServerNsfwModeration(buffer, clientNsfwScore = 0) {
  if (clientNsfwScore >= LIMITS.NSFW_BLOCK_THRESHOLD) {
    return { verdict: "BLOCK", isNsfwPendingReview: false };
  }
  if (clientNsfwScore >= LIMITS.NSFW_WARN_THRESHOLD) {
    return { verdict: "RETRY", isNsfwPendingReview: false };
  }

  if (!process.env.MODERATION_API_URL) {
    return { verdict: "PASS", isNsfwPendingReview: false };
  }

  try {
    const res = await fetch(process.env.MODERATION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        ...(process.env.MODERATION_API_KEY
          ? { Authorization: `Bearer ${process.env.MODERATION_API_KEY}` }
          : {}),
      },
      body: buffer,
      signal: AbortSignal.timeout(LIMITS.MODERATION_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { verdict: "PASS", isNsfwPendingReview: true };
    }
    const data = await res.json();
    const score = Number(data?.nsfwScore ?? 0);
    if (score >= LIMITS.NSFW_BLOCK_THRESHOLD) {
      return { verdict: "BLOCK", isNsfwPendingReview: false };
    }
    if (score >= LIMITS.NSFW_WARN_THRESHOLD) {
      return { verdict: "RETRY", isNsfwPendingReview: false };
    }
    return { verdict: "PASS", isNsfwPendingReview: false };
  } catch {
    // PRD v3.4 #4/#30: timeout >4s -> fail-safe pakai skor client + private prefix blur-by-default
    return { verdict: "PASS", isNsfwPendingReview: true };
  }
}

export async function uploadFieldPhoto(ticketId, parsedPhoto, { isNsfwPendingReview = false } = {}) {
  const prefix = isNsfwPendingReview ? "private/nsfw" : "tickets";
  const key = randomMediaKey(prefix, ticketId, parsedPhoto.ext);
  return uploadStorageObject(key, parsedPhoto.buffer, parsedPhoto.contentType, {
    isPrivate: isNsfwPendingReview,
  });
}

export async function uploadBeritaAcara(ticketId, parsedDoc) {
  const key = randomMediaKey("berita-acara", ticketId, parsedDoc.ext);
  return uploadStorageObject(key, parsedDoc.buffer, parsedDoc.contentType, { isPrivate: false });
}

export async function getSignedNsfwMediaUrl(ticket, type = "before") {
  const objectKey = type === "after" ? ticket.afterPhotoKey : ticket.beforePhotoKey;
  if (!objectKey) {
    throw new AppError(404, "NOT_FOUND", "Berkas foto tidak ditemukan pada laporan ini.");
  }
  if (objectKey.startsWith("samples/")) {
    return { signedUrl: `/${objectKey}`, expiresInSeconds: LIMITS.SIGNED_URL_TTL_SECONDS };
  }
  const cacheKey = `cache:signed:${ticket.id}:${type}:${objectKey}`;
  const cached = await redis.safeGetJson(cacheKey);
  if (cached?.signedUrl) {
    return cached;
  }
  const signedUrl = await createStorageSignedUrl(objectKey, LIMITS.SIGNED_URL_TTL_SECONDS);
  const payload = { signedUrl, expiresInSeconds: LIMITS.SIGNED_URL_TTL_SECONDS };
  await redis.safeSetJson(cacheKey, payload, Math.max(15, LIMITS.SIGNED_URL_TTL_SECONDS - 15));
  return payload;
}

export async function cleanupStorageKeys(keys) {
  await deleteStorageObjects(keys);
}
