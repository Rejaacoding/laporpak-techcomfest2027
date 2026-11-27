const API_BASE = "/api";

export const JURY_TOKEN_KEY = "laporpak_jury_token";
export const JURY_ROLE_KEY = "laporpak_jury_role";
const INSTALL_ID_KEY = "laporpak_install_id_v1";
const fpCache = new Map();
const inFlightGets = new Map();

function getClientInstallId() {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem(INSTALL_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `inst-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(INSTALL_ID_KEY, id);
    }
    return id;
  } catch {
    return "ephemeral";
  }
}

export async function getDeviceFingerprint(juryOverride = {}) {
  if (typeof window === "undefined") return "fp-ssr";
  const state = getJurySessionState();
  const juryToken = juryOverride.juryToken ?? state.juryToken;
  const juryRole = juryOverride.juryRole ?? state.juryRole;
  const scope = juryToken ? `jury:${juryRole || "WARGA_PELAPOR"}` : "citizen";
  if (fpCache.has(scope)) return fpCache.get(scope);

  const installId = getClientInstallId();
  const screenSize =
    typeof window.screen !== "undefined"
      ? `${window.screen.width}x${window.screen.height}`
      : "0x0";
  const raw = `${installId}|${navigator.userAgent || ""}|${screenSize}|${navigator.hardwareConcurrency || 0}|${scope}`;

  let fp = "";
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    fp = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } else {
    // shortcut: fallback non-HTTPS dev hash; upgrade tidak perlu karena produksi selalu HTTPS
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    fp = `fp-${(h >>> 0).toString(16)}-${installId.slice(0, 16)}`;
  }

  fpCache.set(scope, fp);
  return fp;
}

export function getJurySessionState() {
  if (typeof window === "undefined") {
    return { juryToken: "", juryRole: "WARGA_PELAPOR" };
  }
  return {
    juryToken: sessionStorage.getItem(JURY_TOKEN_KEY) || "",
    juryRole: sessionStorage.getItem(JURY_ROLE_KEY) || "WARGA_PELAPOR",
  };
}

export function getJuryHeaders(overrides = {}) {
  const state = getJurySessionState();
  const juryToken = overrides.juryToken ?? state.juryToken;
  const juryRole = overrides.juryRole ?? state.juryRole;
  if (!juryToken) return {};
  return {
    "X-Jury-Token": juryToken,
    "X-Jury-Role": juryRole || "WARGA_PELAPOR",
  };
}

export function clearJurySessionState() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(JURY_TOKEN_KEY);
  sessionStorage.removeItem(JURY_ROLE_KEY);
}

export function dispatchJuryEvent(type, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`laporpak:jury:${type}`, { detail }));
}

export function onJuryEvent(type, handler) {
  if (typeof window === "undefined") return () => {};
  const listener = (event) => handler(event.detail);
  window.addEventListener(`laporpak:jury:${type}`, listener);
  return () => window.removeEventListener(`laporpak:jury:${type}`, listener);
}

export async function fetchSampleAsBase64(samplePath) {
  const res = await fetch(samplePath);
  if (!res.ok) {
    throw new Error("Gagal memuat berkas foto sampel simulasi.");
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Gagal membaca berkas foto sampel."));
    reader.readAsDataURL(blob);
  });
}

function toQueryString(params = {}) {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function apiRequest(
  path,
  { method = "GET", token, body, idempotencyKey, headers = {}, juryOverride } = {}
) {
  const upperMethod = String(method || "GET").toUpperCase();
  const juryHeaders = getJuryHeaders(juryOverride);
  const canDedup = upperMethod === "GET" && body === undefined;
  const dedupKey = canDedup
    ? `${path}|${token ? token.slice(-12) : "anon"}|${juryHeaders["X-Jury-Role"] || ""}`
    : "";

  if (canDedup && inFlightGets.has(dedupKey)) {
    return inFlightGets.get(dedupKey);
  }

  const run = (async () => {
    const deviceFp = await getDeviceFingerprint(juryOverride);
    const finalHeaders = {
      "X-Device-Fingerprint": deviceFp,
      ...juryHeaders,
      ...headers,
    };
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
    if (idempotencyKey) {
      finalHeaders["Idempotency-Key"] = idempotencyKey;
    }
    if (body !== undefined && !finalHeaders["Content-Type"]) {
      finalHeaders["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method: upperMethod,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(
        payload?.error?.message || payload?.message || "Terjadi kendala saat menghubungi server."
      );
      err.status = res.status;
      err.code = payload?.error?.code || payload?.code;
      err.retryable = Boolean(payload?.error?.retryable);
      err.details = payload?.error?.details;
      err.data = payload;
      throw err;
    }

    return payload?.data;
  })();

  if (!canDedup) return run;

  inFlightGets.set(dedupKey, run);
  try {
    return await run;
  } finally {
    inFlightGets.delete(dedupKey);
  }
}

// 1. Kesehatan, Autentikasi & Aktivasi Mitra
export const getHealth = () => apiRequest("/health");
export const getAuthMe = (token, juryOverride) =>
  apiRequest("/auth/me", { token, juryOverride });
export const activatePartner = (body) =>
  apiRequest("/aktivasi-mitra", { method: "POST", body });

// 2. Endpoint Publik: Peta, Pra-Kamera, Detail, Signed URL, Audit & Rapor
export const listTickets = (filters = {}) =>
  apiRequest(`/tickets${toQueryString(filters)}`);
export const checkTicketRadius = ({ lat, lng, category }) =>
  apiRequest(`/tickets/check-radius${toQueryString({ lat, lng, category })}`);
export const getTicketDetail = (ticketId, query = {}, token) =>
  apiRequest(`/tickets/${encodeURIComponent(ticketId)}${toQueryString(query)}`, { token });
export const getTicketMediaSignedUrl = (ticketId, type = "before", token) =>
  apiRequest(
    `/tickets/${encodeURIComponent(ticketId)}/media-signed-url${toQueryString({ type })}`,
    { token }
  );
export const verifyTicketAudit = (ticketId) =>
  apiRequest(`/tickets/${encodeURIComponent(ticketId)}/audit-verify`);
export const getRapor = (filters = {}) =>
  apiRequest(`/rapor${toQueryString(filters)}`);

// 3. Aksi Warga & Kamera
/** @type {(options: { actionType: string, ticketId?: string | null }, token?: string | null) => Promise<any>} */
export const issueCaptureNonce = ({ actionType, ticketId = null }, token) =>
  apiRequest("/capture-nonce", {
    method: "POST",
    token,
    body: ticketId ? { actionType, ticketId } : { actionType },
  });
export const createTicket = (body, { token, idempotencyKey } = {}) =>
  apiRequest("/tickets", { method: "POST", token, idempotencyKey, body });
export const supportTicket = (ticketId, token) =>
  apiRequest(`/tickets/${encodeURIComponent(ticketId)}/support`, { method: "POST", token });
export const validateTicket = (ticketId, body, token) =>
  apiRequest(`/tickets/${encodeURIComponent(ticketId)}/validate`, {
    method: "POST",
    token,
    body,
  });
export const rateTicket = (ticketId, body, token) =>
  apiRequest(`/tickets/${encodeURIComponent(ticketId)}/rate`, {
    method: "POST",
    token,
    body,
  });

// 4. Meja Kerja Instansi ADMIN_DINAS (Antrean + 8 Aksi)
export const listDinasTickets = (filters = {}, token) =>
  apiRequest(`/dinas/tickets${toQueryString(filters)}`, { token });
export const executeDinasAction = (ticketId, action, body = {}, token) =>
  apiRequest(`/tickets/${encodeURIComponent(ticketId)}/${encodeURIComponent(action)}`, {
    method: "POST",
    token,
    body,
  });

// 5. Panel Simulasi Juri
export const createJurySession = (juryToken) =>
  apiRequest("/jury/session", { method: "POST", body: { juryToken } });
export const simulateTicketTime = (ticketId, shiftHours, juryToken) =>
  apiRequest(`/jury/tickets/${encodeURIComponent(ticketId)}/simulate-time`, {
    method: "POST",
    body: { shiftHours: Number(shiftHours) },
    juryOverride: juryToken ? { juryToken } : undefined,
  });
export const resetDemoData = (juryToken) =>
  apiRequest("/jury/reset", {
    method: "POST",
    juryOverride: juryToken ? { juryToken } : undefined,
  });
