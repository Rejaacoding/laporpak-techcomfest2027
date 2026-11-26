# LaporPAK! v3.5 — Pembagian Tugas Tim & Status Terbaru (Arya · Fatih · Reza)

> **Acuan Tunggal:** Dokumen ini diperbarui mengikuti [PRD v3.5](./PRD.md), [Design System](./design.md), dan [8 Flowchart Detail](./flow.md) menuju **Feature Freeze MVP: 12 Desember 2026** dan **Batas Akhir Pengumpulan: 18 Desember 2026, 23.59 WIB**.

---

## 1. Ringkasan Status Tim Saat Ini (Per 26 November 2026)

| Anggota | Peran Utama | Status Pekerjaan Tahap MVP Inti | Fokus Berikutnya |
| :--- | :--- | :--- | :--- |
| **ARYA** | **Backend Developer & Integrator** | **SELESAI 100% & LIVE (`main` `529aaf7`)** <br> Database PostGIS + RLS, `28` tiket seed, mesin `10` status, *Lazy Eval*, segel `HMAC-SHA256`, `20` API client `api.js`, `X-Device-Fingerprint`, `16/16` self-check lolos. | Bantu sambungkan halaman baru Fatih ke `api.js` + **tunggu aba-aba** untuk implementasi backend **3 Solusi Anti-Buzzer & Rating Bintang Catatan Kerja (`v3.5`)**. |
| **REZA** | **Fullstack, NetOps, Kamera & Demo** | **SELESAI 100% TAHAP INTI & LIVE (`main` `529aaf7`)** <br> Vercel `sin1`, Supabase Google OAuth ON, Redis, Kamera WebRTC + relaksasi malam + sensor `nsfwjs`, Panel Simulasi Juri `5` Alat. | `git pull origin main`, sambungkan kamera/Signed URL ke `/dinas` & `/tiket/:id` saat UI Fatih masuk, QA kecepatan `< 2s`, & siapkan skrip Demo + Q&A Anti-Buzzer/Screen-Spoofing. |
| **FATIH** | **Frontend UI/UX & Ilustrator Maskot** | **SEDANG BERJALAN (~35%)** <br> Setup desain token, komponen dasar, `/login`, dan `/lapor` sudah masuk. | `git pull origin main`, selesaikan **4 halaman utama tersisa** (`/`, `/tiket/:id`, `/dinas`, dan `/rapor` bertajuk **"Catatan Kerja Dinas"**) + `ProfileDrawer` + `2` maskot orisinal. |

---

## 2. Checklist Tugas Inti MVP (Prioritas Utama Sebelum Tambahan Baru)

### A. Bagian ARYA (Backend & Integrasi API) — ✅ Tahap Inti Selesai
- [x] **`US-001`** — Skema Prisma, PostGIS `geography`, RLS Supabase, `seed` 4 dinas (`skor 80`) & `28` tiket contoh.
- [x] **`US-005`** — API `check-radius` (`50m` & `30m`), pembuatan tiket atomik aman sinyal putus (`Idempotency-Key`), & *Dukung Prioritas*.
- [x] **`US-006`** — `8` endpoint meja kerja `/dinas` (`process`, `transfer`, `out-of-scope`, `reject-spam`, `resolve`, `reprocess-disputed`, `counter-dispute`, `resolve-escalated` Berita Acara PDF).
- [x] **`US-007`, `US-004`, `US-003`** — Kuorum validasi warga (`SELECT FOR UPDATE` + `X-Device-Fingerprint`), *Lazy Evaluation* otomatis + Cron harian, & verifikasi segel digital `HMAC-SHA256`.
- [x] **Client Integrasi Frontend (`frontend/src/lib/api.js`)** — Seluruh `20` fungsi pemanggil API sudah siap dipakai Fatih di semua halaman.

---

### B. Bagian FATIH (Frontend UI/UX — Wajib `git pull origin main` Dulu!)
- [x] Setup fondasi Tailwind tema (`warm`, `blueprint`, `slate`), komponen dasar, halaman `/login`, dan halaman `/lapor`.
- [ ] **`US-008` — `ProfileDrawer` & 2 Maskot Orisinal (*Cak Pantau* & *Mas Sigap*):**
  - Buat laci geser profil warga (`aliasName`, bar `trustScore` + cara menaikkan skor dari `0.5` ke `1.0`, status jeda/*cooldown*, riwayat laporan, & draf lokal).
  - Buat ilustrasi orisinal pose utama **Cak Pantau** (Warga) dan **Mas Sigap** (Petugas) di `public/mascots/`.
- [ ] **`US-011` — Halaman Beranda `/` (Peta Publik + Aksi Cepat):**
  - Bagian atas ringkas (paham fungsi web dalam `< 5 detik`) + tombol mencolok **Lapor Kerusakan** + angka ringkas laporan aktif.
  - Peta interaktif Leaflet Surabaya–Sidoarjo (`listTickets` dari `api.js`), filter kategori/status, warna + ikon `10` status, dan tombol *Reset Filter* saat hasil kosong.
- [ ] **`US-013` — Halaman Detail `/tiket/:id` (Uji Publik, Pelapor Luar Kota & Perulangan Bantahan):**
  - Slider foto **Sebelum vs Sesudah** + keterangan bukti nyata di bawah foto: `"Diambil petugas X m dari titik laporan · Jam WIB"` + lencana peringatan bila `isFastResolveAnomaly` aktif, atau overlay *blur* + tombol *"Tampilkan Gambar"* (`getTicketMediaSignedUrl`) khusus foto `isNsfwPendingReview`.
  - Bar kuorum warga (`x / 2.0 poin`), tombol **Sudah Beres** & **Klaim Palsu**, serta penjelasan alasan tombol terkunci yang **tertulis langsung di bawah tombol HP** (termasuk tampilan khusus jam `48–72` bebas GPS untuk pelapor luar kota yang sudah pulang bila `disputeCount == 0`, serta penguncian pembantah pertama pada putaran banding `isAppealRound == true`).
  - Kotak **Segel Anti-Rekayasa** (`verifyTicketAudit`) dengan `1` kalimat bahasa awam + tombol *Verifikasi Rantai*.
- [ ] **`US-014` — Dashboard Meja Kerja `/dinas` (Desktop-First Workbench, Responsif Kartu di HP):**
  - Tabel/daftar antrean urut dari `OVERDUE` & sisa waktu tersingkat (`listDinasTickets` & `executeDinasAction` di `api.js`).
  - Dialog wajib isi alasan (`n/15` dan `n/20`) untuk *Oper Tiket*, *Tolak Spam*, dan *Di Luar Wewenang*; hitung mundur `24 jam` saat `DISPUTED` (pilih *Kerjakan Ulang* atau *Ajukan Banding 1x*); serta form `2` unggahan (*Berita Acara PDF `<= 5 MB`* + *Foto Kamera Live `<= 75 m`*) saat `ESCALATED`.
- [ ] **`US-015` — Halaman "Catatan Kerja Dinas" (`/rapor` — Bahasa Awam, Bukan Istilah Teknis!):**
  - Ubah label menu navbar & judul halaman `/rapor` menjadi **"Catatan Kerja Dinas"** (URL tetap `/rapor`, terbuka untuk umum/warga; dinas hanya bisa melihat, tidak bisa mengedit).
  - Tampilkan kartu `4` dinas (`getRapor` di `api.js`) memakai bahasa sehari-hari: **Nilai Kerja (`0–100`)**, rumus sederhana (*mulai 80, tepat waktu +2, telat -3/-6, pengawasan -5*), jumlah selesai tepat waktu vs terlambat, lencana peringatan bila *Sering Melempar Laporan (`> 25%`)* atau *Sering Menolak Laporan (`> 20%`)*, serta peta titik daerah rawan rusak.

---

### C. Bagian REZA (Integrasi Lanjutan Kamera, Kecepatan & Demo Akhir)
- [x] **`US-002` & `US-004`** — Deploy Vercel `sin1`, Supabase Auth + Google OAuth aktif, Upstash Redis.
- [x] **`US-009` & `US-010`** — `LiveCameraCapture.jsx` (anti-kamera-virtual, watermark `4` desimal, kecerahan BT.601 siang `35`/malam `12`, `nsfwjs` lazy-load) & `JuryPanel.jsx` `5` alat sudah live di `main`.
- [ ] **Sinkronisasi Lokal & Sambungan Kamera ke Halaman Baru *(Saat UI Fatih Masuk)*:**
  - Jalankan `git pull origin main` di branch `reza` agar sinkron dengan `529aaf7`.
  - Pasang `LiveCameraCapture` pada tombol *Laporkan Selesai / Banding / Selesai Eskalasi* di `/dinas` serta tombol *Klaim Palsu* di `/tiket/:id`, dan pastikan *Simulasi Jepret Kamera* Panel Juri ikut mengisi foto di kedua halaman tersebut.
- [ ] **QA End-to-End, Video Demo `< 3 Menit` & Amunisi Q&A Juri (`Minggu 4`):**
  - Uji kecepatan muat halaman `< 2 detik` dan alur penuh juri `< 3 menit` tanpa webcam, taruh URL lengkap `?jury_token=...` di baris paling atas `README.md`, rekam **Video Demo** Google Drive (*viewer*), serta kuasai jawaban `3` lapis Q&A juri untuk isu *Screen Spoofing (Foto AI di HP ke-2)* & *Buzzer/Akun Ternakan* sesuai [Flowchart 6](./flow.md).

---

## 3. Pembagian Tugas Tambahan v3.5 (MENUNGGU ABA-ABA ARYA)

> **PENTING (Prinsip YAGNI & Stabilitas):** Seluruh item di bawah ini **SUDAH DICATAT LENGKAP di [PRD v3.5](./PRD.md) dan [Flow v3.5](./flow.md)**, namun **JANGAN DIKODING DULU** sebelum 4 halaman utama Fatih beres dan Arya memberi aba-aba mulai!

| Modul Penguatan v3.5 | Tugas ARYA (Backend) | Tugas FATIH (Frontend UI) | Tugas REZA (QA & Demo Juri) |
| :--- | :--- | :--- | :--- |
| **1. Benteng Anti-Buzzer 1: Masa Tunggu Publik `6 Jam` (`#33`)** | Tahan perubahan `PENDING_VALIDATION -> CLOSED` di `validation.service.js` hingga `>= 6 jam` sejak `validationStartedAt` (otomatis di-bypass bila `req.isJuryMode` aktif atau waktu digeser via `simulate-time`); batalkan kuorum bila masuk `DISPUTE_FALSE`. | Tampilkan info tenang di `/tiket/:id` saat kuorum sudah tercapai namun masih masa tunggu: *"Suara warga sudah cukup — menunggu masa tayang publik X jam lagi sebelum dikunci agar transparan."* | Pastikan alur demo juri `< 3 menit` memakai `X-Jury-Token` tetap langsung tembus `CLOSED` tanpa terhambat `6 jam`, dan uji skenario pembatalan oleh *Klaim Palsu*. |
| **2. Benteng Anti-Buzzer 2: Jangkar Saksi Awal (`#34`)** | Cek di `validation.service.js` (Fase 1 `6–48 jam`): wajib ada min. `1` validator yang pernah `TicketSupport` sebelum `resolvedAt`; jika `supportCount == 0`, syarat kuorum cepat naik ke `>= 3.0 poin` (`>= 3` perangkat berbeda). | Tampilkan keterangan syarat kuorum yang jujur dan mudah dibaca pada bar kuorum `/tiket/:id` (`2.0 poin dengan pendukung awal` atau `3.0 poin warga sekitar`). | Uji kombinasi validator pendukung awal vs validator baru memakai Role Switcher di Panel Juri. |
| **3. Benteng Anti-Buzzer 3 & Anomali Cepat: Anti-Akun-Ternakan (`#35` & `#36`)** | Simpan `resolvedByUserId` + `ipSubnetHash`, hitung `isFastResolveAnomaly` (`< 10 menit`), dan beri `effectiveWeight = 0.0` (*Shadow-Zeroed*) + log `isCollusionSuspect` jika validator `< 5 menit` di subnet sama atau `>= 3x` beruntun hanya menyetujui petugas/dinas yang sama tanpa laporan mandiri. | Tampilkan lencana peringatan kuning *"Diselesaikan Sangat Cepat (<10 menit) — Cek Foto Lebih Teliti"* di atas slider foto `/tiket/:id` bila `isFastResolveAnomaly == true`. | Masukkan poin ini ke dek presentasi & demo Q&A juri sebagai bukti pertahanan *Pre-Aged Sybil & Screen Spoofing*. |
| **4. Rating Bintang & Ulasan Warga di Catatan Kerja Dinas (`#37`)** | Tambah tabel ringan `DepartmentRating` (`UNIQUE(ticketId, userId)`), endpoint `POST /api/tickets/:id/rate` (khusus `WARGA` pada tiket `CLOSED`), dan agregasi rata-rata bintang + ulasan terbaru di `GET /api/rapor`. | Tambah kotak *"Beri Rating Kinerja Dinas (1–5 Bintang + Alasan)"* di `/tiket/:id` setelah `CLOSED`, dan tampilkan bintang + cuplikan ulasan warga pada tiap kartu dinas di halaman **Catatan Kerja Dinas** (`/rapor`). | Isi beberapa contoh ulasan realistis di data *seed* demo & pastikan ikut di-reset bersih saat klik *Reset Demo*. |
