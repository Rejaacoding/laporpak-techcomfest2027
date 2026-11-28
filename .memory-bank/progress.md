# Progress — Status Fitur & Backlog LaporPAK!

## Selesai & Terverifikasi (`[x]`)
- [x] **Database & Security Lockdown (`US-001`):** Skema Prisma + PostGIS + index GIST, RLS lockdown di 7 tabel (`401` untuk public anon key), seed 4 instansi & 28 tiket demo + 4 rating awal.
- [x] **Core Backend Workflows (`US-003`, `US-004`, `US-005`, `US-006`, `US-007`):**
  - Pre-camera radius check (`50 m` / `30 m`), pembuatan tiket atomik idempoten (`Idempotency-Key` + `CAPTURE_NONCE`), dukungan prioritas (`10` dukungan pangkas 15% sisa SLA).
  - 8 aksi Dinas di `/dinas` (`process`, `transfer`, `out-of-scope`, `reject-spam`, `resolve`, `reprocess-disputed`, `counter-dispute`, `resolve-escalated` PDF).
  - Kuorum warga sekitar berbasis trust weight + `X-Device-Fingerprint`, *Lazy Evaluation*, segel `HMAC-SHA256`, `17/17` suite E2E `scripts/self-check.mjs` lulus.
- [x] **Penguatan Anti-Buzzer v3.5 (`#33`–`#37`):** Cooling window `6 jam`, jangkar saksi awal (`2.0` vs `3.0` poin), shadow-zero anti-kolusi, penanda *fast resolve anomaly* `< 10 menit`, `DepartmentRating` + API rating.
- [x] **Kamera & Panel Simulasi Juri (`US-009`, `US-010`):** `LiveCameraCapture.jsx` (blokir virtual camera, watermark koordinat, kecerahan BT.601 siang `35` / malam `12`, NSFWJS client + server guard) & `JuryPanel.jsx` `5` alat + 16 foto `.webp` kalibrasi + PDF sample.
- [x] **Seluruh 9 Halaman Frontend Live (`US-008`, `US-011`, `US-013`, `US-014`, `US-015`):** `/`, `/peta`, `/lapor`, `/tiket/:id`, `/catatan`, `/login`, `/dinas`, `/dinas/peta`, `/dinas/catatan`, ditambah `ProfileDrawer` global dan 7/7 unit test frontend + `tsc --noEmit` 0 error.
- [x] **Peta Nyata, Live Sync, Upstash Redis & Hardening (`ff6e639`..`b98c8fa`):** 6 halaman peta pakai `CivicLeafletMap` (Esri + OSM fallback), `useLiveSync`, cache versioning O(1) & Redis pipeline, code-splitting entry JS (`85.39 kB`), CSP/security headers di `vercel.json`, audit endpoint live.

## Belum Selesai / Remaining Gaps (`[ ]`)
- [ ] **Aset Maskot (`public/mascots/`):** Ilustrasi orisinal *Cak Pantau* & *Mas Sigap* belum ditambahkan ke repo (script build copy di `package.json` sudah siap).
- [ ] **Polish UI Lanjutan (Fatih):** Refinement visual lanjutan sebelum Feature Freeze `12 Des 2026`.
- [ ] **Konfigurasi Dashboard Produksi (Reza):**
  - Tambahkan `CRON_SECRET` di Vercel Dashboard untuk autentikasi bearer `/api/cron/sla`.
  - Konfirmasi Realtime Replication aktif di Supabase untuk `Ticket` & `DepartmentRating`.
- [ ] **QA Browser Menyeluruh & Deliverable Lomba:**
  - Uji klik end-to-end di browser produksi pasca-CSP (OAuth Google, WebRTC `/lapor`, Klaim Palsu `/tiket/:id`, alur juri `< 3 menit`).
  - Rekam Video Demo `< 3 menit` + finalisasi materi Q&A Juri.
- [ ] **Opsional / Hygiene:** Catat riwayat migrasi v3.5 ke `_prisma_migrations` via koneksi direct non-pooler; rotasi secret `.env` pasca lomba.
