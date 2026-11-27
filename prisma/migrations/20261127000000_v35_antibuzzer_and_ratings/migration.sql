-- LaporPAK! v3.5: Penguatan Anti-Buzzer 3 Lapis (#33-#35), Deteksi Fast-Resolve (#36),
-- dan Tabel Rating Kepuasan Warga di Catatan Kerja Dinas (#37) + RLS Lockdown.

ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "resolvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolvedIpSubnet" TEXT,
  ADD COLUMN IF NOT EXISTS "isFastResolveAnomaly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TicketValidation"
  ADD COLUMN IF NOT EXISTS "effectiveWeight" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "ipSubnetHash" TEXT,
  ADD COLUMN IF NOT EXISTS "isCollusionSuspect" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "DepartmentRating" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stars" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "isDemoData" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DepartmentRating_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DepartmentRating_stars_check" CHECK ("stars" >= 1 AND "stars" <= 5),
  CONSTRAINT "DepartmentRating_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DepartmentRating_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DepartmentRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentRating_ticketId_userId_key" ON "DepartmentRating"("ticketId", "userId");
CREATE INDEX IF NOT EXISTS "DepartmentRating_departmentId_createdAt_idx" ON "DepartmentRating"("departmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "DepartmentRating_isDemoData_idx" ON "DepartmentRating"("isDemoData");

ALTER TABLE "DepartmentRating" ENABLE ROW LEVEL SECURITY;
