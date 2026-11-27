// Upstash Redis REST client ringan tanpa SDK ekstra.
// shortcut: in-memory Map fallback saat UPSTASH_REDIS_REST_URL kosong di dev lokal; aktif otomatis ke Upstash begitu env diisi.

const memStore = new Map();

function hasUpstash() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashCommand(args) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Upstash HTTP ${res.status}`);
  }
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

function purgeExpired(key) {
  const entry = memStore.get(key);
  if (entry && entry.exp && Date.now() > entry.exp) {
    memStore.delete(key);
    return null;
  }
  return entry || null;
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

  async setJson(key, value, ttlSeconds) {
    const serialized = JSON.stringify(value);
    if (hasUpstash()) {
      await upstashCommand(["SET", key, serialized, "EX", String(ttlSeconds)]);
      return;
    }
    memStore.set(key, { val: serialized, exp: Date.now() + ttlSeconds * 1000 });
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
      const count = Number(await upstashCommand(["INCR", key]));
      if (count === 1) await upstashCommand(["EXPIRE", key, String(ttlSeconds)]);
      return count;
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
  await Promise.all([
    redis.deleteByPrefix("cache:tickets:"),
    redis.deleteByPrefix("cache:rapor:"),
    redis.deleteByPrefix("cache:dinas:"),
  ]);
}
