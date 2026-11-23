# PRD FINAL v3.4 — FINAL LOCKED (LAST REVISION)
## LaporPAK! — Sistem Audit & Pelaporan Infrastruktur Publik Dua Arah Berbasis Peta

| Atribut Dokumen | Spesifikasi |
| :--- | :--- |
| **Nama Produk** | **LaporPAK!** (*Laporan Infrastruktur Publik & Audit Kolaboratif*) |
| **Versi Dokumen** | **v3.4 (FINAL LOCKED — Edisi Eksekusi, Ditutup untuk Revisi)** — Supersedes v3.3 |
| **Kompetisi & Sub-Tema** | Techcomfest 2027 — Sub-Tema 1: *Smart Governance & Public Service* (SDG 16) |
| **Batas Akhir & Cakupan** | 18 Desember 2026, 23.59 WIB · Wilayah Kab. Sidoarjo & Kota Surabaya |
| **4 Instansi Mitra Utama** | Dishub, Dinas PU Bina Marga, DLH, dan Satpol PP |
| **Tim Eksekutor** | Arya (Backend), Fatih (Frontend UI/UX), Reza (Fullstack, NetOps & Pitch) |

> **Keputusan Kunci Dokumen:** Versi **v3.4** ini menggabungkan seluruh 26 penguncian dari v3.3 ditambah **6 celah penutup terakhir (`#27`–`#32`)** hasil audit menyeluruh. Dokumen ini dikunci sebagai *Single Source of Truth* terakhir agar tim langsung fokus implementasi menuju **Feature Freeze MVP: 12 Desember 2026**.

---

## Ringkasan 6 Penambalan Terakhir (Audit v3.3 -> v3.4 Final)

| Kode | Level | Masalah Tersisa pada v3.3 | Solusi Penguncian di v3.4 (Terintegrasi di Bab 2–9 & Lampiran A–B) |
| :--- | :--- | :--- | :--- |
| **#27** | **KRITIS** | **Acuan Waktu Offline (`createdAt` vs `syncedAt`) & Presisi GPS:** Batas `Oper Tiket` / `REJECTED_SPAM` memakai `createdAt` (merugikan dinas jika draf offline baru sync 15 jam kemudian), dan pembulatan 4 desimal (~11m) berisiko menggeser cek jarak `30m/50m/75m/100m`. | Batas `min(24j, 50% SLA awal)` untuk `Oper Tiket` & `REJECTED_SPAM` dihitung dari **`syncedAt`** (waktu masuk antrean dinas). Database memisahkan `location` (`geography(Point, 4326)` presisi asli, internal server-only) untuk `ST_DWithin` dan `publicLat`/`publicLng` (dibulatkan 4 desimal `~11m`) untuk API publik & watermark. |
| **#28** | **KRITIS** | **Self-Lock Demo Juri oleh Kuota 5 Tiket Aktif (`EC-24`):** Jika akun simulasi `Warga Pelapor` di `seed.ts` sudah memegang >5 tiket aktif, juri langsung terblokir saat mencoba `/lapor` di demo `<3 menit`. | Di `seed.ts`, akun simulasi `Warga Pelapor` dibatasi maks **2 tiket aktif** (sisa 23–28 tiket disebar ke akun warga fiktif lain). Saat header `X-Jury-Token` aktif, kuota `5 aktif / 10 per 24j` per akun warga di-bypass (tetap dibatasi kuota sesi juri global `30 mutasi / 10 menit` & maks `50` tiket demo), dan tombol *Simulasi Jepret Kamera* tetap meminta *capture nonce* sah. |
| **#29** | **KRITIS** | **Nonce Hangus Sebelum Validasi (`SETNX` Race / Retry):** Jika `SETNX nonce:jti` dijalankan sebelum cek `Idempotency-Key`, validasi Zod, atau cek kuota, retry sah atau perbaikan form akan langsung gagal `401 Nonce Already Used`. | Urutan eksekusi wajib: **(1)** Cek `Idempotency-Key` (jika sudah sukses, kembalikan respons awal), **(2)** Validasi Zod, geofencing, kuota & NSFW, **(3)** Baru konsumsi `SETNX nonce:jti` tepat sebelum upload Storage & commit DB; jika DB gagal (`5xx`), jalankan kompensasi `DEL nonce:jti` + hapus objek Storage yatim. |
| **#30** | **TINGGI** | **Beban `blurred derivative` di Serverless Vercel & File Yatim:** Membuat file gambar blur kedua di server butuh binary `sharp` (rawan cold-start/OOM) dan berisiko menyisakan file yatim. | Simpan foto `isNsfwPendingReview: true` di **private bucket/prefix** Supabase Storage (tidak bisa dienumerasi publik), tampilkan overlay blur di UI, dan buka foto asli hanya via *short-lived Signed URL* (`TTL 60 detik`) saat tombol *"Tampilkan Gambar"* diklik. Upload media melewati backend terverifikasi agar EXIF strip & magic-bytes wajib berjalan. |
| **#31** | **TINGGI** | **Ketidakkonsistenan Internal `v3.3` (`US-007`, Label Publik `AuditLog` & Lampiran B):** `US-007` lupa menulis syarat `disputeCount == 0`; `actorPublicRef` ter-hash menyulitkan publik membedakan aksi Warga vs Dinas vs Sistem; Lampiran B belum memuat endpoint `GET /api/tickets`, `:id`, `/api/rapor`, `simulate-time`, dan `/api/health`. | Syarat `disputeCount == 0` dikunci di `US-007`; `AuditLog` menyimpan `actorRole` (`WARGA`/`ADMIN_DINAS`/`SYSTEM`) & `actorDisplayLabel` (`aliasName` / nama dinas / `"Sistem LaporPAK!"`) di samping `actorPublicRef` untuk hash HMAC; seluruh 17 endpoint lengkap dikunci di Lampiran B. |
| **#32** | **MENENGAH** | **Salah Sensor Blur pada Foto Buram & Risiko Foto Sampel Juri:** Override ketajaman percobaan ke-3 ikut memakai `needsReview: true` sehingga foto lubang jalan buram diperlakukan seperti sensor NSFW; aset sampel juri rawan gagal kalibrasi `Y >= 35` / `Laplacian >= 45`. | Pisahkan flag **`isNsfwPendingReview`** (blur-by-default + private Signed URL) dari **`isLowQualityOverride`** (tampil normal dengan lencana *"Kualitas Gambar Rendah"*). Seluruh foto sampel juri di `public/samples/` wajib terverifikasi lolos `Y` di `[50, 220]` & `Laplacian >= 80`. |

---

## BAB 1 — Pendahuluan, Masalah & Tiga Pilar Utama

**LaporPAK!** adalah platform web *civic-tech* berbasis peta interaktif untuk melaporkan kerusakan fasilitas umum (jalan berlubang, lampu PJU mati, saluran tersumbat, tumpukan sampah liar, hingga bahaya infrastruktur darurat) dengan mekanisme audit dua arah antara warga dan instansi pemerintah.

| Sisi Pengguna | Masalah Nyata di Lapangan | Solusi Terukur di LaporPAK! |
| :--- | :--- | :--- |
| **Masyarakat (Warga)** | Laporan sering menggantung tanpa kejelasan tenggat waktu atau statusnya ditutup sepihak (*fake closure*) padahal kondisi fisik belum diperbaiki. | *Public SLA Countdown* terbuka, masa Uji Publik `48 jam` berbasis perbandingan foto Sebelum–Sesudah, serta hak Validasi 1-Tap dan Klaim Palsu dari warga radius `<= 100 m`. |
| **Pemerintah (Dinas)** | Instansi yang bekerja jujur sering kewalahan dibanjiri laporan hoaks, foto comotan internet, konten tidak senonoh (NSFW), foto tidak relevan, dan puluhan tiket ganda di satu titik yang sama. | Blokir galeri total pada foto lapangan (*WebRTC Live Camera*), Filter NSFW 2-Zona + Cek Piksel terkalibrasi di client dan server, tombol Tolak Laporan Spam berpenalti, kuota maksimal `3` laporan per radius `50 m` (`6` global per `30 m`), serta hak Oper Tiket berbatas waktu. |

### Tiga Pilar Ekosistem

1. **Pilar Transparansi:** Setiap laporan memiliki hitung mundur tenggat waktu (*Public SLA*) terbuka dan riwayat perubahan status berantai kriptografi (`HMAC-SHA256`) yang mustahil diedit diam-diam di database tanpa terdeteksi.
2. **Pilar Aspirasi Terverifikasi:** Ketat di pintu masuk (wajib foto langsung di TKP, bebas NSFW, anti-duplikat) dan partisipatif di pintu keluar (warga sekitar ikut mengetuk palu sah atau tidaknya perbaikan per putaran).
3. **Pilar Stabilitas & Akuntabilitas:** Papan skor terbuka (`integrityScore` rentang `0–100`) yang secara objektif menghargai dinas tepat waktu, mencegah penalti ganda, dan menayangkan rasio `OUT_OF_SCOPE` serta `REJECTED_SPAM` secara transparan.

---

## BAB 2 — Arsitektur Peran, Privasi & Alur Autentikasi Multi-Role

Sistem menggunakan gerbang masuk satu pintu (`/login`) berbasis **Supabase Auth** dengan pemisahan wewenang ketat di level database Prisma dan penjaga rute frontend.

### A. Pembagian 4 Tipe Aktor

1. **Pengunjung Publik (Tanpa Login):** Bebas membuka `/`, `/tiket/:id`, dan `/rapor` untuk memantau peta, timer SLA, foto *before–after*, dan skor dinas. Tidak dapat membuat laporan, mendukung prioritas, atau melakukan validasi.
2. **Warga (`WARGA`):** Mendaftar bebas lewat registrasi email/password atau Google OAuth bawaan Supabase. Otomatis mendapatkan nama samaran publik acak (contoh: `Warga-Delta-402`) agar email, nama asli, dan UUID internal tidak pernah terekspos ke API publik maupun peta.
3. **Admin Instansi (`ADMIN_DINAS`):** Tidak dapat mendaftar dari form publik. Akun hanya tersedia melalui:
   - **Akun Mitra Bawaan (*Seed*):** `dishub@laporpak.id`, `dpu@laporpak.id`, `dlh@laporpak.id`, dan `satpolpp@laporpak.id` yang langsung terikat ke `departmentId` masing-masing dengan status `isVerifiedPartner: true`.
   - **Aktivasi Kerja Sama Mitra Baru (`/aktivasi-mitra` — target Bonus Minggu 4):** Instansi baru menerima Kode Aktivasi Sekali Pakai dari Super Admin (contoh: `MITRA-PU-2027`). Pejabat memasukkan email resmi dinas, password, dan kode rahasia; jika cocok, backend mengunci peran `ADMIN_DINAS` + `departmentId`, lalu menghanguskan kode.
   - **Skor Awal Mitra:** Seluruh instansi bawaan maupun mitra baru diinisialisasi pada `integrityScore = 80` (skala `0–100`) agar dinamika bonus (`+2` / `+1`) maupun penalti (`-3` / `-5` / `-6`) langsung terukur sejak transaksi pertama.
4. **Sesi Simulasi Juri (`?jury_token=...`):** Mode pengujian dewan juri tersembunyi yang diverifikasi terhadap `JURY_SECRET_TOKEN` di server lalu menerbitkan *signed session token* (TTL `4 jam`) di `sessionStorage` + header `X-Jury-Token` dengan banner aktif.
   - **Isolasi Mutasi & Kuota Sesi Juri:** Seluruh endpoint mutasi wajib menolak (`403 Forbidden`) jika sesi juri mencoba mengubah data riil (`isDemoData: false`), memblokir akses ke `/aktivasi-mitra`, membatasi laju mutasi juri (`30 mutasi` per `10 menit` per sesi/IP, maks `50` tiket `isDemoData: true` aktif), menandai otomatis setiap *record* baru dari sesi juri sebagai `isDemoData: true`, dan membebaskan akun simulasi juri dari limit `5 tiket aktif / 10 per 24j` milik akun warga biasa agar pengujian tidak macet.

### B. Alur Teknis Login Pemerintah (*End-to-End*)

1. Petugas membuka `/login` dan memasukkan email dinas + password (tombol Google OAuth dikhususkan bagi warga).
2. Supabase Auth memverifikasi kredensial dan mengembalikan JWT `access_token`.
3. Frontend memanggil `GET /api/auth/me` dengan header `Authorization: Bearer <token>`.
4. Backend mencocokkan ID pengguna di Prisma dan mengembalikan `role: 'ADMIN_DINAS'`, `departmentId`, nama instansi, dan lencana `isVerifiedPartner: true`.
5. Router frontend otomatis mengalihkan petugas ke `/dinas`, menyembunyikan tombol *Lapor Kerusakan* serta laci profil warga, dan memblokir akses langsung ke URL `/lapor`.
6. Setiap aksi pada API dinas dikunci ketat dengan filter `where: { departmentId: req.user.departmentId }` (Dishub mustahil menyentuh tiket Dinas PU), seluruh aksinya dicatat ke `AuditLog`, dan tiap mutasi langsung menghapus (*invalidate*) cache Upstash Redis.

### C. Tata Kelola Privasi Data & Media Lapangan

- **Anonimitas API Publik:** Endpoint publik (`/api/tickets`, `/api/tickets/:id`, `/api/rapor`, `/api/tickets/:id/audit-verify`) dilarang mengembalikan `userId` (UUID), `email`, `deviceFingerprint`, maupun IP pengguna. Identitas ditampilkan melalui `aliasName` / `actorDisplayLabel` dan diverifikasi secara kriptografis melalui `actorPublicRef`.
- **Pemisahan Koordinat Presisi vs Publik:** Kolom `Ticket.location` (`geography(Point, 4326)`) menyimpan koordinat GPS asli khusus di server untuk perhitungan jarak `ST_DWithin` (`30m / 50m / 75m / 100m`) dan tidak pernah dikembalikan ke API publik. Seluruh API publik dan watermark foto hanya menggunakan `publicLat`/`publicLng` yang dibulatkan ke `4` desimal (`~11 m`).
- **Sterilisasi Metadata & Proteksi Aset:** Output kamera *WebRTC* (`canvas.toBlob('image/webp')`) secara alami sudah **0% EXIF**; backend memvalidasi *magic bytes* (`JPEG`/`WebP`), dimensi (`<= 1280 px`), dan ukuran (`<= 450 KB`) sebelum menyimpan dengan nama acak CSPRNG UUIDv4 (`tickets/{ticketId}/{uuid}.webp`). Foto `isNsfwPendingReview: true` disimpan di *private bucket/prefix* (Signed URL `TTL 60 detik`), foto NSFW tegas di-*hard-delete*, dan foto `REJECTED_SPAM` non-NSFW dikarantina privat `7 hari` untuk jejak audit.
- **Panduan Privasi Kamera:** Antarmuka viewfinder WebRTC menampilkan pengingat singkat: *"Fokuskan kamera pada fasilitas rusak; hindari memotret wajah warga atau pelat nomor kendaraan."*

---

## BAB 3 — Siklus Hidup 10 Status Tiket (*State Machine* Tanpa Jalan Buntu)

Seluruh perubahan status di frontend, peta, dan backend wajib mengacu pada **10 status baku** berikut agar tidak ada tiket yang menggantung, terkena penalti berulang, atau melompat alur:

| No | Kode Status & Pin | Syarat Masuk | Timer SLA & Aturan Keluar (Transisi Lanjutan) |
| :--- | :--- | :--- | :--- |
| **1** | **`OPEN`** <br> Pin: Biru | Laporan valid warga lolos sensor NSFW 2-zona/piksel, geofencing, nonce, dan masuk DB. | Timer SLA berjalan sejak `syncedAt` (= `createdAt` bila online, atau waktu sinkronisasi bila offline). Dinas boleh **Oper Tiket** maks `1x` (tanpa penalti) selama status masih `OPEN` dalam batas `min(24 jam, 50% SLA awal)` (`= 12 jam` untuk Darurat) dihitung dari `syncedAt` + alasan wajib (`>= 15 karakter`). Oper Tiket hanya memindahkan `departmentId` tanpa mengubah `category` asli, dan penerima mendapat buffer `max(Sisa SLA, 12 jam)`. Dapat pindah ke `IN_PROGRESS`, `OVERDUE`, `OUT_OF_SCOPE`, atau `REJECTED_SPAM`. |
| **2** | **`OUT_OF_SCOPE`** <br> Pin: Abu-abu | Dinas menandai laporan di luar wewenang 4 dinas Pemda (pilihan baku: PLN, PDAM, BPJN Nasional, BBWS, Telkom/Fiber, Lainnya) + catatan rujukan (`>= 20 karakter`). | **Status Terminal.** Timer berhenti, tidak memengaruhi `integrityScore` dinas maupun `trustScore` pelapor. Semua keputusan dicatat di `AuditLog`, dan rasio `OUT_OF_SCOPE` tiap instansi ditampilkan terbuka di `/rapor` (lencana peringatan tampil jika rasio `> 25%`). |
| **3** | **`REJECTED_SPAM`** <br> Pin: Abu Gelap *(Hidden)* | Dinas menekan *Tolak Laporan* (Spam / Tidak Relevan / Darurat Palsu) saat masih `OPEN` dalam batas `min(24 jam, 50% SLA awal)` dihitung dari `syncedAt` + alasan wajib (`>= 15 karakter`). | **Status Terminal.** Tiket hilang dari peta publik, foto non-NSFW dipindah ke *private quarantine* `7 hari` untuk audit (konten NSFW di-*hard-delete* seketika), dicatat di `AuditLog`, dan rasio `REJECTED_SPAM` tayang di `/rapor` (lencana peringatan bila `> 20%`). Pelapor kena `-0.5 trustScore` (lantai `0.1` pada pelanggaran pertama akun baru) + *cooldown* `24 jam`. |
| **4** | **`IN_PROGRESS`** <br> Pin: Kuning | Petugas dinas menekan *Mulai Kerjakan* (dari `OPEN`) atau *Proses Perbaikan Ulang* (dari `DISPUTED` Jalur A). | Timer SLA berjalan (Oper Tiket & Tolak Spam tidak lagi tersedia). Pindah ke `PENDING_VALIDATION` saat petugas unggah foto bukti selesai *live* (`<= 75 m`), atau ke `OVERDUE` jika melewati `slaDeadline`. |
| **5** | **`OVERDUE`** <br> Pin: Merah | Waktu sekarang melewati `slaDeadline` saat status `OPEN` / `IN_PROGRESS` (dipicu *Lazy Evaluation* atomik saat `GET`/mutasi atau Cron harian cadangan). | Skor dinas dipotong `-3 poin` (atau `-6 poin` jika `supportCount >= 10`), maks `1x` per tiket (`overduePenalized` flag). Jika keterlambatan aktif melampaui `100%` SLA awal (`now - slaDeadline > slaInitialHours`), sistem mengunci `isChronicOverdue = true` secara permanen (*sticky*) di `/rapor`. Petugas tetap wajib menyelesaikan & unggah bukti *live* (`<= 75 m`). |
| **6** | **`PENDING_VALIDATION`** <br> Pin: Oranye | Petugas unggah foto bukti perbaikan *live* (`<= 75 m`) yang lolos filter piksel & NSFW. | Sisa waktu SLA disimpan ke `remainingSlaMs` dan timer SLA dijeda (*paused*). `validationStartedAt` dicatat, `validationRound` bertambah `+1`, dan bobot kuorum (`weightAtVote`) dimulai dari `0`. Fase 1 Uji Publik (`0–48 jam`) dan Fase 2 Jendela Pelapor (`48–72 jam`) berjalan. Keluar ke: `CLOSED` (kuorum sah / konfirmasi pelapor jam `48–72` khusus `disputeCount == 0`), `DISPUTED` (bantahan 1), `ESCALATED` (bantahan 2), atau `AUTO_CLOSED` (jam ke-`72`, atomik cek `version`). |
| **7** | **`DISPUTED`** <br> Pin: Ungu | Bantahan warga putaran ke-1 (`disputeCount = 1`) sah dengan foto bukti *live* (`<= 100 m`, lolos NSFW/piksel). Sistem mencatat `disputedAt`. | SLA dijeda maks `24 jam` sejak `disputedAt`. Dinas wajib memilih 2 jalur: **(A)** *Proses Perbaikan Ulang* -> `IN_PROGRESS` (`isAppealRound = false`) dengan `slaDeadline = now + max(0, remainingSlaMs) + 24 jam`; **(B)** Maks `1x`, unggah foto sudut terbaru (`<= 75 m`) + *Ajukan Banding Bukti* kembali ke `PENDING_VALIDATION` (`validationRound++`, `disputeCount` tetap `1`, `isAppealRound = true`; pembantah putaran 1 dilarang ikut *voting*/bantah ke-2 di putaran banding — harus warga lain `>= 1.0`; penalti `-0.5 + 24 jam` kepada pembantah putaran 1 aktif **hanya** jika putaran banding `isAppealRound == true` berakhir `CLOSED` oleh `>= 2` warga lain). **Anti-Deadlock:** Jika `> 24 jam` sejak `disputedAt` dinas diam, sistem otomatis memaksa Jalur A secara deterministik dengan `reworkStart = disputedAt + 24 jam` dan `slaDeadline = reworkStart + max(0, remainingSlaMs) + 24 jam`. |
| **8** | **`ESCALATED`** <br> Pin: Merah Tua / Hitam | Bantahan warga putaran ke-2 (`disputeCount = 2`) sah dengan foto bukti *live* (`<= 100 m`, lolos NSFW/piksel). | Penalti permanen `-5 poin` `integrityScore` langsung dipotong. Dinas menutup titik dengan mengunggah 2 bukti: **Berita Acara Perbaikan Berjenjang** (`PDF/JPG/PNG <= 5 MB`) + **Foto Lapangan Live** (`<= 75 m`) -> `CLOSED` berlabel *"Diselesaikan via Berita Acara Eskalasi"* (tanpa putaran bantahan ke-3; penalti `-5` bersifat permanen). |
| **9** | **`CLOSED`** <br> Pin: Hijau | Kuorum warga (`>= 2.0 poin` DAN `>= 2` akun berbeda pada `validationRound` aktif), atau konfirmasi pelapor jam ke-`48–72` (khusus `disputeCount == 0`), atau Berita Acara `ESCALATED`. | **Status Terminal.** Selesai tepat waktu tanpa pernah `OVERDUE`, `DISPUTED`, atau `ESCALATED` -> dinas `+2 poin` (`CLOSED` pasca-`DISPUTED` = `0` bonus; `integrityScore` dikunci pada rentang `[0, 100]`). Pelapor & validator putaran aktif (atau pembantah putaran 1 & 2 pada jalur `ESCALATED`) mendapat `+0.1 trustScore` (maks `2.0`). |
| **10** | **`AUTO_CLOSED`** <br> Pin: Hijau Muda | Lewat `72 jam` (`48 jam` uji publik + `24 jam` jendela pelapor utama) tanpa bantahan dan tanpa respons pelapor (berlaku juga pada `disputeCount == 1` agar putaran ke-2 tidak *deadlock*; atomik cek `version`). | **Status Terminal.** Ditutup otomatis sistem agar tiket tidak menggantung selamanya. Bonus dinas **`0` poin (netral)** agar *fake closure* di jalan sepi tidak pernah mendapat hadiah skor; pelapor mendapat `+0.1 trustScore` (maks `2.0`). Tidak memicu penalti pembantah Putaran 1. |

---

## BAB 4 — Aturan Main, Rumus Penilaian & Pengamanan

### A. Pintu Masuk Anti-Hoaks, Anti-NSFW & Anti-Duplikat

1. **Kuota Titik Spasial (`geography(Point, 4326)`):**
   - **Kuota Kategori Sama (`50 m`):** Maksimal `3` laporan aktif (status bukan `CLOSED`, `AUTO_CLOSED`, `OUT_OF_SCOPE`, atau `REJECTED_SPAM`) pada `category` yang sama dalam radius `50 meter` (`ST_DWithin` pada kolom internal `Ticket.location`).
   - **Kuota Global Lintas Kategori (`30 m`):** Maksimal `6` laporan aktif lintas seluruh kategori dalam radius `30 meter` untuk mencegah *category-cycling spam* di satu titik.
   - **Kuota Akun Warga:** Maksimal `5` laporan aktif serentak per akun `WARGA` dan maksimal `10` laporan per `24 jam` (dibebaskan khusus sesi ber-header `X-Jury-Token`, yang dijaga oleh kuota sesi juri global). Pengecekan kuota dilakukan saat membuka kamera dan diulang secara atomik di dalam transaksi `POST /api/tickets` (jika penuh, server menolak dengan `409 Conflict` + daftar tiket aktif sekitar agar UI mengarahkan ke *Dukung Prioritas*).
2. **Efek Dukung Prioritas (`POST /api/tickets/:id/support`):**
   - `1` akun `WARGA` (bukan `reporterId` tiket tersebut dan bukan `ADMIN_DINAS`) hanya bisa mendukung `1x` per tiket, khusus saat status `OPEN` atau `IN_PROGRESS`.
   - Setiap kelipatan `10` dukungan (`10, 20, 30, ...`) memangkas sisa SLA sebesar `15%` **hanya jika** sisa SLA saat ini `> 6 jam`, dengan lantai batas minimal `6 jam`:
     ```text
     slaDeadline_baru = now + max(6 jam, sisaSLA * 0.85)
     ```
   - Begitu `supportCount` mencapai `>= 10`, penalti keterlambatan (`OVERDUE`) digandakan satu kali dari `-3` menjadi **`-6 poin`** (tetap maksimal `-6 poin` meski dukungan mencapai `20` atau lebih, dan tetap berlaku `-6 poin` walau `supportCount` mencapai `10` saat sisa SLA `<= 6 jam`).
3. **Tenggat Waktu SLA Otomatis per Kategori (Pemetaan Baku di Lampiran A):**
   - **Darurat (`24 jam`):** `JALAN_AMBLES`, `KABEL_MENJUNTAI`, `POHON_TUMBANG`.
   - **Menengah (`72 jam`):** `PJU_MATI`, `SAMPAH_LIAR`, `SALURAN_TERSUMBAT`, `REKLAME_LIAR`.
   - **Standar (`168 jam` / `7 hari`):** `JALAN_BERLUBANG`.
4. **Kamera Live & Penyaringan 2 Lapis (Berlaku pada Pelaporan Warga, Bukti Selesai Dinas & Foto Bantahan):**
   - **Blokir Input Galeri:** `<input type="file">` diblokir mutlak untuk seluruh foto lapangan; wajib *WebRTC Live Camera* (`facingMode: "environment"` pada ponsel) dan menolak `MediaStreamTrack.label` kamera virtual (`OBS`, `ManyCam`, `Virtual`, `Snap Camera`, dll.). Satu pengecualian resmi: unggahan dokumen Berita Acara (`application/pdf`, `image/jpeg`, `image/png`, maks `5 MB`) khusus di form penyelesaian `ESCALATED` pada `/dinas`.
   - **Cek Kualitas Piksel (Canvas Kalibrasi Terukur):**
     - *Kecerahan (BT.601 Luminance `Y = 0.299R + 0.587G + 0.114B`, skala `0–255`):* Evaluasi jendela malam (`18.00–05.30 WIB`) wajib dikonversi ke zona waktu `Asia/Jakarta` (`UTC+7`). Foto ditolak jika terlalu silau (`Y > 245`) atau terlalu gelap: `Y < 35` untuk kondisi normal, dan dilonggarkan menjadi **`Y < 12`** khusus jendela malam pada **seluruh 3 kategori Darurat** (`JALAN_AMBLES`, `KABEL_MENJUNTAI`, `POHON_TUMBANG`) serta `PJU_MATI` dan `SALURAN_TERSUMBAT`.
     - *Ketajaman Tepi (Laplacian Variance pada sampel `256 x 256` grayscale):* Memblokir foto buram ekstrem atau lensa tertutup (`variance < 45`). Jika gagal `2x` berturut-turut pada sesi yang sama karena keterbatasan kamera perangkat atau hujan, percobaan ke-`3` diizinkan masuk dengan penanda **`isLowQualityOverride: true`** (tampil normal dengan lencana *"Kualitas Gambar Rendah"*, **bukan** blur sensor NSFW).
   - **Filter NSFW 2-Zona (Client + Backend):** Pemeriksaan berjalan dua lapis menggunakan `nsfwjs` (TensorFlow.js, *lazy import* dan dijalankan *async* pasca-jepret agar halaman `< 2 detik`) plus verifikasi API moderasi di backend (bila API eksternal *timeout* `> 4 detik`, *fail-safe* memakai skor client + menandai **`isNsfwPendingReview: true`**):
     1. *Zona Peringatan (`0.55–0.84`):* Mencegah *false positive* pada foto lumpur/aspal basah malam; UI meminta jepret ulang tanpa penalti.
     2. *Zona Tegas (`>= 0.85` / terkonfirmasi server):* Memblokir unggahan seketika sebelum masuk ke Supabase Storage (*hard-delete*) + memotong `-0.5 trustScore` dan *cooldown* `24 jam`.
   - **Filter Relevansi (Dinas):** Foto yang lolos sensor NSFW namun tidak relevan (swafoto, tembok rumah, hewan peliharaan, atau klaim darurat palsu) dapat ditolak dinas lewat `REJECTED_SPAM` saat status `OPEN` dalam `min(24 jam, 50% SLA awal)` sejak `syncedAt` disertai alasan wajib; berkas non-NSFW dipindah ke *private quarantine* `7 hari` untuk audit, rasio penolakan tayang di `/rapor` (lencana peringatan bila `> 20%`), dan pelapor kena `-0.5 trustScore` (lantai `0.1` pada pelanggaran ke-1) + *cooldown* `24 jam`.
5. **Geofencing, Action-Bound Nonce, Hardening Server & Penanganan Offline:**
   - **Geofencing Sidoarjo–Surabaya:** Koordinat pada `POST /api/tickets` wajib berada di dalam poligon daratan Kab. Sidoarjo & Kota Surabaya (`+ buffer 500 m`, batas poligon ditampilkan di peta `/lapor` dari aset GeoJSON teroptimasi `<= 50 KB`; tolak `422 Unprocessable Entity` jika di luar, kecuali sesi GPS Simulator juri aktif).
   - **Action-Bound Signed Capture Nonce & Urutan `SETNX` Aman Retry:** Untuk MVP, server menerbitkan *online signed capture nonce* (TTL `15 menit`) yang mengikat `{ userId, deviceFingerprint, actionType, ticketId?, jti }` (dukungan `2` token *offline* `IndexedDB` `24 jam` masuk target *Bonus Minggu 4* selaras Bab 7). Urutan proses server wajib: **(1)** cek `Idempotency-Key` lebih dulu, **(2)** jalankan seluruh validasi Zod/geofencing/kuota/NSFW, **(3)** baru eksekusi Redis `SETNX nonce:jti` (`TTL 24 jam`) tepat sebelum upload Storage & commit DB (dengan kompensasi `DEL nonce:jti` + hapus objek Storage yatim bila DB gagal `5xx`). Server memvalidasi akurasi GPS wajib `<= 50 m`, *magic bytes* (`JPEG` / `WebP`), dimensi (`<= 1280 px`), dan ukuran (`<= 450 KB`); karena gambar bersumber dari WebRTC `canvas.toBlob`, metadata EXIF secara alami sudah bersih tanpa perlu parser biner manual.
   - **Tampilan `isNsfwPendingReview: true` vs `isLowQualityOverride: true`:** Foto `isNsfwPendingReview: true` disimpan pada *private bucket/prefix* Storage, tampil *blur-by-default* di `/tiket/:id`, dan baru menampilkan gambar asli via *Signed URL* (`TTL 60 detik`) ketika pengguna menekan *"Tampilkan Gambar"*. Sebaliknya, `isLowQualityOverride: true` tampil normal dengan lencana info *"Kualitas Gambar Rendah"*.
   - **Watermark & Indikator Offline:** Foto diberi watermark jam WIB dan `publicLat`/`publicLng` (`4` desimal `~11 m`). Untuk MVP, bila koneksi terputus UI menampilkan banner status *offline* dan menyimpan draf lokal (sinkronisasi antrean otomatis penuh `IndexedDB` + `2` token *offline* masuk target Bonus Minggu 4).

### B. Aturan Kuorum Validasi, Anti-Deadlock & Hak Suara

1. **Skema Bobot Reputasi Warga (`trustScore` `0.0–2.0`):**
   - Akun baru mulai dari `0.5 poin` (mencegah serangan kloning akun).
   - Naik `1x` ke standar `1.0 poin` setelah memiliki `1` laporan atau validasi sah dengan syarat `violationCount == 0`.
   - Setiap kontribusi hingga status `CLOSED` (termasuk pembantah sah putaran 1 & 2 pada penutupan `ESCALATED`) atau `AUTO_CLOSED` (khusus pelapor) menambah `+0.1 poin` (maks `2.0`).
   - Setiap pelanggaran (NSFW tegas, `REJECTED_SPAM`, atau bantahan palsu yang dibatalkan kuorum warga lain pada putaran banding `isAppealRound == true`) memotong `-0.5 poin` + *cooldown* `24 jam`. Khusus **pelanggaran pertama akun baru (`0.5`)**, skor turun ke lantai **`0.1`** (tidak langsung *freeze* `7 hari` agar warga baru tidak dihukum permanen oleh 1 klik oknum). Akun baru terkena *freeze* `7 hari` (mode baca saja) jika **`violationCount >= 2`** (skor `0.0`) atau terjadi `>= 3` pelanggaran dalam `30 hari`. Pasca-*freeze* (`now > frozenUntil`), akun `0.0` boleh membuat laporan baru (`+0.1` tiap laporan berakhir `CLOSED` / `AUTO_CLOSED`), sedangkan tombol *Sudah Beres* dikunci hingga `trustScore >= 0.5` dan *Klaim Palsu* hingga `>= 1.0`.
   - *Rate limit* (`> 5 laporan/jam` khusus pelapor `WARGA` sebanyak `2x` berturut-turut) memicu *cooldown* `24 jam` (tidak membatasi petugas `ADMIN_DINAS` saat menuntaskan tiket).
2. **Syarat Sah Penutupan (*Sudah Beres* 1-Tap):**
   - Wajib berada dalam radius `<= 100 meter` dari titik tiket (`Ticket.location`, akurasi GPS `<= 50 m`) dan dilakukan pada `validationRound` aktif. Suara per putaran bersifat final (tidak dapat diubah/dihapus).
   - **Snapshot Bobot (`weightAtVote`):** Nilai `trustScore` validator saat menekan tombol disimpan statis ke `TicketValidation.weightAtVote` agar perubahan skor di masa depan tidak mengubah status tiket lama secara retroaktif.
   - **Kuorum Sah Ganda:** Mensyaratkan DUA KONDISI SEKALIGUS pada putaran aktif:
     ```text
     SUM(weightAtVote) >= 2.0 poin  DAN  COUNT(DISTINCT akun warga berbeda) >= 2
     ```
     (dengan `userId` berbeda dan `deviceFingerprint` berbeda — cukup `2` warga standar `1.0 + 1.0` atau `4` warga baru `0.5 x 4`, tetap kebal terhadap 1 akun tunggal).
3. **Hak Suara & *Conflict of Interest* (Pelapor Utama vs Warga vs Dinas):**
   - **Fase 1 Uji Publik (`0–48 jam` sejak `validationStartedAt`):** Pelapor Utama dilarang menekan *Sudah Beres* agar penilaian objektif oleh warga sekitar, namun tetap berhak klik *Klaim Palsu* sejak jam ke-`0` (`<= 100 m`, `trustScore >= 1.0`).
   - **Fase 2 Jendela Pelapor (`48–72 jam` sejak `validationStartedAt`):** Warga sekitar tetap boleh melakukan validasi/bantahan. Jika kuorum belum tercapai dan `disputeCount == 0`, Pelapor Utama mendapat tombol konfirmasi 1-Tap *Sudah Beres* bebas radius. Jika `disputeCount >= 1`, tombol 1-tap pelapor tidak muncul, namun `AUTO_CLOSED` jam ke-`72` tetap berjalan (bonus dinas `+0`).
   - **Larangan Mutlak:** Seluruh akun `ADMIN_DINAS` dilarang *voting*. Pada putaran banding Jalur B (`isAppealRound == true`), pembantah putaran 1 dilarang melakukan *vote* maupun bantahan ke-`2` (hak bantah ke-`2` pada putaran banding hanya untuk warga lain dengan `trustScore >= 1.0`).
4. **Syarat Sah Bantahan (*Klaim Palsu* Anti-Deadlock):**
   - Wajib mengambil foto kamera *live* terbaru (`<= 100 m`, akurasi GPS `<= 50 m`, lolos sensor piksel & NSFW 2-zona) oleh akun dengan `trustScore >= 1.0` agar `1` akun kloningan (`0.5`) tidak bisa menjatuhkan dinas namun warga jujur di jalan sepi tidak mengalami *deadlock*. Status langsung berpindah ke `DISPUTED` (putaran 1) atau `ESCALATED` (putaran 2).

### C. Lapisan Keamanan, Anti-Race Condition & Panel Juri

1. **Rantai Audit Kriptografi (`HMAC-SHA256` Tanpa Bocor UUID):** Setiap transisi status, `OUT_OF_SCOPE`, dan `REJECTED_SPAM` menulis baris berantai ke `AuditLog` yang menyimpan `actorRole` (`WARGA` | `ADMIN_DINAS` | `SYSTEM`), `actorDisplayLabel` (`aliasName` / nama instansi / `"Sistem LaporPAK!"`), serta referensi hash anonim `actorPublicRef = HMAC-SHA256(AUDIT_SALT, actorId)`. Manipulasi manual `1` baris saja di database langsung terdeteksi sebagai `tampered` oleh endpoint publik `GET /api/tickets/:id/audit-verify`:
   ```text
   currentHash = HMAC-SHA256(SERVER_SECRET, ticketId || actorPublicRef || action || timestampMs || prevHash)
   ```
2. **Transaksi Anti-Race Condition:** Validasi dan *worker* transisi dibungkus transaksi Prisma memakai *row locking* (`SELECT FOR UPDATE`), *optimistic locking* (`version`), dan constraint unik `UNIQUE(ticketId, validatorId, validationRound)` + `UNIQUE(ticketId, deviceFingerprint, validationRound)` sehingga suara putaran 1 terisolasi aman dari putaran 2 dan *worker* `AUTO_CLOSED` tidak pernah menabrak bantahan detik terakhir.
3. **Caching Redis, Anti-Fake GPS & Standar `deviceFingerprint`:** Upstash Redis menyimpan cache peta (TTL `45 detik`) dan rapor (TTL `180 detik`) dengan *explicit invalidation* (`DEL`) di setiap *write*/*reset*, mengonsumsi *capture nonce* (`SETNX`), dan memblokir *Impossible Travel* (`> 120 km/jam` di seluruh aksi ber-GPS — hanya dihitung jika kedua titik aksi berakurasi GPS `<= 50 m`). Untuk stabilitas lintas browser (termasuk Safari/iOS), `deviceFingerprint` dibentuk dari `SHA-256(clientInstallId + userAgent + screenSize + hardwareConcurrency)` dan dikirim lewat `X-Device-Fingerprint`.
4. **Panel Simulasi Juri (`?jury_token=...`):** Tersembunyi dari publik, persisten lintas rute via `sessionStorage` + header `X-Jury-Token`, dibatasi *rate limit* (`30 mutasi / 10 menit`, maks `50` tiket simulasi aktif), dan dilengkapi `5` alat uji cepat:
   1. *Role Switcher Instan:* Ganti peran `1` klik (Warga Pelapor, Warga Validator, Admin Dishub, Admin PU, Admin DLH, Admin Satpol PP).
   2. *GPS Simulator:* Loncat koordinat ke lokasi tiket mana pun (otomatis melewati blokir *Impossible Travel* & geofencing khusus sesi juri).
   3. *Simulasi Jepret Kamera Lapangan:* *Fallback* desktop tanpa webcam; otomatis meminta *capture nonce* sah dan menyuntikkan foto sampel terkalibrasi (`Y` di `[50, 220]`, `Laplacian >= 80`) dari `public/samples/` ke pipeline kompresi + watermark + sensor piksel/NSFW.
   4. *Percepat Waktu Tiket (`+25 jam` / `+49 jam`):* Menggeser `slaDeadline` / `validationStartedAt` / `disputedAt` tiket agar juri dapat menguji `OVERDUE`, auto-*rework* `DISPUTED`, jendela `48–72 jam`, dan `AUTO_CLOSED` dalam hitungan detik.
   5. *Reset Demo (Isolasi `isDemoData`):* Mengembalikan data simulasi (`isDemoData: true`) dan skor `4` dinas ke *clean seed* secara atomik (tanpa menghapus akun warga asli `isDemoData: false` yang mendaftar via Supabase Auth) sekaligus membersihkan cache Redis (`DEL`).

---

## BAB 5 — Matriks Kondisi Layar, UX Pengguna Awal (*User Awam*) & Kepercayaan Publik

Tema visual memakai **Civic Tactical with Progressive Depth** dengan warna brand **Teal (`#0F766E` / `#2DD4BF` di gelap)** (selaras `docs/design.md`: tema `warm` terang hangat di `/` & `/dinas`, `blueprint` di `/lapor` & `/tiket/:id`, dan `slate` *Deep Command Slate* `#0F172A` di `/rapor` & panel hash) bersama `2` maskot orisinal **Cak Pantau** (Warga, kiri) dan **Mas Sigap** (Petugas, kanan).

### 5.A Matriks Kondisi Layar & Edge-Case UI (5 Halaman + Login + 1 Drawer)

| Halaman | Kondisi Normal (*Happy Path*) | Kondisi Ekstrem / Edge-Case & Perilaku UI |
| :--- | :--- | :--- |
| **`/`** <br> *(Beranda & Peta Publik)* | *Hero* ringkas dengan **Cak Pantau & Mas Sigap**, jelaskan fungsi dalam `< 5 detik` (*"Foto Masalahnya, Pantau Tenggat Dinasnya, Kawal Sampai Beres"*), 1 tombol utama **Lapor Kerusakan** & pratinjau angka nyata (*laporan aktif, rata-rata waktu selesai*), menyambung ke peta Leaflet & timer SLA. | **Pengguna Baru (Belum Login):** Tetap bebas lihat peta, foto *before–after*, dan `/rapor` tanpa dinding login (*minimum path to value*). <br> **Filter Kosong:** Tampilkan pose maskot Siaga + pesan *"Belum ada laporan di filter ini"* + tombol **"Reset Filter Peta"**. <br> **Koneksi Lambat:** Tampilkan *skeleton loader* peta & data cache terakhir Redis. |
| **`/login`** <br> *(Gerbang Masuk)* | `1` form email/password + tombol **Masuk dengan Google** bagi warga, dilengkapi kartu jaminan privasi sebelum masuk. | **Takut Identitas Bocor:** Tampilkan catatan jelas tepat di bawah tombol login: *"Nama asli & emailmu tidak pernah tampil di peta/dinas — otomatis disamarkan jadi alias acak (misal `Warga-Delta-402`)."* <br> **Sesi Kedaluwarsa:** Arahkan ulang dengan pesan tenang *"Sesi berakhir, masuk lagi untuk melanjutkan"* tanpa menghapus draf lokal. |
| **`/lapor`** <br> *(Buat Laporan Baru)* | **Langkah 1:** Pilih pin/GPS & kategori -> langsung tampilkan laporan aktif sekitar (`<= 50 m`) sebelum kamera dibuka -> **Langkah 2:** Kamera *live* WebRTC -> **Langkah 3:** Isi catatan singkat & kirim. | **Izin GPS / Kamera Ditolak Browser:** Dilarang layar kosong; tampilkan kartu pemulihan langkah demi langkah (*"Izin kamera/GPS mati — ketuk ikon gembok di bilah alamat -> Izinkan -> Muat Ulang Posisi"* + tombol **Coba Lagi**). <br> **GPS Tidak Akurat (`> 50 m`):** Tampilkan info jarak aktual + saran praktis (*"Akurasi GPS masih 82 m. Menepi ke area terbuka agar posisi akurat <= 50 m"* + tombol **Perbarui Lokasi**). <br> **Luar Poligon / Kuota Penuh (`3/3` di `50 m` atau `6/6` di `30 m`, termasuk `409` saat *sync*):** Sebelum kamera dibuka (atau saat `check-radius`), tampilkan kartu daftar tiket aktif sekitar + tombol **Dukung Prioritas** (hindari warga memotret sia-sia baru ditolak). <br> **Tanya "Kenapa Tidak Bisa Dari Galeri?":** Tampilkan teks helper singkat di tombol kamera: *"Wajib foto langsung di lokasi agar terbukti kejadian nyata & baru (cegah hoaks). Menepi di tempat aman sebelum memotret."* <br> **Foto Gelap/Blur/NSFW:** Zona `0.55–0.84` atau blur ke-1/ke-2 minta jepret ulang tanpa penalti (blur ke-3 lanjut via `isLowQualityOverride: true`); zona `>= 0.85` blokir total + peringatan `-0.5` & *cooldown*. <br> **Kamera Virtual / Tanpa Webcam:** Blokir OBS/Virtual dengan penjelasan tenang; untuk juri ber-token muncul tombol *Simulasi Jepret Kamera Lapangan*. <br> **Koneksi Putus Saat Kirim / Validasi Gagal:** Input deskripsi, kategori, dan hasil jepret **dilarang hilang**; tombol kirim terkunci (*spinner* *"Mengirim laporan..."*) lalu munculkan tombol **Kirim Ulang** memakai `Idempotency-Key` sama (cegah dobel tiket). <br> **Offline / Freeze / Limit Akun:** Simpan draf lokal (SLA mulai saat `syncedAt`); akun *cooldown*/*freeze* atau batas `5` tiket aktif menampilkan alasan spesifik + hitung mundur buka blokir. |
| **`/tiket/:id`** <br> *(Detail & Uji Publik)* | Foto Sebelum vs Sesudah berdampingan (*Before–After Slider*), metadata jarak & jam ambil foto dinas (`"Diambil 18 m dari titik laporan · 20 Nov 14:22 WIB"`), bar kuorum (`x / 2.0 poin` & jumlah warga), tombol validasi, dan panel Segel Anti-Rekayasa (`HMAC-SHA256`). | **GPS Luar Radius `100 m` atau Akurasi `> 50 m`:** Tombol *Sudah Beres* & *Klaim Palsu* nonaktif dengan teks persis di bawah tombol (*"Kamu berjarak 240 m dari lokasi, perlu <= 100 m"*). <br> **Pelapor Utama Jam `0–48` vs `48–72`:** Jam `0–48`: *Sudah Beres* diganti banner penjelas netralitas (*"Menunggu cek warga sekitar dulu agar adil; kamu tetap bisa Klaim Palsu bila perbaikan fiktif <= 100 m"*). Jam `48–72`: tombol 1-tap *Sudah Beres* bebas radius hanya muncul jika `disputeCount == 0`. <br> **Akun Baru (`trustScore 0.5`) pada *Klaim Palsu*:** Di mobile tooltip hover tidak bekerja -> tampilkan teks penjelasan tepat di bawah tombol terkunci: *"Skor kamu 0.5. Tuntaskan 1 laporan atau validasi 'Sudah Beres' agar naik ke 1.0 dan membuka hak Klaim Palsu."* <br> **Foto `isNsfwPendingReview: true` vs `isLowQualityOverride: true`:** NSFW pending tampil *blur-by-default* + tombol *"Tampilkan Gambar"* (Signed URL `60s`); kualitas rendah tampil normal dengan lencana info *"Foto buram (kualitas terbatas)"*. <br> **Bukan `OPEN` / `IN_PROGRESS` atau Pelapor Sendiri:** Tombol *Dukung Prioritas* nonaktif dengan alasan singkat di bawahnya. <br> **Konflik Status Bersamaan (`409`):** Toast ramah *"Status laporan baru saja diperbarui pengguna/dinas lain"* + *auto-refresh* data terbaru (jangan pernah tampilkan angka `409` mentah). |
| **`/dinas`** <br> *(Meja Kerja Pemerintah)* | Daftar tiket terurut dari `OVERDUE` & sisa SLA tersingkat; tombol *Mulai Kerjakan*, *Oper Tiket*, *Tolak Spam*, *Di Luar Wewenang*, dan *Laporkan Selesai*. | **Akses oleh Warga:** *Redirect* otomatis ke `/` dengan pesan sopan (*"Halaman ini khusus petugas instansi terdaftar"*). <br> **Oper Tiket & Tolak Spam Terkunci:** Nonaktif otomatis bila status bukan `OPEN` atau lewat `min(24 jam, 50% SLA awal)` sejak `syncedAt` (`12 jam` Darurat) beserta alasan di tooltip; Oper Tiket maks `1x`. <br> **`OUT_OF_SCOPE` & `REJECTED_SPAM`:** Modal wajib isi instansi rujukan baku (`>= 20` karakter) / alasan penolakan (`>= 15` karakter) dengan konter huruf `n/15` / `n/20`. <br> **Tiket `DISPUTED`:** Tampilkan hitung mundur `24 jam` batas respons sebelum auto-paksa ke `IN_PROGRESS`; tombol *Ajukan Banding Bukti* hilang permanen setelah `1x` dipakai. <br> **GPS Petugas `> 75 m` / Tiket `ESCALATED`:** Tombol selesai terkunci bila `> 75 m` (atau akurasi `> 50 m`); khusus `ESCALATED` mewajibkan `2` unggahan: berkas Berita Acara (`<= 5 MB`) + Foto *Live* (`<= 75 m`). |
| **`/rapor`** <br> *(Rapor Instansi & Heatmap)* | Tema *Deep Command Slate*, papan skor `4` instansi (`0–100`), keterangan jelas cara skor dihitung (*"Mulai skor 80; tepat waktu +2, telat -3/-6, eskalasi -5"*), rasio SLA, jumlah `OVERDUE` (termasuk `isChronicOverdue`), rasio `OUT_OF_SCOPE` (`> 25%`) & `REJECTED_SPAM` (`> 20%`), serta peta klaster/panas. | **Filter Kategori Nihil:** Grafik menampilkan angka `0` secara bersih tanpa *error render* dan peta menampilkan *"Belum ada titik kerusakan di kategori ini"* + tombol **"Lihat Semua Kategori"**. |
| **Profile Drawer** <br> *(Panel Geser)* | Menampilkan `aliasName`, bar `trustScore` + panduan singkat cara menaikkan skor, status *cooldown*/*freeze*, riwayat laporan & validasi, serta antrean draf lokal. | **Ada Antrean / Draf Lokal:** Menampilkan jumlah tertunda, sisa masa `24 jam`, dan tombol manual **"Sinkronkan Sekarang"**. |

### 5.B Alur & Penjaga Pengguna Awal (*User Awam*) — 5 Aturan Anti-Bingung

1. **Pahami Web dalam 5 Detik & Tanpa Dinding Login Awal:** Pengunjung langsung melihat peta kerusakan nyata, status warna + ikon (bukan warna saja), dan sisa waktu perbaikan di `/` sebelum diminta login.
2. **Privasi Dijelaskan *Sebelum* Prompt Browser Muncul:** Sistem wajib menampilkan kartu penjelas humanis di `/login` dan pra-kamera `/lapor` (*alias acak*, pembulatan lokasi publik `~11 m`, foto tanpa EXIF) agar warga berani melapor tanpa takut terlacak oknum.
3. **Cegah Foto Sia-Sia di Awal `/lapor`:** Pengecekan poligon wilayah & kuota titik (`GET /api/tickets/check-radius`) dijalankan *sebelum* pengguna membuka kamera, dan jika lokasi sudah penuh, langsung menawarkan `1` klik **Dukung Prioritas** pada laporan tetangga.
4. **Input Tidak Pernah Hilang & Anti Klik Ganda:** Saat menekan tombol kirim/validasi/aksi dinas, tombol langsung masuk status *loading* + nonaktif dengan label konkret (*"Mengirim laporan..."*, *"Menyimpan bukti..."*); bila gagal jaringan, seluruh isian teks dan foto tetap utuh untuk **Coba Lagi** via `Idempotency-Key`.
5. **Tidak Ada Jalan Buntu (*Zero Dead-End*) & Ramah Sentuh Mobile:** Semua pesan tombol terkunci pada aksi warga (`Jarak > 100 m`, `Skor 0.5 < 1.0`, `Cooldown`) tampil sebagai teks terbaca di bawah tombol (bukan hanya *hover tooltip*), dan setiap layar gagal/kosong menyediakan tombol pemulihan (**Coba Lagi**, **Muat Ulang GPS**, **Reset Filter**, atau **Kembali ke Peta**).

### 5.C Pilar Kepercayaan Publik (*Public Trust*) & Kamus Bahasa Manusia (Anti-Jargon)

Kepercayaan pengguna awam dibangun melalui **4 bukti konkret** yang tampak langsung di antarmuka:
1. **Bukti Lokasi & Waktu Nyata di Slider `/tiket/:id`:** Di bawah foto *Before–After*, API & UI menampilkan jarak pengambilan foto petugas dari titik asli (`repairDistanceMeters`, dibulatkan meter terdekat tanpa membocorkan koordinat presisi) + stempel waktu `WIB` — membuktikan foto bukan editan lama dari tempat lain.
2. **Transparansi Penolakan & Rujukan:** Saat dinas menolak (`REJECTED_SPAM`) atau melempar (`OUT_OF_SCOPE`), pelapor melihat **alasan lengkap & instansi rujukan** di linimasa tiket, sementara rasio penolakan dinas dipajang permanen di `/rapor` agar dinas tidak sembarangan membuang laporan warga.
3. **Penjelasan Sederhana *Segel Anti-Rekayasa* (`HashPanel`):** Panel audit di `/tiket/:id` wajib menyertakan 1 kalimat awam di atas kode hash: *"Setiap perubahan status dikunci segel digital. Jika ada yang mengubah jam/status diam-diam di server, tombol di bawah akan langsung mendeteksi pelanggaran."* Nama aktor tetap tampil jelas sebagai `Warga-Delta-402` / `Dishub` / `Sistem LaporPAK!`.
4. **Dilarang Bocor Istilah Teknis / HTTP Mentah ke Layar:** Kode status `OPEN`/`OVERDUE` maupun error `409`/`422`/`500`/`UUID`/`HMAC`/`EOF` **wajib** diterjemahkan lewat kamus berikut:

| Kode Sistem (BE/DB) | Label Resmi di UI Warga & Dinas | Pesan Error Ramah Warga (Jika Gagal/Ditolak) |
| :--- | :--- | :--- |
| `OPEN` | **Laporan Masuk** | *(409 Kuota Titik Penuh)* -> *"Titik sekitar sudah memiliki laporan aktif serupa. Yuk Dukung Prioritas agar penanganannya lebih cepat."* |
| `IN_PROGRESS` | **Sedang Ditangani** | *(409 Konflik Status)* -> *"Data baru saja diperbarui pengguna atau petugas lain. Tampilan sudah disegarkan ke kondisi terbaru."* |
| `OVERDUE` | **Melewati Tenggat** | *(422 Luar Wilayah)* -> *"Lokasi pin berada di luar wilayah layanan Surabaya & Sidoarjo. Geser pin ke dalam garis batas peta."* |
| `PENDING_VALIDATION` | **Menunggu Cek Warga** | *(401/403 Nonce / Sesi)* -> *"Sesi atau token foto sudah kedaluwarsa. Silakan ambil foto ulang atau masuk kembali."* |
| `DISPUTED` | **Dibantah Warga** | *(429 Terlalu Banyak / Cooldown)* -> *"Akun sedang dalam masa jeda atau mencapai batas laporan aktif. Coba lagi setelah hitung mundur selesai."* |
| `ESCALATED` | **Eskalasi Pengawasan** | *(5xx Gangguan Server)* -> *"Server sedang sibuk atau koneksi terputus. Isian dan fotomu tetap aman — tekan Coba Lagi."* |
| `CLOSED` | **Tuntas Terverifikasi** | `OUT_OF_SCOPE` -> **Kewenangan Instansi Lain** \| `REJECTED_SPAM` -> **Ditolak (Tidak Relevan/Spam)** \| `AUTO_CLOSED` -> **Ditutup Otomatis (72 Jam)** |

---

## BAB 6 — User Stories (Urut Sesuai Ketergantungan Teknis)

### Tahap 1 — Fondasi Database, Auth & Keamanan Inti
- **`US-001` (Skema Prisma + PostGIS `geography` & Seeding Wilayah):** `5` model utama (`Department`, `User`, `Ticket`, `TicketValidation`, `AuditLog`) + tabel relasi `TicketSupport`, `10` enum status, `8` enum kategori (Lampiran A), `@default(80)` pada `Department.integrityScore`, kolom `version`, `validationRound`, `isAppealRound`, `weightAtVote`, `remainingSlaMs`, `validationStartedAt`, `disputedAt`, `isChronicOverdue`, `overduePenalized`, `violationCount`, `isDemoData`, `isNsfwPendingReview`, `isLowQualityOverride`, pemisahan `location` (`geography(Point, 4326)`) vs `publicLat`/`publicLng` (4 desimal), constraint `UNIQUE(ticketId, validatorId, validationRound)` + `UNIQUE(ticketId, deviceFingerprint, validationRound)`, serta `seed.ts` (`4` dinas Sidoarjo–Surabaya, akun mitra, `25–30` tiket simulasi `isDemoData: true` mencakup `10` status + `1` tiket jam ke-`50`, dan akun demo `Warga Pelapor` maksimal memiliki `2` tiket aktif agar siap uji `/lapor`).
- **`US-002` (Supabase Auth 1 Pintu, Alias Publik & Middleware Role):** Login/registrasi email & Google OAuth (`WARGA` + `aliasName` acak), `4` akun `ADMIN_DINAS` seed, halaman bonus `/aktivasi-mitra`, proteksi `departmentId`, sanitasi UUID di endpoint publik, serta verifikasi *signed* `X-Jury-Token` (`4 jam`, blokir `403` mutasi data `isDemoData: false`, *rate limit* juri `30/10 menit`, bypass limit 5 tiket aktif khusus akun simulasi juri).
- **`US-003` (Rantai Hash `HMAC-SHA256` & Endpoint Verifikasi):** Menulis log audit berantai kriptografi menggunakan `actorPublicRef`, `actorRole`, dan `actorDisplayLabel` pada setiap perubahan status (termasuk `OUT_OF_SCOPE` & `REJECTED_SPAM`) dan menyediakan `GET /api/tickets/:id/audit-verify`.
- **`US-004` (Lazy Evaluation Utama, Cron Cadangan & Upstash Redis):** *Lazy Evaluation* atomik (`version` check saat `GET`/mutasi) sebagai mesin utama transisi `OVERDUE` (maks `1x`), sticky `isChronicOverdue` (`now - slaDeadline > slaInitialHours`), auto-*rework* `DISPUTED` (`> 24 jam` deterministik), dan `AUTO_CLOSED` (`> 72 jam`), dibantu Vercel Cron harian untuk tiket pasif; cache peta (`45 detik`) & rapor (`180 detik`) dengan *explicit* `DEL`; konsumsi nonce `SETNX` (pasca-validasi + kompensasi rollback); *rate limiter* `WARGA` (`5/jam` & `10/24 jam`); *Impossible Travel* (`> 120 km/jam` khusus GPS `<= 50 m`); serta `deviceFingerprint`.

### Tahap 2 — Mesin API Warga & Instansi
- **`US-005` (Cek Radius `geography`, Buat Tiket Atomik & Dukung Prioritas):** Endpoint `check-radius` (`50 m` kategori sama maks `3` & `30 m` global maks `6`), pembuatan tiket atomik (urutan: cek `Idempotency-Key` -> validasi -> `SETNX` nonce -> upload Storage -> commit DB; `409 Conflict` jika kuota penuh, maks `5` tiket aktif per akun) dengan SLA berdasar `syncedAt`, plus `POST /api/tickets/:id/support` (`OPEN` / `IN_PROGRESS`, bukan pelapor sendiri, pangkas `15%` hanya bila `sisaSLA > 6 jam` dengan lantai `6 jam`, dan penalti maksimal `-6 poin` saat dukungan `>= 10`).
- **`US-006` (API Kerja Dinas Lengkap):** Endpoint `process`, `transfer` (`OPEN`, `min(24 jam, 50% SLA)` dari `syncedAt`, `1x`, buffer `>= 12 jam`, wajib alasan), `out-of-scope` (wajib instansi rujukan baku + catatan), `reject-spam` (`OPEN` dalam `min(24 jam, 50% SLA)` dari `syncedAt`, wajib alasan, *private quarantine* `7 hari` non-NSFW / *hard-delete* NSFW + `-0.5` lantai `0.1` pelanggaran ke-1 + `24 jam`), `resolve` (`<= 75 m` + simpan `remainingSlaMs` + NSFW 2-zona), `reprocess-disputed` (`isAppealRound = false`, `max(0, remainingSlaMs) + 24 jam`), `counter-dispute` (`1x`, `isAppealRound = true`, tanpa reset `disputeCount`), dan `resolve-escalated` (Berita Acara `<= 5 MB` + foto *live* `<= 75 m`).
- **`US-007` (API Validasi Warga `<= 100 m` & Anti-Race Condition):** Transaksi `SELECT FOR UPDATE` + `version`, kuorum ganda (`>= 2.0 poin` DAN `>= 2` akun & perangkat berbeda) di `validationRound` aktif, hak bantah Pelapor Utama jam `0–48` (`<= 100 m`) + konfirmasi 1-tap jam `48–72` bebas radius **khusus jika `disputeCount == 0`** (`AUTO_CLOSED` jam `72` tetap berjalan dengan bonus dinas `0`), syarat `trustScore >= 1.0` untuk *Klaim Palsu*, larangan pembantah Putaran 1 saat `isAppealRound == true`, serta vonis komunitas untuk penalti pembantah Putaran 1 khusus saat `isAppealRound == true` berakhir `CLOSED`.

### Tahap 3 — Antarmuka Custom, Kamera & Panel Juri
- **`US-008` (Design System Civic Tactical, Maskot & Profile Drawer):** Komponen UI `100%` *custom* Tailwind tanpa template, aset orisinal Cak Pantau & Mas Sigap, serta *Slide-Over Profile Drawer*.
- **`US-009` (Kamera Live WebRTC, Action-Bound Nonce, Lazy `nsfwjs` & Offline Indikator):** Blokir galeri & kamera virtual, *Online Action-Bound Signed Capture Nonce* (`15 menit`; `2` token *offline* `IndexedDB` masuk Bonus Minggu 4), output `canvas.toBlob` bebas EXIF + cek *magic bytes* di server, cek kecerahan `Asia/Jakarta` (BT.601, malam `Y >= 12` untuk 3 Darurat + PJU + Saluran) & ketajaman Laplacian (`isLowQualityOverride`), muat `nsfwjs` via `React.lazy()` / dynamic `import()` (Vite) *async* pasca-jepret, filter NSFW 2-zona (`isNsfwPendingReview` Signed URL `60s`), kompresi `<= 450 KB` + watermark GPS `4` desimal, serta indikator koneksi + draf lokal.
- **`US-010` (Panel Simulasi Juri `?jury_token=`):** *Role Switcher*, *GPS Simulator*, *Simulasi Jepret Kamera Lapangan* (foto sampel terkalibrasi + auto-nonce), *Percepat Waktu Tiket* (`+25 jam` / `+49 jam`), dan *Reset Demo* (+ `DEL` Redis).
- **`US-011` s.d. `US-015` (5 Layar Inti Aplikasi):** Implementasi penuh `/`, `/lapor`, `/tiket/:id`, `/dinas`, dan `/rapor` beserta seluruh *edge-case* Bab 5.

---

## BAB 7 — Matriks Prioritas Pengerjaan (MVP Wajib Jadi vs Bonus)

Agar tim tidak kehabisan waktu menjelang tenggat **18 Desember 2026**, seluruh fitur dibagi ketat ke dalam dua tingkat prioritas:

| Prioritas | Daftar Fitur & Modul | Target Selesai |
| :--- | :--- | :--- |
| **WAJIB JADI** <br> *(MVP Inti Lomba)* | - Skema Prisma + PostGIS `geography` (`validationRound`, `isAppealRound`, `remainingSlaMs`, `version`, `8` kategori, `10` status) + `25–30` data *seed* <br> - Auth 1 pintu Supabase (Warga + `4` Akun Dinas) & Alias Publik <br> - `5` Halaman Utama (`/`, `/lapor`, `/tiket/:id`, `/dinas`, `/rapor`) + Profile Drawer <br> - Peta Leaflet + geofencing GeoJSON + cek kuota atomik (`3/3` kategori `50 m` & `6/6` global `30 m`) + *Dukung Prioritas* (*floor* `6 jam`) <br> - *WebRTC Live Camera* + kompresi Canvas + cek piksel terkalibrasi + Filter NSFW 2-zona + *Action-Bound Nonce* + `REJECTED_SPAM` *hard-delete* <br> - Alur penuh `10` status (`DISPUTED` *rework* `max(0, sisa) + 24 jam`, `ESCALATED` + Berita Acara PDF, kuorum ganda) <br> - Rantai hash `HMAC-SHA256` anonim, *Lazy Evaluation* SLA & *explicit cache invalidation* Redis <br> - Panel Simulasi Juri `5` alat lengkap (Role + GPS + Fallback Kamera + Percepat Waktu + Reset Demo) <br> - `2` Maskot utama (Cak Pantau & Mas Sigap) pose standar | **Minggu 1 – Minggu 3** <br> *(Kunci fitur: 12 Desember 2026)* |
| **BONUS** <br> *(Jika MVP `100%` Stabil)* | - `5` variasi ekspresi pose dinamis untuk masing-masing maskot <br> - Halaman mandiri `/aktivasi-mitra` (kode undangan kerja sama dinas baru) <br> - Visualisasi *Heatmap* gradien kompleks di `/rapor` (MVP cukup klaster marker warna) <br> - Sinkronisasi antrean *offline* IndexedDB otomatis penuh (MVP cukup indikator koneksi + simpan draf lokal) <br> - Notifikasi email/*push* pengingat jam ke-`48` ke Pelapor Utama (MVP cukup lencana notifikasi di dalam aplikasi) | **Minggu 4** <br> *(13–16 Des 2026, paralel produksi Video Demo)* |

---

## BAB 8 — Batasan Ruang Lingkup (*Non-Goals*) & Metrik Keberhasilan

### Yang Tidak Dibangun (*Out of Scope*)
- Tidak terhubung ke server/API internal instansi pemerintah asli (menggunakan database mandiri & data simulasi realistis Sidoarjo–Surabaya).
- Tidak membangun aplikasi *mobile native* Android/iOS (APK/IPA) maupun fitur ruang obrolan (*chat*) bebas.
- Tidak menyediakan tombol **Penurunan Kategori/SLA** oleh dinas (misal menurunkan `JALAN_AMBLES` `24 jam` ke `JALAN_BERLUBANG` `168 jam`) agar oknum dinas tidak bisa menyabotase tenggat darurat; penyalahgunaan kategori darurat palsu ditangani via `REJECTED_SPAM` (`<= 12 jam`).

### Metrik Keberhasilan Kompetisi
- **Kinerja & Kestabilan (Bobot `30%`):** Seluruh halaman & peta terbuka `< 2 detik` di tautan Vercel publik (*Vercel Authentication* nonaktif) tanpa *error* konsol maupun gagal transaksi konkurensi.
- **Kelancaran Uji Juri:** Siklus penuh tuntas `< 3 menit` lewat Panel Juri meski dari PC tanpa webcam; URL lengkap beserta `?jury_token=...` wajib dicantumkan di baris teratas `README.md` GitHub dan awal Video Demo.
- **Kepatuhan Rulebook:** `1` GitHub Monorepo, UI `100%` *custom*, aset maskot orisinal, dan video demo Google Drive (akses *viewer*) terkumpul sebelum **18 Desember 2026, 23.59 WIB**.

---

## BAB 9 — Checklist Penguncian 32 Edge-Case & Anti-Eksploitasi (QA Master Final)

Tabel berikut merangkum seluruh **32 celah logika, keamanan, privasi & performa** (`#1–#18` v3.2 + `#19–#26` Audit v3.3 + `#27–#32` Audit Final v3.4) sebagai daftar periksa wajib QA tim:

| No | Level | Celah yang Ditemukan | Solusi Terkunci di Spesifikasi (Bab 2–8) |
| :--- | :--- | :--- | :--- |
| **#1** | KRITIS | Konflik Kepentingan *Tolak Bantahan* & Loop | Dibatasi maks `1x` per tiket (`isAppealRound = true`), `disputeCount` tidak di-reset, dan penalti pembantah `-0.5 + 24 jam` aktif **hanya** bila putaran banding berakhir `CLOSED` oleh `>= 2` warga lain. |
| **#2** | KRITIS | Tabrakan `UNIQUE(ticketId, validatorId)` Putaran ke-`2` | Ditambah kolom `validationRound` (default `1`, naik `+1` setiap masuk `PENDING_VALIDATION`), constraint diubah ke `UNIQUE(ticketId, validatorId, validationRound)` + `deviceFingerprint`, dan kuorum di-reset ke `0`. |
| **#3** | KRITIS | SLA *Rework* `DISPUTED` Negatif & Double `OVERDUE` | Menyimpan `remainingSlaMs` saat masuk `PENDING_VALIDATION`; rumus *rework* dikunci ke `max(0, remainingSlaMs) + 24 jam`, penalti `OVERDUE` maksimal `1x` (`overduePenalized`), dan evaluasi *Lazy Evaluation* atomik. |
| **#4** | KRITIS | *False Positive* `nsfwjs`, Bypass API & Kebocoran Foto | Diterapkan `2` Zona Skor (`0.55–0.84` ulang tanpa penalti; `>= 0.85` / server blokir `-0.5 + 24 jam`) di `3` titik unggah foto + *fail-safe timeout* (`> 4 detik` `isNsfwPendingReview: true`). Foto NSFW/`REJECTED_SPAM` dihapus permanen (*hard-delete*) dari Storage. |
| **#5** | TINGGI | *Stale Cache* Redis, Sesi `?jury_token` & Isolasi Reset Demo | Wajib `DEL` Redis tiap mutasi & Reset Demo; simpan token di `sessionStorage` + `X-Jury-Token`; Reset Demo hanya mereset baris `isDemoData: true` & skor `4` dinas tanpa menyentuh akun warga riil. |
| **#6** | TINGGI | Ambiguitas Hak Pelapor Utama (`0–48 jam` vs `48–72 jam`) | Pelapor Utama boleh *Klaim Palsu* sejak jam ke-`0` (`<= 100 m`, `trustScore >= 1.0`); di jam `48–72` warga sekitar tetap bisa *vote*/bantah dan Pelapor Utama dapat konfirmasi 1-tap *Sudah Beres* bebas radius (khusus `disputeCount == 0`). |
| **#7** | TINGGI | Eksploitasi *Oper Tiket*, `OUT_OF_SCOPE` & `REJECTED_SPAM` Mepet SLA | *Oper Tiket* & `REJECTED_SPAM` hanya aktif di `OPEN` maks `min(24 jam, 50% SLA awal)` sejak `syncedAt` (`= 12 jam` Darurat); buffer oper `max(Sisa SLA, 12 jam)`. `OUT_OF_SCOPE` & `REJECTED_SPAM` wajib isi rujukan/alasan, masuk `AuditLog`, dan tampil di `/rapor`. |
| **#8** | TINGGI | Rumus Skor, *Floor* `6 jam`, Kuorum `2.0`, Pemulihan `0.0` & Bonus Pembantah | `integrityScore` di-clamp `[0, 100]`; `AUTO_CLOSED` beri bonus **`0` (netral)**; kuorum `>= 2.0` poin DAN `>= 2` akun berbeda; `CLOSED` via `ESCALATED` beri `+0.1` ke pelapor + pembantah 1 & 2. Pelanggaran ke-1 akun baru (`0.5`) turun ke lantai `0.1` + cooldown `24j` (*freeze* `7 hari` aktif mulai pelanggaran ke-2 / `>= 3` dalam 30 hari). |
| **#9** | MENENGAH | Kontradiksi Blokir `<input type="file">` vs Berita Acara | Blokir `<input type="file">` berlaku mutlak untuk foto lapangan, dengan `1` pengecualian resmi: dokumen Berita Acara `ESCALATED` (`PDF/JPG/PNG <= 5 MB`) wajib didampingi Foto *Live* `<= 75 m`. |
| **#10** | MENENGAH | *Race Condition* Kuota `50 m` & Draf Offline Basi | Re-cek kuota `50 m` secara atomik di dalam transaksi `POST /api/tickets` (`409` *Dukung Prioritas*). Untuk *offline*, SLA dimulai dari `syncedAt`, kedaluwarsa `24 jam`, dan konflik kuota saat *sync* dialihkan ke dukungan. |
| **#11** | MENENGAH | *Mismatch* Timezone Vercel (UTC), Wi-Fi Sama & *Impossible Travel* | Jendela malam `18.00–05.30` dievaluasi di `Asia/Jakarta` (`UTC+7`). Anti-Sybil pakai hash hardware/browser (`deviceFingerprint`). *Impossible Travel* (`> 120 km/jam`) hanya dihitung bila kedua titik aksi berakurasi GPS `<= 50 m`. |
| **#12** | MENENGAH | Belum Ada Pemetaan Tunggal Kategori <-> SLA <-> Dinas | Dikunci 1-ke-1 ke dalam `8` kategori baku di Lampiran A sebagai satu-satunya acuan kode Prisma, dropdown UI, instansi *default*, durasi SLA, dan aturan foto malam. |
| **#13** | KRITIS | Penyalahgunaan `?jury_token=` Publik & Auto-Tagging Demo | Header `X-Jury-Token` memakai *signed token* server (`4 jam`), menolak (`403`) mutasi data `isDemoData: false`, dan otomatis menandai semua *record* baru dari sesi juri sebagai `isDemoData: true`. |
| **#14** | KRITIS | *Deadlock* `DISPUTED` Tanpa Batas Respons & Bonus Waktu Lazy Eval | Ditambahkan batas respons `24 jam` sejak `disputedAt`; bila lewat, sistem otomatis memaksa Jalur A (`IN_PROGRESS`) secara deterministik (`reworkStart = disputedAt + 24 jam`, bukan `now`). |
| **#15** | KRITIS | Bypass API Kamera, EXIF GPS & Beban Offline Nonce | MVP pakai *Online Action-Bound Nonce* (`15 menit`; `2` token *offline* `IndexedDB` masuk Bonus Minggu 4), output WebRTC `canvas.toBlob` secara alami bebas EXIF + validasi *magic bytes* & ukuran di server. |
| **#16** | TINGGI | Konfirmasi Sepihak Pelapor Pasca-Bantahan & Sabotase Banding | Tombol 1-tap Pelapor Utama jam `48–72` hanya aktif bila `disputeCount == 0` (`AUTO_CLOSED` jam `72` tetap jalan dengan bonus `+0`). Pada putaran banding Jalur B, pembantah putaran 1 dilarang *voting*/bantah ke-`2` (harus warga lain `>= 1.0`). |
| **#17** | TINGGI | Skor Awal Dinas `100` & *False Flag* `isChronicOverdue` | Skor awal `Department.integrityScore` ditetapkan `80`. Penanda `isChronicOverdue = true` dikunci permanen (*sticky*) begitu keterlambatan aktif melewati `100%` SLA awal (`now - slaDeadline > slaInitialHours`). |
| **#18** | MENENGAH | Kuorum Retroaktif, Geofencing, Fingerprint Lintas Browser & Bundle `nsfwjs` | Simpan statis `weightAtVote`; validasi poligon Sidoarjo–Surabaya (`+ buffer 500 m` & garis peta `/lapor`); `deviceFingerprint` pakai `SHA-256(clientInstallId + UA + screen + cores)` aman Safari/iOS; muat `nsfwjs` via `React.lazy()` / `import()` *async* pasca-jepret. |
| **#19** | KRITIS | Hilangnya Sisa SLA Saat Pause & Reset `isChronicOverdue` | Ditambahkan kolom `remainingSlaMs` dan `validationStartedAt`; `isChronicOverdue` dikunci sebagai *sticky boolean* yang tidak terhapus saat status berpindah ke `PENDING_VALIDATION`. |
| **#20** | KRITIS | Salah Penalti Pembantah Putaran 1 pada Jalur A *Rework* | Ditambahkan boolean `isAppealRound` pada `Ticket`; penalti `-0.5 + 24 jam` kepada pembantah Putaran 1 hanya berlaku jika `isAppealRound == true` dan berakhir `CLOSED` oleh `>= 2` warga lain. |
| **#21** | KRITIS | Nonce Lintas Aksi/Tiket & Spoofing Akurasi GPS Server | *Capture nonce* (`jti`) diikat ketat ke `{ userId, deviceFingerprint, actionType, ticketId }`, dikonsumsi via Redis `SETNX`, dan server mewajibkan `gpsAccuracy <= 50` meter di seluruh endpoint foto. |
| **#22** | TINGGI | Kebocoran UUID pada `AuditLog` & Enumerasi File Storage | Rantai HMAC memakai `actorPublicRef = HMAC-SHA256(AUDIT_SALT, actorId)` (UUID asli tidak pernah tampil di publik) dan kunci objek Storage memakai CSPRNG UUIDv4. |
| **#23** | TINGGI | *Flooding* Data Simulasi via Token Juri Publik | Sesi juri dibatasi *rate limit* (`30 mutasi / 10 menit` per sesi/IP), batas maksimal `50` tiket `isDemoData: true` aktif, serta dilarang mengakses `/aktivasi-mitra`. |
| **#24** | MENENGAH | *Category-Cycling Spam* di Satu Titik & Penumpukan Tiket | Ditambahkan kuota global maksimal `6` tiket aktif lintas kategori dalam radius `30 m`, serta batas maksimal `5` tiket aktif serentak dan `10` tiket per `24 jam` per akun `WARGA`. |
| **#25** | MENENGAH | Ambiguitas Ambang Piksel, Rasio `OUT_OF_SCOPE`/`REJECTED_SPAM` & Self-Support | Dikunci BT.601 Luminance (`Y >= 35` normal, `Y >= 12` malam untuk 3 Darurat + PJU + Saluran, `Y <= 245` anti-silau) & Laplacian `>= 45`; lencana `/rapor` bila `OUT_OF_SCOPE > 25%` atau `REJECTED_SPAM > 20%`; pelapor dilarang menekan *Dukung Prioritas* pada tiket sendiri. |
| **#26** | KRITIS | Bug Satuan Derajat vs Meter pada PostGIS `ST_DWithin` | Seluruh kolom koordinat spasial wajib bertipe `geography(Point, 4326)` sehingga `ST_DWithin` selalu menghitung jarak dalam satuan **meter** secara akurat. |
| **#27** | KRITIS | Batas `Oper Tiket`/`REJECTED_SPAM` Offline & Pergeseran Pembulatan GPS *(Audit v3.4)* | Batas `min(24j, 50% SLA)` dihitung sejak `syncedAt`; `Ticket.location` menyimpan GPS presisi internal untuk `ST_DWithin`, sedangkan `publicLat`/`publicLng` (4 desimal `~11m`) khusus API publik & watermark. |
| **#28** | KRITIS | Self-Lock Akun Demo Juri oleh Limit `5` Tiket Aktif *(Audit v3.4)* | Akun simulasi `Warga Pelapor` di `seed.ts` maks `2` tiket aktif; sesi `X-Jury-Token` membebaskan limit `5 aktif / 10 per 24j` per akun (tetap dikunci limit sesi juri global), dan *Simulasi Kamera* otomatis mengambil nonce sah. |
| **#29** | KRITIS | Nonce Hangus Akibat Gagal Validasi / Retry Jaringan *(Audit v3.4)* | Urutan server wajib: cek `Idempotency-Key` -> validasi Zod/kuota/NSFW -> baru `SETNX nonce:jti` sebelum upload & commit DB, dengan kompensasi `DEL nonce:jti` + hapus file yatim saat `5xx`. |
| **#30** | TINGGI | Beban `blurred derivative` di Vercel & File Yatim Storage *(Audit v3.4)* | Foto `isNsfwPendingReview: true` disimpan di *private bucket/prefix* (tanpa *sharp* re-encode), dibuka via *Signed URL* `60 detik` saat diklik; upload melewati backend terverifikasi. |
| **#31** | TINGGI | Sinkronisasi `US-007`, Label Publik `AuditLog` & Endpoint Lampiran B *(Audit v3.4)* | Kunci `disputeCount == 0` di `US-007`; tambah `actorRole` + `actorDisplayLabel` pada `AuditLog` agar linimasa publik terbaca jelas tanpa bocor UUID; lengkapi seluruh 17 endpoint di Lampiran B. |
| **#32** | MENENGAH | Salah Sensor Blur Foto Buram & Kegagalan Sampel Juri *(Audit v3.4)* | Pisahkan `isNsfwPendingReview` (blur sensor) dari `isLowQualityOverride` (tampil normal + lencana info); aset `public/samples/` wajib lolos `Y` di `[50, 220]` & `Laplacian >= 80`. |

---

## LAMPIRAN A — Tabel Master Kategori Baku (*Single Source of Truth* FE & BE)

Tabel berikut mengunci pemetaan 1-ke-1 antara kode enum di database Prisma, tampilan di `/lapor`, instansi penerima otomatis, tenggat waktu SLA, dan aturan kelonggaran foto malam (`18.00–05.30 WIB` `Asia/Jakarta`):

| Kode Enum (`category`) | Label Tampilan UI | Instansi Default | Tier & SLA | Kelonggaran Malam (`Y >= 12`) |
| :--- | :--- | :--- | :--- | :--- |
| **`JALAN_AMBLES`** | Jalan Ambles Parah | Dinas PU Bina Marga | **DARURAT** (`24 jam`) | **Ya** (`18.00–05.30 WIB`, `Y >= 12`) |
| **`KABEL_MENJUNTAI`** | Kabel / Tiang Bahaya | Dishub | **DARURAT** (`24 jam`) | **Ya** (`18.00–05.30 WIB`, `Y >= 12`) |
| **`POHON_TUMBANG`** | Pohon Tumbang / Halang Jalan | DLH | **DARURAT** (`24 jam`) | **Ya** (`18.00–05.30 WIB`, `Y >= 12`) |
| **`PJU_MATI`** | Lampu PJU Mati | Dishub | **MENENGAH** (`72 jam`) | **Ya** (`18.00–05.30 WIB`, `Y >= 12`) |
| **`SAMPAH_LIAR`** | Tumpukan Sampah Liar | DLH | **MENENGAH** (`72 jam`) | Tidak (Wajib terang / *flash*, `Y >= 35`) |
| **`SALURAN_TERSUMBAT`** | Saluran Air / Drainase Tersumbat | Dinas PU Bina Marga | **MENENGAH** (`72 jam`) | **Ya** (`18.00–05.30 WIB`, `Y >= 12`) |
| **`REKLAME_LIAR`** | Reklame / Bangunan Liar Bahaya | Satpol PP | **MENENGAH** (`72 jam`) | Tidak (Wajib terang / *flash*, `Y >= 35`) |
| **`JALAN_BERLUBANG`** | Jalan / Aspal Berlubang | Dinas PU Bina Marga | **STANDAR** (`168 jam`) | Tidak (Wajib terang / *flash*, `Y >= 35`) |

> **Catatan Operasional Pemetaan Kategori:** Jika pelapor memilih kategori yang di lapangan ternyata milik aset non-Pemda atau instansi berbeda (misal `KABEL_MENJUNTAI` milik PLN bukan Dishub, atau `POHON_TUMBANG` yang butuh penertiban Satpol PP), instansi penerima awal memiliki hak **Oper Tiket** (ke sesama `4` dinas Pemda selama status `OPEN` dan `<= 12 jam` untuk Darurat / `<= 24 jam` non-Darurat sejak `syncedAt`) atau **`OUT_OF_SCOPE`** (rujukan ke PLN / PDAM / BPJN / BBWS / Telkom) sesuai Bab 3.

---

## LAMPIRAN B — Referensi Lengkap 17 Kontrak Endpoint API & Kesehatan Sistem

1. **Kesehatan Sistem, Autentikasi & Sesi Juri:**
   - `GET /api/health` — Cek status hidup API, konektivitas DB, dan Redis.
   - `GET /api/auth/me` — Mengembalikan profil ter-sanitasi (`aliasName`, `role`, `departmentId`, `trustScore`, `frozenUntil`, `cooldownUntil`).
   - `POST /api/jury/session` — Memverifikasi `jury_token` dan mengembalikan *signed session token* (`4 jam`) untuk header `X-Jury-Token`.
   - `POST /api/jury/tickets/:id/simulate-time` — Menggeser `slaDeadline` / `validationStartedAt` / `disputedAt` (`+25j` / `+49j`) khusus `isDemoData: true` dan menjalankan *Lazy Evaluation*.
   - `POST /api/jury/reset` — Mengembalikan seluruh data `isDemoData: true` dan skor `4` instansi ke *clean seed* + `DEL` cache Redis (tidak menyentuh akun warga asli).
2. **Akses Publik (Peta, Detail, Rapor & Audit):**
   - `GET /api/tickets` — Daftar pin aktif publik (`Redis TTL 45s`, memicu *Lazy Evaluation*, exclude `REJECTED_SPAM`, hanya mengembalikan `publicLat`/`publicLng`).
   - `GET /api/tickets/:id` — Detail tiket lengkap, foto *before–after* (plus `repairDistanceMeters` & `repairCapturedAt`, atau penanda `isNsfwPendingReview` / `isLowQualityOverride`), progres kuorum, linimasa alasan/rujukan, dan *UI action flags* (termasuk `disabledReason`).
   - `GET /api/tickets/:id/media-signed-url` — Menerbitkan *short-lived Signed URL* (`TTL 60 detik`) saat pengguna mengklik *"Tampilkan Gambar"* pada foto `isNsfwPendingReview: true`.
   - `GET /api/tickets/:id/audit-verify` — Memverifikasi keutuhan rantai hash `HMAC-SHA256` dari `GENESIS` secara publik menggunakan `actorPublicRef` + `actorDisplayLabel` tanpa mengekspos UUID, dan mengembalikan `verifiedChain`, `totalEntries`, serta `summaryText` berbahasa awam.
   - `GET /api/rapor` — Papan skor `4` instansi (`Redis TTL 180s`, `integrityScore`, rasio SLA, `isChronicOverdue`, rasio `OUT_OF_SCOPE` & `REJECTED_SPAM`) + titik peta panas/klaster.
3. **Kamera & Pelaporan Warga:**
   - `POST /api/capture-nonce` — Menerbitkan *online signed capture nonce* terikat `{ actionType, ticketId?, deviceFingerprint }` (`15 menit`; cadangan `2` token *offline* `24 jam` masuk target Bonus Minggu 4).
   - `GET /api/tickets/check-radius?lat=...&lng=...&category=...` — Mengecek poligon geofencing, kuota `50 m` (`3/3`) & `30 m` (`6/6`) berbasis PostGIS `geography`, serta daftar ringkas `nearbyTickets` aktif sekitar agar UI dapat menawarkan *Dukung Prioritas* **sebelum** kamera dibuka.
   - `POST /api/tickets` — Transaksi atomik pembuatan laporan (urutan aman retry: `Idempotency-Key` -> validasi/NSFW -> `SETNX` nonce -> cek *magic bytes* & upload -> commit DB).
   - `POST /api/tickets/:id/support` — Menambah dukungan prioritas (`+1`, bukan pelapor sendiri), memangkas SLA `15%` tiap kelipatan `10` (hanya bila `> 6 jam`, lantai `6 jam`), dan menaikkan flag penalti `-6 poin`.
   - `POST /api/tickets/:id/validate` — Validasi *Sudah Beres* (`<= 100 m` atau pelapor jam `48–72` khusus `disputeCount == 0`) dan bantahan *Klaim Palsu* (`<= 100 m` + foto *live* + `trustScore >= 1.0`).
4. **Kerja Instansi (`ADMIN_DINAS`):**
   - `GET /api/dinas/tickets` — Antrean kerja terisolasi `departmentId`, terurut dari `OVERDUE` & sisa SLA tersingkat.
   - `POST /api/tickets/:id/process` | `transfer` | `out-of-scope` | `reject-spam` | `resolve` | `reprocess-disputed` | `counter-dispute` | `resolve-escalated` — Seluruhnya dilindungi `where: { departmentId: req.user.departmentId }`, *optimistic lock* `version`, `DEL` cache Redis, dan pencatatan `AuditLog`.
