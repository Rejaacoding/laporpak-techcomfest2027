import express from "express";
import {
  aktivasiMitraController,
  authMeController,
  captureNonceController,
  checkRadiusController,
  createTicketController,
  cronSlaController,
  getMediaSignedUrlController,
  getTicketDetailController,
  healthController,
  juryResetController,
  jurySessionController,
  jurySimulateTimeController,
  listDinasTicketsController,
  listTicketsController,
  makeDinasActionController,
  raporController,
  rateTicketController,
  supportTicketController,
  validateTicketController,
  verifyAuditController,
} from "../controllers/api.controller.js";
import {
  requireAuth,
  requireJuryToken,
  requireRole,
} from "../middlewares/auth.middleware.js";
import {
  blockJuryPartnerActivation,
  enforceJuryMutationRateLimit,
} from "../middlewares/guard.middleware.js";
import {
  enforceCaptureNonceRateLimit,
  enforceCronRateLimit,
  enforceJurySessionBruteForceGuard,
  enforceRadiusCheckRateLimit,
  enforceSignedMediaRateLimit,
} from "../middlewares/security.middleware.js";

const router = express.Router();

// 1. Kesehatan, Autentikasi & Sesi Juri (5 endpoint)
router.get("/health", healthController);
router.get("/auth/me", requireAuth, authMeController);
router.post("/jury/session", enforceJurySessionBruteForceGuard, jurySessionController);
router.post("/jury/tickets/:id/simulate-time", requireJuryToken, enforceJuryMutationRateLimit, jurySimulateTimeController);
router.post("/jury/reset", requireJuryToken, enforceJuryMutationRateLimit, juryResetController);

// Aktivasi kerja sama mitra baru (kode sekali pakai, diblokir 403 untuk sesi juri #23) & Vercel Cron harian
router.post("/aktivasi-mitra", blockJuryPartnerActivation, enforceJurySessionBruteForceGuard, aktivasiMitraController);
router.get("/cron/sla", enforceCronRateLimit, cronSlaController);

// 2. Akses Publik: Peta, Cek Radius Pra-Kamera, Detail, Signed URL, Audit & Rapor (6 endpoint)
router.get("/tickets", listTicketsController);
router.get("/tickets/check-radius", enforceRadiusCheckRateLimit, checkRadiusController);
router.get("/tickets/:id", getTicketDetailController);
router.get("/tickets/:id/media-signed-url", enforceSignedMediaRateLimit, getMediaSignedUrlController);
router.get("/tickets/:id/audit-verify", verifyAuditController);
router.get("/rapor", raporController);

// 3. Kamera & Aksi Warga (4 endpoint)
router.post("/capture-nonce", requireAuth, enforceCaptureNonceRateLimit, captureNonceController);
router.post("/tickets", requireRole("WARGA"), enforceJuryMutationRateLimit, createTicketController);
router.post("/tickets/:id/support", requireRole("WARGA"), enforceJuryMutationRateLimit, supportTicketController);
router.post("/tickets/:id/validate", requireRole("WARGA"), enforceJuryMutationRateLimit, validateTicketController);
router.post("/tickets/:id/rate", requireRole("WARGA"), enforceJuryMutationRateLimit, rateTicketController);

// 4. Meja Kerja Instansi ADMIN_DINAS (2 rute grup: antrean + 8 aksi dinas)
router.get("/dinas/tickets", requireRole("ADMIN_DINAS"), listDinasTicketsController);
for (const action of [
  "process",
  "transfer",
  "out-of-scope",
  "reject-spam",
  "resolve",
  "reprocess-disputed",
  "counter-dispute",
  "resolve-escalated",
]) {
  router.post(
    `/tickets/:id/${action}`,
    requireRole("ADMIN_DINAS"),
    enforceJuryMutationRateLimit,
    makeDinasActionController(action)
  );
}

export default router;
