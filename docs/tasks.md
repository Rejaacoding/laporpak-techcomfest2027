# LaporPAK! — Pembagian Tugas Tim & Timeline Eksekusi (Bahasa Awam & Teknis)

> **Acuan Tunggal:** Dokumen ini membagi pekerjaan [PRD v3.4](./PRD.md), [Design System](./design.md), dan [Alur Sistem](./flow.md) secara adil dan paralel untuk **Arya**, **Fatih**, dan **Reza** menuju **Feature Freeze MVP: 12 Desember 2026** dan **Batas Akhir Pengumpulan: 18 Desember 2026, 23.59 WIB**.

---

## 1. Gambaran Besar Bahasa Awam: Siapa Pegang Apa?

Supaya tidak ada kerjaan yang bertumpuk di file yang sama (*zero merge-conflict*), proyek dibagi menjadi **3 wilayah kepemilikan jelas**:

| Anggota | Peran & Ibarat Sederhana | Tanggung Jawab Utama (Bahasa Awam) | Folder Kode yang Dipegang |
| :--- | :--- | :--- | :--- |
| **ARYA** | **Backend Developer** <br> *(Kepala Brankas Data & Wasit Aturan)* | - Menyiapkan gudang data (4 dinas, 8 kategori, `25–30` laporan contoh di Surabaya–Sidoarjo). <br> - Mengatur wasit otomatis: hitung mundur tenggat waktu dinas, potong/tambah skor dinas & warga, aturan kuorum 2 warga setuju, serta **segel digital** anti-rekayasa riwayat laporan. | `prisma/` <br> `src/services/` <br> `api/` *(endpoint tiket, dinas, rapor, audit)* |
| **FATIH** | **Frontend UI/UX** <br> *(Arsitek Tampilan, Peta, Maskot & Penunjuk Jalan Warga)* | - Menggambar **2 maskot orisinal** (*Cak Pantau* & *Mas Sigap*) dan merakit **5 halaman web + login + laci profil** dengan tema Teal `#0F766E` sesuai [docs/design.md](./design.md). <br> - Memastikan **warga awam langsung paham**: peta enak digeser, perbandingan foto Sebelum–Sesudah jelas, alasan tombol terkunci tertulis di bawah tombol HP, dan bebas kode error teknis. | `frontend/src/pages/` <br> `frontend/src/components/` <br> `public/mascots/` |
| **REZA** | **Fullstack, NetOps & Pitch Lead** <br> *(Penjaga Gerbang, Kamera Lapangan & Juru Bicara Demo)* | - Menyalakan server online (Supabase, Upstash Redis, Vercel `sin1`) serta pintu masuk akun (Google OAuth warga + nama samaran acak & akun 4 dinas). <br> - Membuat **Kamera Langsung WebRTC** (anti-galeri, cek foto gelap/buram/NSFW) + **Panel Pintas Juri 5 Alat** + memimpin **Video Demo 3 Menit**. | `src/middlewares/` <br> `frontend/src/features/camera/` <br> `frontend/src/features/jury/` |

---

## 2. Checklist Tugas Lengkap per Anggota

### A. Tugas Lengkap ARYA (Backend — Database, Mesin 10 Status & Skor) — ✅ SELESAI 100%

- [x] **`US-001` — Gudang Data Prisma, PostGIS & 25–30 Data Contoh (`seed.ts`):**
  - Buat 5 tabel utama (`Department`, `User`, `Ticket`, `TicketValidation`, `AuditLog`) + tabel dukungan (`TicketSupport`), `10` status, dan `8` kategori sesuai Lampiran A PRD.
  - Pisahkan titik GPS asli (`location` khusus hitung jarak meter di server) dengan titik publik yang dibulatkan (`publicLat`/`publicLng` `~11 m`) agar lokasi rumah pelapor aman.
  - Isi `seed.ts`: 4 dinas (`Dishub`, `Dinas PU Bina Marga`, `DLH`, `Satpol PP`) dengan modal skor awal **`80`**, serta `25–30` laporan contoh di Surabaya–Sidoarjo (pastikan akun demo *Warga Pelapor* hanya memegang maksimal `2` laporan aktif agar juri selalu bisa mencoba buat laporan baru).
- [x] **`US-005` — Cek Titik Penuh Pra-Kamera, Simpan Laporan Baru & Dukung Prioritas:**
  - `GET /api/tickets/check-radius`: cek batas wilayah Surabaya–Sidoarjo + kuota `3` laporan kategori sama (`50 m`) & `6` laporan global (`30 m`), sekaligus kembalikan daftar `nearbyTickets` supaya warga bisa langsung menekan *Dukung Prioritas* sebelum membuka kamera.
  - `POST /api/tickets`: simpan laporan secara aman; jika sinyal warga putus dan mereka menekan *Kirim Ulang* (`Idempotency-Key` sama), kembalikan hasil sebelumnya tanpa membuat laporan ganda.
  - `POST /api/tickets/:id/support`: tiap kelipatan `10` dukungan warga lain, potong sisa waktu tenggat dinas `15%` lebih cepat (batas minimal `6 jam`) dan naikkan hukuman terlambat menjadi `-6 poin`.
- [x] **`US-006` — 8 Aksi Meja Kerja Dinas (`/api/dinas/*` & `/api/tickets/:id/*`):**
  - *Mulai Kerjakan* (`process`), *Oper Tiket* (`transfer` — maks 1 kali di `12 jam`/`24 jam` pertama sejak laporan masuk + wajib alasan), *Di Luar Wewenang* (`out-of-scope` — pilih `PLN/PDAM/BPJN/BBWS/Telkom/Lainnya` + catatan), dan *Tolak Spam* (`reject-spam` — hilang dari peta, foto non-NSFW dikarantina 7 hari, pelapor `-0.5` dengan batas bawah `0.1` pada pelanggaran pertama akun baru).
  - *Laporkan Selesai* (`resolve` — wajib foto langsung `<= 75 m`, jeda waktu SLA ke `remainingSlaMs`, dan hitung jarak meter petugas `repairDistanceMeters` untuk ditampilkan di slider foto warga).
  - *Sengketa & Eskalasi:* *Kerjakan Ulang* (`reprocess-disputed`), *Ajukan Banding 1 Kali* (`counter-dispute`), dan *Selesai Eskalasi* (`resolve-escalated` dengan Berita Acara `<= 5 MB` + foto lapangan `<= 75 m`).
- [x] **`US-007`, `US-004` & `US-003` — Suara Warga, Wasit Waktu Otomatis & Segel Anti-Edit:**
  - `POST /api/tickets/:id/validate`: kunci baris database sesaat (`SELECT FOR UPDATE`) agar aman saat 2 warga menekan tombol bersamaan; laporan tuntas (`CLOSED`) jika disetujui minimal `2` warga berbeda dengan total bobot `>= 2.0` (atau Pelapor Utama di hari ke-3 `48–72 jam` bila belum ada bantahan).
  - *Wasit Waktu Otomatis (`Lazy Evaluation`):* saat laporan dibuka/diubah, cek apakah sudah lewat tenggat (`OVERDUE`, potong `-3`/`-6` maks 1 kali), apakah sengketa didiamkan `> 24 jam` (paksa kerjakan ulang), atau apakah uji publik lewat `72 jam` tanpa respons (`AUTO_CLOSED` dengan bonus dinas `0`).
  - `GET /api/tickets/:id/audit-verify`: cek keutuhan rantai segel digital `HMAC-SHA256` dan kirim kalimat ringkasan bahasa awam (`summaryText`).

---

### B. Tugas Lengkap FATIH (Frontend UI/UX — Desain Teal, Maskot & 5 Halaman)

- [ ] **`US-008` — Token Desain Teal `#0F766E`, Komponen Inti & 2 Maskot Orisinal:**
  - Pasang 3 suasana tema (`warm`, `blueprint`, `slate`) sesuai [docs/design.md](./design.md) beserta komponen tombol, kartu laporan, badge `10` status (ikon + label bahasa Indonesia), hitung mundur waktu (`SlaTimer`), dan `ProfileDrawer`.
  - Buat aset ilustrasi orisinal **Cak Pantau** (Warga) dan **Mas Sigap** (Petugas) — pose utama untuk MVP (5 ekspresi tambahan untuk Bonus Minggu 4).
- [ ] **`US-011` — Beranda `/` (Peta Interaktif) & `/login` (Jaminan Privasi):**
  - Beranda `/`: bagian atas (*Hero*) menjelaskan fungsi web dalam 5 detik + tombol menonjol **Lapor Kerusakan** + peta Leaflet Surabaya–Sidoarjo dengan filter kategori dan tampilan ramah saat filter kosong.
  - Halaman `/login`: form email/password + tombol Google OAuth warga, dilengkapi **kartu jaminan privasi** bahwa nama asli & email warga tidak pernah ditampilkan ke publik maupun dinas.
- [ ] **`US-012` — Halaman `/lapor` yang Ramah Pengguna Awam:**
  - Langkah 1 (Pilih Titik): tampilkan garis batas Surabaya–Sidoarjo; jika di dekat titik sudah ada laporan aktif (`nearbyTickets`), tampilkan kartunya + tombol **Dukung Prioritas** *sebelum* membuka kamera.
  - Langkah 2 (Pra-Kamera): tampilkan alasan singkat kenapa wajib kamera langsung + **kartu panduan cara mengaktifkan izin** jika warga tidak sengaja menolak izin GPS/kamera atau akurasi GPS `> 50 m`.
  - Langkah 3 (Catatan & Kirim): pastikan ketikan dan foto tidak pernah hilang jika sinyal putus (sediakan tombol **Kirim Ulang**).
- [ ] **`US-013` — Halaman Detail `/tiket/:id` (Uji Publik & Segel Anti-Rekayasa):**
  - Geseran foto **Sebelum vs Sesudah** (`BeforeAfterSlider`) dilengkapi keterangan jarak & waktu foto petugas (`"Diambil petugas 18 m dari titik laporan"`).
  - Bar kuorum warga (`x / 2.0`), tombol **Sudah Beres** & **Klaim Palsu**, serta teks penjelasan yang **tertulis langsung di bawah tombol** saat tombol terkunci di HP (misal jarak `> 100 m` atau akun baru `0.5` beserta cara menaikkan skor ke `1.0`).
  - Kotak **Segel Anti-Rekayasa** (`HashPanel`) dengan 1 kalimat penjelasan bahasa awam + tombol **Verifikasi Rantai**.
- [ ] **`US-014` & `US-015` — Meja Kerja `/dinas` & Halaman `/rapor`:**
  - `/dinas`: tabel antrean padat (otomatis jadi tumpukan kartu di HP), kotak dialog wajib isi alasan (`n/15` dan `n/20`) untuk *Oper Tiket*, *Tolak Spam*, dan *Di Luar Wewenang*, serta kotak unggah PDF Berita Acara untuk *Eskalasi*.
  - `/rapor`: kartu skor 4 dinas (`0–100`), keterangan cara hitung skor, lencana peringatan jika rasio lempar laporan `> 25%` atau tolak spam `> 20%`, serta peta klaster titik kerusakan.

---

### C. Tugas Lengkap REZA (Fullstack, NetOps, Kamera WebRTC, Panel Juri & Demo)

- [x] **`US-002` & `US-004` — Server Cloud, Login 1 Pintu, Nama Samaran & Cache Cepat Redis (Backend & Cloud Infra Selesai):**
  - Siapkan project **Supabase** (PostGIS, Auth Email + Google OAuth, Storage bucket publik & privat), **Upstash Redis**, dan deployment **Vercel** region `sin1` (pastikan link publik tidak terkunci *Vercel Authentication*).
  - Buat penjaga autentikasi (`GET /api/auth/me` + pembuat nama samaran otomatis `Warga-Delta-402` saat warga baru masuk) serta pengunci `departmentId` agar petugas dinas hanya bisa mengakses dinasnya sendiri.
  - Pasang penyimpanan cepat Redis (`45 detik` peta, `180 detik` rapor) yang otomatis dihapus (`DEL`) setiap ada perubahan data, ditambah kupon foto sekali pakai (`POST /api/capture-nonce`) dan pencegah lompat lokasi mustahil (`> 120 km/jam`).
- [ ] **`US-009` — Kamera Langsung WebRTC, Cek Cahaya/Buram & Sensor NSFW 2-Zona:**
  - Komponen kamera langsung di browser: blokir ambil file galeri & tolak kamera virtual (`OBS`/`ManyCam`), perkecil foto otomatis (`<= 450 KB`, 0% EXIF) + tempelkan watermark jam WIB & koordinat.
  - Pemeriksa cahaya & ketajaman: longgarkan batas gelap khusus malam hari (`18.00–05.30 WIB`) untuk 3 kategori Darurat + Lampu PJU + Saluran Tersumbat; izinkan jepretan buram ke-3 lolos dengan tanda *"Foto buram (kualitas terbatas)"*.
  - Sensor NSFW (`nsfwjs` dimuat belakangan agar halaman tetap `< 2 detik`): minta foto ulang jika ragu (`0.55–0.84`), blokir jika tegas (`>= 0.85`), dan gunakan ruang privat + tombol *"Tampilkan Gambar"* (`Signed URL 60 detik`) jika server moderasi sibuk.
- [ ] **`US-010` — Panel Simulasi Juri 5 Alat (`/?jury_token=...`):**
  - Buat panel melayang khusus sesi juri (`TTL 4 jam`, terisolasi dari data warga asli): **(1) Ganti Peran 1-Klik**, **(2) Lompat GPS ke Titik Laporan**, **(3) Simulasi Jepret Kamera** (memakai foto sampel jalan yang sudah disiapkan di `public/samples/`), **(4) Percepat Waktu `+25 Jam` / `+49 Jam`**, dan **(5) Reset Demo**.
- [ ] **QA End-to-End, Rekaman Video Demo & Presentasi (`Minggu 4`):**
  - Uji coba siklus penuh juri `< 3 menit` dan kecepatan buka halaman `< 2 detik`, rekam **Video Demo** ke Google Drive (akses *viewer*), cantumkan URL lengkap ber-token juri di baris paling atas `README.md`, dan pimpin presentasi tim.

---

## 3. Jadwal Kerja Mingguan (20 November – 18 Desember 2026)

| Periode | Fokus Arya (Backend) | Fokus Fatih (Frontend UI) | Fokus Reza (Fullstack, Kamera & Demo) |
| :--- | :--- | :--- | :--- |
| **Minggu 1** <br> *(21–27 Nov)* | Tabel Prisma + PostGIS (`US-001`), `seed.ts` 25–30 laporan contoh, API baca peta, detail & rapor. | Setup warna Teal `#0F766E` & 3 tema, gambar pose utama 2 maskot (`US-008`), halaman `/` & `/login` (`US-011`). | Setup Supabase + Redis + Vercel, login Google/Email + nama samaran (`US-002`), cache Redis (`US-004`). |
| **Minggu 2** <br> *(28 Nov–5 Des)* | API `check-radius`, kirim laporan baru, *Dukung Prioritas* (`US-005`), & 8 aksi meja kerja dinas (`US-006`). | Halaman `/lapor` ramah warga awam (`US-012`), meja kerja `/dinas` (`US-014`), & Laci Profil. | Kamera langsung WebRTC + cek cahaya/buram + sensor NSFW + kupon foto (`US-009`) + foto sampel juri. |
| **Minggu 3** <br> *(6–12 Des)* <br> **🔒 Freeze MVP** | API validasi warga (`Sudah Beres` & `Klaim Palsu`, `US-007`), wasit waktu otomatis (`US-004`), & segel digital (`US-003`). | Halaman `/tiket/:id` (slider foto, bar kuorum, panel segel, `US-013`), halaman `/rapor` (`US-015`), & kamus bahasa manusia. | Panel Simulasi Juri 5 Alat (`US-010`), sambungkan semua halaman dengan API, & uji kecepatan `< 2 detik`. |
| **Minggu 4** <br> *(13–18 Des)* <br> **🎬 Demo & Submit** | Jaga kestabilan transaksi database, tes anti-bentrok, & pastikan *Reset Demo* selalu bersih. | Cek tampilan HP (`375px`) s.d. laptop (`1280px`) + fitur *Bonus* (pose ekstra maskot / `/aktivasi-mitra`) bila MVP aman. | Pimpin uji skenario juri `< 3 menit`, rekam **Video Demo Drive**, rapikan `README.md`, & submit `< 18 Des 23.59 WIB`. |
