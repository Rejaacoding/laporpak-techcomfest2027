// Single Source of Truth (SSOT) — PRD v3.4 Lampiran A, Bab 3, Bab 5.C & docs/design.md

export const DEPARTMENTS = {
  DISHUB: {
    id: "DISHUB",
    code: "DISHUB",
    name: "Dinas Perhubungan",
    shortName: "Dishub",
    jurisdiction: "Lampu PJU, Rambu, Marka, & Tiang/Kabel Jalan",
    seedEmail: "dishub@laporpak.id",
    initialScore: 80.0,
  },
  DPU: {
    id: "DPU",
    code: "DPU",
    name: "Dinas PU Bina Marga",
    shortName: "Dinas PU",
    jurisdiction: "Jalan Raya, Aspal, Trotoar, Jembatan, & Drainase",
    seedEmail: "dpu@laporpak.id",
    initialScore: 80.0,
  },
  DLH: {
    id: "DLH",
    code: "DLH",
    name: "Dinas Lingkungan Hidup",
    shortName: "DLH",
    jurisdiction: "Sampah Liar, TPS, Pohon Tumbang, & Taman Publik",
    seedEmail: "dlh@laporpak.id",
    initialScore: 80.0,
  },
  SATPOLPP: {
    id: "SATPOLPP",
    code: "SATPOLPP",
    name: "Satuan Polisi Pamong Praja",
    shortName: "Satpol PP",
    jurisdiction: "Reklame Liar, Bangunan Bahaya, & Ketertiban Umum",
    seedEmail: "satpolpp@laporpak.id",
    initialScore: 80.0,
  },
};

export const DEPARTMENT_IDS = Object.keys(DEPARTMENTS);

export const CATEGORIES = {
  JALAN_AMBLES: {
    code: "JALAN_AMBLES",
    label: "Jalan Ambles Parah",
    defaultDepartmentId: "DPU",
    tier: "DARURAT",
    slaHours: 24,
    nightLowLightAllowed: true,
  },
  KABEL_MENJUNTAI: {
    code: "KABEL_MENJUNTAI",
    label: "Kabel / Tiang Bahaya",
    defaultDepartmentId: "DISHUB",
    tier: "DARURAT",
    slaHours: 24,
    nightLowLightAllowed: true,
  },
  POHON_TUMBANG: {
    code: "POHON_TUMBANG",
    label: "Pohon Tumbang / Halang Jalan",
    defaultDepartmentId: "DLH",
    tier: "DARURAT",
    slaHours: 24,
    nightLowLightAllowed: true,
  },
  PJU_MATI: {
    code: "PJU_MATI",
    label: "Lampu PJU Mati",
    defaultDepartmentId: "DISHUB",
    tier: "MENENGAH",
    slaHours: 72,
    nightLowLightAllowed: true,
  },
  SAMPAH_LIAR: {
    code: "SAMPAH_LIAR",
    label: "Tumpukan Sampah Liar",
    defaultDepartmentId: "DLH",
    tier: "MENENGAH",
    slaHours: 72,
    nightLowLightAllowed: false,
  },
  SALURAN_TERSUMBAT: {
    code: "SALURAN_TERSUMBAT",
    label: "Saluran Air / Drainase Tersumbat",
    defaultDepartmentId: "DPU",
    tier: "MENENGAH",
    slaHours: 72,
    nightLowLightAllowed: true,
  },
  REKLAME_LIAR: {
    code: "REKLAME_LIAR",
    label: "Reklame / Bangunan Liar Bahaya",
    defaultDepartmentId: "SATPOLPP",
    tier: "MENENGAH",
    slaHours: 72,
    nightLowLightAllowed: false,
  },
  JALAN_BERLUBANG: {
    code: "JALAN_BERLUBANG",
    label: "Jalan / Aspal Berlubang",
    defaultDepartmentId: "DPU",
    tier: "STANDAR",
    slaHours: 168,
    nightLowLightAllowed: false,
  },
};

export const TICKET_CATEGORIES = CATEGORIES;

export const CATEGORY_CODES = Object.keys(CATEGORIES);

export const TICKET_STATUSES = {
  OPEN: { code: "OPEN", label: "Laporan Masuk", pinHex: "#2563EB", icon: "circle-dot", terminal: false },
  OUT_OF_SCOPE: { code: "OUT_OF_SCOPE", label: "Kewenangan Instansi Lain", pinHex: "#9CA3AF", icon: "ban", terminal: true },
  REJECTED_SPAM: { code: "REJECTED_SPAM", label: "Ditolak (Spam)", pinHex: "#4B5563", icon: "shield-x", terminal: true },
  IN_PROGRESS: { code: "IN_PROGRESS", label: "Sedang Ditangani", pinHex: "#EAB308", icon: "wrench", terminal: false },
  OVERDUE: { code: "OVERDUE", label: "Melewati Tenggat", pinHex: "#DC2626", icon: "alarm-clock", terminal: false },
  PENDING_VALIDATION: { code: "PENDING_VALIDATION", label: "Menunggu Cek Warga", pinHex: "#F97316", icon: "scale", terminal: false },
  DISPUTED: { code: "DISPUTED", label: "Dibantah Warga", pinHex: "#9333EA", icon: "message-square-warning", terminal: false },
  ESCALATED: { code: "ESCALATED", label: "Eskalasi Pengawasan", pinHex: "#7F1D1D", icon: "siren", terminal: false },
  CLOSED: { code: "CLOSED", label: "Tuntas Terverifikasi", pinHex: "#16A34A", icon: "check-circle-2", terminal: true },
  AUTO_CLOSED: { code: "AUTO_CLOSED", label: "Ditutup Otomatis (72 Jam)", pinHex: "#86EFAC", icon: "clock-check", terminal: true },
};

export const STATUS_CODES = Object.keys(TICKET_STATUSES);
export const TERMINAL_STATUSES = STATUS_CODES.filter((s) => TICKET_STATUSES[s].terminal);
export const ACTIVE_STATUSES = STATUS_CODES.filter((s) => !TICKET_STATUSES[s].terminal);

export const OUT_OF_SCOPE_AGENCIES = [
  { code: "PLN", label: "PLN (Kelistrikan)" },
  { code: "PDAM", label: "PDAM (Air Bersih)" },
  { code: "BPJN_NASIONAL", label: "BPJN (Jalan Nasional)" },
  { code: "BBWS", label: "BBWS (Sungai & Tanggul)" },
  { code: "TELKOM_FIBER", label: "Telkom / Provider Fiber" },
  { code: "LAINNYA", label: "Instansi Lainnya" },
];

export const OUT_OF_SCOPE_CODES = OUT_OF_SCOPE_AGENCIES.map((a) => a.code);

export const LIMITS = {
  MAX_GPS_ACCURACY_METERS: 50,
  SAME_CATEGORY_RADIUS_METERS: 50,
  SAME_CATEGORY_MAX_ACTIVE: 3,
  GLOBAL_RADIUS_METERS: 30,
  GLOBAL_MAX_ACTIVE: 6,
  DINAS_RESOLVE_RADIUS_METERS: 75,
  CITIZEN_VALIDATE_RADIUS_METERS: 100,
  MAX_ACTIVE_TICKETS_PER_CITIZEN: 5,
  MAX_TICKETS_PER_24H_CITIZEN: 10,
  RATE_LIMIT_WARGA_PER_HOUR: 5,
  JURY_MUTATIONS_PER_10M: 30,
  JURY_MAX_ACTIVE_DEMO_TICKETS: 50,
  JURY_SESSION_TTL_SECONDS: 4 * 3600,
  CAPTURE_NONCE_TTL_SECONDS: 15 * 60,
  NONCE_CONSUMED_TTL_SECONDS: 24 * 3600,
  MAP_CACHE_TTL_SECONDS: 45,
  RAPOR_CACHE_TTL_SECONDS: 180,
  SIGNED_URL_TTL_SECONDS: 60,
  QUORUM_MIN_WEIGHT: 2.0,
  QUORUM_MIN_VALIDATORS: 2,
  PUBLIC_VALIDATION_PHASE1_HOURS: 48,
  PUBLIC_VALIDATION_AUTO_CLOSE_HOURS: 72,
  DISPUTE_RESPONSE_HOURS: 24,
  REWORK_BONUS_HOURS: 24,
  SUPPORT_STEP_SIZE: 10,
  SUPPORT_SLA_CUT_FACTOR: 0.85,
  SUPPORT_SLA_FLOOR_MS: 6 * 3600 * 1000,
  IMPOSSIBLE_TRAVEL_KMH: 120,
  MAX_PHOTO_BYTES: 450 * 1024,
  MAX_PHOTO_DIM_PX: 1280,
  MAX_BERITA_ACARA_BYTES: 5 * 1024 * 1024,
  NSFW_WARN_THRESHOLD: 0.55,
  NSFW_BLOCK_THRESHOLD: 0.85,
  MODERATION_TIMEOUT_MS: 4000,
  QUARANTINE_DAYS: 7,
  OUT_OF_SCOPE_WARNING_RATIO: 0.25,
  REJECTED_SPAM_WARNING_RATIO: 0.20,
};

export const SCORE_RULES = {
  DEPT_INITIAL: 80.0,
  DEPT_MIN: 0.0,
  DEPT_MAX: 100.0,
  DEPT_ON_TIME_BONUS: 2.0,
  DEPT_AUTO_CLOSED_BONUS: 0.0,
  DEPT_OVERDUE_PENALTY: -3.0,
  DEPT_OVERDUE_HIGH_SUPPORT_PENALTY: -6.0,
  DEPT_ESCALATED_PENALTY: -5.0,
  TRUST_INITIAL: 0.5,
  TRUST_GRADUATED: 1.0,
  TRUST_MIN: 0.0,
  TRUST_MAX: 2.0,
  TRUST_FIRST_VIOLATION_FLOOR: 0.1,
  TRUST_CONTRIBUTION_BONUS: 0.1,
  TRUST_VIOLATION_PENALTY: -0.5,
  TRUST_MIN_CONFIRM: 0.5,
  TRUST_MIN_DISPUTE: 1.0,
};

export const HUMAN_ERRORS = {
  UNAUTHORIZED: "Silakan masuk ke akunmu terlebih dahulu untuk melanjutkan.",
  FORBIDDEN: "Akunmu tidak memiliki izin untuk melakukan aksi ini.",
  JURY_REAL_DATA_BLOCKED: "Mode simulasi juri hanya boleh mengubah data contoh, bukan laporan asli warga.",
  OUT_OF_SERVICE_AREA: "Lokasi pin berada di luar wilayah layanan Surabaya & Sidoarjo. Geser pin ke dalam garis batas peta.",
  QUOTA_RADIUS_FULL: "Titik sekitar sudah memiliki laporan aktif serupa. Yuk klik Dukung Prioritas agar penanganannya lebih cepat!",
  QUOTA_ACCOUNT_ACTIVE: "Kamu sudah mencapai batas maksimal 5 laporan aktif. Tunggu salah satu tuntas sebelum melapor lagi.",
  QUOTA_ACCOUNT_DAILY: "Kamu sudah mencapai batas maksimal 10 laporan dalam 24 jam terakhir.",
  RATE_LIMITED: "Pengiriman terlalu cepat. Tunggu sebentar sebelum mencoba lagi.",
  COOLDOWN_ACTIVE: "Akunmu sedang dalam masa jeda 24 jam. Coba lagi setelah hitung mundur selesai.",
  FROZEN_ACTIVE: "Akunmu sedang dibekukan sementara selama 7 hari karena pelanggaran berulang.",
  NONCE_INVALID: "Sesi atau kupon foto sudah kedaluwarsa atau tidak cocok. Silakan ambil foto ulang.",
  GPS_INACCURATE: "Sinyal GPS belum cukup akurat (wajib <= 50 m). Menepi ke area terbuka lalu tekan Perbarui Lokasi.",
  TOO_FAR_VALIDATE: "Posisimu terlalu jauh dari titik laporan (wajib berada dalam radius <= 100 m).",
  TOO_FAR_DINAS: "Posisi petugas terlalu jauh dari titik laporan (wajib berada dalam radius <= 75 m).",
  IMPOSSIBLE_TRAVEL: "Perpindahan lokasi terdeteksi terlalu cepat. Pastikan GPS aktif asli tanpa aplikasi pengubah lokasi.",
  NSFW_BLOCKED: "Foto terdeteksi melanggar pedoman konten dan langsung ditolak. Akun dikenai penalti dan jeda 24 jam.",
  NSFW_RETRY: "Foto kurang jelas atau berisiko keliru dideteksi sensor. Silakan jepret ulang fokus ke fasilitas rusak.",
  MEDIA_INVALID: "Format atau ukuran berkas tidak sesuai ketentuan. Pastikan foto diambil dari kamera langsung.",
  VERSION_CONFLICT: "Data baru saja diperbarui pengguna atau petugas lain. Tampilan sudah disegarkan ke kondisi terbaru.",
  NOT_FOUND: "Laporan yang dicari tidak ditemukan atau sudah dihapus.",
  VALIDATION_ERROR: "Beberapa isian belum lengkap atau formatnya kurang tepat. Cek kembali kolom bertanda merah.",
  INTERNAL_ERROR: "Server sedang sibuk atau koneksi terputus. Isian dan fotomu tetap aman — silakan tekan Coba Lagi.",
};

export function roundPublicCoord(val) {
  return Math.round(Number(val) * 10000) / 10000;
}

export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}
