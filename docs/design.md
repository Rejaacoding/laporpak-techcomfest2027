# LaporPAK! Design System (Tailwind CSS)

Acuan: PRD v3.4. Gaya: **Civic Friendly** (radius 12–16px, maskot menonjol, hangat). Brand: **Teal**. Tema: **3 suasana per halaman, tanpa toggle**. Perangkat: **Hybrid per role**. Kepadatan: **Lega untuk warga, padat untuk dinas/rapor**.

## 1. Tema per Halaman (Progressive Depth)

Satu set token semantik, nilainya dibalik per tema lewat atribut `data-theme` di `<body>` atau layout halaman.

| Halaman | `data-theme` | Latar | Perangkat utama |
| --- | --- | --- | --- |
| `/` Beranda & Peta | `warm` | Terang hangat | Mobile-first |
| `/lapor`, `/tiket/:id` | `blueprint` | Biru-teknis terang | Mobile-first |
| `/dinas` | `warm` | Terang hangat | Desktop-first |
| `/rapor`, panel hash | `slate` | Deep Command Slate | Desktop-first |
| Profile Drawer | ikut halaman induk | | Mobile-first |

```css
/* globals.css: token semantik */
:root,[data-theme=warm]{--bg:#FFFBF5;--surface:#FFFFFF;--surface-2:#FEF3E2;--line:#E7DFD3;--fg:#1C1917;--fg-muted:#57534E;--brand:#0F766E;--brand-fg:#FFFFFF;--brand-soft:#CCFBF1}
[data-theme=blueprint]{--bg:#EFF6FF;--surface:#FFFFFF;--surface-2:#DBEAFE;--line:#BFDBFE;--fg:#0F172A;--fg-muted:#475569;--brand:#0F766E;--brand-fg:#FFFFFF;--brand-soft:#CCFBF1}
[data-theme=slate]{--bg:#0F172A;--surface:#1E293B;--surface-2:#273449;--line:#334155;--fg:#F1F5F9;--fg-muted:#94A3B8;--brand:#2DD4BF;--brand-fg:#042F2E;--brand-soft:#134E4A}
```

```js
// tailwind.config.js (extend.colors)
bg:'var(--bg)', surface:{DEFAULT:'var(--surface)',2:'var(--surface-2)'}, line:'var(--line)',
fg:{DEFAULT:'var(--fg)',muted:'var(--fg-muted)'},
brand:{DEFAULT:'var(--brand)',fg:'var(--brand-fg)',soft:'var(--brand-soft)'}
```

Aturan: komponen hanya memakai `bg-surface`, `text-fg`, `border-line`, `bg-brand`. Dilarang hex mentah di komponen.

## 2. Warna Brand & Netral

| Token | Hex | Class | Pakai untuk |
| --- | --- | --- | --- |
| Brand | `#0F766E` | `bg-brand` (warm/blueprint) | CTA utama, link, fokus |
| Brand terang | `#2DD4BF` | `bg-brand` (slate) | CTA di tema gelap |
| Brand soft | `#CCFBF1` | `bg-brand-soft` | Chip, hover ringan |
| Teks utama | `#1C1917` / `#0F172A` / `#F1F5F9` | `text-fg` | Isi |
| Teks sekunder | `#57534E` / `#475569` / `#94A3B8` | `text-fg-muted` | Label, caption |
| Slate command | `#0F172A` | `bg-bg` di `slate` | `/rapor`, panel hash |

Kontras teks minimal 4.5:1. Teal `#0F766E` di atas putih 5.5:1. Pada tema gelap, tombol brand memakai teks `#042F2E`.

## 3. Warna Status Tiket (10 Status, Bab 3)

Pin peta, badge, dan timeline memakai warna yang sama. Badge wajib memuat **ikon + label**, warna saja tidak cukup.

| Status | Label UI (Anti-Jargon) | Pin | Hex pin | Badge (Tailwind) | Ikon (Lucide) |
| --- | --- | --- | --- | --- | --- |
| OPEN | Laporan Masuk | Biru | `#2563EB` | `bg-blue-100 text-blue-800` | `circle-dot` |
| OUT_OF_SCOPE | Kewenangan Instansi Lain | Abu-abu | `#9CA3AF` | `bg-gray-200 text-gray-700` | `ban` |
| REJECTED_SPAM | Ditolak (Spam) | Abu gelap (tersembunyi) | `#4B5563` | `bg-gray-700 text-gray-100` | `shield-x` |
| IN_PROGRESS | Sedang Ditangani | Kuning | `#EAB308` | `bg-yellow-100 text-yellow-900` | `wrench` |
| OVERDUE | Melewati Tenggat | Merah | `#DC2626` | `bg-red-100 text-red-800` | `alarm-clock` |
| PENDING_VALIDATION | Menunggu Cek Warga | Oranye | `#F97316` | `bg-orange-100 text-orange-900` | `scale` |
| DISPUTED | Dibantah Warga | Ungu | `#9333EA` | `bg-purple-100 text-purple-800` | `message-square-warning` |
| ESCALATED | Eskalasi Pengawasan | Merah tua | `#7F1D1D` | `bg-red-900 text-red-50` | `siren` |
| CLOSED | Tuntas Terverifikasi | Hijau | `#16A34A` | `bg-green-100 text-green-800` | `check-circle-2` |
| AUTO_CLOSED | Ditutup Otomatis (72 Jam) | Hijau muda | `#86EFAC` | `bg-green-50 text-green-800 ring-1 ring-green-300` | `clock-check` |

Di tema `slate`, badge memakai `bg-{warna}-500/15 text-{warna}-300`.

**Warna sistem lain:**

| Fungsi | Class |
| --- | --- |
| Sukses (toast, skor ≥70) | `text-green-700` / `bg-green-50` |
| Warning (cooldown, skor 40–69, rasio >20%/25%) | `text-amber-800` / `bg-amber-50` |
| Error (409, 422, blokir) | `text-red-700` / `bg-red-50` |
| Info (isLowQualityOverride, banner juri) | `text-sky-800` / `bg-sky-50` |

Skor integritas dinas: ≥70 hijau, 40–69 amber, <40 merah.

## 4. Tipografi

- Heading & UI: **Lexend** (500/600/700). Body: **Source Sans 3** (400/600). Data, hash, koordinat, timer: **JetBrains Mono** (500).
- Muat lewat `@fontsource` atau Google Fonts, `font-display: swap`.
- `fontFamily: { head:['Lexend','sans-serif'], sans:['"Source Sans 3"','sans-serif'], mono:['"JetBrains Mono"','monospace'] }`

| Peran | Mobile | Desktop | Class |
| --- | --- | --- | --- |
| Display (hero) | 32/38 | 48/54 | `font-head font-bold text-[32px] md:text-5xl` |
| H1 | 24/30 | 30/36 | `font-head font-bold text-2xl md:text-3xl` |
| H2 | 20/26 | 24/30 | `font-head font-semibold text-xl md:text-2xl` |
| H3 | 18/24 | 18/24 | `font-head font-semibold text-lg` |
| Body | 16/24 | 16/24 | `text-base` |
| Body padat (`/dinas`, `/rapor`) | 14/20 | 14/20 | `text-sm` |
| Label | 14/20 | 14/20 | `text-sm font-medium` |
| Caption | 12/16 | 12/16 | `text-xs text-fg-muted` |
| Data/angka | 14/20 | 14/20 | `font-mono text-sm tabular-nums` |

Aturan: body warga minimal 16px (cegah zoom otomatis iOS di input). Teks isi tidak boleh di bawah 12px. Angka timer dan skor selalu `tabular-nums`.

## 5. Spacing, Radius, Elevasi, Gerak

- Skala dasar 4px. Jarak antar-seksi warga `py-10 md:py-16`. Antar-kartu `gap-4` (warga) / `gap-2` (dinas).
- Padding kartu: warga `p-4 md:p-6`, dinas `p-3`. Padding halaman `px-4 md:px-6 lg:px-8`. Kontainer `max-w-7xl mx-auto`.
- **Kepadatan warga:** target sentuh `min-h-12` (48px), jarak antar-target `gap-2`. **Kepadatan dinas/rapor:** baris tabel `h-10`, target klik `min-h-9` (hanya di breakpoint `md+`).
- Radius: input & tombol `rounded-xl` (12px), kartu `rounded-2xl` (16px), badge `rounded-full`, modal & drawer `rounded-t-3xl` (mobile) / `rounded-2xl` (desktop).
- Elevasi: kartu `shadow-sm border border-line`, popover `shadow-md`, modal & drawer `shadow-xl`. Tema `slate` memakai border, bukan shadow.
- Breakpoint standar Tailwind: `sm 640`, `md 768`, `lg 1024`, `xl 1280`. Mobile-first: tulis gaya dasar untuk HP, tambah `md:`/`lg:` ke atas. `/dinas` dan `/rapor` memakai tata letak desktop di `lg:`, dan tetap dapat dipakai di HP.
- Gerak: 150ms (hover), 200ms (modal, drawer), `ease-out`. Ubah hanya `opacity` dan `transform`. Hormati `motion-reduce:` (`motion-reduce:transition-none`).
- Fokus: `focus-visible:ring-2 ring-brand ring-offset-2`. Jangan pernah menghapus outline.
- Ikon: Lucide, 20px (dalam teks) / 24px (tombol ikon). Tombol ikon wajib `aria-label`. Tanpa emoji sebagai ikon.

## 6. Komponen Inti

### 6.1 Navigasi
- **Navbar warga (mobile):** bottom nav 4 item (`Peta`, `Lapor`, `Rapor`, `Profil`), `h-16`, ikon + label 12px. Tombol `Lapor` menonjol: `bg-brand rounded-full -mt-4 size-14 shadow-lg`.
- **Navbar desktop:** top bar `h-16 bg-surface border-b border-line`, logo kiri, menu tengah, avatar alias kanan.
- **Sidebar `/dinas`:** `w-60` di `lg+`, nama dinas + `integrityScore` di atas. Mobile berubah jadi tab bar atas yang bisa digeser.
- **Banner Juri** (jika `?jury_token`): sticky atas `bg-sky-900 text-sky-50 text-xs h-9`, berisi sisa TTL dan tombol Panel Juri.
- Role guard: menu `Lapor` disembunyikan untuk `ADMIN_DINAS`. Pengunjung publik melihat `Masuk`.

### 6.2 Tombol
| Varian | Class |
| --- | --- |
| Primary | `bg-brand text-brand-fg hover:brightness-110 rounded-xl min-h-12 px-5 font-semibold` |
| Secondary | `bg-surface border border-line text-fg hover:bg-surface-2` |
| Danger (Tolak Spam, Klaim Palsu) | `bg-red-600 text-white hover:bg-red-700` |
| Ghost | `text-brand hover:bg-brand-soft` |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed`. Wajib ada teks alasan di bawahnya (jarak, akurasi, cooldown). |

Tombol aksi yang memanggil API menampilkan spinner dan dinonaktifkan sampai respons datang (cegah klik ganda dan 409).

### 6.3 Kartu
- **TicketCard (daftar/peta):** foto 16:9 `rounded-xl`, badge status kiri atas, judul kategori (H3), alamat singkat, `SlaTimer`, `supportCount`. Seluruh kartu bisa diklik.
- **StatCard (`/rapor`):** angka `font-mono text-3xl`, label caption, delta/ikon. Latar `bg-surface`.
- **DinasScoreCard:** nama dinas, `integrityScore` besar + bar 0–100 berwarna sesuai skor, baris rasio `OUT_OF_SCOPE` (>25%) dan `REJECTED_SPAM` (>20%) dengan lencana peringatan `bg-amber-100`, lencana `isChronicOverdue` merah.
- **Maskot panel:** Cak Pantau (kondisi normal/pantau) dan Mas Sigap (aksi/darurat), ilustrasi 96–160px di hero, empty state, dan toast besar. Pose "Siaga" dipakai untuk filter kosong dan error.

### 6.4 SlaTimer (Public SLA Countdown)
- Format `HH:MM:SS` (`font-mono tabular-nums`), diperbarui tiap 1 detik. Jika >24 jam sisa, tampilkan `X hari Y jam`.
- Warna: >50% sisa `text-fg`, 25–50% `text-amber-700`, <25% `text-red-700`, OVERDUE `text-red-700 font-bold` + label `Terlambat +HH:MM`.
- Paused (PENDING_VALIDATION): ikon `pause`, teks `SLA dijeda`, `text-fg-muted`.
- Tier SLA tampil sebagai chip: `DARURAT · 24j` (merah), `MENENGAH · 72j` (amber), `STANDAR · 168j` (biru).

### 6.5 Peta (Leaflet)
- Pin: lingkaran 32px berwarna status (tabel §3) dengan ikon putih di dalam. Pin dipilih: ring `brand` dan skala 1.15.
- Klaster marker: `bg-brand text-brand-fg rounded-full`, ukuran naik per jumlah (36/44/52px).
- Poligon geofencing `/lapor`: garis `#0F766E` putus-putus, isi `rgba(15,118,110,0.08)`. Di luar poligon, pin berubah merah dengan pesan humanis *"Lokasi pin berada di luar wilayah layanan Surabaya & Sidoarjo"* (dilarang menampilkan kode `422`/`409`/`500` mentah ke warga).
- Pra-kamera `/lapor`: setelah pin diletakkan, tampilkan daftar ringkas `nearbyTickets` dalam 50 m + 1 klik `Dukung Prioritas` **sebelum** kamera dibuka agar warga tidak memotret sia-sia saat kuota penuh.
- Filter peta: chip kategori di atas peta, bisa digeser, `min-h-10`. Filter nihil menampilkan maskot Siaga + tombol `Reset Filter Peta`.
- Loading: skeleton `animate-pulse` bentuk peta. Hormati `motion-reduce`.
- Heatmap `/rapor`: gradien `#14B8A6 → #FACC15 → #DC2626` (MVP cukup klaster marker).

### 6.6 Kamera Live (WebRTC Viewfinder)
- Pra-kamera `/lapor`: kartu ringkas di atas tombol buka kamera menjelaskan *kenapa* tidak bisa pilih dari galeri (*"Wajib foto langsung di lokasi agar terbukti kejadian nyata & baru"*) + jaminan privasi sebelum browser memicu prompt izin GPS/kamera.
- Izin GPS/Kamera ditolak & GPS `>50m`: dilarang layar mati/kosong — tampilkan kartu panduan langkah demi langkah (*klik ikon gembok di bilah alamat → Izinkan → Muat Ulang Posisi*) atau saran menepi ke area terbuka + tombol `Coba Lagi`.
- Layar penuh `fixed inset-0 bg-black`, video `object-cover`, bingkai pemandu sudut `border-white/80`.
- Bar atas: tombol tutup (48px) dan chip akurasi GPS (`≤50m` hijau, `>50m` merah + teks).
- Pengingat privasi permanen di bawah bingkai: `Jangan potret wajah atau pelat nomor` (`text-xs text-white/90 bg-black/50 rounded-full px-3`).
- Tombol jepret: lingkaran `size-20 border-4 border-white bg-white/20`, di tengah bawah.
- Hasil jepret: layar tinjau + tombol `Jepret Ulang` (secondary) dan `Kirim` (primary). Saat gagal jaringan/server, foto + ketikan form tetap tersimpan utuh dengan tombol `Kirim Ulang` (`Idempotency-Key` sama).
- Pesan gagal kalibrasi, satu baris dengan ikon: `Terlalu silau`, `Terlalu gelap`, `Buram`, `Foto tidak pantas, jepret ulang` (zona 0.55–0.84). Jepret ke-3 buram: banner info `Foto kualitas rendah akan tetap dikirim`.
- Blokir `≥0.85`: modal error dengan penalti -0.5 dan hitung mundur cooldown 24j.
- Kamera virtual terdeteksi: modal danger. Sesi juri melihat tombol `Simulasi Jepret Kamera`.
- Tidak ada tombol unggah file. Satu-satunya dropzone adalah Berita Acara di §6.10.

### 6.7 Form Input
- Label selalu terlihat di atas field (`text-sm font-medium mb-1`). Placeholder bukan pengganti label.
- Input: `min-h-12 rounded-xl border border-line bg-surface px-4 text-base focus-visible:ring-2 ring-brand`. Padat (`/dinas`): `min-h-10 text-sm`.
- Error di bawah field: `text-sm text-red-700` + ikon, `role="alert"`. Helper `text-xs text-fg-muted`. Isian form wajib bertahan saat error validasi atau putus koneksi.
- Textarea alasan menampilkan penghitung `n/20` (Out of Scope), `n/15` (Tolak Spam, Oper). Tombol kirim aktif setelah syarat minimum terpenuhi.
- Select instansi (Out of Scope): PLN, PDAM, BPJN, BBWS, Telkom, Lainnya.
- Login `/login`: satu form, tombol Google OAuth di atas dengan pemisah `atau`, ditambah catatan jaminan anonimitas di bawahnya (`aliasName` acak, email/UUID tidak tampil ke publik/dinas). Tanpa tautan daftar untuk dinas.

### 6.8 Halaman Detail `/tiket/:id` (Uji Publik)
- **BeforeAfterSlider:** dua foto, handle geser `size-12`, label `Sebelum` / `Sesudah`, dilengkapi info `repairDistanceMeters` & `repairCapturedAt` (misal `Diambil petugas 18 m dari titik laporan · 20 Nov 14:22 WIB`). Bisa dioperasikan keyboard (`←` `→`).
- **QuorumBar:** `h-3 rounded-full bg-surface-2`, isi `bg-brand`, label `x / 2.0` + `n validator`. Penanda di 2.0.
- **ValidationActions:** dua tombol 48px, `Sudah Beres` (primary) dan `Klaim Palsu` (danger outline). Jika nonaktif (jarak >100 m, akurasi >50 m, atau `trustScore < 1.0` pada akun baru), alasan + cara menaikkan skor tampil sebagai teks terlihat di bawah tombol (jangan bergantung pada hover tooltip di HP).
- **PhaseBanner:** jam 0–48 `bg-sky-50` (`Menunggu cek warga sekitar ≤100 m agar penilaian adil`), jam 48–72 `bg-amber-50` (`Konfirmasi 1-tap pelapor`).
- **Media NSFW pending:** foto `blur-xl` dengan tombol tengah `Tampilkan Gambar` (Signed URL 60 detik). **isLowQualityOverride:** foto normal + chip `Foto buram (kualitas terbatas)` `bg-sky-100 text-sky-800`.
- **Timeline status:** vertikal, titik berwarna status, waktu `font-mono`, label aktor anonim (`actorDisplayLabel`), serta alasan rujukan/penolakan jika `OUT_OF_SCOPE` / `REJECTED_SPAM`.
- **HashPanel (`slate`):** `bg-[#0F172A] rounded-2xl p-4`, satu kalimat penjelasan awam *Segel Anti-Rekayasa* di atas hash (`"Membuktikan riwayat waktu & status tidak pernah diubah diam-diam"`), hash `font-mono text-xs break-all text-brand`, tombol `Verifikasi Rantai` (hasil: ringkasan `summaryText` + ikon hijau valid / merah rusak). Dapat dilipat di mobile.
- `Dukung Prioritas`: tombol secondary dengan ikon, hitungan `supportCount`. Nonaktif untuk pelapor sendiri atau tiket di luar `Laporan Masuk` / `Sedang Ditangani`, dengan teks alasan singkat di bawahnya.

### 6.9 Tabel & Antrean `/dinas` (padat)
- Desktop: tabel `text-sm`, header `sticky top-0 bg-surface-2`, baris `h-10 hover:bg-surface-2`, urutan OVERDUE dulu lalu SLA tersingkat. Baris OVERDUE: `border-l-4 border-red-600`.
- Kolom: `Status`, `Kategori`, `Lokasi`, `SlaTimer`, `Dukungan`, `Aksi`.
- Mobile: tabel berubah jadi tumpukan kartu padat (`p-3 gap-2`).
- Aksi per baris: `Kerjakan`, `Oper`, `Tolak Spam`, `Di Luar Wewenang`, `Selesai`. Aksi yang terkunci tampil abu-abu dengan tooltip alasan (bukan OPEN, lewat `min(24j, 50% SLA)` sejak `syncedAt`).
- Tiket DISPUTED: banner ungu dengan timer respons 24j, tombol `Proses Ulang` dan `Ajukan Banding Bukti` (1×).
- Tiket ESCALATED: panel merah tua, tombol selesai terkunci sampai ada Berita Acara + Foto Live.
- Tabel `/rapor` (`slate`): baris 4 dinas, kolom `Skor`, `SLA`, `OVERDUE/ESCALATED`, `Kronis`, `OUT_OF_SCOPE %`, `REJECTED_SPAM %`.

### 6.10 Modal, Drawer & Dropzone
- **Modal:** overlay `bg-black/50`, panel `bg-surface rounded-2xl max-w-md p-6`. Di mobile berupa bottom sheet `rounded-t-3xl`. Fokus terkunci di dalam, `Esc` menutup (kecuali modal blokir).
- **Modal aksi dinas** (Out of Scope, Tolak Spam, Oper): judul, penjelasan satu kalimat, field wajib, tombol `Batal` + tombol aksi. Tolak Spam menampilkan peringatan penalti pelapor.
- **ProfileDrawer:** `fixed right-0 w-full sm:w-96`, isi: `aliasName` (contoh `Warga-Delta-402`), bar `trustScore 0–2.0` (warna merah <0.5, amber 0.5–1.0, hijau >1.0), status cooldown/freeze dengan hitung mundur, riwayat tiket, antrean offline.
- **Antrean offline:** kartu `bg-amber-50` berisi `n foto tertunda`, sisa masa 24 jam, tombol `Sinkronkan Sekarang`.
- **Dropzone Berita Acara:** `border-2 border-dashed rounded-2xl p-6`, terima PDF/JPG/PNG ≤5 MB, tampilkan nama file dan tombol hapus. Satu-satunya input `file` di aplikasi.
- **Toast:** kanan atas desktop, atas tengah mobile, 5 detik. Konflik status/kuota (`409`) menampilkan pesan ramah bahasa awam (tanpa angka kode HTTP) lalu refresh data otomatis.

### 6.11 Panel Juri
- Tombol melayang `bottom-20 right-4` (mobile) membuka panel 5 alat: `Role Switcher`, `GPS Simulator`, `Simulasi Jepret Kamera`, `Percepat Waktu (+25j/+49j)`, `Reset Demo`.
- Gaya `slate` dengan aksen `sky`. `Reset Demo` berwarna danger dengan konfirmasi.

## 7. Aksesibilitas & Kinerja

- Warna tidak pernah jadi satu-satunya penanda status (ikon + teks wajib).
- Semua elemen interaktif bisa dijangkau keyboard, urutan fokus mengikuti urutan visual.
- Gambar punya `alt`. Foto laporan memakai `loading="lazy"`, rasio ditetapkan (`aspect-video`) agar CLS <0.1.
- Dukungan `prefers-reduced-motion`. Terang dan gelap lolos kontras 4.5:1.
- Target performa: halaman dan peta <2 detik. `nsfwjs` dimuat lewat `React.lazy()`/`import()`.
- Konten halaman publik tidak boleh memuat UUID, email, atau IP pengguna.

## 8. Daftar Periksa Sebelum Merge UI

- [ ] Komponen memakai token (`bg-surface`, `text-fg`, `bg-brand`), tanpa hex mentah.
- [ ] Status memakai tabel §3, lengkap dengan ikon dan label.
- [ ] Target sentuh warga ≥48px, dinas ≥36px di `md+`.
- [ ] Tampilan dicek di 375px, 768px, 1280px tanpa scroll horizontal.
- [ ] Setiap state edge-case Bab 5 punya tampilan: kosong, lambat, izin ditolak, error non-jargon, terkunci (alasan terlihat di HP), offline.
- [ ] Fokus terlihat, tombol ikon punya `aria-label`, `motion-reduce` aktif.
