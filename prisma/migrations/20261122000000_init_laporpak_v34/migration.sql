-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('WARGA', 'ADMIN_DINAS');

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('WARGA', 'ADMIN_DINAS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('JALAN_AMBLES', 'KABEL_MENJUNTAI', 'POHON_TUMBANG', 'PJU_MATI', 'SAMPAH_LIAR', 'SALURAN_TERSUMBAT', 'REKLAME_LIAR', 'JALAN_BERLUBANG');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'OUT_OF_SCOPE', 'REJECTED_SPAM', 'IN_PROGRESS', 'OVERDUE', 'PENDING_VALIDATION', 'DISPUTED', 'ESCALATED', 'CLOSED', 'AUTO_CLOSED');

-- CreateEnum
CREATE TYPE "OutOfScopeAgency" AS ENUM ('PLN', 'PDAM', 'BPJN_NASIONAL', 'BBWS', 'TELKOM_FIBER', 'LAINNYA');

-- CreateEnum
CREATE TYPE "ValidationType" AS ENUM ('CONFIRM_RESOLVED', 'DISPUTE_FALSE');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "integrityScore" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
    "totalResolved" INTEGER NOT NULL DEFAULT 0,
    "onTimeResolved" INTEGER NOT NULL DEFAULT 0,
    "overdueCount" INTEGER NOT NULL DEFAULT 0,
    "chronicOverdueCnt" INTEGER NOT NULL DEFAULT 0,
    "escalatedCount" INTEGER NOT NULL DEFAULT 0,
    "outOfScopeCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedSpamCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "aliasName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WARGA',
    "departmentId" TEXT,
    "isVerifiedPartner" BOOLEAN NOT NULL DEFAULT false,
    "isDemoData" BOOLEAN NOT NULL DEFAULT false,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "hasGraduatedToOne" BOOLEAN NOT NULL DEFAULT false,
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "violationWindow" JSONB NOT NULL DEFAULT '[]',
    "cooldownUntil" TIMESTAMPTZ(3),
    "frozenUntil" TIMESTAMPTZ(3),
    "lastGpsLat" DOUBLE PRECISION,
    "lastGpsLng" DOUBLE PRECISION,
    "lastGpsAccuracy" DOUBLE PRECISION,
    "lastGpsAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "departmentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "isDemoData" BOOLEAN NOT NULL DEFAULT false,
    "publicLat" DOUBLE PRECISION NOT NULL,
    "publicLng" DOUBLE PRECISION NOT NULL,
    "gpsAccuracyMeters" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326) NOT NULL,
    "beforePhotoUrl" TEXT NOT NULL,
    "beforePhotoKey" TEXT NOT NULL,
    "afterPhotoUrl" TEXT,
    "afterPhotoKey" TEXT,
    "repairCapturedAt" TIMESTAMPTZ(3),
    "repairDistanceMeters" INTEGER,
    "beritaAcaraUrl" TEXT,
    "beritaAcaraKey" TEXT,
    "isNsfwPendingReview" BOOLEAN NOT NULL DEFAULT false,
    "isLowQualityOverride" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaInitialHours" INTEGER NOT NULL,
    "slaDeadline" TIMESTAMPTZ(3) NOT NULL,
    "remainingSlaMs" INTEGER,
    "validationStartedAt" TIMESTAMPTZ(3),
    "disputedAt" TIMESTAMPTZ(3),
    "validationRound" INTEGER NOT NULL DEFAULT 1,
    "disputeCount" INTEGER NOT NULL DEFAULT 0,
    "isAppealRound" BOOLEAN NOT NULL DEFAULT false,
    "appealUsed" BOOLEAN NOT NULL DEFAULT false,
    "transferCount" INTEGER NOT NULL DEFAULT 0,
    "transferredFromId" TEXT,
    "transferReason" TEXT,
    "overduePenalized" BOOLEAN NOT NULL DEFAULT false,
    "overdueHighPenalty" BOOLEAN NOT NULL DEFAULT false,
    "isChronicOverdue" BOOLEAN NOT NULL DEFAULT false,
    "everOverdue" BOOLEAN NOT NULL DEFAULT false,
    "everDisputed" BOOLEAN NOT NULL DEFAULT false,
    "everEscalated" BOOLEAN NOT NULL DEFAULT false,
    "outOfScopeAgency" "OutOfScopeAgency",
    "outOfScopeReason" TEXT,
    "rejectedSpamReason" TEXT,
    "quarantineDeleteAt" TIMESTAMPTZ(3),
    "supportCount" INTEGER NOT NULL DEFAULT 0,
    "supportCutTier" INTEGER NOT NULL DEFAULT 0,
    "closedResolutionNote" TEXT,
    "idempotencyKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSupport" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketValidation" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "validatorId" TEXT NOT NULL,
    "validationRound" INTEGER NOT NULL,
    "type" "ValidationType" NOT NULL,
    "weightAtVote" DOUBLE PRECISION NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "evidencePhotoUrl" TEXT,
    "evidencePhotoKey" TEXT,
    "gpsAccuracyMeters" DOUBLE PRECISION NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "isPenalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorPublicRef" TEXT NOT NULL,
    "actorRole" "ActorRole" NOT NULL,
    "actorDisplayLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus" NOT NULL,
    "note" TEXT,
    "timestampMs" BIGINT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_aliasName_key" ON "User"("aliasName");

-- CreateIndex
CREATE INDEX "User_role_departmentId_idx" ON "User"("role", "departmentId");

-- CreateIndex
CREATE INDEX "User_isDemoData_idx" ON "User"("isDemoData");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_idempotencyKey_key" ON "Ticket"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Ticket_status_departmentId_slaDeadline_idx" ON "Ticket"("status", "departmentId", "slaDeadline");

-- CreateIndex
CREATE INDEX "Ticket_category_status_idx" ON "Ticket"("category", "status");

-- CreateIndex
CREATE INDEX "Ticket_reporterId_status_idx" ON "Ticket"("reporterId", "status");

-- CreateIndex
CREATE INDEX "Ticket_isDemoData_status_idx" ON "Ticket"("isDemoData", "status");

-- CreateIndex
CREATE INDEX "TicketSupport_userId_idx" ON "TicketSupport"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketSupport_ticketId_userId_key" ON "TicketSupport"("ticketId", "userId");

-- CreateIndex
CREATE INDEX "TicketValidation_ticketId_validationRound_type_idx" ON "TicketValidation"("ticketId", "validationRound", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TicketValidation_ticketId_validatorId_validationRound_key" ON "TicketValidation"("ticketId", "validatorId", "validationRound");

-- CreateIndex
CREATE UNIQUE INDEX "TicketValidation_ticketId_deviceFingerprint_validationRound_key" ON "TicketValidation"("ticketId", "deviceFingerprint", "validationRound");

-- CreateIndex
CREATE INDEX "AuditLog_ticketId_createdAt_idx" ON "AuditLog"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSupport" ADD CONSTRAINT "TicketSupport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSupport" ADD CONSTRAINT "TicketSupport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketValidation" ADD CONSTRAINT "TicketValidation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketValidation" ADD CONSTRAINT "TicketValidation_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- PostGIS Spatial GIST Index untuk ST_DWithin 30m/50m/75m/100m
CREATE INDEX IF NOT EXISTS "ticket_location_gist_idx" ON "Ticket" USING GIST ("location");
