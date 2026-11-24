import {
  AlarmClock,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock,
  MessageSquareWarning,
  Scale,
  ShieldX,
  Siren,
  Wrench,
} from "lucide-react";

/**
 * 10 Ticket Statuses — SSOT aligned with docs/design.md §3 & src/shared/constants.js.
 * Note: lucide-react@0.468.0 does not export ClockCheck, so AUTO_CLOSED uses Clock.
 */
export const TICKET_STATUSES = {
  OPEN: {
    code: "OPEN",
    label: "Laporan Masuk",
    pinHex: "#2563EB",
    Icon: CircleDot,
    badgeClass:
      "bg-blue-100 text-blue-800 [[data-theme=slate]_&]:bg-blue-500/15 [[data-theme=slate]_&]:text-blue-300",
    terminal: false,
  },
  OUT_OF_SCOPE: {
    code: "OUT_OF_SCOPE",
    label: "Kewenangan Instansi Lain",
    pinHex: "#9CA3AF",
    Icon: Ban,
    badgeClass:
      "bg-gray-200 text-gray-700 [[data-theme=slate]_&]:bg-gray-500/15 [[data-theme=slate]_&]:text-gray-300",
    terminal: true,
  },
  REJECTED_SPAM: {
    code: "REJECTED_SPAM",
    label: "Ditolak (Spam)",
    pinHex: "#4B5563",
    Icon: ShieldX,
    badgeClass:
      "bg-gray-700 text-gray-100 [[data-theme=slate]_&]:bg-gray-600/30 [[data-theme=slate]_&]:text-gray-200",
    terminal: true,
  },
  IN_PROGRESS: {
    code: "IN_PROGRESS",
    label: "Sedang Ditangani",
    pinHex: "#EAB308",
    Icon: Wrench,
    badgeClass:
      "bg-yellow-100 text-yellow-900 [[data-theme=slate]_&]:bg-yellow-500/15 [[data-theme=slate]_&]:text-yellow-300",
    terminal: false,
  },
  OVERDUE: {
    code: "OVERDUE",
    label: "Melewati Tenggat",
    pinHex: "#DC2626",
    Icon: AlarmClock,
    badgeClass:
      "bg-red-100 text-red-800 [[data-theme=slate]_&]:bg-red-500/15 [[data-theme=slate]_&]:text-red-300",
    terminal: false,
  },
  PENDING_VALIDATION: {
    code: "PENDING_VALIDATION",
    label: "Menunggu Cek Warga",
    pinHex: "#F97316",
    Icon: Scale,
    badgeClass:
      "bg-orange-100 text-orange-900 [[data-theme=slate]_&]:bg-orange-500/15 [[data-theme=slate]_&]:text-orange-300",
    terminal: false,
  },
  DISPUTED: {
    code: "DISPUTED",
    label: "Dibantah Warga",
    pinHex: "#9333EA",
    Icon: MessageSquareWarning,
    badgeClass:
      "bg-purple-100 text-purple-800 [[data-theme=slate]_&]:bg-purple-500/15 [[data-theme=slate]_&]:text-purple-300",
    terminal: false,
  },
  ESCALATED: {
    code: "ESCALATED",
    label: "Eskalasi Pengawasan",
    pinHex: "#7F1D1D",
    Icon: Siren,
    badgeClass:
      "bg-red-900 text-red-50 [[data-theme=slate]_&]:bg-red-500/25 [[data-theme=slate]_&]:text-red-200",
    terminal: false,
  },
  CLOSED: {
    code: "CLOSED",
    label: "Tuntas Terverifikasi",
    pinHex: "#16A34A",
    Icon: CheckCircle2,
    badgeClass:
      "bg-green-100 text-green-800 [[data-theme=slate]_&]:bg-green-500/15 [[data-theme=slate]_&]:text-green-300",
    terminal: true,
  },
  AUTO_CLOSED: {
    code: "AUTO_CLOSED",
    label: "Ditutup Otomatis (72 Jam)",
    pinHex: "#86EFAC",
    Icon: Clock,
    badgeClass:
      "bg-green-50 text-green-800 ring-1 ring-green-300 [[data-theme=slate]_&]:bg-green-500/15 [[data-theme=slate]_&]:text-green-300 [[data-theme=slate]_&]:ring-green-500/30",
    terminal: true,
  },
};

export const STATUS_CODES = Object.keys(TICKET_STATUSES);

/** SLA Tier chips (docs/design.md §6.4) */
export const SLA_TIERS = {
  DARURAT: {
    code: "DARURAT",
    label: "DARURAT · 24j",
    hours: 24,
    chipClass:
      "bg-red-100 text-red-800 [[data-theme=slate]_&]:bg-red-500/15 [[data-theme=slate]_&]:text-red-300",
  },
  MENENGAH: {
    code: "MENENGAH",
    label: "MENENGAH · 72j",
    hours: 72,
    chipClass:
      "bg-amber-100 text-amber-800 [[data-theme=slate]_&]:bg-amber-500/15 [[data-theme=slate]_&]:text-amber-300",
  },
  STANDAR: {
    code: "STANDAR",
    label: "STANDAR · 168j",
    hours: 168,
    chipClass:
      "bg-blue-100 text-blue-800 [[data-theme=slate]_&]:bg-blue-500/15 [[data-theme=slate]_&]:text-blue-300",
  },
};

export const CATEGORIES = [
  { code: "JALAN_AMBLES", label: "Jalan Ambles Parah", tier: "DARURAT", slaHours: 24 },
  { code: "KABEL_MENJUNTAI", label: "Kabel / Tiang Bahaya", tier: "DARURAT", slaHours: 24 },
  { code: "POHON_TUMBANG", label: "Pohon Tumbang / Halang Jalan", tier: "DARURAT", slaHours: 24 },
  { code: "PJU_MATI", label: "Lampu PJU Mati", tier: "MENENGAH", slaHours: 72 },
  { code: "SAMPAH_LIAR", label: "Tumpukan Sampah Liar", tier: "MENENGAH", slaHours: 72 },
  { code: "SALURAN_TERSUMBAT", label: "Saluran Air / Drainase Tersumbat", tier: "MENENGAH", slaHours: 72 },
  { code: "REKLAME_LIAR", label: "Reklame / Bangunan Liar Bahaya", tier: "MENENGAH", slaHours: 72 },
  { code: "JALAN_BERLUBANG", label: "Jalan / Aspal Berlubang", tier: "STANDAR", slaHours: 168 },
];

/** Kamus Bahasa Manusia — Error codes synced with src/shared/constants.js */
export const HUMAN_ERRORS = {
  UNAUTHORIZED: "Silakan masuk ke akunmu terlebih dahulu untuk melanjutkan.",
  FORBIDDEN: "Akunmu tidak memiliki izin untuk melakukan aksi ini.",
  JURY_REAL_DATA_BLOCKED:
    "Mode simulasi juri hanya boleh mengubah data contoh, bukan laporan asli warga.",
  OUT_OF_SERVICE_AREA:
    "Lokasi pin berada di luar wilayah layanan Surabaya & Sidoarjo. Geser pin ke dalam garis batas peta.",
  QUOTA_RADIUS_FULL:
    "Titik sekitar sudah memiliki laporan aktif serupa. Yuk klik Dukung Prioritas agar penanganannya lebih cepat!",
  QUOTA_ACCOUNT_ACTIVE:
    "Kamu sudah mencapai batas maksimal 5 laporan aktif. Tunggu salah satu tuntas sebelum melapor lagi.",
  QUOTA_ACCOUNT_DAILY:
    "Kamu sudah mencapai batas maksimal 10 laporan dalam 24 jam terakhir.",
  RATE_LIMITED: "Pengiriman terlalu cepat. Tunggu sebentar sebelum mencoba lagi.",
  COOLDOWN_ACTIVE:
    "Akunmu sedang dalam masa jeda 24 jam. Coba lagi setelah hitung mundur selesai.",
  FROZEN_ACTIVE:
    "Akunmu sedang dibekukan sementara selama 7 hari karena pelanggaran berulang.",
  NONCE_INVALID:
    "Sesi atau kupon foto sudah kedaluwarsa atau tidak cocok. Silakan ambil foto ulang.",
  GPS_INACCURATE:
    "Sinyal GPS belum cukup akurat (wajib <= 50 m). Menepi ke area terbuka lalu tekan Perbarui Lokasi.",
  TOO_FAR_VALIDATE:
    "Posisimu terlalu jauh dari titik laporan (wajib berada dalam radius <= 100 m).",
  TOO_FAR_DINAS:
    "Posisi petugas terlalu jauh dari titik laporan (wajib berada dalam radius <= 75 m).",
  IMPOSSIBLE_TRAVEL:
    "Perpindahan lokasi terdeteksi terlalu cepat. Pastikan GPS aktif asli tanpa aplikasi pengubah lokasi.",
  NSFW_BLOCKED:
    "Foto terdeteksi melanggar pedoman konten dan langsung ditolak. Akun dikenai penalti dan jeda 24 jam.",
  NSFW_RETRY:
    "Foto kurang jelas atau berisiko keliru dideteksi sensor. Silakan jepret ulang fokus ke fasilitas rusak.",
  MEDIA_INVALID:
    "Format atau ukuran berkas tidak sesuai ketentuan. Pastikan foto diambil dari kamera langsung.",
  VERSION_CONFLICT:
    "Data baru saja diperbarui pengguna atau petugas lain. Tampilan sudah disegarkan ke kondisi terbaru.",
  NOT_FOUND: "Laporan yang dicari tidak ditemukan atau sudah dihapus.",
  VALIDATION_ERROR:
    "Beberapa isian belum lengkap atau formatnya kurang tepat. Cek kembali kolom bertanda merah.",
  INTERNAL_ERROR:
    "Server sedang sibuk atau koneksi terputus. Isian dan fotomu tetap aman — silakan tekan Coba Lagi.",
};
