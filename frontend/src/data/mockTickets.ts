import type { DinasQueueCounts, DinasQueueFilterKey } from "../components/layout/DinasSidebar.tsx";

export type TicketStatusCode =
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING_VALIDATION"
  | "OVERDUE"
  | "DISPUTED"
  | "ESCALATED"
  | "CLOSED"
  | "AUTO_CLOSED"
  | "OUT_OF_SCOPE"
  | "REJECTED_SPAM";

export type SlaTierCode = "DARURAT" | "MENENGAH" | "STANDAR";

export type TicketActionVariant = "primary" | "secondary" | "ghost" | "danger";

export interface TicketActionItem {
  id: string;
  label: string;
  variant: TicketActionVariant;
  disabled?: boolean;
  disabledReason?: string;
}

export interface DinasTicketRow {
  id: string;
  ticketId?: string;
  status: TicketStatusCode;
  categoryTitle: string;
  tier: SlaTierCode;
  location: string;
  region: "Surabaya" | "Sidoarjo";
  slaText: string;
  slaTone: "overdue" | "disputed" | "warning" | "normal" | "muted";
  supportCount: number;
  isFastResolveAnomaly?: boolean;
  actions: TicketActionItem[];
}

export interface KpiStatItem {
  id: string;
  label: string;
  value: string;
  meta: string;
  valueTone: "default" | "error" | "purple" | "brand";
}

export const DINAS_DEPARTMENT_META = {
  departmentName: "Dinas PU Bina Marga & Pematusan",
  departmentShortName: "DPU Bina Marga",
  regionLabel: "Kota Surabaya & Kab. Sidoarjo",
  isVerifiedPartner: true,
  integrityScore: 84,
};

export const DINAS_QUEUE_COUNTS: DinasQueueCounts = {
  ALL: 42,
  OVERDUE: 5,
  DISPUTED: 2,
  ESCALATED: 1,
  PENDING_VALIDATION: 11,
  CLOSED: 24,
};

export const DINAS_KPI_STATS: KpiStatItem[] = [
  {
    id: "active",
    label: "Tiket Aktif",
    value: "42",
    meta: "8 Darurat · 19 Menengah · 15 Standar",
    valueTone: "default",
  },
  {
    id: "overdue",
    label: "Melewati Tenggat",
    value: "5",
    meta: "Penalti aktif -3 / -6 poin per tiket",
    valueTone: "error",
  },
  {
    id: "disputed-escalated",
    label: "Dibantah & Eskalasi",
    value: "3",
    meta: "2 Dibantah Warga · 1 Eskalasi Berita Acara",
    valueTone: "purple",
  },
  {
    id: "integrity",
    label: "Skor Integritas Dinas",
    value: "84",
    meta: "Kepatuhan SLA 91.4% · Tepat waktu +2 poin",
    valueTone: "brand",
  },
];

export const DINAS_ALERTS = {
  disputed: {
    ticketId: "#LP-2026-0819",
    countdownText: "Batas respons: 18:24:10",
    description:
      "#LP-2026-0819 · Jl. Mastrip Karangpilang — Warga mengunggah foto bantahan lubang belum ditambal rata. Jika diam >24 jam, sistem otomatis memaksa Perbaikan Ulang.",
  },
  escalated: {
    ticketId: "#LP-2026-0794",
    penaltyText: "Penalti permanen -5 poin",
    description:
      "#LP-2026-0794 · Jl. Raya Ngagel — Bantahan putaran ke-2 sah. Tombol Selesai terkunci hingga Berita Acara (PDF/JPG ≤5 MB) dan Foto Live (≤75 m) diunggah.",
  },
};

export const DINAS_MOCK_TICKETS: DinasTicketRow[] = [
  {
    id: "#LP-2026-0831",
    status: "OVERDUE",
    categoryTitle: "Jalan Ambles 60 cm",
    tier: "DARURAT",
    location: "Jl. Raya Waru No. 18, Waru, Sidoarjo",
    region: "Sidoarjo",
    slaText: "Terlambat +03:14:22",
    slaTone: "overdue",
    supportCount: 18,
    actions: [{ id: "complete", label: "Laporkan Selesai", variant: "primary" }],
  },
  {
    id: "#LP-2026-0834",
    status: "OVERDUE",
    categoryTitle: "Saluran Tersumbat Total",
    tier: "MENENGAH",
    location: "Jl. Rungkut Industri Raya No. 42, Surabaya",
    region: "Surabaya",
    slaText: "Terlambat +01:08:45",
    slaTone: "overdue",
    supportCount: 12,
    actions: [
      { id: "start", label: "Mulai Kerjakan", variant: "primary" },
      {
        id: "transfer",
        label: "Oper",
        variant: "secondary",
        disabled: true,
        disabledReason: "Oper terkunci setelah melewati tenggat",
      },
    ],
  },
  {
    id: "#LP-2026-0819",
    status: "DISPUTED",
    categoryTitle: "Jalan Berlubang Jalur Kiri",
    tier: "STANDAR",
    location: "Jl. Mastrip No. 88, Karangpilang, Surabaya",
    region: "Surabaya",
    slaText: "Jeda 18:24:10",
    slaTone: "disputed",
    supportCount: 9,
    actions: [
      { id: "rework", label: "Proses Ulang", variant: "primary" },
      { id: "appeal", label: "Banding (1×)", variant: "secondary" },
    ],
  },
  {
    id: "#LP-2026-0852",
    status: "OPEN",
    categoryTitle: "Kabel Menjuntai di Trotoar",
    tier: "DARURAT",
    location: "Jl. Ahmad Yani No. 204, Gayungan, Surabaya",
    region: "Surabaya",
    slaText: "Sisa 21:40:12",
    slaTone: "normal",
    supportCount: 4,
    actions: [
      { id: "start", label: "Kerjakan", variant: "primary" },
      { id: "transfer", label: "Oper", variant: "secondary" },
      { id: "out-of-scope", label: "Luar Wewenang", variant: "ghost" },
      { id: "spam", label: "Spam", variant: "danger" },
    ],
  },
  {
    id: "#LP-2026-0847",
    status: "IN_PROGRESS",
    categoryTitle: "Trotoar Amblas Depan Sekolah",
    tier: "MENENGAH",
    location: "Jl. Dharmawangsa No. 32, Gubeng, Surabaya",
    region: "Surabaya",
    slaText: "Sisa 38:15:09",
    slaTone: "warning",
    supportCount: 15,
    actions: [{ id: "complete", label: "Laporkan Selesai", variant: "primary" }],
  },
  {
    id: "#LP-2026-0812",
    status: "PENDING_VALIDATION",
    categoryTitle: "Perbaikan Aspal Jalur Cepat",
    tier: "STANDAR",
    location: "Jl. Basuki Rahmat No. 55, Genteng, Surabaya",
    region: "Surabaya",
    slaText: "Uji Publik 28j / 48j",
    slaTone: "muted",
    supportCount: 7,
    actions: [
      {
        id: "quorum",
        label: "Menunggu Kuorum (1.0/2.0)",
        variant: "ghost",
        disabled: true,
      },
    ],
  },
  {
    id: "#LP-2026-0794",
    status: "ESCALATED",
    categoryTitle: "Gorong-Gorong Jebol Jalan Utama",
    tier: "DARURAT",
    location: "Jl. Raya Ngagel No. 120, Wonokromo, Surabaya",
    region: "Surabaya",
    slaText: "Eskalasi Pengawasan",
    slaTone: "overdue",
    supportCount: 22,
    actions: [
      {
        id: "upload-ba",
        label: "Unggah Berita Acara & Foto",
        variant: "danger",
      },
    ],
  },
  {
    id: "#LP-2026-0805",
    status: "CLOSED",
    categoryTitle: "Tambal Sulam Aspal Simpang Tiga",
    tier: "STANDAR",
    location: "Jl. Raya Buduran No. 9, Buduran, Sidoarjo",
    region: "Sidoarjo",
    slaText: "Tuntas (+2 poin)",
    slaTone: "muted",
    supportCount: 11,
    actions: [
      {
        id: "verified",
        label: "Terverifikasi Warga",
        variant: "ghost",
        disabled: true,
      },
    ],
  },
];

export const TICKET_TABS: Array<{
  key: DinasQueueFilterKey;
  label: string;
  count: number;
  countClass: string;
}> = [
  {
    key: "ALL",
    label: "Semua Antrean",
    count: DINAS_QUEUE_COUNTS.ALL,
    countClass: "bg-brand-soft text-brand",
  },
  {
    key: "OVERDUE",
    label: "Melewati Tenggat",
    count: DINAS_QUEUE_COUNTS.OVERDUE,
    countClass: "bg-red-100 text-red-800",
  },
  {
    key: "PENDING_VALIDATION",
    label: "Menunggu Cek Warga",
    count: DINAS_QUEUE_COUNTS.PENDING_VALIDATION,
    countClass: "bg-orange-100 text-orange-900",
  },
  {
    key: "DISPUTED",
    label: "Dibantah",
    count: DINAS_QUEUE_COUNTS.DISPUTED,
    countClass: "bg-purple-100 text-purple-800",
  },
  {
    key: "CLOSED",
    label: "Tuntas Terverifikasi",
    count: DINAS_QUEUE_COUNTS.CLOSED,
    countClass: "bg-green-100 text-green-800",
  },
];

export interface DinasMapPin extends DinasTicketRow {
  /** Posisi persentase X di kanvas peta dummy (0–100) */
  mapX: number;
  /** Posisi persentase Y di kanvas peta dummy (0–100) */
  mapY: number;
  categoryGroup: "Semua" | "Jalan Ambles" | "Drainase" | "Jalan Berlubang" | "Trotoar & Kabel";
  critical?: boolean;
  publicCoords: string;
  reporterAlias: string;
  liveProofWatermark: string;
  citizenNote: string;
  lockedReason?: string;
}

export interface MapClusterItem {
  id: string;
  count: number;
  label: string;
  mapX: number;
  mapY: number;
  sizePx: 36 | 44 | 52;
}

export const DINAS_PU_CATEGORIES: Array<{
  value: DinasMapPin["categoryGroup"];
  label: string;
}> = [
  { value: "Semua", label: "Kategori PU: Semua (42)" },
  { value: "Jalan Ambles", label: "Kategori PU: Jalan Ambles (11)" },
  { value: "Drainase", label: "Kategori PU: Drainase & Saluran (13)" },
  { value: "Jalan Berlubang", label: "Kategori PU: Jalan Berlubang (10)" },
  { value: "Trotoar & Kabel", label: "Kategori PU: Trotoar & Kabel (8)" },
];

export const DINAS_MAP_CLUSTERS: MapClusterItem[] = [
  { id: "cl-pusat", count: 12, label: "Surabaya Pusat", mapX: 30, mapY: 22, sizePx: 52 },
  { id: "cl-rungkut", count: 7, label: "Rungkut Industri", mapX: 71, mapY: 30, sizePx: 44 },
  { id: "cl-sidoarjo", count: 5, label: "Waru · Sidoarjo", mapX: 64, mapY: 70, sizePx: 36 },
];

export const DINAS_MAP_PINS: DinasMapPin[] = [
  {
    ...DINAS_MOCK_TICKETS[0],
    categoryTitle: "Jalan Ambles 60 cm di Jalur Lambat",
    mapX: 46,
    mapY: 54,
    categoryGroup: "Jalan Ambles",
    critical: true,
    publicCoords: "-7.3584, 112.7289",
    reporterAlias: "Warga-Delta-402",
    liveProofWatermark: "Live WebRTC · 19 Nov 08:14 WIB · Akurasi 12 m",
    citizenNote:
      '"Aspal jalur lambat depan ruko Waru amblas sedalam ±60 cm akibat gorong-gorong bocor, membahayakan pengendara motor."',
    actions: [
      { id: "complete", label: "Laporkan Selesai", variant: "primary" },
      { id: "start", label: "Mulai Kerjakan", variant: "secondary" },
      {
        id: "transfer",
        label: "Oper Tiket",
        variant: "secondary",
        disabled: true,
        disabledReason: "Oper Tiket terkunci — batas 12 jam untuk kategori Darurat telah terlewati.",
      },
    ],
    lockedReason: "Oper Tiket terkunci — batas 12 jam untuk kategori Darurat telah terlewati.",
  },
  {
    ...DINAS_MOCK_TICKETS[1],
    mapX: 69,
    mapY: 46,
    categoryGroup: "Drainase",
    critical: true,
    publicCoords: "-7.3312, 112.7614",
    reporterAlias: "Warga-Gamma-118",
    liveProofWatermark: "Live WebRTC · 19 Nov 10:05 WIB · Akurasi 14 m",
    citizenNote:
      '"Saluran pematusan tersumbat sedimen dan sampah proyek, air meluap ke badan jalan kawasan industri."',
    lockedReason: "Oper Tiket terkunci karena status telah melewati tenggat SLA.",
  },
  {
    ...DINAS_MOCK_TICKETS[6],
    mapX: 51,
    mapY: 34,
    categoryGroup: "Drainase",
    critical: true,
    publicCoords: "-7.2914, 112.7438",
    reporterAlias: "Warga-Sigma-309",
    liveProofWatermark: "Live WebRTC · 18 Nov 16:40 WIB · Akurasi 9 m",
    citizenNote:
      '"Bantahan warga putaran ke-2 sah: penutup gorong-gorong masih miring dan berlubang."',
    lockedReason: "Wajib unggah Berita Acara (PDF/JPG ≤5 MB) & Foto Live (≤75 m) untuk menutup tiket Eskalasi.",
  },
  {
    ...DINAS_MOCK_TICKETS[2],
    mapX: 23,
    mapY: 41,
    categoryGroup: "Jalan Berlubang",
    critical: false,
    publicCoords: "-7.3261, 112.6885",
    reporterAlias: "Warga-Alpha-512",
    liveProofWatermark: "Live WebRTC · 19 Nov 13:20 WIB · Akurasi 16 m",
    citizenNote:
      '"Tambalan aspal di jalur kiri kembali terkelupas saat hujan deras semalam."',
  },
  {
    ...DINAS_MOCK_TICKETS[3],
    mapX: 37,
    mapY: 44,
    categoryGroup: "Trotoar & Kabel",
    critical: false,
    publicCoords: "-7.3298, 112.7311",
    reporterAlias: "Warga-Omega-774",
    liveProofWatermark: "Live WebRTC · 20 Nov 07:12 WIB · Akurasi 11 m",
    citizenNote:
      '"Kabel utilitas menjuntai rendah di atas trotoar jalur pejalan kaki menuju halte."',
  },
  {
    ...DINAS_MOCK_TICKETS[4],
    mapX: 57,
    mapY: 24,
    categoryGroup: "Trotoar & Kabel",
    critical: false,
    publicCoords: "-7.2741, 112.7520",
    reporterAlias: "Warga-Beta-204",
    liveProofWatermark: "Live WebRTC · 19 Nov 15:50 WIB · Akurasi 10 m",
    citizenNote:
      '"Batu trotoar ambles di depan gerbang sekolah, berisiko bagi siswa saat jam pulang."',
  },
  {
    ...DINAS_MOCK_TICKETS[5],
    mapX: 42,
    mapY: 19,
    categoryGroup: "Jalan Berlubang",
    critical: false,
    publicCoords: "-7.2655, 112.7402",
    reporterAlias: "Warga-Kappa-640",
    liveProofWatermark: "Live WebRTC · 20 Nov 11:30 WIB · Akurasi 8 m",
    citizenNote:
      '"Petugas telah mengunggah foto perbaikan selesai, menunggu kuorum verifikasi warga sekitar."',
  },
];

export const MAP_LEGEND_ITEMS = [
  { label: "Melewati Tenggat / Kritis", colorHex: "#DC2626" },
  { label: "Eskalasi Pengawasan", colorHex: "#7F1D1D" },
  { label: "Dibantah Warga", colorHex: "#9333EA" },
  { label: "Sedang Ditangani", colorHex: "#EAB308" },
  { label: "Laporan Masuk", colorHex: "#2563EB" },
  { label: "Klaster Area (Teal)", colorHex: "#0F766E" },
];

export const RAPOR_KPI_STATS: KpiStatItem[] = [
  {
    id: "total",
    label: "Total Laporan Masuk",
    value: "186",
    meta: "148 tuntas · 38 dalam proses",
    valueTone: "default",
  },
  {
    id: "sla",
    label: "Kepatuhan SLA (%)",
    value: "88.4%",
    meta: "+3.2% dibanding bulan lalu",
    valueTone: "brand",
  },
  {
    id: "late",
    label: "Jumlah Telat / Eskalasi",
    value: "14",
    meta: "11 Overdue · 3 Escalated",
    valueTone: "error",
  },
  {
    id: "avg-time",
    label: "Rata-rata Waktu Tuntas",
    value: "19j 42m",
    meta: "Target Darurat ≤24 jam tercapai",
    valueTone: "brand",
  },
];

export interface RaporDinasCardItem {
  id: string;
  name: string;
  fullName: string;
  scope: string;
  score: number;
  slaCompliance: string;
  overdueEscalated: string;
  isChronicOverdue: boolean;
  outOfScopePct: number;
  rejectedSpamPct: number;
}

export const RAPOR_DINAS_SCORES: RaporDinasCardItem[] = [
  {
    id: "dishub",
    name: "Dinas Perhubungan",
    fullName: "Dinas Perhubungan (Dishub)",
    scope: "PJU Mati & Rambu Lalu Lintas",
    score: 91,
    slaCompliance: "94.6%",
    overdueEscalated: "1 / 0",
    isChronicOverdue: false,
    outOfScopePct: 8.1,
    rejectedSpamPct: 5.4,
  },
  {
    id: "dpu",
    name: "DPU Bina Marga",
    fullName: "DPU Bina Marga & Pematusan",
    scope: "Jalan Ambles, Lubang & Drainase",
    score: 84,
    slaCompliance: "91.4%",
    overdueEscalated: "5 / 1",
    isChronicOverdue: false,
    outOfScopePct: 12.0,
    rejectedSpamPct: 22.5,
  },
  {
    id: "satpolpp",
    name: "Satpol PP",
    fullName: "Satpol PP",
    scope: "Reklame Liar & Penertiban Fasum",
    score: 76,
    slaCompliance: "86.0%",
    overdueEscalated: "2 / 0",
    isChronicOverdue: false,
    outOfScopePct: 14.2,
    rejectedSpamPct: 11.8,
  },
  {
    id: "dlh",
    name: "Dinas Lingkungan Hidup",
    fullName: "Dinas Lingkungan Hidup (DLH)",
    scope: "Sampah Liar & Pohon Tumbang",
    score: 62,
    slaCompliance: "74.5%",
    overdueEscalated: "3 / 2",
    isChronicOverdue: true,
    outOfScopePct: 28.4,
    rejectedSpamPct: 16.0,
  },
];

export interface RaporHeatmapCluster {
  id: string;
  label: string;
  region: "Surabaya" | "Sidoarjo";
  count: number;
  mapX: number;
  mapY: number;
  sizePx: 36 | 38 | 44 | 52;
}

export const RAPOR_HEATMAP_CLUSTERS: RaporHeatmapCluster[] = [
  { id: "hm-waru", label: "Waru · Gayungan", region: "Sidoarjo", count: 24, mapX: 47, mapY: 56, sizePx: 52 },
  { id: "hm-rungkut", label: "Rungkut", region: "Surabaya", count: 14, mapX: 73, mapY: 42, sizePx: 44 },
  { id: "hm-karangpilang", label: "Karangpilang", region: "Surabaya", count: 9, mapX: 25, mapY: 38, sizePx: 38 },
  { id: "hm-sidoarjo", label: "Sidoarjo Kota", region: "Sidoarjo", count: 7, mapX: 62, mapY: 73, sizePx: 36 },
];

export const RAPOR_CATEGORIES = [
  { value: "ALL", label: "Kategori: Semua (8)" },
  { value: "JALAN_AMBLES", label: "Jalan Ambles" },
  { value: "PJU_MATI", label: "Lampu PJU Mati" },
  { value: "SALURAN_TERSUMBAT", label: "Drainase Tersumbat" },
  { value: "EMPTY_SAMPLE", label: "Reklame Liar (0 Titik)" },
];

export const RAPOR_REGIONS = [
  { value: "ALL", label: "Wilayah: Surabaya & Sidoarjo" },
  { value: "Surabaya", label: "Wilayah: Kota Surabaya" },
  { value: "Sidoarjo", label: "Wilayah: Kab. Sidoarjo" },
];


