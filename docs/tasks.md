# LaporPAK! v3.5 — Pembagian Tugas Tim & Status Terbaru (Arya · Fatih · Reza)

> **Acuan Tunggal:** Dokumen ini diperbarui mengikuti [PRD v3.5](./PRD.md), [Design System](./design.md), dan [8 Flowchart Detail](./flow.md) menuju **Feature Freeze MVP: 12 Desember 2026** dan **Batas Akhir Pengumpulan: 18 Desember 2026, 23.59 WIB**.

---

## 1. Ringkasan Status Tim Saat Ini (Per 27 November 2026)

| Anggota | Peran Utama | Status Pekerjaan Saat Ini | Fokus Berikutnya |
| :--- | :--- | :--- | :--- |
| **ARYA** | **Backend Developer & Integrator** | **SELESAI 100% (MVP Inti + Penguatan v3.5 `#33`–`#37`)** <br> Database PostGIS + RLS (`DepartmentRating` aktif), `28` tiket seed + `4` rating seed, mesin `10` status, *Lazy Eval* + throttle Redis `30s`, segel `HMAC-SHA256`, `21` fungsi API client `api.js`, `X-Device-Fingerprint`, 3 Benteng Anti-Buzzer (`#33`–`#35`), Deteksi Cepat (`#36`), Rating Bintang (`#37`), & audit fullstack `/dinas` + `/rapor` live API (`17/17` self-check). | Bantu integrasi halaman `/` & `/tiket/:id` saat PR Fatih masuk, plus *polish* akhir sebelum Feature Freeze `12 Des`. |
| **REZA** | **Fullstack, NetOps, Kamera & Demo** | **SELESAI TAHAP INTI & QA KECEPATAN (`< 2s` LOLOS)** <br> Vercel `sin1`, Supabase Google OAuth ON, Redis, Kamera WebRTC + relaksasi malam + sensor `nsfwjs`, Panel Simulasi Juri `5` Alat, & QA audit `/dinas` + kecepatan live Vercel (`< 1s`). | `git pull origin main`, sambungkan kamera *Klaim Palsu* + Signed URL NSFW di `/tiket/:id` saat UI Fatih masuk, lalu rekam Video Demo `< 3 menit` + siapkan Q&A Anti-Buzzer/Screen-Spoofing. |
| **FATIH** | **Frontend UI/UX & Ilustrator Maskot** | **BERJALAN (~65% — `/login`, `/lapor`, `/dinas`, `/rapor` SUDAH LIVE)** <br> Fondasi tema, `/login`, `/lapor`, meja kerja `/dinas`, dan **Catatan Kerja Dinas** (`/rapor` + rating bintang warga) sudah terhubung ke DB & API nyata. | `git pull origin main`, selesaikan **2 halaman publik tersisa** (`/` Beranda Peta & `/tiket/:id` Detail + Uji Publik + kotak Rating Bintang) + `ProfileDrawer` + `2` maskot orisinal. |

---

## 2. Checklist Tugas Inti MVP (Prioritas Utama Sebelum Tambahan Baru)

### A. Bagian ARYA (Backend & Integrasi API) — ✅ Tahap Inti Selesai
- [x] **`US-001`** — Skema Prisma, PostGIS `geography`, RLS Supabase, `seed` 4 dinas (`skor 80`) & `28` tiket contoh.
- [x] **`US-005`** — API `check-radius` (`50m` & `30m`), pembuatan tiket atomik aman sinyal putus (`Idempotency-Key`), & *Dukung Prioritas*.
- [x] **`US-006`** — `8` endpoint meja kerja `/dinas` (`process`, `transfer`, `out-of-scope`, `reject-spam`, `resolve`, `reprocess-disputed`, `counter-dispute`, `resolve-escalated` Berita Acara PDF).
- [x] **`US-007`, `US-004`, `US-003`** — Kuorum validasi warga (`SELECT FOR UPDATE` + `X-Device-Fingerprint`), *Lazy Evaluation* otomatis + Cron harian, & verifikasi segel digital `HMAC-SHA256`.
- [x] **Client Integrasi Frontend (`frontend/src/lib/api.js`)** — Seluruh `21` fungsi pemanggil API (termasuk `rateTicket`) sudah siap dipakai Fatih di semua halaman.
- [x] **Penguatan v3.5 (`#33`–`#37`)** — Masa tunggu `6 jam` + *Lazy Eval* otomatis (`#33`), Jangkar Saksi Awal / kuorum `3.0` (`#34`), *Shadow-Zeroed* anti-kolusi subnet & akun ternakan (`#35`), deteksi `isFastResolveAnomaly < 10 menit` (`#36`), serta tabel `DepartmentRating` + RLS + `POST /api/tickets/:id/rate` + agregasi bintang di `GET /api/rapor` (`#37`).

---

### B. Bagian FATIH (Frontend UI/UX — Wajib `git pull origin main` Dulu!)
- [x] Setup fondasi Tailwind tema (`warm`, `blueprint`, `slate`), komponen dasar, halaman `/login`, dan halaman `/lapor`.
- [x] **`US-014` — Dashboard Meja Kerja `/dinas`** — Sudah terhubung ke API nyata (`listDinasTickets` & `executeDinasAction`), lengkap `8` aksi, validasi alasan (`15`/`20` karakter), `LiveCameraCapture`, dan unggah Berita Acara PDF `<= 5 MB`.
- [x] **`US-015` — Halaman "Catatan Kerja Dinas" (`/rapor`)** — Sudah diganti ke bahasa awam, terhubung ke `getRapor`, dan menampilkan rata-rata bintang + ulasan warga terbaru dari DB nyata.
- [ ] **`US-008` — `ProfileDrawer` & 2 Maskot Orisinal (*Cak Pantau* & *Mas Sigap*):**
  - Buat laci geser profil warga (`aliasName`, bar `trustScore` + cara menaikkan skor dari `0.5` ke `1.0`, status jeda/*cooldown*, riwayat laporan, & draf lokal).
  - Buat ilustrasi orisinal pose utama **Cak Pantau** (Warga) dan **Mas Sigap** (Petugas) di `public/mascots/`.
- [ ] **`US-011` — Halaman Beranda `/` (Peta Publik + Aksi Cepat):**
  - Bagian atas ringkas (paham fungsi web dalam `< 5 detik`) + tombol mencolok **Lapor Kerusakan** + angka ringkas laporan aktif.
  - Peta interaktif Leaflet Surabaya–Sidoarjo (`listTickets` dari `api.js`), filter kategori/status, warna + ikon `10` status, dan tombol *Reset Filter* saat hasil kosong.
- [ ] **`US-013` — Halaman Detail `/tiket/:id` (Uji Publik, Pelapor Luar Kota, Anti-Buzzer & Rating Bintang):**
  - Slider foto **Sebelum vs Sesudah** + keterangan bukti nyata di bawah foto: `"Diambil petugas X m dari titik laporan · Jam WIB"` + lencana peringatan kuning bila `ticket.isFastResolveAnomaly == true`, atau overlay *blur* + tombol *"Tampilkan Gambar"* (`getTicketMediaSignedUrl`) khusus foto `isNsfwPendingReview`.
  - Bar kuorum warga memakai `quorum.currentWeight / quorum.targetWeight` (tampilkan info tenang bila `quorum.isCoolingHold == true` hingga `quorum.coolingEndsAt`), tombol **Sudah Beres** & **Klaim Palsu**, serta penjelasan alasan tombol terkunci langsung di bawah tombol HP (termasuk tampilan jam `48–72` bebas GPS untuk pelapor luar kota bila `disputeCount == 0`, serta penguncian pembantah pertama pada putaran banding `isAppealRound == true`).
  - Kotak *"Beri Rating Kinerja Dinas (1–5 Bintang + Alasan)"* saat `ticket.status === "CLOSED"` dan `ratings.canRate === true` memakai `rateTicket(ticketId, { stars, comment }, token)` dari `api.js`.
  - Kotak **Segel Anti-Rekayasa** (`verifyTicketAudit`) dengan `1` kalimat bahasa awam + tombol *Verifikasi Rantai*.

---

### C. Bagian REZA (Integrasi Lanjutan Kamera, Kecepatan & Demo Akhir)
- [x] **`US-002` & `US-004`** — Deploy Vercel `sin1`, Supabase Auth + Google OAuth aktif, Upstash Redis.
- [x] **`US-009` & `US-010`** — `LiveCameraCapture.jsx` (anti-kamera-virtual, watermark `4` desimal, kecerahan BT.601 siang `35`/malam `12`, `nsfwjs` lazy-load) & `JuryPanel.jsx` `5` alat sudah live di `main`.
- [x] **Audit `/dinas` & QA Kecepatan Live (`< 2 detik`)** — Sudah diverifikasi di Vercel produksi.
- [ ] **Sambungan Kamera di `/tiket/:id` *(Saat UI Fatih Masuk)*:**
  - Jalankan `git pull origin main` di branch `reza` agar sinkron dengan rilis v3.5.
  - Pasang `LiveCameraCapture` pada tombol *Klaim Palsu* di `/tiket/:id` + *Signed URL* NSFW, dan pastikan *Simulasi Jepret Kamera* Panel Juri ikut mengisi foto di sana.
- [ ] **QA End-to-End, Video Demo `< 3 Menit` & Amunisi Q&A Juri (`Minggu 4`):**
  - Uji alur penuh juri `< 3 menit` tanpa webcam (termasuk bypass masa tunggu `6 jam` + Role Switcher `WARGA_VALIDATOR_2` / `WARGA_BARU`), rekam **Video Demo** Google Drive (*viewer*), serta kuasai jawaban `3` lapis Q&A juri untuk isu *Screen Spoofing (Foto AI di HP ke-2)* & *Buzzer/Akun Ternakan* sesuai [Flowchart 6](./flow.md).

---

## 3. Status Modul Penguatan v3.5 (Backend ARYA ✅ LIVE — Siap Disambungkan di `/tiket/:id`)

> **STATUS TERKINI:** Seluruh backend **3 Benteng Anti-Buzzer (`#33`–`#35`), Deteksi Cepat (`#36`), dan Rating Bintang (`#37`)** beserta tampilan bintang di `/rapor` sudah **SELESAI, TERUJI `17/17`, DAN LIVE DI `main`**. Seluruh perubahan API bersifat *backward-compatible* (menambah field baru tanpa merusak field lama), sehingga Fatih bisa langsung menyambungkannya saat mengerjakan `/tiket/:id`.

| Modul Penguatan v3.5 | Tugas ARYA (Backend) | Tugas FATIH (Frontend UI di `/tiket/:id`) | Tugas REZA (QA & Demo Juri) |
| :--- | :--- | :--- | :--- |
| **1. Benteng Anti-Buzzer 1: Masa Tunggu Publik `6 Jam` (`#33`)** | ✅ **SELESAI** — Tahan `PENDING_VALIDATION -> CLOSED` hingga `>= 6 jam` (`coolingHold: true`, `coolingEndsAt`), auto-`CLOSED` via *Lazy Eval* Step 3b lewat 6 jam, dan otomatis *bypass* bila `req.isJuryMode` aktif. | Tampilkan banner info tenang saat `quorum.isCoolingHold === true`: *"Suara warga sudah cukup — menunggu masa tayang publik hingga [jam] WIB sebelum dikunci agar transparan."* | Pastikan alur demo juri `< 3 menit` memakai `X-Jury-Token` tetap langsung tembus `CLOSED`, dan uji pembatalan masa tunggu oleh *Klaim Palsu*. |
| **2. Benteng Anti-Buzzer 2: Jangkar Saksi Awal (`#34`)** | ✅ **SELESAI** — Cek pendukung awal (`TicketSupport.createdAt <= repairCapturedAt`) di Fase 1 non-juri; jika belum ada pendukung awal, syarat kuorum otomatis naik ke `>= 3.0 poin` & `>= 3` perangkat. | Tampilkan `quorum.currentWeight / quorum.targetWeight` + keterangan jujur (`2.0 poin dengan pendukung awal` atau `3.0 poin warga sekitar`). | Uji kombinasi validator pendukung awal vs validator baru memakai Role Switcher di Panel Juri. |
| **3. Benteng Anti-Buzzer 3 & Anomali Cepat (`#35` & `#36`)** | ✅ **SELESAI** — Simpan `resolvedByUserId` + `resolvedIpSubnet` (HMAC `/24` atau `/48`), hitung `isFastResolveAnomaly` (`< 10 menit`), dan *Shadow-Zeroed* (`effectiveWeight = 0.0`, `isCollusionSuspect = true`) untuk subnet sama `< 5 menit` atau akun ternakan `>= 3x` dinas sama tanpa laporan mandiri. | Tampilkan lencana peringatan kuning *"Diselesaikan Sangat Cepat (<10 menit) — Cek Foto Lebih Teliti"* di atas slider foto `/tiket/:id` bila `ticket.isFastResolveAnomaly === true`. | Masukkan poin ini ke dek presentasi & demo Q&A juri sebagai bukti pertahanan *Pre-Aged Sybil & Screen Spoofing*. |
| **4. Rating Bintang & Ulasan Warga (`#37`)** | ✅ **SELESAI** — Tabel `DepartmentRating` + RLS, `4` ulasan *seed* demo, `POST /api/tickets/:id/rate`, `rateTicket()` di `api.js`, agregasi `averageRating` / `ratingCount` / `recentRatings` di `GET /api/rapor`, & kartu `/rapor` sudah menampilkan rating bintang. | Tambah kotak *"Beri Rating Kinerja Dinas (1–5 Bintang + Alasan)"* di `/tiket/:id` saat `ratings.canRate === true`, panggil `rateTicket()` dari `api.js`. | Pastikan `4` ulasan *seed* tampil di `/rapor` dan ikut ter-reset bersih saat klik *Reset Demo*. |
