# Tech Context — Stack, Environment & Perintah

## Tech Stack
- **Runtime:** Node.js `>= 20` (ESM `"type": "module"`)
- **Backend:** Express `^4.21.2`, Prisma `^6.19.3` (PostgreSQL + PostGIS), Zod `^3.24.2`, Helmet `^8.0.0`, Upstash Redis REST client ringan tanpa SDK (`backend/src/lib/redis.js`, fallback in-memory Map di dev)
- **Auth & Storage:** Supabase Auth (JWT + Google OAuth) & Supabase Storage (bucket publik `laporpak-public`, privat `laporpak-private`), RLS aktif di seluruh 7 tabel (`Department`, `User`, `Ticket`, `TicketSupport`, `TicketValidation`, `AuditLog`, `DepartmentRating`)
- **Frontend:** React `^18.3.1`, React Router DOM `^6.30.6`, TypeScript `^5.9.3`, Vite `^6.4.6`, Tailwind CSS `^3.4.19`, Leaflet `^1.9.4`, Lucide React `^0.468.0`, NSFWJS `^4.3.0` + `@tensorflow/tfjs` `^4.22.0`
- **Hosting:** Vercel region `sin1` (Frontend static `frontend/dist` + Serverless API `api/index.js` + daily cron `/api/cron/sla` pukul `00:00 UTC`)

## Environment Variables (Nama Kunci Saja — Nilai Asli Hanya di Root `.env` & Vercel Dashboard)
- **Supabase:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLIC_BUCKET`, `SUPABASE_PRIVATE_BUCKET` (Vite otomatis membaca `SUPABASE_URL` & `SUPABASE_ANON_KEY` dari root `.env` via `frontend/vite.config.js` ke `VITE_SUPABASE_*`; jangan pernah prefix secret key dengan `VITE_`).
- **Database:** `DATABASE_URL` (pooler port `6543`, `?pgbouncer=true`), `DIRECT_URL` (port `5432`)
- **Redis:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Keamanan & Juri:** `SERVER_SECRET`, `AUDIT_SALT`, `JURY_SECRET_TOKEN`
- **Produksi & Opsional:** `ALLOWED_ORIGINS`, `CRON_SECRET`, `PARTNER_INVITE_CODES_JSON`, `MODERATION_API_URL`, `MODERATION_API_KEY`

## Perintah Penting (Dari Root Repo)
- Install dependensi: `npm install && npm --prefix frontend install --include=dev`
- Jalankan lokal (2 terminal, buka `http://localhost:5173`):
  - Backend `:5050`: `npm run dev`
  - Frontend `:5173`: `npm --prefix frontend run dev`
- Cek tipe TS: `npm run typecheck` (`tsc --noEmit`)
- Unit test frontend (`node:test`): `node --test frontend/tests/*.test.mjs`
- Build produksi (Prisma + typecheck + Vite + copy `public/{samples,geo,mascots}`): `npm run build`
- E2E backend & security self-check (`17/17` suite): `npm run check` (`node scripts/self-check.mjs`)

## Kendala Lingkungan Lokal
- OS developer Arya memakai Linux/NixOS (`backend/src/lib/prisma.js` otomatis fallback ke `libquery_engine-debian-openssl-3.0.x.so.node`); koneksi langsung `DIRECT_URL` port `5432` kadang tidak terjangkau sehingga DDL v3.5 diterapkan lewat pooler (`_prisma_migrations` belum mencatat migrasi v3.5 secara resmi).
- Kamera WebRTC & GPS di browser mewajibkan `https://` atau `http://localhost` (hindari membuka via IP LAN).
