# LaporPAK! v3.5 — Panduan Alur Lengkap & Bedah Satu per Satu (*Master Flow Guide*)

> **Tujuan Dokumen Ini:** Dokumen ini memecah seluruh cara kerja **LaporPAK! v3.5** menjadi **8 Flowchart Terpisah yang Sangat Detail** (tidak digabung menumpuk dalam 1 gambar sempit). Setiap flowchart langsung diikuti **Penjelasan Urut Satu per Satu (Kotak demi Kotak)** dalam bahasa sehari-hari + aturan teknisnya agar **Arya**, **Fatih**, dan **Reza** punya pemahaman `100%` sama saat diskusi maupun coding.
>
> **Catatan Status Fitur v3.5:** Alur utama (`Flow 1`–`Flow 5` & `Flow 8`) sudah aktif di backend/kamera produksi saat ini (`main`), sedangkan penguatan **3 Benteng Anti-Buzzer (`Flow 6`)** dan **Rating Bintang di Catatan Kerja Dinas (`Flow 7`)** sudah dikunci di desain dokumen ini dan **menunggu aba-aba eksekusi kode** setelah 4 halaman UI utama selesai.

---

## Daftar Isi 8 Flowchart
1. **Flowchart 1:** Peta Gerbang Masuk & Hak Akses 5 Tipe Pengguna
2. **Flowchart 2:** Alur Lengkap Warga Membuat Laporan Baru (`/lapor`) — Dari Cek Titik Sampai Kirim Aman Sinyal Putus
3. **Flowchart 3:** Alur Lengkap Meja Kerja Pemerintah (`/dinas`) — Dari Laporan Masuk Sampai Unggah Foto Selesai
4. **Flowchart 4:** Alur Uji Publik (`PENDING_VALIDATION`) & Solusi Pelapor Luar Kota (Surabaya/Sidoarjo) yang Sudah Pulang
5. **Flowchart 5:** Alur Detail Perulangan Bantahan / Sengketa (`DISPUTED` Jalur A vs Jalur B & `ESCALATED` Berita Acara)
6. **Flowchart 6:** Alur Pertahanan Anti-Buzzer, Akun Ternakan (*Pre-Aged Sybil*), Tutup Kilat & Foto Layar HP AI (*Screen Spoofing*)
7. **Flowchart 7:** Alur Halaman **"Catatan Kerja Dinas"** (`/rapor`) — Nilai Kerja Otomatis + Rating Bintang Warga
8. **Flowchart 8:** Alur Simulasi Dewan Juri `< 3 Menit` (`/?jury_token=...`)

---

## 1. Flowchart 1: Peta Gerbang Masuk & Hak Akses 5 Tipe Pengguna

Diagram ini menjelaskan siapa saja yang membuka website **LaporPAK!** dan halaman mana yang boleh atau dilarang mereka masuki.

```mermaid
flowchart TD
    Start(["Pengguna Membuka Website LaporPAK!"]) --> CheckJury{"Apakah URL memakai ?jury_token=...?"}

    CheckJury -->|"Ya & Token Valid"| JurySession["F1-A: Aktifkan Mode Simulasi Juri (4 Jam)\nMuncul Panel Melayang 5 Alat di Pojok Kanan Bawah"]
    CheckJury -->|"Tidak"| CheckAuth{"Apakah Sudah Login?"}

    CheckAuth -->|"Belum Login"| PublicUser["F1-B: Pengunjung Umum (Tanpa Akun)"]
    PublicUser --> PubPages["Bebas Buka:\n1. Beranda & Peta (/)\n2. Detail Laporan (/tiket/:id)\n3. Catatan Kerja Dinas (/rapor)"]
    PublicUser -->|"Klik Lapor / Dukung / Validasi"| GoLogin["F1-C: Diarahkan ke /login\nTampil Kartu Jaminan Nama Samaran"]

    CheckAuth -->|"Sudah Login"| CheckRole{"Apa Peran Akunnya?"}

    CheckRole -->|"WARGA (Lokal / Pendatang)"| CitizenUser["F1-D: Warga Terdaftar\nDapat Nama Samaran Otomatis (mis. Warga-Delta-402)\nSkor Kepercayaan Awal = 0.5"]
    CitizenUser --> CitizenPages["Boleh Buka:\n- Beranda (/), Detail (/tiket/:id), Catatan Kerja (/rapor)\n- Buat Laporan (/lapor)\n- Laci Profil (Skor, Riwayat, Draf)"]
    CitizenUser -->|"Coba Buka /dinas"| BlockToHome1["Ditolak Sopan -> Kembali ke Beranda (/)"]

    CheckRole -->|"ADMIN_DINAS (Dishub / PU / DLH / Satpol PP)"| DinasUser["F1-E: Petugas Instansi Resmi\nTerkunci hanya ke departmentId miliknya"]
    DinasUser --> DinasPages["Otomatis Masuk ke Meja Kerja (/dinas)\nBoleh Lihat Peta (/) & Catatan Kerja (/rapor) sebatas Baca-Saja"]
    DinasUser -->|"Coba Buka /lapor atau Klik Vote Warga"| BlockToDinas["Ditolak Mutlak -> Kembali ke /dinas"]

    JurySession --> SwitchRole["F1-F: Juri Bebas Ganti Peran 1-Klik\n(Warga Pelapor / Validator 1 / Validator 2 / 4 Admin Dinas)\nHanya Boleh Mengubah Data Contoh (isDemoData = true)"]
```

### Penjelasan Urut Satu per Satu (Kotak demi Kotak):
1. **`Pengguna Membuka Website` -> `Cek ?jury_token=`:** Begitu halaman dibuka, sistem memeriksa apakah link mengandung token khusus juri dari `README.md`.
2. **`F1-A (Mode Simulasi Juri)` & `F1-F`:** Jika token cocok, juri mendapat sesi khusus `4 jam`. Juri tidak perlu daftar akun manual dan bisa berpindah peran dalam `1` klik, namun sistem mengunci ketat agar juri hanya bisa mengutak-atik data contoh (`isDemoData: true`), bukan laporan warga sungguhan.
3. **`F1-B (Pengunjung Umum Belum Login)`:** Warga yang baru pertama kali masuk **tidak dihadang halaman login**. Mereka langsung bisa menggeser peta kerusakan Surabaya–Sidoarjo (`/`), melihat geseran foto Sebelum–Sesudah (`/tiket/:id`), dan membaca **Catatan Kerja Dinas** (`/rapor`).
4. **`F1-C (Halaman /login)`:** Login baru diminta ketika warga ingin melakukan aksi nyata (melapor, mendukung prioritas, atau memvalidasi). Tepat di bawah tombol *Masuk dengan Google* / *Email*, tertulis jaminan bahwa nama asli & email warga tidak pernah ditampilkan ke publik maupun dinas.
5. **`F1-D (Warga Terdaftar — Lokal maupun Luar Kota)`:** Saat warga pertama kali masuk, backend otomatis membuatkan nama samaran acak (`Warga-Delta-402`) dan modal skor kepercayaan `0.5`. Warga bebas melapor selama saat memotret kerusakan ia memang sedang berada secara fisik di wilayah Surabaya–Sidoarjo. Warga tidak bisa membuka `/dinas`.
6. **`F1-E (Petugas Instansi / ADMIN_DINAS)`:** Akun dinas (`dishub@laporpak.id`, `dpu@laporpak.id`, `dlh@laporpak.id`, `satpolpp@laporpak.id`) otomatis diarahkan ke dashboard `/dinas`. Petugas Dishub **mustahil** mengubah laporan milik Dinas PU, dilarang membuat laporan warga (`/lapor`), dilarang ikut voting warga, dan hanya bisa melihat halaman **Catatan Kerja Dinas** (`/rapor`) tanpa bisa mengedit nilainya.

---

## 2. Flowchart 2: Alur Lengkap Warga Membuat Laporan Baru (`/lapor`)

Diagram ini membedah urutan pelaporan dari pemilihan lokasi sampai pengiriman laporan agar warga tidak memotret sia-sia dan ketikannya tidak hilang saat sinyal jelek.

```mermaid
flowchart TD
    L1(["L2-1: Warga Buka /lapor\nDraf Lokal Otomatis Dimuat (Jika Ada)"]) --> L2["L2-2: Pilih Jenis Kerusakan (8 Kategori)\nTampil Chip Tingkat Bahaya & Tenggat SLA (24j / 72j / 168j)"]
    L2 --> L3["L2-3: Klik 'Kunci Lokasi GPS Saat Ini'"]

    L3 --> L4{"L2-4: Izin GPS Diberikan & Akurasi <= 50m?"}
    L4 -->|"Izin Ditolak Browser"| L4A["Panduan Gembok Browser -> Izinkan Lokasi -> Tombol Coba Lagi"]
    L4A --> L3
    L4 -->|"Akurasi > 50m (Misal di Dalam Gedung)"| L4B["Peringatan Akurasi Belum Cukup -> Menepi ke Ruang Terbuka"]
    L4B --> L3

    L4 -->|"GPS Valid <= 50m"| L5["L2-5: Panggil GET /api/tickets/check-radius\nCek Batas Wilayah & Laporan Tetangga"]
    L5 --> L6{"L2-6: Masuk Poligon Surabaya-Sidoarjo (+500m)?"}
    L6 -->|"Di Luar Wilayah"| L6A["Kunci Kamera + Pesan: Di Luar Wilayah Layanan Surabaya & Sidoarjo"]

    L6 -->|"Di Dalam Wilayah"| L7{"L2-7: Apakah Titik Sudah Penuh?\n(>= 3 Kategori Sama di 50m ATAU >= 6 Lintas Kategori di 30m)"}
    L7 -->|"Penuh!"| L7A["L2-8: Kamera Dikunci Agar Tidak Foto Sia-Sia\nTampilkan Kartu Laporan Tetangga + Tombol 'Dukung Prioritas'"]
    L7A -->|"Klik Dukung Prioritas"| L7B(["Dukungan Tercatat! Tiap 10 Dukungan Potong Sisa SLA 15% (Min. 6 Jam)"])

    L7 -->|"Masih Tersedia"| L8["L2-9: Buka Kamera Langsung WebRTC\n(Galeri HP & Kamera Virtual OBS/ManyCam Diblokir)"]
    L8 --> L9["L2-10: Jepret Foto -> Kompres Canvas <= 450 KB (0% EXIF)\nTempel Watermark Jam WIB + Koordinat Publik 4 Desimal (~11m)"]

    L9 --> L10{"L2-11: Cek Cahaya BT.601 & Ketajaman Laplacian"}
    L10 -->|"Silau Y > 245 ATAU Gelap\n(Normal Y < 35; Malam 18.00-05.30 WIB Y < 12 khusus Darurat/PJU/Saluran)"| L10A["Minta Jepret Ulang + Saran Sudut Cahaya"]
    L10A --> L8
    L10 -->|"Foto Buram (Laplacian < 45) Percobaan ke-1 atau ke-2"| L10B["Minta Tahan Tangan Lebih Stabil & Jepret Ulang (1/3 atau 2/3)"]
    L10B --> L8
    L10 -->|"Buram Percobaan ke-3"| L10C["Lolos Darurat: Tandai isLowQualityOverride = true\n(Nanti Tampil Normal + Label Info 'Kualitas Gambar Rendah')"]
    L10 -->|"Cahaya & Tajam Aman"| L11["L2-12: Cek Sensor NSFWJS di Browser (Timeout 4 Detik)"]
    L10C --> L11

    L11 --> L12{"L2-13: Hasil Skor Konten NSFW"}
    L12 -->|"Skor >= 0.85 (Konten Porno Tegas)"| L12A[" Tolak Seketika + Peringatan Penalti Skor -0.5 & Jeda 24 Jam"]
    L12 -->|"Skor 0.55 - 0.84 (Ragu/Gelap Lumpur)"| L12B["Minta Foto Ulang dengan Sudut Lebih Jelas (Tanpa Penalti)"]
    L12B --> L8
    L12 -->|"Timeout > 4 Detik / Gagal Muat Model"| L12C["Fail-Safe: Lolos dengan isNsfwPendingReview = true\n(Masuk Bucket Privat + Blur Default + Signed URL 60s)"]
    L12 -->|"Skor < 0.55 (Aman)"| L13["L2-14: Isi Judul (>= 5 Huruf) & Catatan (>= 10 Huruf) -> Klik Kirim"]
    L12C --> L13

    L13 --> L14["L2-15: Minta Kupon Foto Sekali Pakai (POST /api/capture-nonce)\nLalu Kirim POST /api/tickets + Idempotency-Key + X-Device-Fingerprint"]
    L14 --> L15{"L2-16: Respons Server?"}
    L15 -->|"Internet Putus / Error 5xx"| L15A["Foto & Ketikan TIDAK HILANG di localStorage!\nKlik 'Kirim Ulang' Pakai Idempotency-Key Sama (Anti Tiket Ganda)"]
    L15A --> L14
    L15 -->|"Sukses 201 Created"| L16(["L2-17: Laporan Resmi Masuk (Status: OPEN)\nSegel Audit GENESIS Dibuat & Hitung Mundur SLA Dinas Dimulai!"])
```

### Penjelasan Urut Satu per Satu (Kotak demi Kotak):
1. **`L2-1` s.d. `L2-3` (Draf Otomatis & Kategori):** Setiap ketikan dan foto sementara disimpan di `localStorage` perangkat warga. Begitu warga memilih kategori (misal *Jalan Ambles*), layar langsung memberi tahu bahwa laporan ini bertipe **DARURAT (batas waktu dinas 24 jam)**.
2. **`L2-4` (Penjaga GPS):** Jika izin lokasi tidak sengaja tertolak, muncul panduan bergambar teks (*klik ikon gembok -> Izinkan*). Jika warga di dalam ruangan sehingga GPS meleset `> 50 meter`, sistem meminta warga bergeser ke area terbuka dulu agar titik laporan tidak salah jalan.
3. **`L2-5` s.d. `L2-8` (Cek Wilayah & Anti-Duplikat Sebelum Kamera):** Sebelum warga repot memotret, server mengecek apakah posisi masuk Surabaya–Sidoarjo dan apakah di radius `50 meter` sudah ada `3` laporan serupa (atau `6` laporan apa pun di `30 meter`). Bila penuh, kamera dikunci dan warga langsung disajikan daftar laporan tetangga di dekatnya lengkap dengan tombol **Dukung Prioritas** (tiap kelipatan `10` dukungan memangkas sisa waktu dinas `15%`, minimal `6 jam`, dan menggandakan denda terlambat dinas menjadi `-6 poin`).
4. **`L2-9` & `L2-10` (Kamera WebRTC Murni & Privasi):** Tombol unggah file galeri ditiadakan total dan kamera virtual (`OBS`/`ManyCam`) ditolak. Hasil jepretan digambar ulang di Canvas (`<= 450 KB`) sehingga metadata EXIF HP hilang `100%`, lalu ditempel watermark waktu `WIB` dan koordinat yang sudah dibulatkan `4` desimal (`~11 meter` agar alamat persis rumah pelapor tetap aman).
5. **`L2-11` (Cek Cahaya Malam & Foto Buram):** Siang/normal wajib kecerahan `Y >= 35`. Khusus malam hari (`18.00–05.30 WIB`) untuk `5` kategori darurat/gelap (`JALAN_AMBLES`, `KABEL_MENJUNTAI`, `POHON_TUMBANG`, `PJU_MATI`, `SALURAN_TERSUMBAT`), batas diturunkan ke `Y >= 12` supaya warga tetap bisa melapor lampu jalan mati. Jika kamera HP warga murahan sehingga buram terus, percobaan ke-`3` tetap diizinkan lewat (`isLowQualityOverride = true`).
6. **`L2-12` & `L2-13` (Sensor NSFW 2-Zona + Fail-Safe):** Model `nsfwjs` baru diunduh saat memotret agar pembukaan web awal tetap cepat (`< 2 detik`). Skor `>= 0.85` diblokir tegas, skor `0.55–0.84` hanya diminta foto ulang tanpa hukuman, dan bila internet lambat (`> 4 detik`), foto tetap diterima masuk ruang penyimpanan privat (*blur* otomatis hingga diklik *Tampilkan Gambar*).
7. **`L2-14` s.d. `L2-17` (Kupon Foto & Anti-Dobel Kirim):** Sistem meminta kupon `captureNonce` sekali pakai yang terikat ke perangkat (`X-Device-Fingerprint`), lalu mengirim laporan memakai `Idempotency-Key`. Jika sinyal warga mati di tengah jalan lalu warga menekan *Kirim Ulang* berkali-kali, server mengenali `Idempotency-Key` yang sama sehingga tidak pernah tercipta laporan kembar.

---

## 3. Flowchart 3: Alur Lengkap Meja Kerja Pemerintah (`/dinas`)

Diagram ini menjelaskan apa yang terjadi sejak laporan warga mendarat di antrean salah satu dinas hingga petugas mengunggah foto bukti perbaikan.

```mermaid
flowchart TD
    D1(["D3-1: Laporan Baru Masuk Antrean Dinas (Status: OPEN)\nUrut Otomatis dari OVERDUE & Sisa Waktu Tersingkat"]) --> D2{"D3-2: Cek Batas Waktu Keputusan Awal\nMasih OPEN & <= min(24 Jam, 50% SLA Awal) sejak syncedAt?"}

    D2 -->|"Ya (<= 12j Darurat / <= 24j Biasa)"| D3{"D3-3: Pilih 1 dari 4 Keputusan Awal Petugas"}
    D2 -->|"Sudah Lewat Batas Awal"| D4["Tombol 'Oper Tiket' & 'Tolak Spam' Otomatis Terkunci!\nDinas Wajib Mengerjakan atau Rujuk Instansi Non-Pemda"]

    D3 -->|"1. Memang Tugasnya"| D5["D3-4: Klik 'Mulai Kerjakan' -> Status: IN_PROGRESS"]
    D3 -->|"2. Salah Dinas Pemda (Maks 1x)"| D6["D3-5: Klik 'Oper Tiket' + Alasan (>= 15 Huruf)\nPindah ke Dinas Pemda Tujuan dengan Buffer max(Sisa SLA, 12 Jam)"]
    D3 -->|"3. Aset PLN / PDAM / BPJN / Telkom"| D7(["D3-6: Klik 'Di Luar Wewenang' + Instansi & Catatan (>= 20 Huruf)\nStatus Terminal: OUT_OF_SCOPE (Skor 0, Tercatat di Catatan Kerja)"])
    D3 -->|"4. Foto Iseng / Hoaks / Tembok Rumah"| D8(["D3-7: Klik 'Tolak Spam' + Alasan (>= 15 Huruf)\nStatus Terminal: REJECTED_SPAM (Hilang dari Peta, Pelapor -0.5 & Jeda 24j)"])

    D4 --> D5
    D6 --> D1

    D5 --> D9{"D3-8: Apakah Waktu Sekarang Melewati slaDeadline?"}
    D9 -->|"Ya, Terlambat!"| D10["D3-9: Mesin Lazy Evaluation Ubah ke Status: OVERDUE\nPotong Skor Dinas Maks 1x (-3 Poin, atau -6 Poin bila Dukungan >= 10)\nJika Telat > 100% SLA Awal -> Kunci Permanen isChronicOverdue = true"]
    D9 -->|"Belum Lewat"| D11["D3-10: Petugas Datang ke Lokasi Perbaikan"]
    D10 --> D11

    D11 --> D12{"D3-11: Cek Syarat Foto Selesai Petugas"}
    D12 -->|"Jarak GPS > 75m atau Akurasi > 50m"| D12A["Tombol Selesai Terkunci! Petugas Wajib Berdiri <= 75m dari Titik Laporan"]
    D12A --> D11
    D12 -->|"Jarak <= 75m & Lolos Kamera Live + NSFW"| D13["D3-12: Hitung repairDistanceMeters & Cek Durasi Kerja\n(Jika Selesai < 10 Menit -> Tandai Info Audit isFastResolveAnomaly)"]

    D13 --> D14(["D3-13: Status Pindah ke PENDING_VALIDATION (Menunggu Cek Warga)\nSisa Waktu SLA Disimpan ke remainingSlaMs (Jam Dinas Dijeda)"])
```

### Penjelasan Urut Satu per Satu (Kotak demi Kotak):
1. **`D3-1` & `D3-2` (Aturan Anti-Cuci-Tangan Mepet Tenggat):** Begitu laporan masuk (`OPEN`), waktu dinas langsung berjalan. Dinas hanya diberi jendela separuh awal (`maksimal 12 jam` untuk kategori Darurat `24 jam`, atau `24 jam` untuk kategori `72/168 jam`) untuk mengoper laporan ke dinas lain atau menolak spam. Lewat dari itu, tombol *Oper* dan *Tolak Spam* mati otomatis agar oknum dinas tidak membuang laporan `5 menit` sebelum tenggat habis.
2. **`D3-5` (`Oper Tiket` Maks 1x):** Misalnya warga melapor *Kabel Bahaya* ke Dishub, padahal di lapangan butuh penanganan Dinas PU. Dishub boleh mengoper **maksimal 1 kali** (tidak boleh lempar-lemparan bolak-balik), dan dinas penerima dijamin mendapat waktu kerja minimal `12 jam`.
3. **`D3-6` & `D3-7` (`OUT_OF_SCOPE` & `REJECTED_SPAM` Diawasi Publik):** Kalau objeknya tiang listrik PLN/pipa PDAM, dinas memilih *Di Luar Wewenang* dengan catatan terbuka. Kalau fotonya iseng/palsu, dinas memilih *Tolak Spam* (pelapor dikurangi `-0.5` skor; khusus pelanggaran pertama akun baru berhenti di lantai `0.1` agar tidak langsung terblokir `7 hari`). Semua rasio pelemparan dan penolakan ini dihitung terbuka di halaman **Catatan Kerja Dinas** (`/rapor`) — jika `> 25%` atau `> 20%`, muncul tanda peringatan!
4. **`D3-8` & `D3-9` (Hukuman Otomatis Terlambat):** Tanpa perlu menunggu cron tengah malam, setiap kali halaman dibuka (*Lazy Evaluation*), sistem mengecek apakah tenggat `slaDeadline` sudah terlewat. Jika lewat, status langsung merah (`OVERDUE`) dan nilai dinas langsung dipotong `-3` (atau `-6` bila didukung `>= 10` warga) tepat **satu kali**.
5. **`D3-11` s.d. `D3-13` (Wajib Foto di Lokasi `<= 75m`):** Petugas yang mengklaim selesai wajib memotret langsung pada jarak `<= 75 meter` dari titik kerusakan asli. Sistem mencatat jarak meter petugas (`repairDistanceMeters`), menandai anomali bila dikerjakan kilat tidak wajar (`< 10 menit`), menjeda sisa waktu SLA di `remainingSlaMs`, lalu menyerahkan hasilnya ke warga sekitar (`PENDING_VALIDATION`).

---

## 4. Flowchart 4: Alur Uji Publik (`PENDING_VALIDATION`) & Solusi Pelapor Luar Kota yang Sudah Pulang

Diagram ini menjawab tuntas pertanyaan tim: **"Bagaimana kalau pelapornya orang luar Surabaya/Sidoarjo (misal pendatang/luar Jawa) yang waktu lapor ada di lokasi, tapi saat dinas selesai dia sudah pulang ke kotanya?"**

```mermaid
flowchart TD
    V1(["V4-1: Tiket Masuk Status PENDING_VALIDATION\nFoto Sebelum vs Sesudah + Jarak Meter Petugas Tayang ke Publik"]) --> V2{"V4-2: Berapa Jam Sejak Dinas Klaim Selesai (validationStartedAt)?"}

    V2 -->|"Jam 0 s.d. 48 (Fase 1: Uji Warga Sekitar)"| V3["V4-3: Pelapor Utama Dilarang Klik 'Sudah Beres' Dulu (Jaga Netralitas)\nTetapi Warga Lokal Sekitar (<= 100m) & Pelapor di Lokasi Bisa Menilai"]
    V3 --> V4{"V4-4: Siapa yang Menekan Tombol di Lokasi (<= 100m, GPS <= 50m)?"}

    V4 -->|"Warga Lokal Klik 'Klaim Palsu' + Foto Live (Skor >= 1.0)"| GoDispute(["Langsung Pindah ke Alur Sengketa (Flowchart 5)\nMeskipin Pelapor Awal Sudah Pulang ke Luar Kota!"])
    V4 -->|"Warga Lokal Klik 'Sudah Beres' (Skor >= 0.5, 1 HP = 1 Suara)"| V5{"V4-5: Cek Syarat Kuorum + Benteng Anti-Buzzer (Flowchart 6)\nMin. 2 Akun & 2 HP Berbeda, Total Bobot >= 2.0, Lewat Masa Tunggu 6 Jam"}
    V5 -->|"Belum Terpenuhi / Masih Masa Tunggu 6 Jam"| V1
    V5 -->|"Terpenuhi & Tidak Ada Bantahan"| VClosed1(["V4-6: Status CLOSED (Tuntas Terverifikasi Warga Lokal)\nDinas +2 Poin (Jika Tepat Waktu & Tanpa Sengketa), Pelapor & Validator +0.1 Skor"])

    V2 -->|"Jam 48 s.d. 72 (Fase 2: Jendela Pelapor Utama)"| V7{"V4-7: Apakah Tiket Ini Pernah Dibantah Sebelumnya (disputeCount == 0)?"}
    V7 -->|"Pernah Dibantah (disputeCount >= 1)"| V7A["Tombol 1-Tap Pelapor Dikunci!\nWajib Disahkan Warga Lokal <= 100m atau Tunggu Jam ke-72"]
    V7 -->|"Belum Pernah Dibantah (disputeCount == 0)"| V8["V4-8: SOLUSI PELAPOR LUAR KOTA!\nMuncul Tombol 1-Tap 'Sudah Beres' BEBAS RADIUS GPS bagi Pelapor Utama\n+ Peringatan Cek Teliti Foto Sebelum-Sesudah"]

    V8 -->|"Pelapor Yakin Foto Asli & Klik 'Sudah Beres'"| VClosed2(["V4-9: Status CLOSED (Dikonfirmasi Pelapor Utama)\nPelapor Luar Kota Tidak Perlu Balik ke Surabaya/Sidoarjo!"])
    V8 -->|"Pelapor Ragu Karena Tidak di Lokasi -> Diamkan Saja"| V9["Tunggu Sampai Lewat 72 Jam (Warga Lokal Tetap Bisa Bantah Jika Lewat)"]
    V7A --> V9

    V2 -->|"Lewat 72 Jam Tanpa Bantahan & Tanpa Kuorum"| V10(["V4-10: Status AUTO_CLOSED (Ditutup Otomatis Sistem)\nTiket Tidak Menggantung, Dinas Dapat 0 Bonus Poin (Netral), Pelapor +0.1 Skor"])
    V9 --> V10
```

### Penjelasan Urut Satu per Satu (Kenapa Pelapor Luar Kota Aman `100%`):
1. **Saat Melapor Awal:** Pendatang dari luar Jawa/luar kota sedang berada di Surabaya/Sidoarjo, melihat jalan berlubang, lalu melapor di lokasi (`Flowchart 2`). Setelah itu ia pulang ke kota asalnya.
2. **`V4-3` & `V4-4` (Jam `0–48` — Diwakili Warga Lokal):** Begitu dinas selesai memperbaiki, sistem **tidak bergantung pada pelapor awal yang sudah pulang**. Dua warga lokal Surabaya/Sidoarjo yang lewat di radius `<= 100 meter` cukup menekan *Sudah Beres* -> laporan beres (`V4-6`), atau jika dinas berbohong, `1` warga lokal cukup memotret *Klaim Palsu* (`GoDispute`).
3. **`V4-8` & `V4-9` (Jam `48–72` — Hak Khusus Bebas GPS untuk Pelapor yang Sudah Pulang):** Bagaimana kalau jalan tersebut agak sepi sehingga sampai `2 hari` (`48 jam`) belum ada `2` warga lokal yang menekan tombol, dan belum ada sengketa (`disputeCount == 0`)? Pada jam ke-`48` s.d. `72`, sistem membuka **tombol konfirmasi 1-tap bebas syarat GPS khusus bagi Pelapor Utama**. Jadi pelapor yang sudah di luar pulau tetap bisa menutup laporannya setelah memeriksa foto *Before–After* dinas!
4. **`V4-10` (Lewat `72 Jam` — Jaring Pengaman Terakhir):** Kalau pelapor luar kota ragu menekan setuju karena tidak melihat aspalnya secara langsung (atau lupa membuka web), ia **tidak perlu memaksakan klik**. Begitu lewat `72 jam` tanpa bantahan, sistem otomatis menutup tiket ke `AUTO_CLOSED` agar antrean stabil, tetapi **dinas diberi bonus `0 poin`** supaya dinas tidak pernah diuntungkan oleh klaim diam-diam di lokasi sepi.

---

## 5. Flowchart 5: Alur Detail Perulangan Bantahan / Sengketa (`DISPUTED` & `ESCALATED`)

Diagram ini mengurai kebingungan soal **"bagaimana perulangan saat perbaikan dinas dibantah warga, kapan balik kerja ulang, kapan banding, dan kapan berhenti supaya tidak muter selamanya (anti-infinite-loop)"**.

```mermaid
flowchart TD
    S1(["S5-1: Tiket di PENDING_VALIDATION (Putaran ke-1)\nvalidationRound = 1, disputeCount = 0"]) --> S2["S5-2: Warga A (Skor >= 1.0, Jarak <= 100m)\nAmbil Foto Live Bukti Masih Rusak -> Klik 'Klaim Palsu'"]

    S2 --> S3["S5-3: Status Pindah ke DISPUTED (Dibantah Warga)\ndisputeCount naik jadi 1 | Waktu Bantah dicatat ke disputedAt\nDinas Diberi Batas Respons Maksimal 24 Jam!"]

    S3 --> S4{"S5-4: Apa Respons Dinas Dalam 24 Jam?"}

    S4 -->|"Jalur A: Dinas Mengakui Belum Rapi\nKlik 'Kerjakan Ulang' (reprocess-disputed)"| SA1["S5-5A: Status Kembali ke IN_PROGRESS\nisAppealRound = false\nBatas SLA Baru = Sisa SLA Lama + Tambahan 24 Jam"]
    S4 -->|"Dinas Diam > 24 Jam (Anti-Deadlock)"| SA2["S5-5B: Mesin Lazy Evaluation Paksa Masuk Jalur A Otomatis!\nStatus Jadi IN_PROGRESS (isAppealRound = false)"]
    SA1 --> SA3["S5-6A: Petugas Perbaiki Fisik di Lapangan & Unggah Foto Selesai Baru (<= 75m)"]
    SA2 --> SA3
    SA3 --> Round2A["S5-7A: Masuk PENDING_VALIDATION Putaran ke-2\nvalidationRound = 2, disputeCount tetap 1, isAppealRound = false\nSuara Putaran 1 Direset ke 0 (Warga Boleh Menilai Hasil Baru)"]

    S4 -->|"Jalur B (Maksimal 1x Seumur Tiket!):\nDinas Yakin Sudah Benar & Warga A Bohong\nUnggah Foto Sudut Baru <= 75m + Klik 'Ajukan Banding'"| SB1["S5-5C: Masuk PENDING_VALIDATION Putaran Banding\nvalidationRound = 2, disputeCount tetap 1, isAppealRound = true\nTombol Banding Dinas Dikunci Permanen (Tidak Bisa Dipakai Lagi)"]

    SB1 --> SB2["S5-6B: ATURAN NETRALITAS BANDING:\nWarga A (Pembantah Putaran 1) DILARANG Ikut Vote / Bantah Lagi!\nHarus Diuji oleh Warga Lain di Sekitar Lokasi (<= 100m)"]

    Round2A --> CheckR2{"S5-8: Apa Hasil Uji Publik Putaran ke-2?"}
    SB2 --> CheckR2

    CheckR2 -->|"Disetujui Kuorum >= 2 Warga Lain (Skor >= 2.0)"| R2Closed{"S5-9: Apakah Ini Tadi Jalur Banding (isAppealRound == true)?"}
    R2Closed -->|"Tidak (Jalur A Kerja Ulang)"| WinA(["S5-10A: Status CLOSED (Tuntas Pasca-Perbaikan Ulang)\nDinas Dapat 0 Bonus (Karena Pernah Dibantah), Warga A TIDAK Dihukum"])
    R2Closed -->|"Ya (Jalur B Banding Dinas Terbukti Benar!)"| WinB(["S5-10B: Status CLOSED\nWarga A Terbukti Membantah Palsu -> Kena Penalti Skor -0.5 + Jeda 24 Jam!"])

    CheckR2 -->|"Dibantah Lagi oleh Warga B (Skor >= 1.0, Foto Live <= 100m)"| Esc1["S5-11: Bantahan ke-2! Status Langsung NAIK KE ESCALATED\ndisputeCount = 2 | Skor Dinas Langsung Dipotong -5 Poin PERMANEN!"]

    Esc1 --> Esc2["S5-12: TIDAK ADA LAGI BANDING ATAU LOOP KE-3!\nDinas Wajib Unggah 2 Bukti Sekaligus di /dinas:\n1. Dokumen Berita Acara Resmi Berjenjang (PDF/JPG/PNG <= 5 MB)\n2. Foto Lapangan Live Terbaru (<= 75m)"]
    Esc2 --> EscClosed(["S5-13: Status CLOSED ('Diselesaikan via Berita Acara Eskalasi')\nPotongan -5 Poin Dinas Tetap Permanen, Pelapor + Warga A + Warga B Dapat +0.1 Skor"])
```

### Penjelasan Urut Satu per Satu (Kenapa Tidak Mungkin Berputar Tanpa Akhir):
1. **Maksimal Hanya Ada `2` Kali Bantahan (`disputeCount` `1` lalu `2`):** Tidak ada bantahan ke-`3`, ke-`4`, dst.
2. **Bantahan Pertama (`S5-2` -> `S5-3`):** Mengubah status ke `DISPUTED`. Jika dinas mendiamkan sengketa lebih dari `24 jam` (`S5-5B`), sistem otomatis memaksa dinas masuk status kerja ulang (`IN_PROGRESS`) supaya laporan tidak pernah menggantung.
3. **Bedanya Jalur A vs Jalur B (`S5-5A` vs `S5-5C`):**
   - **Jalur A (Kerja Ulang):** Dinas memperbaiki ulang di lokasi. Kalau setelah diperbaiki ulang warga setuju beres (`S5-10A`), pembantah pertama **tidak dihukum** karena bantahannya memang membuat jalan diperbaiki ulang!
   - **Jalur B (Banding Dinas — Maks `1x`):** Dinas merasa pekerjaannya sudah benar sejak awal dan warga pertama hanya usil. Di putaran banding ini (`isAppealRound = true`), **pembantah pertama dikunci tidak boleh ikut memencet tombol** (`S5-6B`). Bila minimal `2` warga lain menyatakan pekerjaan dinas memang sudah beres (`S5-10B`), barulah pembantah pertama yang usil tadi terkena hukuman `-0.5` skor + jeda `24 jam`.
4. **Bantahan Kedua = Palu Terakhir `ESCALATED` (`S5-11` s.d. `S5-13`):** Begitu ada warga kedua yang membuktikan lewat foto *live* bahwa jalan masih rusak, dinas langsung kehilangan **`-5 poin`** secara permanen dan wajib melampirkan dokumen resmi **Berita Acara PDF** yang ditandatangani pejabat + foto lapangan untuk menutup tiket. Siklus selesai tuntas tanpa putaran ke-`3`.

---

## 6. Flowchart 6: Alur Pertahanan Anti-Buzzer, Akun Ternakan & Anti-*Screen Spoofing* *(Penguatan v3.5)*

Diagram ini membedah skenario kecurangan ekstrem yang ditanyakan tim: **"Bagaimana jika oknum dinas membawa 2 HP (HP ke-2 menampilkan foto jalan mulus hasil AI lalu difoto oleh HP ke-1 petugas), lalu memakai akun ternakan lama / buzzer bayaran untuk buru-buru menekan Approve?"**

```mermaid
flowchart TD
    Attack(["Skenario Curang Oknum Dinas:\n1. HP-1 Petugas memfoto layar HP-2 berisi gambar jalan mulus editan AI\n2. Akun Buzzer / HP-2 mencoba buru-buru klik 'Sudah Beres' agar cepat CLOSED"]) --> LayerCam["Lapis 1 (Saat Dinas Unggah Foto):\n- WebRTC Live <= 75m + Watermark WIB + Jarak Meter Tercatat\n- Cek Durasi: Selesai < 10 Menit sejak Diproses? -> Tandai 'isFastResolveAnomaly'"]

    LayerCam --> VoteAttempt["Akun Buzzer Klik 'Sudah Beres' di Lokasi (<= 100m)"]

    VoteAttempt --> Guard1{"Cek Benteng Teknis Dasar (Sudah Aktif):\nApakah 1 HP Dipakai Ganti-Ganti Akun?"}
    Guard1 -->|"X-Device-Fingerprint Sama pada Putaran Ini"| Reject409["DITOLAK 409!\n1 Perangkat Fisik Hanya Punya 1 Suara meski Ganti 10 Akun"]

    Guard1 -->|"HP Berbeda"| Guard2{"Benteng Anti-Buzzer 3 (Deteksi Kolusi & Akun Ternakan):\n1. Klik < 5 Menit pasca-resolve dengan Subnet IP Sama Petugas?\n2. Atau >= 3x Berturut-turut Hanya Approve Dinas Itu Tanpa Pernah Melapor?"}
    Guard2 -->|"Terdeteksi Pola Kolusi!"| ShadowZero["Suara Dicatat Transparan tapi Bobot dijadikan 0.0 (Shadow-Zeroed)\nDitandai 'isCollusionSuspect = true' di AuditLog -> Kuorum Buzzer Gagal!"]

    Guard2 -->|"Lolos Cek Kolusi"| Guard3{"Benteng Anti-Buzzer 2 (Jangkar Saksi Awal):\nApakah Ada Min. 1 Pendukung Awal (sebelum selesai)?\n(Jika Akun Baru, Bobot Hanya 0.5 -> Butuh 4 HP)"}
    Guard3 -->|"Tidak Ada Saksi Awal & Baru 2.0 Poin Orang Asing (< 48 Jam)"| NeedMore["Belum Bisa Kunci Cepat!\nTanpa Saksi Awal Wajib Kuorum >= 3.0 Poin (Min. 3 HP Berbeda)"]

    Guard3 -->|"Kuorum Terpenuhi"| Guard4{"Benteng Anti-Buzzer 1 (Masa Tunggu Eksposur Publik 6 Jam):\nApakah Sudah Lewat Minimal 6 Jam Sejak Dinas Klaim Selesai?\n(Bypass Otomatis Hanya untuk Mode Demo Juri)"}
    Guard4 -->|"Belum 6 Jam! (Serangan Tutup Kilat Detik ke-10)"| HoldOpen["TAHAN STATUS DI PENDING_VALIDATION!\nFoto Sebelum-Sesudah + Label Anomali Terpajang Terbuka Selama 6 Jam"]

    NeedMore --> HoldOpen
    HoldOpen --> PublicEye{"Selama Masa Terbuka, Warga Asli / Pelapor Lewat & Cek Foto:\nTerlihat Bezel HP / Efek Garis Layar (Moire) / Aspal AI Palsu\npadahal Jalan Asli Masih Rusak!"}

    PublicEye -->|"1 Warga Asli (Skor >= 1.0) Foto Live & Klik 'Klaim Palsu'"| Bust(["KECURANGAN TERBONGKAR!\n1. Seluruh Suara Buzzer Langsung GUGUR\n2. Status Jatuh ke DISPUTED / ESCALATED (-5 Poin Dinas)\n3. Foto AI Palsu & Daftar Akun Buzzer Terkunci Abadi di Segel HMAC-SHA256!"])
    PublicEye -->|"Lewat >= 6 Jam & Memang Benar-Benar Mulus Tanpa Bantahan"| SafeClose(["Barulah Tiket Sah Menjadi CLOSED"])
```

### Penjelasan Urut Satu per Satu (Cara Kerja 6 Lapis Pertahanan):
1. **`Lapis 1` (Menangkal Foto Layar HP + AI / *Screen Spoofing*):** Memotret layar HP kedua dari dekat selalu menyisakan cacat visual dibanding foto jalan asli (pantulan kaca, pola garis piksel *moiré*, warna aspal tidak menyatu dengan trotoar foto *Before*, atau diselesaikan hanya `3 menit` setelah tiket diambil sehingga otomatis diberi label peringatan **`Selesai Sangat Cepat — Perlu Cek Teliti`**). Karena foto *Before–After* dipajang berdampingan ke publik, kebohongan ini mudah terlihat oleh warga sekitar.
2. **`Guard 1` (Anti-Kloning `1` HP Banyak Akun — Sudah Aktif):** Kode `X-Device-Fingerprint` (`SHA-256` perangkat) mengunci `1` HP = `1` suara per putaran. Petugas membawa `1` HP cadangan lalu login-logout `4` akun tetap gagal di suara ke-`2`.
3. **`Guard 2` (Solusi Anti-Buzzer 3 — Mematikan Akun Ternakan Lama / *Pre-Aged Sybil*):** Sekalipun akun palsu sudah disiapkan berbulan-bulan sebelumnya, perilaku akun ternakan selalu mencolok: selalu muncul `< 5 menit` setelah petugas yang sama menekan *Selesai* di jaringan/hotspot yang sama, atau tidak pernah melapor kerusakan tapi kerjanya hanya menyetujui satu dinas tertentu (`>= 3x`). Sistem otomatis mengenolkan bobot suaranya (`effectiveWeight = 0.0`).
4. **`Guard 3` (Solusi Anti-Buzzer 2 — Jangkar Saksi Awal):** Dua akun asing yang baru muncul setelah dinas selesai tidak cukup untuk menutup tiket cepat apabila tidak ada satu pun warga pendukung awal laporan tersebut — sistem menuntut minimal `1` pendukung awal atau menaikkan syarat menjadi `>= 3.0 poin` (`>= 3` perangkat berbeda).
5. **`Guard 4` (Solusi Anti-Buzzer 1 — Mematikan Serangan "Tutup Kilat" dengan Masa Tunggu `6 Jam`):** Inilah kunci utamanya. Walaupun buzzer langsung menekan *Sudah Beres* pada detik ke-`10` setelah petugas selesai, sistem **menolak mengunci tiket ke `CLOSED` sebelum minimal `6 jam` berlalu**. Tiket tetap terbuka di peta sebagai *Menunggu Cek Warga*.
6. **`Bust` (`1` Bantahan Warga Asli Mengalahkan Keroyokan Buzzer):** Selama jendela terbuka tersebut, cukup **`1` orang warga jujur** (`skor >= 1.0`) yang lewat di jalan itu dan memotret kondisi asli yang masih berlubang (*Klaim Palsu*), seluruh suara buzzer langsung gugur, tiket masuk sengketa/eskalasi (`-5 poin` dinas), dan bukti foto AI palsu beserta nama samaran penyetujunya tersegel permanen di `AuditLog` `HMAC-SHA256` (tidak bisa dihapus dinas).

---

## 7. Flowchart 7: Alur Halaman "Catatan Kerja Dinas" (`/rapor`) — Nilai Otomatis + Rating Bintang Warga

Diagram ini menjelaskan hasil kesepakatan tim untuk mengganti istilah kaku *"Rapor Integritas"* menjadi **"Catatan Kerja Dinas"** yang mudah dimengerti warga awam sekaligus menggabungkan nilai otomatis dengan ulasan bintang warga.

```mermaid
flowchart TD
    R1(["R7-1: Siapa Saja Membuka Menu 'Catatan Kerja Dinas' (/rapor)\n(Warga Tanpa Login, Warga Login, Juri, maupun Dinas Sebatas Lihat)"]) --> R2["R7-2: Server Ambil Data GET /api/rapor (Cache Cepat Redis 180 Detik)"]

    R2 --> R3["R7-3: Bagian 1 — Kartu 4 Dinas dengan Bahasa Manusia (Bebas Istilah Teknis):\n1. Nilai Kerja Otomatis (0-100, Modal Awal 80)\n   - Beres Tepat Waktu: +2 Poin\n   - Lewat Batas Waktu: -3 Poin (-6 bila Didukung >= 10 Warga)\n   - Naik ke Pengawasan (Bohong 2x): -5 Poin Permanen\n2. Catatan Kecepatan: Berapa Selesai Tepat Waktu vs Terlambat\n3. Lencana Peringatan 'Sering Lempar Laporan' (>25%) / 'Sering Tolak Laporan' (>20%)"]

    R2 --> R4["R7-4: Bagian 2 — Rating Kepuasan Warga (1-5 Bintang + Alasan Singkat):\nMenampilkan Rata-Rata Bintang & Komentar Nyata Warga per Dinas"]

    R2 --> R5["R7-5: Bagian 3 — Peta Titik Rawan Kerusakan Surabaya-Sidoarjo\nFilter per Kategori (Jika Kosong -> Tampil Tombol 'Lihat Semua Kategori')"]

    TicketClosed(["Dari Halaman Detail Tiket (/tiket/:id) yang Sudah Berstatus CLOSED"]) --> CanRate{"R7-6: Apakah Pengguna = WARGA Login & Belum Pernah Memberi Bintang di Tiket Ini?"}
    CanRate -->|"Ya"| SubmitRate["R7-7: Pilih 1-5 Bintang + Tulis Alasan Singkat -> POST /api/tickets/:id/rate\nCache Redis Dihapus -> Rata-Rata Bintang di /rapor Langsung Terbarui!"]
    CanRate -->|"Belum Login / Petugas Dinas / Sudah Pernah Isi"| ReadOnlyRate["Hanya Bisa Membaca Ulasan (Cegah Spam Bintang & Manipulasi Dinas)"]
```

### Penjelasan Urut Satu per Satu:
1. **Kenapa Dua Indikator Digabung (`R7-3` + `R7-4`):**
   - **Nilai Kerja Otomatis (`0–100`)** menjaga keadilan objektif untuk lomba (tidak bisa diserbu spam bintang palsu karena dihitung murni dari ketepatan waktu dan bukti fisik lapangan), namun kata-katanya diterjemahkan total ke bahasa sehari-hari warga.
   - **Rating Bintang Warga (`1–5 Bintang` + alasan)** memenuhi kebutuhan pengguna awam yang terbiasa membaca ulasan bintang seperti layanan publik/sekolah.
2. **Anti-Spam Ulasan (`R7-6` & `R7-7`):** Ulasan bintang tidak dibuka bebas sebagai form kosong tanpa dasar, melainkan muncul pada laporan yang memang sudah **Selesai (`CLOSED`)** dengan batas `1` akun `1` ulasan per tiket, dan akun `ADMIN_DINAS` dilarang memberi bintang untuk dinasnya sendiri.

---

## 8. Flowchart 8: Alur Simulasi Dewan Juri `< 3 Menit` (`/?jury_token=...`)

Diagram ini adalah urutan baku saat presentasi/video demo maupun saat juri mencoba langsung dari laptop penjurian tanpa harus pergi ke jalanan Surabaya–Sidoarjo.

```mermaid
flowchart TD
    J1(["Menit 0:00 — Juri Klik Link di Baris Teratas README.md (?jury_token=...)"]) --> J2["Panel Simulasi Juri Aktif (4 Jam)\nOtomatis Masuk Peran 1: WARGA_PELAPOR"]
    J2 --> J3["Menit 0:30 — Buka /lapor -> Klik Alat 2 (Lompat GPS ke Sidoarjo/Surabaya)\nKlik Alat 3 (Simulasi Jepret Kamera Sampel Terkalibrasi) -> Kirim Laporan Baru"]
    J3 --> J4["Menit 1:10 — Klik Alat 1: Ganti Peran ke ADMIN_DPU / ADMIN_DISHUB\nBuka /dinas -> Klik 'Mulai Kerjakan' -> Lompat GPS -> Unggah Foto Selesai"]
    J4 --> J5["Menit 1:50 — Uji Skenario Sengketa atau Selesai:\nGanti Peran ke WARGA_VALIDATOR -> Buka /tiket/:id\nCoba Alat 4 (+25 Jam / +49 Jam) atau Klik 'Sudah Beres' (Validator 1 lalu Validator 2)\n(Mode Juri Otomatis Melewati Jendela Tunggu 6 Jam agar Langsung Terlihat CLOSED)"]
    J5 --> J6["Menit 2:30 — Buka /tiket/:id Klik 'Verifikasi Segel Digital' (Hijau Aman)\nLalu Buka 'Catatan Kerja Dinas' (/rapor) Lihat Skor Dinas Naik +2 Poin"]
    J6 --> J7(["Menit 2:50 — Klik Alat 5: 'Reset Data Demo'\nSeluruh Data Contoh & Skor 4 Dinas Kembali Bersih ke 80 (Akun Warga Asli Tetap Aman)"])
```

### Penjelasan Urut Satu per Satu:
1. **`J1`–`J3`:** Juri yang memakai PC tanpa kamera belakang atau berada di kota lain (misal Semarang/Jakarta) tetap bisa menguji pembuatan laporan lengkap beserta kupon `captureNonce` sah menggunakan Alat 2 (*GPS Simulator*) dan Alat 3 (*Simulasi Jepret Kamera*).
2. **`J4`–`J5`:** Dengan `1` klik pindah peran (`WARGA_PELAPOR` -> `ADMIN_DPU` -> `WARGA_VALIDATOR` -> `WARGA_VALIDATOR_2`), setiap peran simulasi diberi sidik perangkat simulasi terpisah sehingga juri bisa menuntaskan kuorum `2` warga di `1` laptop tanpa terhalang masa tunggu `6 jam`.
3. **`J6`–`J7`:** Setelah melihat segel `HMAC-SHA256` dan kenaikan nilai di **Catatan Kerja Dinas**, tombol **Reset Data Demo** membersihkan kembali semua percobaan juri ke kondisi awal (`skor 80`) dan menghapus cache Redis dalam hitungan detik.
