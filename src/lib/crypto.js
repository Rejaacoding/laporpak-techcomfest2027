import crypto from "node:crypto";
import { LIMITS } from "../shared/constants.js";

export function isHostedProduction() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

export function requireSecret(envNames, devFallback) {
  const names = Array.isArray(envNames) ? envNames : [envNames];
  for (const name of names) {
    const val = process.env[name]?.trim();
    if (val && val.length >= 16) return val;
  }
  if (isHostedProduction()) {
    throw new Error(`Missing required secret env: ${names[0]}`);
  }
  return devFallback;
}

export function getJurySecret() {
  const val = process.env.JURY_SECRET_TOKEN?.trim();
  if (!val || val.length < 16) {
    throw new Error("Missing required secret env: JURY_SECRET_TOKEN");
  }
  return val;
}

export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function computeActorPublicRef(actorId) {
  const salt = requireSecret(["AUDIT_SALT", "AUDIT_ACTOR_SALT"], "dev_audit_actor_salt_fallback_0001");
  return crypto.createHmac("sha256", salt).update(String(actorId)).digest("hex");
}

export function computeAuditHash({ ticketId, actorPublicRef, action, timestampMs, prevHash }) {
  const secret = requireSecret(["SERVER_SECRET", "HMAC_SERVER_SECRET"], "dev_hmac_server_secret_fallback_0001");
  const payload = `${ticketId}||${actorPublicRef}||${action}||${String(timestampMs)}||${prevHash}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function signToken(payloadObj, secretEnvName, devFallback) {
  const secret = requireSecret(secretEnvName, devFallback);
  const body = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token, secretEnvName, devFallback) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const secret = requireSecret(secretEnvName, devFallback);
  const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function signCaptureNonce({ userId, deviceFingerprint, actionType, ticketId = null }) {
  const jti = crypto.randomUUID();
  const exp = Date.now() + LIMITS.CAPTURE_NONCE_TTL_SECONDS * 1000;
  const token = signToken(
    { userId, deviceFingerprint, actionType, ticketId, jti, exp },
    ["CAPTURE_NONCE_SECRET", "SERVER_SECRET", "HMAC_SERVER_SECRET"],
    "dev_capture_nonce_secret_fallback_0001"
  );
  return { captureNonce: token, jti, expiresAt: new Date(exp).toISOString() };
}

export function verifyCaptureNonce(token) {
  return verifyToken(
    token,
    ["CAPTURE_NONCE_SECRET", "SERVER_SECRET", "HMAC_SERVER_SECRET"],
    "dev_capture_nonce_secret_fallback_0001"
  );
}

export function signJurySession(roleKey = "WARGA_PELAPOR") {
  const sid = crypto.randomUUID();
  const exp = Date.now() + LIMITS.JURY_SESSION_TTL_SECONDS * 1000;
  const sessionToken = signToken(
    { sid, roleKey, jury: true, exp },
    "JURY_SECRET_TOKEN",
    "dev_jury_session_secret_fallback_0001"
  );
  return {
    sessionToken,
    sid,
    expiresAt: new Date(exp).toISOString(),
    ttlSeconds: LIMITS.JURY_SESSION_TTL_SECONDS,
  };
}

export function verifyJurySession(token) {
  const parsed = verifyToken(token, "JURY_SECRET_TOKEN", "dev_jury_session_secret_fallback_0001");
  return parsed?.jury ? parsed : null;
}

const ALIAS_WORDS = ["Delta", "Surya", "Brantas", "Tunjungan", "Waru", "Kencana", "Bima", "Loka", "Nusa", "Garda"];

export function generateAliasName() {
  const word = ALIAS_WORDS[crypto.randomInt(0, ALIAS_WORDS.length)];
  const num = crypto.randomInt(100, 999);
  return `Warga-${word}-${num}`;
}

export function randomMediaKey(prefix, ticketId, ext) {
  return `${prefix}/${ticketId}/${crypto.randomUUID()}.${ext}`;
}
