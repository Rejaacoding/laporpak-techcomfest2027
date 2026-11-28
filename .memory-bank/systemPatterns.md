# System Patterns & Architecture Decisions (ADRs)

## Arsitektur Monorepo Berlapis
```text
api/index.js (Express App & Vercel Entrypoint)
  └─ backend/src/
       ├─ routes/api.routes.js          (HTTP mapping + rate-limit/RBAC middlewares)
       ├─ middlewares/                  (auth, security, guard, error)
       ├─ controllers/api.controller.js (Zod schema parse + JSON response envelope)
       ├─ services/                     (ticket, dinas, validation, lazy-eval, media, rapor, jury)
       ├─ repositories/                 (Prisma queries, PostGIS raw SQL, FOR UPDATE locks)
       ├─ lib/                          (prisma, redis, supabase, crypto, geo, errors)
       └─ shared/                       (constants SSOT, Zod schemas)

frontend/src/
  ├─ App.jsx             (React.lazy code-splitting + RouteThemeSync + ProfileDrawer + JuryPanel)
  ├─ pages/{auth,warga,dinas}/
  ├─ components/{auth,camera,dinas,jury,layout,map,ui}/
  ├─ hooks/useLiveSync.ts
  ├─ services/{api.js,supabase.ts}
  └─ utils/{humanize.js,laporDraft.ts,ticketMappers.ts}
```

## ADR & Keputusan Teknis Kunci
| Tanggal | Keputusan | Konteks & Alasan |
| :--- | :--- | :--- |
| 2026-11-22 | **Serverless Express + Lazy Evaluation (`evaluateTicketLazy`) + Vercel Cron harian** | Menghindari worker/cron menit-an di serverless; transisi `OVERDUE`, `isChronicOverdue`, `DISPUTED -> IN_PROGRESS`, dan `AUTO_CLOSED` dievaluasi deterministik saat tiket diakses atau batch 30s (`SETNX` Redis). |
| 2026-11-23 | **PostGIS `geography(Point, 4326)` + index GIST** | Perhitungan radius nyata meter bumi (`30 m`, `50 m`, `75 m`, `100 m`) langsung di PostgreSQL; koordinat publik di-round 4 desimal. |
| 2026-11-23 | **HMAC-SHA256 Audit Chain + Nonce Sekali Pakai** | Setiap mutasi status tercatat di `AuditLog` berantai (`GENESIS -> currentHash`); kupon foto WebRTC diverifikasi tanda tangan HMAC sebelum di-`SETNX` (`consume` hanya saat media siap). |
| 2026-11-27 | **Anti-Buzzer v3.5 3 Lapis (`#33`–`#37`)** | (1) Cooling window `6 jam` sebelum `PENDING_VALIDATION -> CLOSED` (di-bypass mode juri); (2) Jangkar saksi awal (kuorum naik ke `3.0` poin / `3` perangkat jika tanpa pendukung awal di Fase 1); (3) *Shadow-zero* (`effectiveWeight = 0.0`) untuk kolusi subnet `< 5m` atau voter berulang tanpa laporan mandiri; plus flag `isFastResolveAnomaly < 10m` dan `DepartmentRating`. |
| 2026-11-27 | **Leaflet `CivicLeafletMap` + Esri World Topo (fallback OSM)** | Menggantikan 6 peta SVG statis. CARTO Voyager dikembalikan watermark `API KEY REQUIRED` di HTTP 200, sehingga diganti Esri `World_Topo_Map` tanpa API key + OSM fallback. Pin/cluster distabilkan memakai memo + signature check agar tick 30s tidak menyebabkan remount. |
| 2026-11-27 | **Upstash Redis `/pipeline` + Cache Versioning O(1) (`cv:public`)** | `incrWithTtl` pakai 1-RTT `INCR` + `EXPIRE NX`; invalidasi seluruh cache (`tickets`, `rapor`, `dinas`, `detail`, `check-radius`) cukup `INCR cv:public`. `verifyTicketAuditChain` dan `/api/health` sengaja **tidak** di-cache agar tamper DB terdeteksi instan. |
| 2026-11-27 | **Hardening Produksi & CSP `vercel.json`** | `/api/cron/sla` butuh bearer/cron guard, `/api/aktivasi-mitra` nonaktif tanpa `PARTNER_INVITE_CODES_JSON` + wajib auth cocok, foto karantina spam dibatasi `ADMIN_DINAS`, IP rate limiter pakai `x-vercel-forwarded-for`, dan `vercel.json` menerapkan CSP + `X-Frame-Options: DENY` + `Permissions-Policy`. |
