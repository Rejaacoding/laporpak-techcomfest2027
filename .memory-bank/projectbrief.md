# Project Brief — LaporPAK! (Techcomfest 2027)

## Identitas & Tujuan
- **Nama Aplikasi:** LaporPAK! (Platform Pelaporan Infrastruktur & Audit Publik Dua Arah Berbasis Peta)
- **Kompetisi & Tema:** Techcomfest 2027 — SDG 16 (Tata Kelola Pemerintahan Transparan, Akuntabel & Partisipatif)
- **Wilayah Layanan Resmi:** Kota Surabaya & Kabupaten Sidoarjo (poligon batas `public/geo/sidoarjo-surabaya.json`)
- **Live URL:** `https://laporpak-techcomfest2027.vercel.app/`
- **Repository:** `git@github.com:Rejaacoding/laporpak-techcomfest2027.git` (`main`, `arya`, `fatih`, `reza`)
- **Timeline:** Feature Freeze MVP **12 Desember 2026**, Batas Pengumpulan **18 Desember 2026 23.59 WIB**

## Struktur Tim
- **Arya (Backend & Integrator):** `prisma/`, `backend/src/`, `api/`
- **Fatih (Frontend UI/UX & Maskot):** `frontend/src/pages/`, `frontend/src/components/`, `public/mascots/`
- **Reza (Fullstack, Infra, Kamera & Demo):** `backend/src/middlewares/`, `frontend/src/components/camera/`, `frontend/src/components/jury/`

## Ruang Lingkup Inti (Non-Goals & Boundaries)
- **Warga (`WARGA`):** Lapor kerusakan via kamera WebRTC langsung + GPS (`<= 50 m`), dukung prioritas, validasi perbaikan *Sudah Beres* / *Klaim Palsu* (`<= 100 m`), verifikasi segel audit kriptografi, dan beri rating bintang `1–5` setelah tiket `CLOSED`. Identitas warga selalu tersamarkan (`Warga-<Kata>-<Angka>`) dan koordinat publik dibulatkan 4 desimal (`±11 m`).
- **Petugas Instansi (`ADMIN_DINAS`):** 4 dinas aktif (`DISHUB`, `DPU`, `DLH`, `SATPOLPP`) mengelola antrean tiket, 8 aksi kerja (`process`, `transfer` 1x, `out-of-scope`, `reject-spam`, `resolve <= 75 m`, `reprocess-disputed`, `counter-dispute`, `resolve-escalated` dengan Berita Acara PDF).
- **Non-Goals:** Tidak mengizinkan upload galeri (anti foto palsu/AI; wajib kamera fisik WebRTC), tidak mengubah skor keterlambatan/eskalasi secara manual, tidak membuka data asli warga pada mode simulasi juri.
- **Referensi Utama:** `docs/PRD.md` (v3.5), `docs/design.md`, `docs/flow.md`, `docs/backend.md`, `docs/tasks.md`.
