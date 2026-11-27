import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localMediaDir = path.resolve(__dirname, "..", "..", "..", ".local-media");

// shortcut: jika SUPABASE_URL belum diisi di dev lokal, media disimpan di .local-media/ (gitignored); otomatis pakai Supabase Storage saat env aktif.

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
}

function getServiceKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function getAnonKey() {
  return (process.env.SUPABASE_ANON_KEY || "").trim();
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseUrl() && getServiceKey());
}

function getPublicBucket() {
  return (process.env.SUPABASE_PUBLIC_BUCKET || "laporpak-public").trim();
}

function getPrivateBucket() {
  return (process.env.SUPABASE_PRIVATE_BUCKET || "laporpak-private").trim();
}

function resolveBucket(objectKey, isPrivate = false) {
  if (isPrivate || String(objectKey || "").startsWith("private/")) {
    return getPrivateBucket();
  }
  return getPublicBucket();
}

export async function verifySupabaseJwt(accessToken) {
  if (!hasSupabaseConfig()) return null;
  const res = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: getAnonKey() || getServiceKey(),
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function uploadStorageObject(objectKey, buffer, contentType, { isPrivate = false } = {}) {
  if (hasSupabaseConfig()) {
    const bucket = resolveBucket(objectKey, isPrivate);
    const res = await fetch(`${getSupabaseUrl()}/storage/v1/object/${bucket}/${objectKey}`, {
      method: "POST",
      headers: {
        apikey: getServiceKey(),
        Authorization: `Bearer ${getServiceKey()}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: buffer,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      throw new Error(`Supabase Storage upload failed (${res.status}): ${errTxt}`);
    }
    return {
      key: objectKey,
      publicUrl: isPrivate
        ? ""
        : `${getSupabaseUrl()}/storage/v1/object/public/${bucket}/${objectKey}`,
    };
  }

  const dest = path.join(localMediaDir, objectKey);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);
  return {
    key: objectKey,
    publicUrl: isPrivate ? "" : `/local-media/${objectKey}`,
  };
}

export async function deleteStorageObjects(keys) {
  const list = keys.filter(Boolean);
  if (list.length === 0) return;

  if (hasSupabaseConfig()) {
    const byBucket = new Map();
    for (const key of list) {
      const bucket = resolveBucket(key);
      const arr = byBucket.get(bucket) || [];
      arr.push(key);
      byBucket.set(bucket, arr);
    }

    await Promise.all(
      [...byBucket.entries()].map(([bucket, prefixes]) =>
        fetch(`${getSupabaseUrl()}/storage/v1/object/${bucket}`, {
          method: "DELETE",
          headers: {
            apikey: getServiceKey(),
            Authorization: `Bearer ${getServiceKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prefixes }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {})
      )
    );
    return;
  }

  await Promise.all(
    list.map((k) => fs.rm(path.join(localMediaDir, k), { force: true }).catch(() => {}))
  );
}

// Pindahkan foto REJECTED_SPAM non-NSFW dari bucket publik ke bucket privat (karantina audit 7 hari)
export async function quarantinePublicObject(sourceKey) {
  if (!sourceKey || sourceKey.startsWith("private/") || sourceKey.startsWith("samples/")) {
    return sourceKey;
  }
  const destKey = `private/quarantine/${sourceKey.replace(/^tickets\//, "")}`;

  if (hasSupabaseConfig()) {
    const pubBucket = getPublicBucket();
    const privBucket = getPrivateBucket();
    const dl = await fetch(`${getSupabaseUrl()}/storage/v1/object/authenticated/${pubBucket}/${sourceKey}`, {
      headers: { apikey: getServiceKey(), Authorization: `Bearer ${getServiceKey()}` },
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);

    if (dl && dl.ok) {
      const contentType = dl.headers.get("content-type") || "image/webp";
      const buf = Buffer.from(await dl.arrayBuffer());
      await uploadStorageObject(destKey, buf, contentType, { isPrivate: true }).catch(() => {});
      await deleteStorageObjects([sourceKey]);
      return destKey;
    }
    await deleteStorageObjects([sourceKey]);
    return destKey;
  }

  const srcPath = path.join(localMediaDir, sourceKey);
  const dstPath = path.join(localMediaDir, destKey);
  await fs.mkdir(path.dirname(dstPath), { recursive: true });
  await fs.rename(srcPath, dstPath).catch(() => {});
  return destKey;
}

export async function createStorageSignedUrl(objectKey, ttlSeconds = 60) {
  if (hasSupabaseConfig()) {
    const bucket = resolveBucket(objectKey);
    const res = await fetch(`${getSupabaseUrl()}/storage/v1/object/sign/${bucket}/${objectKey}`, {
      method: "POST",
      headers: {
        apikey: getServiceKey(),
        Authorization: `Bearer ${getServiceKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: ttlSeconds }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      throw new Error(`Supabase sign failed (${res.status}): ${errTxt}`);
    }
    const data = await res.json();
    const signedPath = data.signedURL || data.signedUrl;
    return `${getSupabaseUrl()}/storage/v1${signedPath}`;
  }

  return `/local-media/${objectKey}?signed=local&ttl=${ttlSeconds}`;
}
