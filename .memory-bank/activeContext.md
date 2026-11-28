# Active Context — Kondisi Terkini & Fokus Selanjutnya

**Snapshot Repo:** Commit `b98c8fa` (branch `arya` dan `main` sinkron, working tree bersih) · Live di `https://laporpak-techcomfest2027.vercel.app/`

## Apa yang Baru Dikerjakan (27–28 Nov 2026)
- **Peta Jalanan Nyata (`ff6e639`, `3e91488`):** Seluruh 6 peta SVG statis (`/`, `/peta`, `/lapor`, `/catatan`, `/dinas/peta`, `/dinas/catatan`) diganti `CivicLeafletMap.tsx` memakai tile Esri World Topo Map (+ fallback OSM), poligon Surabaya–Sidoarjo, pin 10 status, klaster panas, radius GPS `50 m`, dan `flyTo`.
- **Real-Time & Polish UI (`ff6e639`):** Tambah `useLiveSync.ts` (Supabase Realtime `postgres_changes` + polling tab aktif 25s + refresh focus 8s + tick `nowMs` 30s untuk countdown SLA & WIB stamp), perbaiki hierarki hero Beranda + micro-animasi `prefers-reduced-motion` (`index.css`, `Modal.jsx`, `ProfileDrawer.tsx`).
- **Optimisasi Upstash Redis, Keamanan & Bundle (`86c6ce9`, `e014e11`):**
  - Upgrade Redis `/pipeline` atomik & cache versioning O(1) (`cv:public`); cache JWT Supabase, profil + UUID alias `ADMIN_DINAS`, `/api/tickets`, `/api/rapor`, `/api/dinas/tickets`, `/api/tickets/:id`, `/api/tickets/check-radius`, dan signed URL (menurunkan latensi warm endpoint dari ~1–1.8 detik ke ~60–85 ms).
  - Tutup celah audit keamanan: `/api/cron/sla` butuh bearer/cron guard (`401`), `/api/aktivasi-mitra` dikunci di produksi (`403`), foto karantina spam dibatasi `ADMIN_DINAS`, IP rate limit pakai trusted Vercel header, CSP + security header aktif di `vercel.json`, dan redirect backslash diblokir di `LoginPage.tsx`.
  - Code-splitting route (`React.lazy`) + `manualChunks` memangkas entry JS awal dari `801.53 kB` ke `85.39 kB`, ditambah deduplikasi `GET` in-flight di `api.js`.
- **Cleanup (`b98c8fa`):** Sinkronisasi `README.md`, `docs/tasks.md`, `.env.example`, perbaiki `public/index.html` dev fallback, dan tambah favicon SVG inline di `frontend/index.html`.

## Branch & Status Tim
- `main` / `origin/main` / `arya` / `origin/arya`: `b98c8fa` (terkini)
- `origin/fatih`: berhenti di `1a13d39` — Fatih berencana polish UI lanjutan dan wajib `git pull origin main && npm --prefix frontend install` sebelum mengedit.
- `origin/reza`: berhenti di `74ff9cd` (`e3e905a` hanya edit `README.md`, esensinya sudah digantikan di `b98c8fa`).

## Langkah Berikutnya (Prioritas)
1. **Fatih:** Buat 2 ilustrasi maskot orisinal (*Cak Pantau* & *Mas Sigap*) di `public/mascots/` dan lakukan polish UI tanpa memutus prop/hook `CivicLeafletMap`, `useLiveSync`, `z-[400]`, atau aturan CSP di `vercel.json`.
2. **Reza:** Set env `CRON_SECRET` di Vercel Dashboard, verifikasi Realtime Replication aktif di Supabase (`Ticket` & `DepartmentRating`), jalankan QA klik lengkap di browser produksi bebas blokir CSP (Google OAuth, WebRTC `/lapor`, alur juri `< 3 menit`), lalu rekam Video Demo `< 3 menit`.
3. **Arya:** Siaga sesuaikan `Content-Security-Policy` di `vercel.json` bila QA/Fatih butuh domain baru, dan rotasi secret `.env` pasca periode lomba.
