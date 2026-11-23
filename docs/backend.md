# LaporPAK! — Spesifikasi Arsitektur Sistem, Database & Backend (v3.4 Final)

> **Acuan Tunggal:** Dokumen ini menurunkan seluruh aturan [PRD v3.4](./PRD.md), [Design System](./design.md), dan [Alur Sistem](./flow.md) menjadi cetak biru teknis **tanpa celah (*zero-gap*)** berbasis **Clean Layered Architecture** (`Routes -> Controllers -> Services -> Repositories`), skema **Prisma + PostGIS `geography`** siap pakai, algoritma **State Machine 10 Status & Lazy Evaluation**, urutan **Action-Bound Nonce Aman Retry**, serta **17 Kontrak Endpoint API** lengkap dengan pesan ramah pengguna awam.

---

## BAB 1 — Topologi Arsitektur Serverless & Clean Layered Architecture

Aplikasi berjalan sebagai **1 Monorepo Serverless** di **Vercel (`sin1` — Singapura)** dengan **Supabase (PostgreSQL + PostGIS + Auth + Storage)** dan **Upstash Redis (REST)**. Seluruh proses backend bersifat **100% *stateless*** (dilarang menyimpan state di RAM proses Node.js seperti prototipe lama `src/core/laporpak.engine.js`).

```mermaid
flowchart TD
    Client["Browser Warga / Dinas / Juri (React + Vite + WebRTC + Lazy nsfwjs)"] -->|HTTPS + JWT + X-Device-Fingerprint + X-Jury-Token| Edge["Vercel Edge Network (sin1)"]
    Edge -->|/api/*| Router["1. Routes Layer (src/routes/*)"]
    Router --> MW["Middleware Chain (Auth, Jury Guard, Rate Limit, Impossible Travel, Multer/JSON Limit)"]
    MW --> Ctrl["2. Controllers Layer (src/controllers/* — Validasi Zod & Format Envelope Ramah Awam)"]
    Ctrl --> Svc["3. Services Layer (src/services/* — Lazy Eval, State Machine 10 Status, Skor, Nonce SETNX, HMAC)"]
    Svc --> Repo["4. Repositories Layer (src/repositories/* — Prisma ORM + PostGIS Tagged $queryRaw)"]
    Repo --> Pooler[("Supabase PgBouncer (Port 6543) -> PostgreSQL + PostGIS")]
    Svc --> Redis[("Upstash Redis REST (Cache 45s/180s, Nonce SETNX, Rate Limit)")]
    Svc --> Storage[("Supabase Storage (Public Prefix vs Private NSFW/Quarantine Prefix)")]
```

### 1.1 Empat Lapisan Kode (*Clean Layered Architecture*)

| Lapisan | Lokasi Folder | Tanggung Jawab Ketat & Larangan |
| :--- | :--- | :--- |
| **1. Routes** | `src/routes/` | Memetakan path URL (`17` endpoint Lampiran B) ke *Controller* dan memasang *Middleware* (`requireAuth`, `optionalAuth`, `juryIsolationGuard`, `requireRole`, `rateLimiter`). **Dilarang** menaruh logika bisnis atau query DB di sini. |
| **2. Controllers** | `src/controllers/` | Memvalidasi `100%` input (`req.body`, `req.query`, `req.params`, header `Idempotency-Key`, `X-Device-Fingerprint`) dengan **Zod**, memanggil *Service*, lalu membungkus hasil ke **Uniform Response Envelope** dengan pesan bahasa manusia (Kamus PRD Bab 5.C). |
| **3. Services** | `src/services/` | Otak bisnis utama: menjalankan *Lazy Evaluation* atomik, cek urutan `Idempotency-Key -> Validasi -> SETNX Nonce`, perhitungan SLA & skor (`integrityScore` & `trustScore`), rantai `HMAC-SHA256`, upload/hapus Storage, serta `DEL` cache Redis. |
| **4. Repositories** | `src/repositories/` | Satu-satunya lapisan yang menyentuh database (`PrismaClient` & query spasial PostGIS `prisma.$queryRaw` berparameter aman). **Wajib** mencegah *N+1 query* dengan `select`/`include` terukur dan memakai `SELECT ... FOR UPDATE` pada transaksi kuorum. |

### 1.2 Struktur Folder Monorepo Target

```text
LaporPAK/
├── api/
│   └── index.js                      # Entrypoint Serverless Express + Global Error Handler
├── prisma/
│   ├── schema.prisma                 # 5 Model Inti + TicketSupport + PostGIS geography
│   ├── migrations/                   # SQL migrasi berurutan + index GIST PostGIS
│   └── seed.ts                       # Seed 4 Dinas (skor 80), Akun Mitra/Warga, 28 Tiket Demo
├── public/
│   ├── geo/sidoarjo-surabaya.json    # Poligon batas layanan + buffer 500m (<= 50 KB)
│   └── samples/                      # Foto sampel juri terkalibrasi (Y in [50,220], Laplacian >= 80)
├── src/
│   ├── shared/
│   │   ├── constants.js              # SSOT: 8 Kategori, 10 Status + Label Awam, 4 Dinas, Kamus Error
│   │   └── schemas.js                # Skema validasi Zod (FE & BE parity)
│   ├── lib/
│   │   ├── prisma.js                 # Singleton PrismaClient (Transaction Pooler port 6543)
│   │   ├── supabase.js               # Supabase Admin Client (Auth JWT verify & Storage Signed URL)
│   │   ├── redis.js                  # Upstash Redis REST helper (cache, SETNX, rate-limit, DEL)
│   │   └── crypto.js                 # HMAC-SHA256 AuditLog, Nonce JWT/HMAC signer & Jury Token signer
│   ├── middlewares/
│   │   ├── auth.middleware.js        # Verifikasi Bearer JWT, auto-alias warga baru & X-Jury-Token
│   │   ├── guard.middleware.js       # Isolasi mutasi juri (403 data riil), RBAC & departmentId lock
│   │   ├── security.middleware.js    # Rate limit WARGA (5/jam, 10/24j), Cooldown/Freeze & Impossible Travel
│   │   └── error.middleware.js       # Penangkap error terpusat -> Kamus Bahasa Manusia (tanpa bocor stack/SQL)
│   ├── repositories/
│   │   ├── ticket.repository.js      # CRUD tiket, PostGIS ST_DWithin (30m/50m/75m/100m) & FOR UPDATE lock
│   │   ├── department.repository.js  # Update atomik integrityScore (clamp 0..100) & counter rapor
│   │   ├── user.repository.js        # Update trustScore (lantai 0.1 pelanggaran ke-1), cooldown & freeze
│   │   └── audit.repository.js       # Append & baca berurutan rantai AuditLog
│   ├── services/
│   │   ├── lazy-eval.service.js      # Mesin utama OVERDUE, sticky isChronicOverdue, DISPUTED >24j, AUTO_CLOSED >72j
│   │   ├── ticket.service.js         # Pipeline check-radius, create atomik aman retry, & support prioritas
│   │   ├── validation.service.js     # Kuorum ganda >= 2.0 & >= 2 akun, sengketa Putaran 1 & 2, penalti banding
│   │   ├── dinas.service.js          # 8 aksi meja kerja dinas + karantina 7 hari / hard-delete Storage
│   │   ├── media.service.js          # Cek magic-bytes JPEG/WebP/PDF, moderasi NSFW timeout 4s, Signed URL 60s
│   │   └── jury.service.js           # Session 4j, simulate-time (+25j/+49j), & Reset Demo terisolasi
│   ├── controllers/                  # Controller per domain (auth, ticket, dinas, rapor, jury)
│   └── routes/                       # Router Express untuk 17 endpoint Lampiran B
└── frontend/                         # Aplikasi Vite + React 18 + Tailwind (Design System Fatih & Kamera Reza)
```

---

## BAB 2 — Skema Database Lengkap (`prisma/schema.prisma`) & Query Spasial PostGIS

### 2.1 Spesifikasi `prisma/schema.prisma` (100% Sinkron PRD v3.4 `#1–#32`)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL") // Port 6543 (?pgbouncer=true&connection_limit=5)
  directUrl  = env("DIRECT_URL")   // Port 5432 (Khusus migrasi & seed)
  extensions = [postgis]
}

enum Role {
  WARGA
  ADMIN_DINAS
}

enum ActorRole {
  WARGA
  ADMIN_DINAS
  SYSTEM
}

enum TicketCategory {
  JALAN_AMBLES
  KABEL_MENJUNTAI
  POHON_TUMBANG
  PJU_MATI
  SAMPAH_LIAR
  SALURAN_TERSUMBAT
  REKLAME_LIAR
  JALAN_BERLUBANG
}

enum TicketStatus {
  OPEN
  OUT_OF_SCOPE
  REJECTED_SPAM
  IN_PROGRESS
  OVERDUE
  PENDING_VALIDATION
  DISPUTED
  ESCALATED
  CLOSED
  AUTO_CLOSED
}

enum OutOfScopeAgency {
  PLN
  PDAM
  BPJN_NASIONAL
  BBWS
  TELKOM_FIBER
  LAINNYA
}

enum ValidationType {
  CONFIRM_RESOLVED
  DISPUTE_FALSE
}

model Department {
  id                String   @id // "DISHUB", "DPU", "DLH", "SATPOL_PP"
  code              String   @unique
  name              String
  shortName         String
  jurisdiction      String
  integrityScore    Float    @default(80.0) // Dikunci mulai 80.0, clamp [0.0, 100.0] (#17)
  totalResolved     Int      @default(0)
  onTimeResolved    Int      @default(0)
  overdueCount      Int      @default(0)
  chronicOverdueCnt Int      @default(0)
  escalatedCount    Int      @default(0)
  outOfScopeCount   Int      @default(0)
  rejectedSpamCount Int      @default(0)
  createdAt         DateTime @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime @updatedAt @db.Timestamptz(3)

  users   User[]
  tickets Ticket[]
}

model User {
  id                String    @id // UUID Supabase Auth (atau ID seed demo)
  email             String    @unique // PRIVAT: Dilarang keluar di endpoint publik
  aliasName         String    @unique // Contoh: "Warga-Delta-402"
  role              Role      @default(WARGA)
  departmentId      String?
  isVerifiedPartner Boolean   @default(false)
  isDemoData        Boolean   @default(false) // Melindungi akun warga riil saat Reset Demo (#5, #13)

  trustScore        Float     @default(0.5)   // Rentang [0.0, 2.0]
  hasGraduatedToOne Boolean   @default(false) // Naik 1x dari 0.5 -> 1.0 pasca 1 kontribusi sah
  violationCount    Int       @default(0)     // Pelanggaran ke-1 akun 0.5 turun ke lantai 0.1 (#8)
  violationWindow   Json      @default("[]")  // Array timestamp pelanggaran 30 hari terakhir
  cooldownUntil     DateTime? @db.Timestamptz(3)
  frozenUntil       DateTime? @db.Timestamptz(3)

  // Pelacak Impossible Travel (>120 km/jam hanya bila kedua titik gpsAccuracy <= 50m) (#11, #21)
  lastGpsLat        Float?
  lastGpsLng        Float?
  lastGpsAccuracy   Float?
  lastGpsAt         DateTime? @db.Timestamptz(3)

  createdAt         DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime  @updatedAt @db.Timestamptz(3)

  department  Department?        @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  tickets     Ticket[]           @relation("ReporterTickets")
  supports    TicketSupport[]
  validations TicketValidation[]

  @@index([role, departmentId])
  @@index([isDemoData])
}

model Ticket {
  id                   String         @id @default(cuid())
  code                 String         @unique // Contoh: "LPK-2026-0104"
  title                String
  description          String
  category             TicketCategory
  status               TicketStatus   @default(OPEN)
  departmentId         String
  reporterId           String
  isDemoData           Boolean        @default(false)

  // Pemisahan Koordinat Presisi Server vs Koordinat Publik 4 Desimal (~11m) (#26, #27)
  publicLat            Float          // Dibulatkan 4 desimal untuk API publik & watermark
  publicLng            Float
  gpsAccuracyMeters    Float          // Wajib <= 50m saat lapor
  location             Unsupported("geography(Point, 4326)") // Presisi asli khusus ST_DWithin di server

  // Media & Bukti Lapangan (#30, #32)
  beforePhotoUrl       String         // Kosong jika isNsfwPendingReview = true (pakai Signed URL 60s)
  beforePhotoKey       String         // Key CSPRNG UUIDv4 di Storage
  afterPhotoUrl        String?
  afterPhotoKey        String?
  repairCapturedAt     DateTime?      @db.Timestamptz(3)
  repairDistanceMeters Int?           // Jarak foto selesai petugas dari titik asli (dibulatkan meter)
  beritaAcaraUrl       String?        // Khusus penyelesaian ESCALATED (<= 5 MB)
  beritaAcaraKey       String?
  isNsfwPendingReview  Boolean        @default(false) // Blur-by-default + private prefix (#30)
  isLowQualityOverride Boolean        @default(false) // Tampil normal + lencana kualitas rendah (#32)

  // Manajemen Waktu SLA, Jeda & Anti-Deadlock (#3, #14, #17, #19, #27)
  syncedAt             DateTime       @default(now()) @db.Timestamptz(3) // Acuan SLA & batas Oper/Spam
  slaInitialHours      Int            // 24 (Darurat), 72 (Menengah), 168 (Standar)
  slaDeadline          DateTime       @db.Timestamptz(3)
  remainingSlaMs       Int?           // Disimpan saat masuk PENDING_VALIDATION
  validationStartedAt  DateTime?      @db.Timestamptz(3) // Acuan Fase 1 (0-48j), Fase 2 (48-72j), AUTO_CLOSED (72j)
  disputedAt           DateTime?      @db.Timestamptz(3) // Acuan batas respons dinas 24 jam

  // Putaran Validasi, Sengketa & Penalti (#1, #2, #16, #17, #20)
  validationRound      Int            @default(1)
  disputeCount         Int            @default(0)
  isAppealRound        Boolean        @default(false) // True hanya saat Jalur B Banding Bukti
  appealUsed           Boolean        @default(false) // Maks 1x banding per tiket
  transferCount        Int            @default(0)     // Maks 1x oper tiket
  transferredFromId    String?
  transferReason       String?

  overduePenalized     Boolean        @default(false) // Penalti OVERDUE maks 1x per tiket
  isChronicOverdue     Boolean        @default(false) // Sticky true bila now - slaDeadline > slaInitialHours
  everOverdue          Boolean        @default(false)
  everDisputed         Boolean        @default(false)
  everEscalated        Boolean        @default(false)

  // Alasan Terminal & Dukungan Prioritas
  outOfScopeAgency     OutOfScopeAgency?
  outOfScopeReason     String?
  rejectedSpamReason   String?
  quarantineDeleteAt   DateTime?      @db.Timestamptz(3) // Karantina privat 7 hari non-NSFW
  supportCount         Int            @default(0)
  supportCutTier       Int            @default(0)
  closedResolutionNote String?

  idempotencyKey       String?        @unique
  version              Int            @default(1) // Optimistic locking anti-race condition
  createdAt            DateTime       @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime       @updatedAt @db.Timestamptz(3)

  department  Department         @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  reporter    User               @relation("ReporterTickets", fields: [reporterId], references: [id], onDelete: Restrict)
  supports    TicketSupport[]
  validations TicketValidation[]
  auditLogs   AuditLog[]

  @@index([status, departmentId, slaDeadline])
  @@index([category, status])
  @@index([reporterId, status])
  @@index([isDemoData, status])
}

model TicketSupport {
  id        String   @id @default(cuid())
  ticketId  String
  userId    String
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([ticketId, userId])
  @@index([userId])
}

model TicketValidation {
  id                String         @id @default(cuid())
  ticketId          String
  validatorId       String
  validationRound   Int
  type              ValidationType
  weightAtVote      Float          // Snapshot statis trustScore saat vote (#18)
  deviceFingerprint String         // SHA-256(clientInstallId + UA + screen + cores)
  evidencePhotoUrl  String?
  evidencePhotoKey  String?
  gpsAccuracyMeters Float
  distanceMeters    Int
  isPenalized       Boolean        @default(false)
  createdAt         DateTime       @default(now()) @db.Timestamptz(3)

  ticket    Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  validator User   @relation(fields: [validatorId], references: [id], onDelete: Restrict)

  @@unique([ticketId, validatorId, validationRound])
  @@unique([ticketId, deviceFingerprint, validationRound])
  @@index([ticketId, validationRound, type])
}

model AuditLog {
  id                String        @id @default(cuid())
  ticketId          String
  actorPublicRef    String        // HMAC-SHA256(AUDIT_SALT, actorId) — tanpa bocor UUID (#22)
  actorRole         ActorRole     // WARGA | ADMIN_DINAS | SYSTEM (#31)
  actorDisplayLabel String        // aliasName | Nama Dinas | "Sistem LaporPAK!" (#31)
  action            String
  fromStatus        TicketStatus?
  toStatus          TicketStatus
  note              String?
  timestampMs       BigInt
  prevHash          String        // "GENESIS" untuk baris pertama tiket
  currentHash       String        // HMAC-SHA256(SERVER_SECRET, ticketId||actorPublicRef||action||timestampMs||prevHash)
  createdAt         DateTime      @default(now()) @db.Timestamptz(3)

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
}
```

### 2.2 Tiga Query Spasial PostGIS Berparameter (`prisma.$queryRaw` — Anti-SQL Injection)

Di migrasi SQL awal, aktifkan index spasial:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE INDEX IF NOT EXISTS ticket_location_gist_idx ON "Ticket" USING GIST ("location");
```

1. **Cek Kuota Radius `50 m` (`3/3` Kategori Sama) & `30 m` (`6/6` Global) + Daftar `nearbyTickets` Pra-Kamera:**
```sql
SELECT
  id, code, title, category, status, "supportCount", "slaDeadline",
  ROUND(ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
  ))::int AS "distanceMeters"
FROM "Ticket"
WHERE status NOT IN ('CLOSED', 'AUTO_CLOSED', 'OUT_OF_SCOPE', 'REJECTED_SPAM')
  AND ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
    50
  )
ORDER BY "distanceMeters" ASC
LIMIT 10;
```
*(Service menghitung: `sameCategoryWithin50m = rows.filter(r => r.category === category && r.distanceMeters <= 50).length >= 3` dan `anyCategoryWithin30m = rows.filter(r => r.distanceMeters <= 30).length >= 6`).*

2. **Verifikasi Jarak Petugas Dinas Saat Klaim Selesai (`<= 75 m`) & Hitung `repairDistanceMeters`:**
```sql
SELECT
  ROUND(ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(${officerLng}, ${officerLat}), 4326)::geography
  ))::int AS "repairDistanceMeters"
FROM "Ticket"
WHERE id = ${ticketId};
```
*(Jika `repairDistanceMeters > 75` atau `gpsAccuracyMeters > 50`, tolak dengan pesan ramah: `"Posisi petugas berjarak ${repairDistanceMeters} m dari titik laporan (wajib <= 75 m dengan akurasi GPS <= 50 m)."`)*

3. **Verifikasi Jarak Warga Saat Validasi / Klaim Palsu (`<= 100 m`):**
Menggunakan perhitungan `ST_Distance` yang sama terhadap `Ticket.location`; wajib `<= 100` meter dan `gpsAccuracyMeters <= 50`, **kecuali** `userId === ticket.reporterId` yang melakukan `CONFIRM_RESOLVED` pada jendela `48–72 jam` dengan syarat `ticket.disputeCount === 0`.

---

## BAB 3 — Mesin Logika Backend: Lazy Evaluation, Nonce SETNX, Skor & Kriptografi

### 3.1 Mesin *Lazy Evaluation* Atomik (`src/services/lazy-eval.service.js`)

Dipanggil setiap kali `GET /api/tickets`, `GET /api/tickets/:id`, `GET /api/dinas/tickets`, `GET /api/rapor`, setiap endpoint mutasi tiket, serta Cron cadangan harian:

1. **Transisi `OPEN` / `IN_PROGRESS` -> `OVERDUE` (`now > slaDeadline`):**
   - Update atomik dengan syarat `WHERE id = ticket.id AND version = ticket.version`.
   - Jika `!ticket.overduePenalized`: potong `Department.integrityScore` sebesar **`-3`** (atau **`-6`** jika `ticket.supportCount >= 10`), clamp `[0, 100]`, set `overduePenalized = true`, `everOverdue = true`, tulis `AuditLog` (`SYSTEM`), dan `DEL` cache Redis.
2. **Penguncian Permanen `isChronicOverdue` (`#17`, `#19`):**
   - Jika tiket sedang `OVERDUE`, `!ticket.isChronicOverdue`, dan keterlambatan aktif melampaui `100%` durasi SLA awal (`now - slaDeadline > slaInitialHours * 3600 * 1000`): kunci `isChronicOverdue = true` secara permanen (*sticky* — tidak pernah di-reset meski nanti masuk `PENDING_VALIDATION`) dan tambah `Department.chronicOverdueCnt`.
3. **Anti-Deadlock `DISPUTED` Lewat `24 Jam` (`#14`):**
   - Jika `status === 'DISPUTED'` dan `now > disputedAt + 24 jam`: paksa masuk Jalur A (`IN_PROGRESS`) secara deterministik dengan:
     ```js
     const reworkStartMs = ticket.disputedAt.getTime() + 24 * 3600 * 1000;
     const newDeadlineMs = reworkStartMs + Math.max(0, ticket.remainingSlaMs ?? 0) + 24 * 3600 * 1000;
     ```
     Set `isAppealRound = false`, `version++`, tulis `AuditLog` (`SYSTEM`, *"Batas respons 24 jam terlampaui — sistem otomatis mengembalikan ke pengerjaan ulang"*), dan `DEL` cache Redis.
4. **Penutupan Otomatis `PENDING_VALIDATION` -> `AUTO_CLOSED` Lewat `72 Jam` (`#8`, `#16`):**
   - Jika `status === 'PENDING_VALIDATION'` dan `now > validationStartedAt + 72 jam` (berlaku baik pada `disputeCount === 0` maupun `disputeCount === 1`):
   - Update atomik `WHERE id = ticket.id AND version = ticket.version AND status = 'PENDING_VALIDATION'` menjadi `AUTO_CLOSED`.
   - **Bonus Dinas = `0` poin (netral)**; Pelapor Utama mendapat `+0.1 trustScore` (maks `2.0`); **tidak** memicu penalti pada pembantah Putaran 1.

### 3.2 Urutan Eksekusi *Action-Bound Nonce* Aman Retry (`#21`, `#29`)

Untuk memastikan warga awam yang mengalami putus sinyal atau salah isi form tidak kehilangan kupon foto (`401 Nonce Already Used`), seluruh endpoint berfoto (`POST /api/tickets`, `resolve`, `counter-dispute`, `resolve-escalated`, dan `validate` tipe `DISPUTE_FALSE`) **wajib** mengikuti urutan 7 langkah ini:

```text
Langkah 1: Cek header Idempotency-Key di DB/Redis.
           -> Jika pernah sukses (200/201), langsung kembalikan respons yang sama tanpa proses ulang.
Langkah 2: Verifikasi tanda tangan kriptografi captureNonce (JWT/HMAC 15 menit):
           -> Pastikan payload { userId, deviceFingerprint, actionType, ticketId?, jti } cocok 100%
              dengan user login, header X-Device-Fingerprint, jenis aksi, dan ID tiket.
           -> Cek Redis EXISTS("nonce:" + jti): jika sudah ada, tolak ramah (kupon sudah terpakai).
           -> JANGAN jalankan SETNX di langkah ini!
Langkah 3: Jalankan seluruh validasi input & aturan bisnis:
           -> Schema Zod, gpsAccuracyMeters <= 50, Impossible Travel (>120 km/jam),
              kuota akun (<= 5 aktif & <= 10/24j bagi WARGA non-juri), poligon geofencing,
              kuota radius PostGIS (3/50m & 6/30m), magic-bytes JPEG/WebP, ukuran <= 450 KB,
              serta moderasi NSFW (timeout 4s -> fail-safe isNsfwPendingReview = true).
Langkah 4: Konsumsi Nonce secara atomik:
           -> Eksekusi Redis SET("nonce:" + jti, "1", "EX", 86400, "NX").
           -> Jika gagal (balapan paralel), tolak 409.
Langkah 5: Upload berkas foto ke Supabase Storage dengan nama CSPRNG UUIDv4:
           -> Gunakan private prefix jika isNsfwPendingReview == true, public prefix jika false.
Langkah 6: Jalankan transaksi Prisma ($transaction):
           -> Simpan/update Ticket + tulis baris AuditLog HMAC-SHA256.
Langkah 7: Hapus cache Redis (DEL) & kembalikan respons sukses.

[KOMPENSASI ROLLBACK WAJIB]:
Jika Langkah 5 atau Langkah 6 gagal karena error infrastruktur (5xx / DB timeout):
-> Jalankan Redis DEL("nonce:" + jti) DAN hapus file yatim di Supabase Storage,
   sehingga saat warga menekan tombol "Kirim Ulang", kupon foto masih hidup dan langsung berhasil!
```

### 3.3 Mesin Reputasi Warga (`trustScore`) & Skor Instansi (`integrityScore`)

| Peristiwa | Efek ke `User.trustScore` (`[0.0, 2.0]`) | Efek ke `Department.integrityScore` (`[0.0, 100.0]`) |
| :--- | :--- | :--- |
| **Akun Baru / Dinas Baru** | Mulai `0.5` (`hasGraduatedToOne = false`) | Mulai **`80.0`** |
| **1 Laporan / Validasi Sah Pertama (`violationCount == 0`)** | Naik `1x` ke standar **`1.0`** (`hasGraduatedToOne = true`) | — |
| **Tiket Berakhir `CLOSED` (Kuorum `>= 2.0` & `>= 2` Akun / 1-Tap Pelapor Jam `48–72`)** | Pelapor + seluruh validator `CONFIRM_RESOLVED` putaran aktif dapat **`+0.1`** | **`+2.0`** jika `!everOverdue && !everDisputed && !everEscalated`; **`0`** jika pernah `DISPUTED` |
| **Tiket Berakhir `AUTO_CLOSED` (Lewat `72 Jam`)** | Pelapor dapat **`+0.1`** | **`0` (Netral — cegah hadiah *fake closure* di jalan sepi)** |
| **Tiket Masuk `OVERDUE` (Lewat `slaDeadline`)** | — | **`-3.0`** (atau **`-6.0`** jika `supportCount >= 10`), maks `1x` per tiket |
| **Dukungan Mencapai `>= 10` Saat Sudah `OVERDUE`** | — | Potong selisih tambahan **`-3.0`** (sehingga total penalti tiket tersebut pas `-6.0`) |
| **Tiket Masuk `ESCALATED` (Bantahan Sah ke-2)** | Saat nanti `CLOSED` via Berita Acara: Pelapor + Pembantah Putaran 1 & 2 dapat **`+0.1`** | **`-5.0` permanen** langsung dipotong saat masuk `ESCALATED` |
| **Pelanggaran (`NSFW >= 0.85`, `REJECTED_SPAM`, atau Bantahan Palsu Kalah Banding `isAppealRound == true` oleh `>= 2` Warga Lain)** | Potong **`-0.5`** + *cooldown* `24 jam`. **Khusus pelanggaran ke-1 akun baru (`0.5`):** skor turun ke lantai **`0.1`** (tidak langsung freeze). **Freeze `7 hari`** aktif jika `violationCount >= 2` (skor `0.0`) atau `>= 3` pelanggaran dalam `30 hari`. | — |

---

## BAB 4 — Kontrak Lengkap 17 Endpoint API & Envelope Ramah Pengguna Awam

### 4.1 Standar Pembungkus JSON (*Uniform Response Envelope*)

```json
// Respons Sukses (200 OK / 201 Created)
{
  "ok": true,
  "message": "Laporan berhasil tercatat. Timer tenggat dinas mulai berjalan.",
  "data": { ... }
}

// Respons Gagal (400 / 401 / 403 / 404 / 409 / 422 / 429 / 500)
{
  "ok": false,
  "error": {
    "code": "QUOTA_RADIUS_FULL",
    "message": "Titik sekitar sudah memiliki 3 laporan aktif serupa. Yuk klik Dukung Prioritas agar penanganannya lebih cepat!",
    "retryable": false,
    "details": { "nearbyTickets": [ ... ] }
  }
}
```
> **Aturan Anti-Jargon:** Field `error.message` **wajib** selalu berisi kalimat bahasa Indonesia ramah warga (sesuai Kamus PRD Bab 5.C) sehingga komponen Toast/Alert Fatih bisa langsung menampilkannya tanpa pernah memunculkan tulisan `"Request failed with status code 409"` atau `"422 Unprocessable Entity"`.

### 4.2 Spesifikasi Detail 17 Endpoint (Lampiran B PRD v3.4)

| No | Method & Path | Guard & Cache | Request (Query / Header / Body) | Response `data` Utama & Perilaku Khusus |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `GET /api/health` | Publik | — | `{ status: "healthy", db: "up", redis: "up", region: "sin1", timestamp }` |
| **2** | `GET /api/auth/me` | `requireAuth` | Header `Authorization: Bearer <token>` (+ opsional `X-Jury-Token`) | `{ aliasName, role, departmentId, departmentName, isVerifiedPartner, trustScore, activeTicketCount, cooldownUntil, frozenUntil, juryMode }` *(Tanpa email/UUID di payload komponen publik)*. |
| **3** | `POST /api/jury/session` | Publik | Body `{ juryToken }` | Cocokkan dengan `process.env.JURY_SECRET_TOKEN` (`timingSafeEqual`). Terbitkan `{ sessionToken, expiresAt, ttlSeconds: 14400, availableRoles }`. |
| **4** | `POST /api/jury/tickets/:id/simulate-time` | `requireJuryToken` (`DEL` Redis) | Body `{ shiftHours: 25 \| 49 }` | Tolak `403` jika `ticket.isDemoData === false`. Geser mundur `syncedAt`, `slaDeadline`, `validationStartedAt`, dan `disputedAt` sebesar `shiftHours`, lalu panggil `runLazyEvaluation(ticket.id)`. |
| **5** | `POST /api/jury/reset` | `requireJuryToken` (`DEL` Redis) | — | Transaksi atomik: hapus hanya baris `Ticket` ber-`isDemoData: true`, reset `Department.integrityScore = 80.0` & counter ke kondisi seed awal, bangun ulang `28` tiket seed (`Warga Pelapor` maks `2` tiket aktif), **tanpa menyentuh** `User` ber-`isDemoData: false`. |
| **6** | `GET /api/tickets` | Publik (`Redis TTL 45s`) | Query `?category=&status=&departmentId=` | Jalankan *Lazy Eval* batch aktif. Kembalikan daftar pin peta (kecuali `REJECTED_SPAM`): `{ id, code, title, category, categoryLabel, status, statusLabel, publicLat, publicLng, slaDeadline, remainingSlaMs, supportCount, department: { code, shortName } }`. |
| **7** | `GET /api/tickets/:id` | `optionalAuth` | Query opsional `?lat=&lng=&accuracy=` (untuk hitung jarak tombol real-time) | Jalankan *Lazy Eval* tiket. Kembalikan detail lengkap + `beforePhotoUrl`, `afterPhotoUrl`, **`repairDistanceMeters`**, **`repairCapturedAt`**, `isNsfwPendingReview`, `isLowQualityOverride`, `quorum: { currentWeight, targetWeight: 2.0, uniqueValidators, minValidators: 2, phase: "PUBLIC_0_48" \| "REPORTER_48_72" }`, `timeline` (`actorDisplayLabel` + alasan rujukan/penolakan), serta **`uiFlags`**: `{ canSupport, canVoteConfirm, canDispute, canConfirmAsReporter48_72, canProcess, canTransfer, canRejectSpam, canOutOfScope, canResolve, canAppeal, disabledReasons: { support, confirm, dispute, dinasAction } }`. |
| **8** | `GET /api/tickets/:id/media-signed-url` | Publik (Rate-limited) | Query `?type=before\|after\|dispute` | Khusus foto ber-`isNsfwPendingReview: true` di *private prefix*. Menerbitkan `{ signedUrl, expiresInSeconds: 60 }`. |
| **9** | `GET /api/tickets/:id/audit-verify` | Publik | — | Hitung ulang rantai `HMAC-SHA256` dari `GENESIS`. Kembalikan `{ verifiedChain: true\|false, totalEntries, tamperedAtIndex: null\|number, summaryText: "Seluruh N catatan riwayat utuh dan tersegel kriptografi — belum pernah diubah diam-diam di database.", entries: [{ action, fromStatus, toStatus, actorRole, actorDisplayLabel, actorPublicRef, timestampMs, prevHash, currentHash }] }`. |
| **10** | `GET /api/rapor` | Publik (`Redis TTL 180s`) | Query `?category=` | Jalankan *Lazy Eval*. Kembalikan `{ scoreExplanation: "Mulai skor 80; selesai tepat waktu +2, terlambat -3/-6, eskalasi -5", departments: [{ id, name, shortName, integrityScore, slaOnTimeRatio, overdueCount, chronicOverdueCnt, isChronicWarning, escalatedCount, outOfScopeCount, outOfScopeRatio, outOfScopeWarning, rejectedSpamCount, rejectedSpamRatio, rejectedSpamWarning }], clusterPoints: [...] }`. |
| **11** | `POST /api/capture-nonce` | `requireAuth` | Header `X-Device-Fingerprint`, Body `{ actionType: "CREATE_TICKET" \| "RESOLVE_TICKET" \| "DISPUTE_TICKET" \| "APPEAL_TICKET" \| "RESOLVE_ESCALATED", ticketId? }` | Terbitkan *signed token* `captureNonce` (`TTL 15 menit`) dengan `jti = crypto.randomUUID()` terikat `{ userId, deviceFingerprint, actionType, ticketId, jti }`. |
| **12** | `GET /api/tickets/check-radius` | `optionalAuth` | Query `?lat=&lng=&category=` | Cek poligon Sidoarjo–Surabaya (`+ 500 m`) + kuota PostGIS `3/50m` kategori sama & `6/30m` global. Kembalikan `{ insideServiceArea, sameCategoryCount50m, globalCount30m, isQuotaFull, canOpenCamera, guidanceText, nearbyTickets: [{ id, code, title, categoryLabel, statusLabel, distanceMeters, supportCount }] }`. |
| **13** | `POST /api/tickets` | `requireRole("WARGA")` (`DEL` Redis) | Header `Idempotency-Key`, `X-Device-Fingerprint`; Multipart/JSON `{ title, description, category, lat, lng, gpsAccuracyMeters, captureNonce, isLowQualityOverride, clientNsfwScore, photoBlob }` | Ikuti **7 Langkah Aman Retry Bab 3.2**. Jika sesi `X-Jury-Token` aktif, tandai `isDemoData: true` dan bypass limit `5` tiket aktif per akun (tetap dijaga limit sesi juri `30 mutasi/10m` & maks `50` tiket demo). |
| **14** | `POST /api/tickets/:id/support` | `requireRole("WARGA")` (`DEL` Redis) | — | Tolak jika `userId === ticket.reporterId` atau status bukan `OPEN`/`IN_PROGRESS`. Insert `TicketSupport`; tiap kelipatan `10`, pangkas `15%` sisa SLA jika `sisa > 6 jam` (lantai `6 jam`); saat `supportCount === 10` pada tiket yang sudah `OVERDUE`, potong selisih `-3` tambahan. |
| **15** | `POST /api/tickets/:id/validate` | `requireRole("WARGA")` (`DEL` Redis) | Header `X-Device-Fingerprint`; Body `{ type: "CONFIRM_RESOLVED" \| "DISPUTE_FALSE", lat, lng, gpsAccuracyMeters, captureNonce?, photoBlob?, note? }` | Transaksi `SELECT ... FOR UPDATE` + `SET LOCAL lock_timeout = '3s'` + cek `version`. Validasi Fase 1 (`0–48j`) vs Fase 2 (`48–72j`), kuorum ganda `>= 2.0` & `>= 2` akun/perangkat berbeda, syarat `trustScore >= 1.0` & foto live untuk `DISPUTE_FALSE`, serta larangan pembantah Putaran 1 saat `isAppealRound === true`. |
| **16** | `GET /api/dinas/tickets` | `requireRole("ADMIN_DINAS")` | Query `?status=&category=` | Filter mutlak `where: { departmentId: req.user.departmentId }`. Urutkan prioritas: `OVERDUE` paling atas, lalu `DISPUTED`/`ESCALATED`, lalu `slaDeadline ASC`. |
| **17** | `POST /api/tickets/:id/:dinasAction` | `requireRole("ADMIN_DINAS")` (`DEL` Redis) | `:dinasAction` in `process` \| `transfer` \| `out-of-scope` \| `reject-spam` \| `resolve` \| `reprocess-disputed` \| `counter-dispute` \| `resolve-escalated` | Semua wajib lolos `ticket.departmentId === req.user.departmentId` & cek `version`. Detail syarat per aksi sesuai Bab 3 PRD v3.4 (`transfer` & `reject-spam` hanya saat `OPEN` dalam `<= min(24j, 50% SLA)` sejak `syncedAt`; `resolve` & `counter-dispute` wajib foto live `<= 75 m`; `resolve-escalated` wajib Berita Acara `<= 5 MB` + foto live `<= 75 m`). |

---

## BAB 5 — Variabel Environment, Spesifikasi `seed.ts` & Pemetaan 32 Edge-Case ke Kode

### 5.1 Variabel Environment Wajib (`.env.local` & Vercel Production)

```ini
# 1. Database Supabase (Transaction Pooler & Direct Migration)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# 2. Supabase Auth & Storage
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_ANON_KEY="sb_publishable_..."
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
SUPABASE_PUBLIC_BUCKET="laporpak-public"
SUPABASE_PRIVATE_BUCKET="laporpak-private"

# 3. Upstash Redis REST
UPSTASH_REDIS_REST_URL="https://[ENDPOINT].upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."

# 4. Kriptografi Server, CORS & Mode Simulasi Juri
SERVER_SECRET="64-char-hex-secret-untuk-rantai-hash-auditlog-dan-nonce"
AUDIT_SALT="64-char-hex-salt-untuk-actorPublicRef-anonim"
JURY_SECRET_TOKEN="laporpak-juri-techcomfest-2027"
ALLOWED_ORIGINS="https://laporpak-techcomfest2027.vercel.app"
```

### 5.2 Aturan Emas `prisma/seed.ts` (Anti-Self-Lock Demo Juri `#28`)

1. **4 Instansi (`integrityScore = 80.0`):** `DISHUB`, `DPU`, `DLH`, `SATPOL_PP`.
2. **10 Akun Pengguna (`isDemoData: true`):**
   - `4` akun `ADMIN_DINAS`: `dishub@laporpak.id`, `dpu@laporpak.id`, `dlh@laporpak.id`, `satpolpp@laporpak.id` (`isVerifiedPartner: true`).
   - `1` akun simulasi utama **`Warga Pelapor`** (`warga.pelapor@laporpak.id`, `aliasName: "Warga-Delta-402"`, `trustScore: 1.2`) — **HANYA memegang `2` tiket aktif** di `seed.ts` agar saat juri membuka `/lapor` tidak pernah terbentur batas 5 tiket aktif!
   - `1` akun simulasi **`Warga Validator`** (`warga.validator@laporpak.id`, `aliasName: "Warga-Surya-108"`, `trustScore: 1.1`).
   - `4` akun warga latar (`Warga-Brantas-201` s.d. `204`) untuk memegang sisa `26` tiket contoh di Surabaya & Sidoarjo.
3. **28 Tiket Koordinat Nyata Sidoarjo–Surabaya:** Mencakup ke-`10` status (`OPEN`, `IN_PROGRESS`, `OVERDUE`, `PENDING_VALIDATION` jam ke-`10`, `PENDING_VALIDATION` **jam ke-`50`** untuk demo 1-tap Pelapor Utama, `DISPUTED`, `ESCALATED`, `CLOSED`, `AUTO_CLOSED`, `OUT_OF_SCOPE`, `REJECTED_SPAM`) lengkap dengan rantai `AuditLog` valid dari `GENESIS`.

### 5.3 Tabel Pemetaan 32 Edge-Case PRD Bab 9 ke Implementasi Backend

| Edge-Case PRD | File & Fungsi Backend Penjaga |
| :--- | :--- |
| **`#1`, `#16`, `#20`** *(Banding 1x, `isAppealRound`, Larangan Pembantah 1, 1-Tap Pelapor `disputeCount == 0`)* | `dinas.service.js -> counterDispute()` mengunci `appealUsed = true, isAppealRound = true` tanpa reset `disputeCount`. `validation.service.js -> validateTicket()` memblokir pembantah Putaran 1 saat `isAppealRound` dan menghukum `-0.5` hanya jika putaran banding berakhir `CLOSED` oleh `>= 2` warga lain. |
| **`#2`, `#18`** *(Multi-Round Unique & Snapshot `weightAtVote`)* | `schema.prisma -> TicketValidation` memakai `@@unique([ticketId, validatorId, validationRound])` + `deviceFingerprint`, menyimpan `weightAtVote = user.trustScore` saat klik. |
| **`#3`, `#14`, `#17`, `#19`** *(Sisa SLA Pause, Double Overdue, Auto-Rework 24j, Sticky `isChronicOverdue`)* | `dinas.service.js -> resolveTicket()` menyimpan `remainingSlaMs`. `lazy-eval.service.js` mengunci `overduePenalized` maks 1x, `isChronicOverdue` sticky saat `now - slaDeadline > slaInitialHours`, dan paksa rework `reworkStart = disputedAt + 24j`. |
| **`#4`, `#25`, `#30`, `#32`** *(NSFW 2-Zona, Kalibrasi Malam `Y >= 12`, Private Signed URL 60s, `isLowQualityOverride`)* | `media.service.js` memisahkan `isNsfwPendingReview` (private prefix + Signed URL `60s`) dari `isLowQualityOverride` (tampil normal), timeout moderasi `AbortSignal.timeout(4000)`, dan karantina privat 7 hari untuk `REJECTED_SPAM` non-NSFW. |
| **`#5`, `#13`, `#23`, `#28`** *(Cache Redis `DEL`, Isolasi `?jury_token=`, Limit Juri, Seed Maks 2 Aktif)* | `redis.js -> invalidatePublicCaches()` dipanggil di setiap mutasi & reset. `guard.middleware.js` menolak `403` jika sesi juri menyentuh `isDemoData: false` & membatasi `30 mutasi/10m`. |
| **`#7`, `#27`** *(Batas `Oper`/`REJECTED_SPAM` dari `syncedAt` & Pemisahan GPS Presisi vs Publik)* | `dinas.service.js` menghitung usia tiket dari `ticket.syncedAt`. `ticket.repository.js` menyimpan `location` (`geography`) khusus `ST_DWithin` dan hanya mengembalikan `publicLat`/`publicLng` (4 desimal) + `repairDistanceMeters` (bulat meter). |
| **`#8`, `#10`, `#24`** *(Lantai `0.1` Pelanggaran Ke-1, `AUTO_CLOSED` +0, Kuota `3/50m` & `6/30m`)* | `user.repository.js -> applyViolationPenalty()` menahan skor akun baru `0.5` di `0.1` saat `violationCount === 1` (freeze mulai `violationCount >= 2`). `ticket.service.js` mengecek kuota `3/50m` & `6/30m` saat `check-radius` pra-kamera dan di dalam transaksi `POST /api/tickets`. |
| **`#11`, `#15`, `#21`, `#29`** *(Zona WIB, Impossible Travel `<= 50m`, Action-Bound Nonce & Urutan `SETNX` Aman Retry)* | `security.middleware.js` mengecek kecepatan `> 120 km/jam` hanya bila kedua titik `gpsAccuracy <= 50m`. `ticket.service.js` menjalankan `SETNX nonce:jti` *setelah* validasi Zod/kuota/NSFW dan menjalankan kompensasi `DEL nonce:jti` saat DB `5xx`. |
| **`#22`, `#26`, `#31`** *(Hash Anonim `actorPublicRef`, PostGIS `geography` Meter, `summaryText` Awam)* | `crypto.js -> computeAuditHash()` memakai `actorPublicRef = HMAC(AUDIT_SALT, actorId)` + menyimpan `actorRole` & `actorDisplayLabel`, serta mengembalikan `summaryText` bahasa awam di `GET /api/tickets/:id/audit-verify`. |
