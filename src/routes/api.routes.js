import express from "express";
import {
  authMeController,
  captureNonceController,
  checkRadiusController,
  createTicketController,
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
  enforceJurySessionBruteForceGuard,
  enforceSignedMediaRateLimit,
} from "../middlewares/security.middleware.js";

const router = express.Router();

// 1. Kesehatan, Autentikasi & Sesi Juri (5 endpoint)
router.get("/health", healthController);
router.get("/auth/me", requireAuth, authMeController);
router.post("/jury/session", enforceJurySessionBruteForceGuard, jurySessionController);
router.post("/jury/tickets/:id/simulate-time", requireJuryToken, enforceJuryMutationRateLimit, jurySimulateTimeController);
router.post("/jury/reset", requireJuryToken, enforceJuryMutationRateLimit, juryResetController);

// Blokir akses sesi juri ke endpoint aktivasi mitra (Bonus Minggu 4)
router.all("/aktivasi-mitra", blockJuryPartnerActivation, (_req, res) => {
  res.status(501).json({
    ok: false,
    error: { code: "NOT_IMPLEMENTED", message: "Aktivasi mitra baru masuk tahap Bonus Minggu 4.", retryable: false },
  });
});

// 2. Akses Publik: Peta, Cek Radius Pra-Kamera, Detail, Signed URL, Audit & Rapor (6 endpoint)
router.get("/tickets", listTicketsController);
router.get("/tickets/check-radius", checkRadiusController);
router.get("/tickets/:id", getTicketDetailController);
router.get("/tickets/:id/media-signed-url", enforceSignedMediaRateLimit, getMediaSignedUrlController);
router.get("/tickets/:id/audit-verify", verifyAuditController);
router.get("/rapor", raporController);

// 3. Kamera & Aksi Warga (4 endpoint)
router.post("/capture-nonce", requireAuth, captureNonceController);
router.post("/tickets", requireRole("WARGA"), enforceJuryMutationRateLimit, createTicketController);
router.post("/tickets/:id/support", requireRole("WARGA"), enforceJuryMutationRateLimit, supportTicketController);
router.post("/tickets/:id/validate", requireRole("WARGA"), enforceJuryMutationRateLimit, validateTicketController);

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
