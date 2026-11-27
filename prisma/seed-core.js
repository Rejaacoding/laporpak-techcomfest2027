import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { CATEGORIES, DEPARTMENTS, roundPublicCoord } from "../backend/src/shared/constants.js";
import { computeActorPublicRef, computeAuditHash } from "../backend/src/lib/crypto.js";

const DEMO_USERS = [
  { id: "demo-admin-dishub", email: "dishub@laporpak.id", aliasName: "Admin-Dishub", role: "ADMIN_DINAS", departmentId: "DISHUB", isVerifiedPartner: true, trustScore: 1.0, hasGraduatedToOne: false },
  { id: "demo-admin-dpu", email: "dpu@laporpak.id", aliasName: "Admin-DPU", role: "ADMIN_DINAS", departmentId: "DPU", isVerifiedPartner: true, trustScore: 1.0, hasGraduatedToOne: false },
  { id: "demo-admin-dlh", email: "dlh@laporpak.id", aliasName: "Admin-DLH", role: "ADMIN_DINAS", departmentId: "DLH", isVerifiedPartner: true, trustScore: 1.0, hasGraduatedToOne: false },
  { id: "demo-admin-satpolpp", email: "satpolpp@laporpak.id", aliasName: "Admin-SatpolPP", role: "ADMIN_DINAS", departmentId: "SATPOLPP", isVerifiedPartner: true, trustScore: 1.0, hasGraduatedToOne: false },
  { id: "demo-warga-pelapor", email: "warga.pelapor@laporpak.id", aliasName: "Warga-Delta-402", role: "WARGA", departmentId: null, isVerifiedPartner: false, trustScore: 1.2, hasGraduatedToOne: true },
  { id: "demo-warga-validator", email: "warga.validator@laporpak.id", aliasName: "Warga-Surya-108", role: "WARGA", departmentId: null, isVerifiedPartner: false, trustScore: 1.1, hasGraduatedToOne: true },
  { id: "demo-warga-baru", email: "warga.baru@laporpak.id", aliasName: "Warga-Waru-501", role: "WARGA", departmentId: null, isVerifiedPartner: false, trustScore: 0.5, hasGraduatedToOne: false },
  { id: "demo-warga-2", email: "warga.2@laporpak.id", aliasName: "Warga-Brantas-201", role: "WARGA", departmentId: null, isVerifiedPartner: false, trustScore: 1.3, hasGraduatedToOne: true },
  { id: "demo-warga-3", email: "warga.3@laporpak.id", aliasName: "Warga-Tunjungan-202", role: "WARGA", departmentId: null, isVerifiedPartner: false, trustScore: 1.0, hasGraduatedToOne: true },
  { id: "demo-warga-4", email: "warga.4@laporpak.id", aliasName: "Warga-Kencana-203", role: "WARGA", departmentId: null, isVerifiedPartner: false, trustScore: 1.4, hasGraduatedToOne: true },
];

// 28 tiket nyata wilayah Surabaya & Sidoarjo mencakup seluruh 10 status.
// PRD v3.4 #28: demo-warga-pelapor HANYA memegang 2 tiket aktif (seed-tkt-01 & seed-tkt-02 jam ke-50).
const SEED_TICKETS = [
  { id: "seed-tkt-01", code: "LPK-2026-1001", title: "Jalan Berlubang Depan Alun-Alun Sidoarjo", category: "JALAN_BERLUBANG", status: "OPEN", reporterId: "demo-warga-pelapor", lat: -7.4468, lng: 112.7183, ageHours: 2 },
  { id: "seed-tkt-02", code: "LPK-2026-1002", title: "Lampu PJU Mati Bundaran Waru (Jam ke-50 Uji Publik)", category: "PJU_MATI", status: "PENDING_VALIDATION", reporterId: "demo-warga-pelapor", lat: -7.3502, lng: 112.7289, ageHours: 60, validationElapsedHours: 50, repairDistanceMeters: 18 },
  { id: "seed-tkt-03", code: "LPK-2026-1003", title: "Jalan Ambles Parah Jl. Ahmad Yani Surabaya", category: "JALAN_AMBLES", status: "OPEN", reporterId: "demo-warga-2", lat: -7.3167, lng: 112.7351, ageHours: 3 },
  { id: "seed-tkt-04", code: "LPK-2026-1004", title: "Kabel Menjuntai Rendah Jl. Raya Darmo", category: "KABEL_MENJUNTAI", status: "OPEN", reporterId: "demo-warga-2", lat: -7.2892, lng: 112.7398, ageHours: 1 },
  { id: "seed-tkt-05", code: "LPK-2026-1005", title: "Pohon Tumbang Halang Jalur Rungkut Industri", category: "POHON_TUMBANG", status: "IN_PROGRESS", reporterId: "demo-warga-3", lat: -7.3285, lng: 112.7615, ageHours: 5 },
  { id: "seed-tkt-06", code: "LPK-2026-1006", title: "Tumpukan Sampah Liar Pasar Larangan Sidoarjo", category: "SAMPAH_LIAR", status: "IN_PROGRESS", reporterId: "demo-warga-3", lat: -7.4601, lng: 112.7142, ageHours: 12 },
  { id: "seed-tkt-07", code: "LPK-2026-1007", title: "Saluran Drainase Tersumbat Jl. Mayjen Sungkono", category: "SALURAN_TERSUMBAT", status: "IN_PROGRESS", reporterId: "demo-warga-4", lat: -7.2889, lng: 112.7072, ageHours: 10 },
  { id: "seed-tkt-08", code: "LPK-2026-1008", title: "Reklame Liar Miring Jl. Basuki Rahmat", category: "REKLAME_LIAR", status: "OPEN", reporterId: "demo-warga-4", lat: -7.2662, lng: 112.7421, ageHours: 4 },
  { id: "seed-tkt-09", code: "LPK-2026-1009", title: "Aspal Berlubang Dalam Jl. Raya Gedangan", category: "JALAN_BERLUBANG", status: "OVERDUE", reporterId: "demo-warga-2", lat: -7.3924, lng: 112.7258, ageHours: 190, overduePenalized: true },
  { id: "seed-tkt-10", code: "LPK-2026-1010", title: "Lampu PJU Padam Total Jl. Diponegoro", category: "PJU_MATI", status: "OVERDUE", reporterId: "demo-warga-3", lat: -7.2815, lng: 112.7322, ageHours: 160, overduePenalized: true, isChronicOverdue: true },
  { id: "seed-tkt-11", code: "LPK-2026-1011", title: "Perbaikan Saluran Air Jl. Merr Soekarno", category: "SALURAN_TERSUMBAT", status: "PENDING_VALIDATION", reporterId: "demo-warga-2", lat: -7.3112, lng: 112.7805, ageHours: 30, validationElapsedHours: 10, repairDistanceMeters: 14 },
  { id: "seed-tkt-12", code: "LPK-2026-1012", title: "Pembersihan Sampah Liar Wonokromo", category: "SAMPAH_LIAR", status: "PENDING_VALIDATION", reporterId: "demo-warga-3", lat: -7.3025, lng: 112.7379, ageHours: 24, validationElapsedHours: 6, repairDistanceMeters: 22 },
  { id: "seed-tkt-13", code: "LPK-2026-1013", title: "Tambalan Aspal Mengelupas Jl. Raya Buduran", category: "JALAN_BERLUBANG", status: "DISPUTED", reporterId: "demo-warga-2", lat: -7.4235, lng: 112.7224, ageHours: 48, disputeCount: 1, disputedElapsedHours: 4, repairDistanceMeters: 25 },
  { id: "seed-tkt-14", code: "LPK-2026-1014", title: "Penertiban Reklame Tidak Tuntas Jl. Tunjungan", category: "REKLAME_LIAR", status: "ESCALATED", reporterId: "demo-warga-4", lat: -7.2588, lng: 112.7377, ageHours: 80, disputeCount: 2, repairDistanceMeters: 30 },
  { id: "seed-tkt-15", code: "LPK-2026-1015", title: "Perbaikan PJU Tuntas Taman Bungkul", category: "PJU_MATI", status: "CLOSED", reporterId: "demo-warga-2", lat: -7.2914, lng: 112.7393, ageHours: 40, repairDistanceMeters: 11 },
  { id: "seed-tkt-16", code: "LPK-2026-1016", title: "Evakuasi Pohon Tumbang Sukolilo", category: "POHON_TUMBANG", status: "CLOSED", reporterId: "demo-warga-3", lat: -7.2901, lng: 112.7965, ageHours: 18, repairDistanceMeters: 9 },
  { id: "seed-tkt-17", code: "LPK-2026-1017", title: "Normalisasi Drainase Candi Sidoarjo", category: "SALURAN_TERSUMBAT", status: "CLOSED", reporterId: "demo-warga-4", lat: -7.4795, lng: 112.7155, ageHours: 50, repairDistanceMeters: 16 },
  { id: "seed-tkt-18", code: "LPK-2026-1018", title: "Tambal Lubang Jl. Raya Krian Timur", category: "JALAN_BERLUBANG", status: "AUTO_CLOSED", reporterId: "demo-warga-2", lat: -7.4095, lng: 112.5872, ageHours: 110, repairDistanceMeters: 21 },
  { id: "seed-tkt-19", code: "LPK-2026-1019", title: "Kabel Tegangan Menengah Milik PLN Jl. Jemursari", category: "KABEL_MENJUNTAI", status: "OUT_OF_SCOPE", reporterId: "demo-warga-3", lat: -7.3218, lng: 112.7495, ageHours: 14, outOfScopeAgency: "PLN", outOfScopeReason: "Aset jaringan listrik tegangan menengah merupakan kewenangan PT PLN UP3 Surabaya Selatan." },
  { id: "seed-tkt-20", code: "LPK-2026-1020", title: "Pipa Induk Air Bocor Milik PDAM Jl. Gubeng", category: "SALURAN_TERSUMBAT", status: "OUT_OF_SCOPE", reporterId: "demo-warga-4", lat: -7.2722, lng: 112.7521, ageHours: 16, outOfScopeAgency: "PDAM", outOfScopeReason: "Kebocoran berasal dari pipa transmisi air bersih PDAM Surya Sembada, bukan drainase jalan." },
  { id: "seed-tkt-21", code: "LPK-2026-1021", title: "Foto Tidak Relevan (Swafoto Dalam Ruangan)", category: "JALAN_BERLUBANG", status: "REJECTED_SPAM", reporterId: "demo-warga-4", lat: -7.3355, lng: 112.7211, ageHours: 8, rejectedSpamReason: "Foto yang diunggah bukan fasilitas umum melainkan ruangan pribadi." },
  { id: "seed-tkt-22", code: "LPK-2026-1022", title: "Sampah Liar Pinggir Kali Mas Surabaya", category: "SAMPAH_LIAR", status: "OPEN", reporterId: "demo-warga-3", lat: -7.2465, lng: 112.7392, ageHours: 6 },
  { id: "seed-tkt-23", code: "LPK-2026-1023", title: "Reklame Roboh Simpang Margorejo", category: "REKLAME_LIAR", status: "OPEN", reporterId: "demo-warga-2", lat: -7.3189, lng: 112.7386, ageHours: 7 },
  { id: "seed-tkt-24", code: "LPK-2026-1024", title: "Lubang Jalan Raya Sepanjang Taman", category: "JALAN_BERLUBANG", status: "OPEN", reporterId: "demo-warga-4", lat: -7.3471, lng: 112.6975, ageHours: 9 },
  { id: "seed-tkt-25", code: "LPK-2026-1025", title: "Lampu PJU Kedip Jl. Raya Juanda Sedati", category: "PJU_MATI", status: "IN_PROGRESS", reporterId: "demo-warga-2", lat: -7.3762, lng: 112.7654, ageHours: 11 },
  { id: "seed-tkt-26", code: "LPK-2026-1026", title: "Saluran Mampet Kawasan Ketintang", category: "SALURAN_TERSUMBAT", status: "OPEN", reporterId: "demo-warga-3", lat: -7.3119, lng: 112.7291, ageHours: 5 },
  { id: "seed-tkt-27", code: "LPK-2026-1027", title: "Jalan Ambles Jalur Lingkar Timur Sidoarjo", category: "JALAN_AMBLES", status: "IN_PROGRESS", reporterId: "demo-warga-4", lat: -7.4544, lng: 112.7425, ageHours: 4 },
  { id: "seed-tkt-28", code: "LPK-2026-1028", title: "Kabel Tiang Miring Kawasan Wiyung", category: "KABEL_MENJUNTAI", status: "CLOSED", reporterId: "demo-warga-3", lat: -7.3114, lng: 112.6912, ageHours: 20, repairDistanceMeters: 12 },
];

// 5-statement atomic batch transaction: < 1 detik di Supabase Cloud & kebal timeout P2028!
export async function seedDemoData(db, { resetOnlyDemo = false } = {}) {
  const now = new Date();
  const nowMs = now.getTime();
  const userMap = new Map(DEMO_USERS.map((u) => [u.id, u]));

  const deptTuples = Object.values(DEPARTMENTS).map(
    (d) =>
      Prisma.sql`(${d.id}, ${d.code}, ${d.name}, ${d.shortName}, ${d.jurisdiction}, ${d.initialScore}, 0, 0, 0, 0, 0, 0, 0, ${now}, ${now})`
  );

  const userTuples = DEMO_USERS.map(
    (u) =>
      Prisma.sql`(${u.id}, ${u.email}, ${u.aliasName}, ${u.role}::"Role", ${u.departmentId}, ${u.isVerifiedPartner}, true, ${u.trustScore}, ${u.hasGraduatedToOne}, 0, '[]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL, ${now}, ${now})`
  );

  const auditRows = [];
  const ticketTuples = SEED_TICKETS.map((item) => {
    const cat = CATEGORIES[item.category];
    const syncedAt = new Date(nowMs - item.ageHours * 3600 * 1000);
    const slaDeadline = new Date(syncedAt.getTime() + cat.slaHours * 3600 * 1000);
    const reporter = userMap.get(item.reporterId);

    let validationStartedAt = null;
    let repairCapturedAt = null;
    let repairDistanceMeters = null;
    let afterPhotoUrl = null;
    let afterPhotoKey = null;
    let remainingSlaMs = null;
    let disputedAt = null;

    if (item.validationElapsedHours != null) {
      validationStartedAt = new Date(nowMs - item.validationElapsedHours * 3600 * 1000);
      repairCapturedAt = validationStartedAt;
      repairDistanceMeters = item.repairDistanceMeters ?? 15;
      afterPhotoUrl = `/samples/${item.category.toLowerCase()}-fixed.webp`;
      afterPhotoKey = `samples/${item.id}-after.webp`;
      remainingSlaMs = 12 * 3600 * 1000;
    }
    if (item.disputeCount) {
      validationStartedAt = new Date(nowMs - (item.disputedElapsedHours ?? 4) * 3600 * 1000 - 3600 * 1000);
      remainingSlaMs = 10 * 3600 * 1000;
      repairDistanceMeters = item.repairDistanceMeters ?? 20;
      afterPhotoUrl = `/samples/${item.category.toLowerCase()}-fixed.webp`;
      afterPhotoKey = `samples/${item.id}-after.webp`;
      if (item.disputedElapsedHours != null) {
        disputedAt = new Date(nowMs - item.disputedElapsedHours * 3600 * 1000);
      }
    }
    if (item.status === "CLOSED" || item.status === "AUTO_CLOSED") {
      repairCapturedAt = new Date(nowMs - 2 * 3600 * 1000);
      repairDistanceMeters = item.repairDistanceMeters ?? 14;
      afterPhotoUrl = `/samples/${item.category.toLowerCase()}-fixed.webp`;
      afterPhotoKey = `samples/${item.id}-after.webp`;
    }

    const ts1 = BigInt(syncedAt.getTime());
    const ref1 = computeActorPublicRef(reporter.id);
    const hash1 = computeAuditHash({
      ticketId: item.id,
      actorPublicRef: ref1,
      action: "TICKET_CREATED",
      timestampMs: ts1,
      prevHash: "GENESIS",
    });
    auditRows.push({
      id: `aud_${crypto.randomBytes(8).toString("hex")}`,
      ticketId: item.id,
      actorPublicRef: ref1,
      actorRole: "WARGA",
      actorDisplayLabel: reporter.aliasName,
      action: "TICKET_CREATED",
      fromStatus: null,
      toStatus: "OPEN",
      note: `Laporan awal ${cat.label} dicatat dari lapangan.`,
      timestampMs: ts1,
      prevHash: "GENESIS",
      currentHash: hash1,
      createdAt: syncedAt,
    });

    if (item.status !== "OPEN") {
      const ts2 = BigInt(syncedAt.getTime() + 60000);
      const ref2 = computeActorPublicRef("SYSTEM_LAPORPAK");
      const action2 = `SEED_STATE_${item.status}`;
      const hash2 = computeAuditHash({
        ticketId: item.id,
        actorPublicRef: ref2,
        action: action2,
        timestampMs: ts2,
        prevHash: hash1,
      });
      auditRows.push({
        id: `aud_${crypto.randomBytes(8).toString("hex")}`,
        ticketId: item.id,
        actorPublicRef: ref2,
        actorRole: "SYSTEM",
        actorDisplayLabel: "Sistem LaporPAK!",
        action: action2,
        fromStatus: "OPEN",
        toStatus: item.status,
        note: `Status simulasi awal ${item.status} untuk pengujian menyeluruh.`,
        timestampMs: ts2,
        prevHash: hash1,
        currentHash: hash2,
        createdAt: new Date(syncedAt.getTime() + 60000),
      });
    }

    return Prisma.sql`(
      ${item.id}, ${item.code}, ${item.title},
      ${`Laporan lapangan ${cat.label} di sekitar koordinat ${roundPublicCoord(item.lat)}, ${roundPublicCoord(item.lng)}.`},
      ${item.category}::"TicketCategory", ${item.status}::"TicketStatus",
      ${cat.defaultDepartmentId}, ${item.reporterId}, true,
      ${roundPublicCoord(item.lat)}, ${roundPublicCoord(item.lng)}, 12,
      ST_SetSRID(ST_MakePoint(${item.lng}, ${item.lat}), 4326)::geography,
      ${item.status === "REJECTED_SPAM" ? "" : `/samples/${item.category.toLowerCase()}.webp`},
      ${`samples/${item.id}-before.webp`},
      ${afterPhotoUrl}, ${afterPhotoKey}, ${repairCapturedAt}, ${repairDistanceMeters},
      ${syncedAt}, ${cat.slaHours}, ${slaDeadline},
      ${remainingSlaMs}, ${validationStartedAt}, ${disputedAt},
      ${item.disputeCount || 0}, ${Boolean(item.overduePenalized)},
      ${Boolean(item.isChronicOverdue)}, ${Boolean(item.overduePenalized)},
      ${Boolean(item.disputeCount)}, ${Boolean((item.disputeCount || 0) >= 2)},
      ${item.outOfScopeAgency || null}::"OutOfScopeAgency",
      ${item.outOfScopeReason || null}, ${item.rejectedSpamReason || null},
      1, ${syncedAt}, ${syncedAt}
    )`;
  });

  await db.$transaction([
    db.$executeRaw(Prisma.sql`
      INSERT INTO "Department" (
        id, code, name, "shortName", jurisdiction, "integrityScore",
        "totalResolved", "onTimeResolved", "overdueCount", "chronicOverdueCnt",
        "escalatedCount", "outOfScopeCount", "rejectedSpamCount", "createdAt", "updatedAt"
      ) VALUES ${Prisma.join(deptTuples)}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "shortName" = EXCLUDED."shortName",
        jurisdiction = EXCLUDED.jurisdiction,
        "integrityScore" = EXCLUDED."integrityScore",
        "totalResolved" = 0,
        "onTimeResolved" = 0,
        "overdueCount" = 0,
        "chronicOverdueCnt" = 0,
        "escalatedCount" = 0,
        "outOfScopeCount" = 0,
        "rejectedSpamCount" = 0,
        "updatedAt" = EXCLUDED."updatedAt"
    `),
    resetOnlyDemo
      ? db.ticket.deleteMany({ where: { isDemoData: true } })
      : db.ticket.deleteMany({ where: { id: { in: SEED_TICKETS.map((t) => t.id) } } }),
    db.$executeRaw(Prisma.sql`
      INSERT INTO "User" (
        id, email, "aliasName", role, "departmentId", "isVerifiedPartner", "isDemoData",
        "trustScore", "hasGraduatedToOne", "violationCount", "violationWindow",
        "cooldownUntil", "frozenUntil", "lastGpsLat", "lastGpsLng", "lastGpsAccuracy", "lastGpsAt",
        "createdAt", "updatedAt"
      ) VALUES ${Prisma.join(userTuples)}
      ON CONFLICT (id) DO UPDATE SET
        "departmentId" = EXCLUDED."departmentId",
        "trustScore" = EXCLUDED."trustScore",
        "hasGraduatedToOne" = EXCLUDED."hasGraduatedToOne",
        "violationCount" = 0,
        "violationWindow" = '[]'::jsonb,
        "cooldownUntil" = NULL,
        "frozenUntil" = NULL,
        "lastGpsLat" = NULL,
        "lastGpsLng" = NULL,
        "lastGpsAccuracy" = NULL,
        "lastGpsAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
    `),
    db.$executeRaw(Prisma.sql`
      INSERT INTO "Ticket" (
        id, code, title, description, category, status,
        "departmentId", "reporterId", "isDemoData",
        "publicLat", "publicLng", "gpsAccuracyMeters", location,
        "beforePhotoUrl", "beforePhotoKey",
        "afterPhotoUrl", "afterPhotoKey", "repairCapturedAt", "repairDistanceMeters",
        "syncedAt", "slaInitialHours", "slaDeadline",
        "remainingSlaMs", "validationStartedAt", "disputedAt",
        "disputeCount", "overduePenalized",
        "isChronicOverdue", "everOverdue",
        "everDisputed", "everEscalated",
        "outOfScopeAgency", "outOfScopeReason", "rejectedSpamReason",
        version, "createdAt", "updatedAt"
      ) VALUES ${Prisma.join(ticketTuples)}
    `),
    db.auditLog.createMany({ data: auditRows }),
    db.departmentRating.createMany({
      data: [
        {
          id: "seed-rate-01",
          ticketId: "seed-tkt-15",
          departmentId: "DISHUB",
          userId: "demo-warga-2",
          stars: 5,
          comment: "Lampu Taman Bungkul langsung menyala terang di malam yang sama.",
          isDemoData: true,
        },
        {
          id: "seed-rate-02",
          ticketId: "seed-tkt-16",
          departmentId: "DLH",
          userId: "demo-warga-3",
          stars: 4,
          comment: "Evakuasi pohon tumbang cepat, sisa ranting juga dibersihkan rapi.",
          isDemoData: true,
        },
        {
          id: "seed-rate-03",
          ticketId: "seed-tkt-17",
          departmentId: "DPU",
          userId: "demo-warga-4",
          stars: 5,
          comment: "Saluran air Candi tidak lagi menggenang saat hujan deras.",
          isDemoData: true,
        },
        {
          id: "seed-rate-04",
          ticketId: "seed-tkt-28",
          departmentId: "DISHUB",
          userId: "demo-warga-validator",
          stars: 4,
          comment: "Kabel miring Wiyung sudah dirapikan petugas di hari yang sama.",
          isDemoData: true,
        },
      ],
      skipDuplicates: true,
    }),
  ]);

  return {
    departmentsSeeded: Object.keys(DEPARTMENTS).length,
    demoUsersSeeded: DEMO_USERS.length,
    demoTicketsSeeded: SEED_TICKETS.length,
    wargaPelaporActiveTickets: 2,
  };
}
