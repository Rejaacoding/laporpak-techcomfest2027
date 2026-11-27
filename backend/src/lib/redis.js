// Upstash Redis REST client ringan tanpa SDK ekstra (mendukung atomic /pipeline & O(1) cache versioning).
// shortcut: in-memory Map fallback saat UPSTASH_REDIS_REST_URL kosong di dev lokal; aktif otomatis ke Upstash begitu env diisi.

const memStore = new Map();
const VERSION_KEY = "cv:public";
const VERSION_L1_TTL_MS = 2_000;
let versionL1 = { value: null, exp: 0 };

function hasUpstash() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getUpstashBaseUrl() {
  return String(process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
}

async function upstashCommand(args) {
  const res = await fetch(getUpstashBaseUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Upstash HTTP ${res.status}`);
  }
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

async function upstashPipeline(commands) {
  const res = await fetch(`${getUpstashBaseUrl()}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Upstash Pipeline HTTP ${res.status}`);
  }
  const results = await res.json();
  if (!Array.isArray(results)) {
    throw new Error("Upstash Pipeline returned unexpected shape");
  }
  for (const item of results) {
    if (item?.error) throw new Error(item.error);
  }
  return results.map((item) => item.result);
}

function purgeExpired(key) {
  const entry = memStore.get(key);
  if (entry && entry.exp && Date.now() > entry.exp) {
    memStore.delete(key);
    return null;
  }
  return entry || null;
}

export async function getPublicCacheVersion() {
  if (versionL1.value && Date.now() < versionL1.exp) {
    return versionL1.value;
  }
  try {
    let raw;
    if (hasUpstash()) {
      raw = await upstashCommand(["GET", VERSION_KEY]);
    } else {
      raw = purgeExpired(VERSION_KEY)?.val ?? null;
    }
    const ver = raw ? String(raw) : "1";
    versionL1 = { value: ver, exp: Date.now() + VERSION_L1_TTL_MS };
    return ver;
  } catch {
    return versionL1.value || "1";
  }
}

export async function bumpPublicCacheVersion() {
  versionL1 = { value: null, exp: 0 };
  if (hasUpstash()) {
    const next = await upstashCommand(["INCR", VERSION_KEY]);
    versionL1 = { value: String(next), exp: Date.now() + VERSION_L1_TTL_MS };
    return String(next);
  }
  const current = Number(purgeExpired(VERSION_KEY)?.val || "1");
  const next = String(current + 1);
  memStore.set(VERSION_KEY, { val: next, exp: 0 });
  versionL1 = { value: next, exp: Date.now() + VERSION_L1_TTL_MS };
  return next;
}

export const redis = {
  async ping() {
    if (hasUpstash()) {
      const pong = await upstashCommand(["PING"]);
      return pong === "PONG" ? "up" : "degraded";
    }
    return "local-memory";
  },

  async getJson(key) {
    if (hasUpstash()) {
      const raw = await upstashCommand(["GET", key]);
      return raw ? JSON.parse(raw) : null;
    }
    const entry = purgeExpired(key);
    return entry ? JSON.parse(entry.val) : null;
  },

  async safeGetJson(key) {
    try {
      return await this.getJson(key);
    } catch {
      return null;
    }
  },

  async setJson(key, value, ttlSeconds) {
    const serialized = JSON.stringify(value);
    if (hasUpstash()) {
      await upstashCommand(["SET", key, serialized, "EX", String(ttlSeconds)]);
      return;
    }
    memStore.set(key, { val: serialized, exp: Date.now() + ttlSeconds * 1000 });
  },

  async safeSetJson(key, value, ttlSeconds) {
    try {
      await this.setJson(key, value, ttlSeconds);
    } catch {
      // Fail-open: cache write failure must not break a valid API response.
    }
  },

  async exists(key) {
    if (hasUpstash()) {
      const n = await upstashCommand(["EXISTS", key]);
      return Number(n) > 0;
    }
    return Boolean(purgeExpired(key));
  },

  async setNx(key, value, ttlSeconds) {
    if (hasUpstash()) {
      const result = await upstashCommand(["SET", key, String(value), "EX", String(ttlSeconds), "NX"]);
      return result === "OK";
    }
    if (purgeExpired(key)) return false;
    memStore.set(key, { val: String(value), exp: Date.now() + ttlSeconds * 1000 });
    return true;
  },

  async del(...keys) {
    const flat = keys.flat().filter(Boolean);
    if (flat.length === 0) return;
    if (hasUpstash()) {
      await upstashCommand(["DEL", ...flat]);
      return;
    }
    for (const k of flat) memStore.delete(k);
  },

  async incrWithTtl(key, ttlSeconds) {
    if (hasUpstash()) {
      // 1-RTT atomic pipeline: EXPIRE ... NX guarantees every counter always has a TTL.
      const [countRaw] = await upstashPipeline([
        ["INCR", key],
        ["EXPIRE", key, String(ttlSeconds), "NX"],
      ]);
      return Number(countRaw);
    }
    const entry = purgeExpired(key);
    if (!entry) {
      memStore.set(key, { val: "1", exp: Date.now() + ttlSeconds * 1000 });
      return 1;
    }
    const next = Number(entry.val) + 1;
    memStore.set(key, { val: String(next), exp: entry.exp });
    return next;
  },

  async deleteByPrefix(prefix) {
    if (prefix.startsWith("cache:")) {
      await bumpPublicCacheVersion().catch(() => {});
    }
    if (hasUpstash()) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await upstashCommand(["SCAN", cursor, "MATCH", `${prefix}*`, "COUNT", "100"]);
        if (Array.isArray(keys) && keys.length > 0) {
          await upstashCommand(["DEL", ...keys]);
        }
        cursor = String(nextCursor);
      } while (cursor !== "0");
      return;
    }
    for (const k of memStore.keys()) {
      if (k.startsWith(prefix)) memStore.delete(k);
    }
  },
};

export async function invalidatePublicCaches() {
  // O(1) version bump: 1 single Upstash INCR invalidates all versioned public/dinas/rapor/detail caches immediately.
  // Fails open so a Redis hiccup never turns a committed DB write into a 500.
  await bumpPublicCacheVersion().catch(() => {});
}
