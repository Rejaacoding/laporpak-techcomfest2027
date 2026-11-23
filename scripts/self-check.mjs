import assert from "node:assert/strict";
import http from "node:http";

process.env.NODE_ENV = "test";

const { prisma } = await import("../src/lib/prisma.js");
const { redis } = await import("../src/lib/redis.js");
const { deleteStorageObjects, uploadStorageObject } = await import("../src/lib/supabase.js");
const { seedDemoData } = await import("../prisma/seed-core.js");
const { default: app } = await import("../api/index.js");

const uploadedTestKeys = [];

// Minimal valid 1x1 lossless WebP (26 bytes, RIFF....WEBP + VP8L) & minimal PDF (%PDF-1.4)
const VALID_WEBP_B64 = Buffer.from(
  "524946461a000000574542505650384c0d0000002f00000010071011118888fe0700",
  "hex"
).toString("base64");
const VALID_PDF_B64 = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8").toString("base64");
const INVALID_FILE_B64 = Buffer.from("not-an-image-payload-1234567890", "utf8").toString("base64");

let server;
let baseUrl;

async function req(method, path, { headers = {}, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function getNonce(userId, fp, actionType, ticketId) {
  const r = await req("POST", "/api/capture-nonce", {
    headers: { "X-Dev-User-Id": userId, "X-Device-Fingerprint": fp },
    body: { actionType, ...(ticketId ? { ticketId } : {}) },
  });
  assert.equal(r.status, 200, `capture-nonce failed: ${JSON.stringify(r.json)}`);
  return r.json.data.captureNonce;
}

async function runTests() {
  // Bersihkan sisa rate-limit & cache test di Upstash Redis agar rerun 100% idempoten
  await Promise.all([
    redis.deleteByPrefix("rl:warga:"),
    redis.deleteByPrefix("rl:jury:"),
    redis.deleteByPrefix("rl:ip:jury_session:"),
    redis.deleteByPrefix("cache:"),
  ]);
  await seedDemoData(prisma, { resetOnlyDemo: true });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;

  // 1. Health & Public Tickets
  const health = await req("GET", "/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.json.data.db, "up");

  const list = await req("GET", "/api/tickets");
  assert.equal(list.status, 200);
  assert.ok(list.json.data.length >= 25, "Expected >= 25 public tickets");
  assert.ok(list.json.data.every((t) => t.status !== "REJECTED_SPAM"), "REJECTED_SPAM must be hidden");
  assert.equal(JSON.stringify(list.json.data).includes("email"), false, "Public tickets must not leak email");
  console.log("PASS [1/15] Health & Public Map Pin Sanitization");

  // 2. Auth /me & Check-Radius Pre-Camera (Geofencing + PostGIS meters)
  const me = await req("GET", "/api/auth/me", { headers: { "X-Dev-User-Id": "demo-warga-pelapor" } });
  assert.equal(me.status, 200);
  assert.equal(me.json.data.aliasName, "Warga-Delta-402");
  assert.equal(me.json.data.activeTicketCount, 2, "Warga Pelapor seed must hold max 2 active tickets (#28)");

  const outOfArea = await req("GET", "/api/tickets/check-radius?lat=-6.2000&lng=106.8166&category=JALAN_BERLUBANG");
  assert.equal(outOfArea.status, 200);
  assert.equal(outOfArea.json.data.insideServiceArea, false);
  assert.equal(outOfArea.json.data.canOpenCamera, false);

  const nearSeed = await req("GET", "/api/tickets/check-radius?lat=-7.4468&lng=112.7183&category=JALAN_BERLUBANG");
  assert.equal(nearSeed.status, 200);
  assert.equal(nearSeed.json.data.insideServiceArea, true);
  assert.ok(nearSeed.json.data.nearbyTickets.some((t) => t.id === "seed-tkt-01" && t.distanceMeters <= 5));
  console.log("PASS [2/15] Auth /me, Geofencing & PostGIS Pre-Camera Check-Radius");

  // 3. Create Ticket: Retry-Safe Nonce (#29), Idempotency-Key & Spatial 3/50m Quota
  const fp1 = "fp-device-arya-01";
  const nonce1 = await getNonce("demo-warga-pelapor", fp1, "CREATE_TICKET");

  // 3a. Bad GPS accuracy (>50m) MUST NOT burn nonce (#29)
  const badGps = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor", "X-Device-Fingerprint": fp1, "Idempotency-Key": "idem-bad-1" },
    body: {
      title: "Lubang Jalan Test Akurasi Buruk",
      description: "Pengujian akurasi GPS lebih dari 50 meter",
      category: "JALAN_BERLUBANG",
      lat: -7.4301,
      lng: 112.7101,
      gpsAccuracyMeters: 85,
      captureNonce: nonce1,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(badGps.status, 422);
  assert.equal(badGps.json.error.code, "GPS_INACCURATE");

  // 3b. Bad magic bytes MUST NOT burn nonce (#29)
  const badMedia = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor", "X-Device-Fingerprint": fp1, "Idempotency-Key": "idem-bad-2" },
    body: {
      title: "Lubang Jalan Test Format Salah",
      description: "Pengujian file teks menyamar sebagai gambar",
      category: "JALAN_BERLUBANG",
      lat: -7.4301,
      lng: 112.7101,
      gpsAccuracyMeters: 15,
      captureNonce: nonce1,
      photoBase64: INVALID_FILE_B64,
    },
  });
  assert.equal(badMedia.status, 422);
  assert.equal(badMedia.json.error.code, "MEDIA_INVALID");

  // 3c. Same nonce STILL WORKS after prior validation errors!
  const created1 = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor", "X-Device-Fingerprint": fp1, "Idempotency-Key": "idem-ok-1" },
    body: {
      title: "Jalan Rusak Parah Dekat Perumahan Taman Pinang",
      description: "Lubang aspal sedalam 15 cm membahayakan pengendara motor malam hari.",
      category: "JALAN_BERLUBANG",
      lat: -7.4301,
      lng: 112.7101,
      gpsAccuracyMeters: 12,
      captureNonce: nonce1,
      photoBase64: VALID_WEBP_B64,
      isLowQualityOverride: true,
    },
  });
  assert.equal(created1.status, 201, `Create failed: ${JSON.stringify(created1.json)}`);
  const newTicketId = created1.json.data.id;

  // 3d. Idempotency replay returns 200 with same ticket ID (no duplicate!)
  const replay = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor", "X-Device-Fingerprint": fp1, "Idempotency-Key": "idem-ok-1" },
    body: {
      title: "Jalan Rusak Parah Dekat Perumahan Taman Pinang",
      description: "Lubang aspal sedalam 15 cm membahayakan pengendara motor malam hari.",
      category: "JALAN_BERLUBANG",
      lat: -7.4301,
      lng: 112.7101,
      gpsAccuracyMeters: 12,
      captureNonce: nonce1,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.json.data.id, newTicketId);

  // 3e. Reusing burned nonce with new Idempotency-Key fails 401
  const reuseNonce = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor", "X-Device-Fingerprint": fp1, "Idempotency-Key": "idem-ok-2" },
    body: {
      title: "Percobaan Pakai Ulang Nonce",
      description: "Seharusnya ditolak karena kupon foto sudah dipakai.",
      category: "JALAN_BERLUBANG",
      lat: -7.4301,
      lng: 112.7101,
      gpsAccuracyMeters: 12,
      captureNonce: nonce1,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(reuseNonce.status, 401);
  assert.equal(reuseNonce.json.error.code, "NONCE_INVALID");
  console.log("PASS [3/15] Retry-Safe Nonce (#29), Idempotency-Key & Magic Bytes");

  // 4. NSFW 2-Zone & 0.1 First-Violation Floor on New 0.5 Account (#4, #8)
  const nonceNewWarn = await getNonce("demo-warga-baru", "fp-baru-1", "CREATE_TICKET");
  const nsfwWarn = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-baru", "X-Device-Fingerprint": "fp-baru-1" },
    body: {
      title: "Tes Zona Peringatan NSFW",
      description: "Skor 0.65 harus minta jepret ulang tanpa penalti.",
      category: "SAMPAH_LIAR",
      lat: -7.435,
      lng: 112.715,
      gpsAccuracyMeters: 15,
      captureNonce: nonceNewWarn,
      photoBase64: VALID_WEBP_B64,
      clientNsfwScore: 0.65,
    },
  });
  assert.equal(nsfwWarn.status, 422);
  assert.equal(nsfwWarn.json.error.code, "NSFW_RETRY");

  const nsfwBlock = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-baru", "X-Device-Fingerprint": "fp-baru-1" },
    body: {
      title: "Tes Zona Blokir NSFW",
      description: "Skor 0.90 langsung tolak dan lantai 0.1 pada akun baru.",
      category: "SAMPAH_LIAR",
      lat: -7.435,
      lng: 112.715,
      gpsAccuracyMeters: 15,
      captureNonce: nonceNewWarn,
      photoBase64: VALID_WEBP_B64,
      clientNsfwScore: 0.9,
    },
  });
  assert.equal(nsfwBlock.status, 422);
  assert.equal(nsfwBlock.json.error.code, "NSFW_BLOCKED");

  const baruAfter = await prisma.user.findUnique({ where: { id: "demo-warga-baru" } });
  assert.equal(baruAfter.trustScore, 0.1, "First violation on 0.5 account must land on 0.1 floor (#8)");
  assert.equal(baruAfter.frozenUntil, null, "First violation on 0.5 account must NOT freeze 7 days (#8)");
  assert.ok(baruAfter.cooldownUntil, "Cooldown 24h must activate");
  console.log("PASS [4/15] NSFW 2-Zone & New Account 0.1 Penalty Floor (#4, #8)");

  // 5. Support Priority (No Self-Support #25)
  const selfSup = await req("POST", `/api/tickets/${newTicketId}/support`, {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor" },
  });
  assert.equal(selfSup.status, 403);

  const validSup = await req("POST", `/api/tickets/${newTicketId}/support`, {
    headers: { "X-Dev-User-Id": "demo-warga-validator" },
  });
  assert.equal(validSup.status, 200);
  assert.equal(validSup.json.data.supportCount, 1);

  const dupSup = await req("POST", `/api/tickets/${newTicketId}/support`, {
    headers: { "X-Dev-User-Id": "demo-warga-validator" },
  });
  assert.equal(dupSup.status, 409);
  console.log("PASS [5/15] Support Priority & Anti-Self-Support (#25)");

  // 6. Dinas Isolation, Transfer (1x), Process & Resolve (<=75m + repairDistanceMeters)
  const crossDept = await req("POST", `/api/tickets/${newTicketId}/process`, {
    headers: { "X-Dev-User-Id": "demo-admin-dishub" },
  });
  assert.equal(crossDept.status, 403, "Dishub must NOT touch DPU ticket");

  const startWork = await req("POST", `/api/tickets/${newTicketId}/process`, {
    headers: { "X-Dev-User-Id": "demo-admin-dpu" },
  });
  assert.equal(startWork.status, 200);
  assert.equal(startWork.json.data.status, "IN_PROGRESS");

  // Resolve > 75m rejected
  const fpDpu = "fp-officer-dpu";
  const nonceResTooFar = await getNonce("demo-admin-dpu", fpDpu, "RESOLVE_TICKET", newTicketId);
  const resTooFar = await req("POST", `/api/tickets/${newTicketId}/resolve`, {
    headers: { "X-Dev-User-Id": "demo-admin-dpu", "X-Device-Fingerprint": fpDpu },
    body: {
      lat: -7.432, // > 200m away
      lng: 112.7101,
      gpsAccuracyMeters: 10,
      captureNonce: nonceResTooFar,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(resTooFar.status, 422);
  assert.equal(resTooFar.json.error.code, "TOO_FAR_DINAS");

  // Resolve <= 75m succeeds (~11m away)
  const nonceResOk = await getNonce("demo-admin-dpu", fpDpu, "RESOLVE_TICKET", newTicketId);
  const resOk = await req("POST", `/api/tickets/${newTicketId}/resolve`, {
    headers: { "X-Dev-User-Id": "demo-admin-dpu", "X-Device-Fingerprint": fpDpu },
    body: {
      lat: -7.4302,
      lng: 112.7101,
      gpsAccuracyMeters: 10,
      captureNonce: nonceResOk,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(resOk.status, 200);
  assert.equal(resOk.json.data.status, "PENDING_VALIDATION");
  assert.ok(resOk.json.data.repairDistanceMeters <= 25, "Expected repairDistanceMeters <= 25m");
  console.log("PASS [6/15] Dinas Isolation, Process & PostGIS <= 75m Resolve");

  // 7. Public Validation: Phase 1 Reporter Block, Dispute -> Appeal (1x) -> Quorum Close + Disputer Penalty (#1, #16, #20)
  const repPhase1 = await req("POST", `/api/tickets/${newTicketId}/validate`, {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor", "X-Device-Fingerprint": "fp-rep-1" },
    body: { type: "CONFIRM_RESOLVED", lat: -7.4301, lng: 112.7101, gpsAccuracyMeters: 10 },
  });
  assert.equal(repPhase1.status, 403, "Reporter cannot CONFIRM_RESOLVED in hours 0-48");

  // Round 1 Dispute by demo-warga-validator
  const fpVal1 = "fp-val-1";
  const nonceDisp = await getNonce("demo-warga-validator", fpVal1, "DISPUTE_TICKET", newTicketId);
  const disp1 = await req("POST", `/api/tickets/${newTicketId}/validate`, {
    headers: { "X-Dev-User-Id": "demo-warga-validator", "X-Device-Fingerprint": fpVal1 },
    body: {
      type: "DISPUTE_FALSE",
      lat: -7.4301,
      lng: 112.7101,
      gpsAccuracyMeters: 12,
      captureNonce: nonceDisp,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(disp1.status, 200);
  assert.equal(disp1.json.data.status, "DISPUTED");

  // Dinas counters with Appeal (Jalur B, isAppealRound = true)
  const nonceAppeal = await getNonce("demo-admin-dpu", fpDpu, "APPEAL_TICKET", newTicketId);
  const appeal = await req("POST", `/api/tickets/${newTicketId}/counter-dispute`, {
    headers: { "X-Dev-User-Id": "demo-admin-dpu", "X-Device-Fingerprint": fpDpu },
    body: {
      lat: -7.4301,
      lng: 112.7101,
      gpsAccuracyMeters: 10,
      captureNonce: nonceAppeal,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(appeal.status, 200);
  assert.equal(appeal.json.data.isAppealRound, true);

  // Round 1 disputer BLOCKED from voting in appeal round (#1/#16)
  const blockedDisputer = await req("POST", `/api/tickets/${newTicketId}/validate`, {
    headers: { "X-Dev-User-Id": "demo-warga-validator", "X-Device-Fingerprint": fpVal1 },
    body: { type: "CONFIRM_RESOLVED", lat: -7.4301, lng: 112.7101, gpsAccuracyMeters: 10 },
  });
  assert.equal(blockedDisputer.status, 403);

  // Two OTHER citizens confirm (>=2.0 weight & >=2 distinct accounts/fingerprints) -> CLOSED + penalize Round 1 disputer (#20)
  const v1 = await req("POST", `/api/tickets/${newTicketId}/validate`, {
    headers: { "X-Dev-User-Id": "demo-warga-2", "X-Device-Fingerprint": "fp-w2" },
    body: { type: "CONFIRM_RESOLVED", lat: -7.4301, lng: 112.7101, gpsAccuracyMeters: 10 },
  });
  assert.equal(v1.status, 200);
  assert.equal(v1.json.data.closed, false);

  const v2 = await req("POST", `/api/tickets/${newTicketId}/validate`, {
    headers: { "X-Dev-User-Id": "demo-warga-3", "X-Device-Fingerprint": "fp-w3" },
    body: { type: "CONFIRM_RESOLVED", lat: -7.4301, lng: 112.7101, gpsAccuracyMeters: 10 },
  });
  assert.equal(v2.status, 200);
  assert.equal(v2.json.data.status, "CLOSED");

  const penalizedVal = await prisma.user.findUnique({ where: { id: "demo-warga-validator" } });
  assert.equal(penalizedVal.trustScore, 0.6, "Disputer losing appeal round must drop 1.1 -> 0.6 (#20)");
  console.log("PASS [7/15] Quorum >=2.0 & >=2 Accounts, Dispute, Appeal Lock & Penalty (#1, #16, #20)");

  // 8. Reporter 48-72h Free-Radius 1-Tap Confirm (seed-tkt-02) & Escalated Berita Acara (seed-tkt-14)
  const rep48 = await req("POST", "/api/tickets/seed-tkt-02/validate", {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor", "X-Device-Fingerprint": "fp-rep-48" },
    body: { type: "CONFIRM_RESOLVED" },
  });
  assert.equal(rep48.status, 200);
  assert.equal(rep48.json.data.status, "CLOSED");

  const nonceEsc = await getNonce("demo-admin-satpolpp", "fp-satpol", "RESOLVE_ESCALATED", "seed-tkt-14");
  const escRes = await req("POST", "/api/tickets/seed-tkt-14/resolve-escalated", {
    headers: { "X-Dev-User-Id": "demo-admin-satpolpp", "X-Device-Fingerprint": "fp-satpol" },
    body: {
      lat: -7.2588,
      lng: 112.7377,
      gpsAccuracyMeters: 10,
      captureNonce: nonceEsc,
      photoBase64: VALID_WEBP_B64,
      beritaAcaraBase64: VALID_PDF_B64,
    },
  });
  assert.equal(escRes.status, 200);
  assert.equal(escRes.json.data.status, "CLOSED");
  assert.equal(escRes.json.data.closedResolutionNote, "Diselesaikan via Berita Acara Eskalasi");
  console.log("PASS [8/15] Reporter 48-72h Free-Radius Confirm & ESCALATED Berita Acara");

  // 9. HMAC-SHA256 Audit Chain Verify & Tamper Detection (#22, #31)
  const auditOk = await req("GET", `/api/tickets/${newTicketId}/audit-verify`);
  assert.equal(auditOk.status, 200);
  assert.equal(auditOk.json.data.verifiedChain, true);
  assert.ok(auditOk.json.data.totalEntries >= 5);
  assert.equal(JSON.stringify(auditOk.json.data).includes("demo-warga-pelapor"), false, "Audit must never leak raw userId");

  const firstLog = await prisma.auditLog.findFirst({
    where: { ticketId: newTicketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  await prisma.auditLog.update({ where: { id: firstLog.id }, data: { action: "TAMPERED_ACTION" } });
  const auditTampered = await req("GET", `/api/tickets/${newTicketId}/audit-verify`);
  assert.equal(auditTampered.status, 200);
  assert.equal(auditTampered.json.data.verifiedChain, false);
  assert.equal(auditTampered.json.data.tamperedAtIndex, 0);
  console.log("PASS [9/15] HMAC-SHA256 Audit Chain Verification & Tamper Detection (#22, #31)");

  // 10. Jury Session, Simulate-Time Lazy Eval (+25h OVERDUE, +25h DISPUTED Auto-Rework #14), Isolation & Clean Reset (#5, #13)
  const realUser = await prisma.user.upsert({
    where: { id: "real-citizen-preserve-test" },
    create: {
      id: "real-citizen-preserve-test",
      email: "warga.asli.test@example.com",
      aliasName: "Warga-Asli-999",
      role: "WARGA",
      isDemoData: false,
      trustScore: 1.0,
    },
    update: {},
  });

  const jurySess = await req("POST", "/api/jury/session", {
    body: { juryToken: process.env.JURY_SECRET_TOKEN || "laporpak-techcomfest-2027-demo" },
  });
  assert.equal(jurySess.status, 200);
  const juryToken = jurySess.json.data.sessionToken;

  // Simulate +25h on emergency OPEN ticket (seed-tkt-03) -> OVERDUE
  const simOverdue = await req("POST", "/api/jury/tickets/seed-tkt-03/simulate-time", {
    headers: { "X-Jury-Token": juryToken },
    body: { shiftHours: 25 },
  });
  assert.equal(simOverdue.status, 200);
  assert.equal(simOverdue.json.data.status, "OVERDUE");

  // Simulate +25h on DISPUTED ticket (seed-tkt-13) -> auto-rework IN_PROGRESS (#14)
  const simDisputed = await req("POST", "/api/jury/tickets/seed-tkt-13/simulate-time", {
    headers: { "X-Jury-Token": juryToken },
    body: { shiftHours: 25 },
  });
  assert.equal(simDisputed.status, 200);
  assert.equal(simDisputed.json.data.status, "IN_PROGRESS");

  // Reset Demo restores 4 departments to 80.0 AND preserves real citizen account (#5, #13)
  const reset = await req("POST", "/api/jury/reset", { headers: { "X-Jury-Token": juryToken } });
  assert.equal(reset.status, 200);

  const realStillExists = await prisma.user.findUnique({ where: { id: realUser.id } });
  assert.ok(realStillExists, "Reset Demo must NEVER delete real citizen accounts (isDemoData: false)");
  await prisma.user.delete({ where: { id: realUser.id } });

  const rapor = await req("GET", "/api/rapor");
  assert.equal(rapor.status, 200);
  assert.equal(rapor.json.data.departments.length, 4);
  assert.ok(rapor.json.data.departments.every((d) => d.integrityScore === 80), "All 4 depts must reset cleanly to 80.0");
  console.log("PASS [10/15] Jury Session, Simulate-Time Lazy Eval, Real-User Preservation & Rapor");

  // 11. All Remaining Dinas Actions (queue, transfer 1x, out-of-scope, reject-spam, reprocess-disputed) & media-signed-url
  const dinasQueue = await req("GET", "/api/dinas/tickets", { headers: { "X-Dev-User-Id": "demo-admin-dpu" } });
  assert.equal(dinasQueue.status, 200);
  assert.ok(dinasQueue.json.data.length > 0);
  assert.equal(dinasQueue.json.data[0].status, "OVERDUE", "Dinas queue must prioritize OVERDUE first");

  const transferOk = await req("POST", "/api/tickets/seed-tkt-04/transfer", {
    headers: { "X-Dev-User-Id": "demo-admin-dishub" },
    body: { targetDepartmentId: "SATPOLPP", reason: "Kabel terikat reklame liar yang menjadi kewenangan penertiban Satpol PP." },
  });
  assert.equal(transferOk.status, 200);
  assert.equal(transferOk.json.data.departmentId, "SATPOLPP");

  const transfer2nd = await req("POST", "/api/tickets/seed-tkt-04/transfer", {
    headers: { "X-Dev-User-Id": "demo-admin-satpolpp" },
    body: { targetDepartmentId: "DISHUB", reason: "Mencoba oper balik kedua kalinya harus ditolak maksimal 1x." },
  });
  assert.equal(transfer2nd.status, 409, "2nd transfer must fail (max 1x)");

  const oos = await req("POST", "/api/tickets/seed-tkt-22/out-of-scope", {
    headers: { "X-Dev-User-Id": "demo-admin-dlh" },
    body: { agency: "BBWS", reason: "Sampah berada di badan sungai besar kewenangan BBWS Brantas." },
  });
  assert.equal(oos.status, 200);
  assert.equal(oos.json.data.status, "OUT_OF_SCOPE");

  const spam = await req("POST", "/api/tickets/seed-tkt-23/reject-spam", {
    headers: { "X-Dev-User-Id": "demo-admin-satpolpp" },
    body: { reason: "Foto buram tidak menunjukkan reklame melainkan jalan kosong." },
  });
  assert.equal(spam.status, 200);
  assert.equal(spam.json.data.status, "REJECTED_SPAM");
  const spammedUser = await prisma.user.findUnique({ where: { id: "demo-warga-2" } });
  assert.ok(spammedUser.cooldownUntil, "REJECTED_SPAM must trigger 24h cooldown on reporter");

  const reprocess = await req("POST", "/api/tickets/seed-tkt-13/reprocess-disputed", {
    headers: { "X-Dev-User-Id": "demo-admin-dpu" },
  });
  assert.equal(reprocess.status, 200);
  assert.equal(reprocess.json.data.status, "IN_PROGRESS");

  // Uji Signed URL nyata pada bucket privat (laporpak-private) + bersihkan setelah tes
  const privKey = `private/nsfw/self-check-${Date.now()}.webp`;
  await uploadStorageObject(privKey, Buffer.from(VALID_WEBP_B64, "base64"), "image/webp", { isPrivate: true });
  uploadedTestKeys.push(privKey);
  await prisma.ticket.update({
    where: { id: "seed-tkt-01" },
    data: { beforePhotoKey: privKey, isNsfwPendingReview: true, beforePhotoUrl: "" },
  });
  const signed = await req("GET", "/api/tickets/seed-tkt-01/media-signed-url?type=before");
  assert.equal(signed.status, 200, `media-signed-url failed: ${JSON.stringify(signed.json)}`);
  assert.equal(signed.json.data.expiresInSeconds, 60);
  assert.ok(signed.json.data.signedUrl.length > 10);
  console.log("PASS [11/15] Dinas Queue, Transfer 1x, Out-of-Scope, Reject-Spam (+Cooldown), Reprocess & Private Signed URL");

  // 12. Spatial Quota 3/50m Enforcement, 5-Active Account Quota (#24) & Impossible Travel (>120 km/h)
  const quotaLat = -7.4155;
  const quotaLng = 112.7155;
  const actors = ["demo-warga-pelapor", "demo-warga-validator", "demo-warga-baru"];
  for (let i = 0; i < 3; i++) {
    const n = await getNonce(actors[i], `fp-q-${i}`, "CREATE_TICKET");
    const r = await req("POST", "/api/tickets", {
      headers: { "X-Dev-User-Id": actors[i], "X-Device-Fingerprint": `fp-q-${i}` },
      body: {
        title: `Kuota Spasial Test Tiket #${i + 1}`,
        description: "Pengujian batas maksimal 3 tiket kategori sama dalam radius 50 meter.",
        category: "SAMPAH_LIAR",
        lat: quotaLat,
        lng: quotaLng,
        gpsAccuracyMeters: 10,
        captureNonce: n,
        photoBase64: VALID_WEBP_B64,
      },
    });
    assert.equal(r.status, 201, `Quota setup #${i + 1} failed: ${JSON.stringify(r.json)}`);
  }

  // Verify 5-active account quota (#24) on demo-warga-3 (holds 5 active seeded tickets)
  const nMax5 = await getNonce("demo-warga-3", "fp-max5", "CREATE_TICKET");
  const blocked5 = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-3", "X-Device-Fingerprint": "fp-max5" },
    body: {
      title: "Tes Batas 5 Tiket Aktif Akun Warga",
      description: "Akun warga dengan 5 laporan aktif harus tertahan 409 QUOTA_ACCOUNT_ACTIVE.",
      category: "PJU_MATI",
      lat: -7.419,
      lng: 112.719,
      gpsAccuracyMeters: 10,
      captureNonce: nMax5,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(blocked5.status, 409);
  assert.equal(blocked5.json.error.code, "QUOTA_ACCOUNT_ACTIVE");

  const n4 = await getNonce("demo-warga-pelapor", "fp-q-4", "CREATE_TICKET");
  const blocked4 = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor", "X-Device-Fingerprint": "fp-q-4" },
    body: {
      title: "Kuota Spasial Test Tiket Ke-4 Harus Ditolak",
      description: "Seharusnya terkena 409 QUOTA_RADIUS_FULL beserta daftar nearbyTickets.",
      category: "SAMPAH_LIAR",
      lat: quotaLat,
      lng: quotaLng,
      gpsAccuracyMeters: 10,
      captureNonce: n4,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(blocked4.status, 409);
  assert.equal(blocked4.json.error.code, "QUOTA_RADIUS_FULL");
  assert.ok(blocked4.json.error.details.nearbyTickets.length >= 3);

  // Impossible travel: demo-warga-pelapor just acted at (-7.4155, 112.7155) 10s ago -> jump ~22km to North Surabaya
  await prisma.user.update({
    where: { id: "demo-warga-pelapor" },
    data: { lastGpsLat: quotaLat, lastGpsLng: quotaLng, lastGpsAccuracy: 10, lastGpsAt: new Date(Date.now() - 10_000) },
  });
  const nImp = await getNonce("demo-warga-pelapor", "fp-imp-1", "CREATE_TICKET");
  const impRes = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": "demo-warga-pelapor", "X-Device-Fingerprint": "fp-imp-1" },
    body: {
      title: "Tes Lompat Lokasi Mustahil",
      description: "Berpindah 22 km dalam 10 detik harus diblokir Impossible Travel.",
      category: "PJU_MATI",
      lat: -7.22,
      lng: 112.74,
      gpsAccuracyMeters: 10,
      captureNonce: nImp,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(impRes.status, 422);
  assert.equal(impRes.json.error.code, "IMPOSSIBLE_TRAVEL");
  console.log("PASS [12/15] Spatial 3/50m Quota (409) & Impossible Travel (>120 km/h)");

  // 13. AUTO_CLOSED (+0 Dinas Bonus #8) & Sticky isChronicOverdue (#17, #19)
  const dishubBefore = await prisma.department.findUnique({ where: { id: "DISHUB" } });
  const simAutoClose = await req("POST", "/api/jury/tickets/seed-tkt-02/simulate-time", {
    headers: { "X-Jury-Token": juryToken },
    body: { shiftHours: 25 }, // 50h + 25h = 75h > 72h -> AUTO_CLOSED
  });
  assert.equal(simAutoClose.status, 200);
  assert.equal(simAutoClose.json.data.status, "AUTO_CLOSED");
  const dishubAfter = await prisma.department.findUnique({ where: { id: "DISHUB" } });
  assert.equal(dishubAfter.integrityScore, dishubBefore.integrityScore, "AUTO_CLOSED must award 0 bonus to department (#8)");

  // Sticky isChronicOverdue on seed-tkt-10 (already chronic) survives resolve -> PENDING_VALIDATION
  const nChron = await getNonce("demo-admin-dishub", "fp-chron", "RESOLVE_TICKET", "seed-tkt-10");
  const resChron = await req("POST", "/api/tickets/seed-tkt-10/resolve", {
    headers: { "X-Dev-User-Id": "demo-admin-dishub", "X-Device-Fingerprint": "fp-chron" },
    body: {
      lat: -7.2815,
      lng: 112.7322,
      gpsAccuracyMeters: 10,
      captureNonce: nChron,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(resChron.status, 200);
  const chronRow = await prisma.ticket.findUnique({ where: { id: "seed-tkt-10" } });
  assert.equal(chronRow.isChronicOverdue, true, "isChronicOverdue must stay sticky true after resolve (#19)");
  console.log("PASS [13/15] AUTO_CLOSED (+0 Bonus #8) & Sticky isChronicOverdue (#17, #19)");

  // 14. Jury Isolation on Real Data (403 #13) & /aktivasi-mitra Block (403 #23) + Clean Final Reset
  const realUser2 = await prisma.user.create({
    data: { id: "real-user-iso-14", email: "iso14@example.com", aliasName: "Warga-Iso-14", role: "WARGA", isDemoData: false, trustScore: 1.0 },
  });
  const nReal = await getNonce(realUser2.id, "fp-real-14", "CREATE_TICKET");
  const realTkt = await req("POST", "/api/tickets", {
    headers: { "X-Dev-User-Id": realUser2.id, "X-Device-Fingerprint": "fp-real-14" },
    body: {
      title: "Laporan Asli Warga Non-Demo",
      description: "Data asli ini tidak boleh disentuh oleh sesi simulasi juri.",
      category: "PJU_MATI",
      lat: -7.27,
      lng: 112.76,
      gpsAccuracyMeters: 10,
      captureNonce: nReal,
      photoBase64: VALID_WEBP_B64,
    },
  });
  assert.equal(realTkt.status, 201);
  const realTicketId = realTkt.json.data.id;

  const juryMutateReal = await req("POST", `/api/tickets/${realTicketId}/support`, {
    headers: { "X-Jury-Token": juryToken, "X-Jury-Role": "WARGA_VALIDATOR" },
  });
  assert.equal(juryMutateReal.status, 403);
  assert.equal(juryMutateReal.json.error.code, "JURY_REAL_DATA_BLOCKED");

  const juryMitra = await req("POST", "/api/aktivasi-mitra", { headers: { "X-Jury-Token": juryToken } });
  assert.equal(juryMitra.status, 403);

  // Bersihkan seluruh file uji di Supabase Storage sebelum & sesudah reset demo agar bucket cloud tetap bersih
  const allUploaded = await prisma.ticket.findMany({
    where: {
      OR: [
        { beforePhotoKey: { startsWith: "tickets/" } },
        { afterPhotoKey: { startsWith: "tickets/" } },
        { beritaAcaraKey: { startsWith: "berita-acara/" } },
        { beforePhotoKey: { startsWith: "private/" } },
      ],
    },
    select: { beforePhotoKey: true, afterPhotoKey: true, beritaAcaraKey: true },
  });
  for (const row of allUploaded) {
    if (row.beforePhotoKey) uploadedTestKeys.push(row.beforePhotoKey);
    if (row.afterPhotoKey) uploadedTestKeys.push(row.afterPhotoKey);
    if (row.beritaAcaraKey) uploadedTestKeys.push(row.beritaAcaraKey);
  }
  const valKeys = await prisma.ticketValidation.findMany({
    where: { evidencePhotoKey: { not: null } },
    select: { evidencePhotoKey: true },
  });
  for (const v of valKeys) {
    if (v.evidencePhotoKey) uploadedTestKeys.push(v.evidencePhotoKey);
  }

  // Cleanup test real ticket & restore clean demo seed for dev server
  await prisma.ticket.delete({ where: { id: realTicketId } });
  await prisma.user.delete({ where: { id: realUser2.id } });
  await req("POST", "/api/jury/reset", { headers: { "X-Jury-Token": juryToken } });
  console.log("PASS [14/15] Jury 403 Real-Data Isolation (#13), /aktivasi-mitra Block (#23) & Clean Reset");

  // 15. Security Hardening: RLS Enabled (6 Tables), CORS Allowlist, X-Dev-User-Id Vercel Block & Brute-Force Guard
  const rlsRows = await prisma.$queryRaw`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('Department', 'User', 'Ticket', 'TicketSupport', 'TicketValidation', 'AuditLog')
  `;
  assert.equal(rlsRows.length, 6, "All 6 tables must exist in public schema");
  assert.ok(rlsRows.every((r) => r.relrowsecurity === true), "RLS must be enabled on all 6 tables");

  const evilCors = await req("GET", "/api/tickets", {
    headers: { Origin: "https://evil-vibehack.example" },
  });
  assert.equal(evilCors.status, 403, "Unknown cross-origin browser request must be blocked");

  const localCors = await req("GET", "/api/tickets", {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(localCors.status, 200);

  const prevVercel = process.env.VERCEL;
  const prevJuryEnv = process.env.JURY_SECRET_TOKEN;
  try {
    process.env.VERCEL = "1";
    const devOnVercel = await req("GET", "/api/auth/me", {
      headers: { "X-Dev-User-Id": "demo-warga-pelapor" },
    });
    assert.equal(devOnVercel.status, 401, "X-Dev-User-Id must NEVER work when VERCEL env is set");

    delete process.env.JURY_SECRET_TOKEN;
    const { getJurySecret } = await import("../src/lib/crypto.js");
    assert.throws(() => getJurySecret(), /Missing required secret env: JURY_SECRET_TOKEN/);
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevJuryEnv !== undefined) process.env.JURY_SECRET_TOKEN = prevJuryEnv;
  }

  let rateLimited = false;
  for (let i = 0; i < 11; i++) {
    const attempt = await req("POST", "/api/jury/session", { body: { juryToken: "wrong-token-guess" } });
    if (attempt.status === 429) {
      rateLimited = true;
      break;
    }
  }
  assert.equal(rateLimited, true, "Brute-force guard must trigger 429 on /api/jury/session after 10 attempts");
  await redis.deleteByPrefix("rl:ip:jury_session:");
  console.log("PASS [15/15] RLS Lockdown (6 Tables), CORS Allowlist, Vercel Dev-Auth Block & Brute-Force Guard");

  console.log("\nALL 15 END-TO-END BACKEND & SECURITY SUITES PASSED (ZERO ERRORS).");
}

runTests()
  .catch((err) => {
    console.error("SELF-CHECK FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (uploadedTestKeys.length > 0) {
      await deleteStorageObjects(uploadedTestKeys).catch(() => {});
    }
    if (server) await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  });
