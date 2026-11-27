import { CATEGORIES, SLA_TIERS, TICKET_STATUSES } from "../constants/designTokens.js";

/**
 * Pure view-model mappers for the LaporPAK! API.
 *
 * These helpers intentionally contain no React/JSX so they can be unit-tested
 * with the native Node test runner. All HTTP access stays in `lib/api.js`.
 */

export type TicketStatusCode =
  | "OPEN"
  | "OUT_OF_SCOPE"
  | "REJECTED_SPAM"
  | "IN_PROGRESS"
  | "OVERDUE"
  | "PENDING_VALIDATION"
  | "DISPUTED"
  | "ESCALATED"
  | "CLOSED"
  | "AUTO_CLOSED";

export type SlaTone = "overdue" | "disputed" | "warning" | "normal" | "muted";
export type SlaTierCode = "DARURAT" | "MENENGAH" | "STANDAR";
export type TicketActionVariant = "primary" | "secondary" | "ghost" | "danger";

export type DinasActionId =
  | "process"
  | "transfer"
  | "out-of-scope"
  | "reject-spam"
  | "resolve"
  | "reprocess-disputed"
  | "counter-dispute"
  | "resolve-escalated";

export interface TicketActionItem {
  id: DinasActionId;
  label: string;
  variant: TicketActionVariant;
  disabled?: boolean;
  disabledReason?: string;
}

export interface KpiStatItem {
  id: string;
  label: string;
  value: string;
  meta: string;
  valueTone: "default" | "error" | "purple" | "brand";
}

export interface ApiPublicTicket {
  id: string;
  code?: string;
  title: string;
  category: string;
  categoryLabel?: string;
  tier?: SlaTierCode;
  status: TicketStatusCode | string;
  statusLabel?: string;
  publicLat?: number | null;
  publicLng?: number | null;
  slaDeadline?: string | null;
  remainingSlaMs?: number | null;
  supportCount?: number;
  isChronicOverdue?: boolean;
  isDemoData?: boolean;
  isNsfwPendingReview?: boolean;
  createdAt?: string | null;
  department?: { id?: string; code?: string; shortName?: string } | null;
}

export interface ApiDinasTicket extends ApiPublicTicket {
  reporterAlias?: string | null;
  syncedAt?: string | null;
  disputedAt?: string | null;
  validationStartedAt?: string | null;
  transferCount?: number;
  appealUsed?: boolean;
  description?: string;
  afterPhotoUrl?: string | null;
  isLowQualityOverride?: boolean;
  outOfScopeAgency?: string | null;
  outOfScopeReason?: string | null;
  rejectedSpamReason?: string | null;
  closedResolutionNote?: string | null;
}

export interface DinasTicketViewRow {
  id: string;
  code: string;
  displayCode: string;
  status: TicketStatusCode;
  category: string;
  categoryTitle: string;
  categoryLabel: string;
  tier: SlaTierCode;
  location: string;
  region: "Surabaya" | "Sidoarjo";
  slaText: string;
  slaTone: SlaTone;
  supportCount: number;
  actions: TicketActionItem[];
  reporterAlias: string;
  publicLat: number | null;
  publicLng: number | null;
  publicCoords: string;
  syncedAt: string | null;
  disputedAt: string | null;
  transferCount: number;
  appealUsed: boolean;
  isChronicOverdue: boolean;
  isDemoData: boolean;
  description: string;
  afterPhotoUrl: string | null;
  isLowQualityOverride: boolean;
}

export interface WargaFeedTicketView {
  id: string;
  code: string;
  displayCode: string;
  status: TicketStatusCode;
  category: string;
  categoryLabel: string;
  title: string;
  location: string;
  region: "Surabaya" | "Sidoarjo";
  slaText: string;
  slaTone: SlaTone;
  supportCount: number;
  departmentLabel: string;
  publicLat: number | null;
  publicLng: number | null;
  isNsfwPendingReview?: boolean;
}

export interface WargaMapPinView extends WargaFeedTicketView {
  mapX: number;
  mapY: number;
}

export interface RaporDinasCardView {
  id: string;
  name: string;
  mobileName: string;
  fullName: string;
  scope: string;
  score: number;
  slaCompliance: string;
  overdueEscalated: string;
  chronicCount: number;
  disputedCount: number;
  isChronicOverdue: boolean;
  outOfScopePct: number;
  rejectedSpamPct: number;
  totalTickets: number;
  totalResolved: number;
  onTimeResolved: number;
  overdueCount: number;
  escalatedCount: number;
  outOfScopeWarning: boolean;
  rejectedSpamWarning: boolean;
}

export interface RaporClusterView {
  id: string;
  label: string;
  region: "Surabaya" | "Sidoarjo";
  count: number;
  mapX: number;
  mapY: number;
  sizePx: number;
}

export interface ApiRaporDepartment {
  id: string;
  code: string;
  name: string;
  shortName: string;
  integrityScore: number;
  totalTickets: number;
  totalResolved: number;
  onTimeResolved: number;
  slaOnTimeRatio: number;
  overdueCount: number;
  chronicOverdueCnt: number;
  isChronicWarning: boolean;
  escalatedCount: number;
  outOfScopeCount: number;
  outOfScopeRatio: number;
  outOfScopeWarning: boolean;
  rejectedSpamCount: number;
  rejectedSpamRatio: number;
  rejectedSpamWarning: boolean;
}

export interface ApiRaporClusterPoint {
  id: string;
  category: string;
  status: string;
  lat: number;
  lng: number;
}

export interface ApiRaporResponse {
  scoreExplanation?: string;
  departments: ApiRaporDepartment[];
  clusterPoints: ApiRaporClusterPoint[];
}

export interface RaporViewModel {
  kpiStats: KpiStatItem[];
  wargaKpiStats: KpiStatItem[];
  departments: RaporDinasCardView[];
  clusters: RaporClusterView[];
  pendingValidationCount: number;
}

// Bounding box matching public/geo/sidoarjo-surabaya.json
const MIN_LAT = -7.585;
const MAX_LAT = -7.175;
const MIN_LNG = 112.49;
const MAX_LNG = 112.86;
const EDGE_PERCENT = 4;
const SPAN_PERCENT = 100 - EDGE_PERCENT * 2;

const CATEGORY_BY_CODE = new Map<string, (typeof CATEGORIES)[number]>(
  CATEGORIES.map((category: (typeof CATEGORIES)[number]) => [category.code, category])
);

const DEPARTMENT_SCOPES: Record<string, string> = {
  DISHUB: "PJU, Rambu, Marka & Kabel Jalan",
  DPU: "Jalan, Trotoar, Jembatan & Drainase",
  DLH: "Sampah, TPS, Pohon & Taman Publik",
  SATPOLPP: "Reklame Liar, Bangunan & Ketertiban",
};

const CLUSTER_BUCKET_DEG = 0.02;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(96, Math.max(4, Math.round(value * 100) / 100));
}

export function projectCoordToMapPercent(
  lat: number,
  lng: number
): { mapX: number; mapY: number } {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { mapX: 50, mapY: 50 };
  }
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * SPAN_PERCENT + EDGE_PERCENT;
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * SPAN_PERCENT + EDGE_PERCENT;
  return { mapX: clampPercent(x), mapY: clampPercent(y) };
}

export function inferRegionFromCoords(
  lat: number,
  lng: number
): "Surabaya" | "Sidoarjo" {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Surabaya";
  return lat <= -7.35 ? "Sidoarjo" : "Surabaya";
}

function parseTimeMs(value?: string | Date | null): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function pad2(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hms = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  return days > 0 ? `${days}j ${hms}` : hms;
}

export function formatSlaRemaining(
  ticket: {
    status: string;
    slaDeadline?: string | Date | null;
    disputedAt?: string | Date | null;
    validationStartedAt?: string | Date | null;
  },
  nowMs: number = Date.now()
): { text: string; tone: SlaTone } {
  const status = String(ticket.status || "OPEN").toUpperCase();

  if (status === "CLOSED") return { text: "Tuntas Terverifikasi", tone: "muted" };
  if (status === "AUTO_CLOSED") return { text: "Tutup Otomatis 72j", tone: "muted" };
  if (status === "OUT_OF_SCOPE") return { text: "Dirujuk Instansi Lain", tone: "muted" };
  if (status === "REJECTED_SPAM") return { text: "Ditolak (Spam)", tone: "muted" };

  if (status === "DISPUTED") {
    const disputedAtMs = parseTimeMs(ticket.disputedAt);
    const remaining = disputedAtMs === null ? 0 : disputedAtMs + 24 * 3600 * 1000 - nowMs;
    return {
      text: remaining > 0 ? `Jeda ${formatDuration(remaining)}` : "Batas Banding Habis",
      tone: "disputed",
    };
  }

  if (status === "PENDING_VALIDATION") {
    const startedMs = parseTimeMs(ticket.validationStartedAt);
    if (startedMs === null) return { text: "Uji Publik 0j / 48j", tone: "warning" };
    const elapsedHours = Math.max(0, Math.floor((nowMs - startedMs) / 3600000));
    if (elapsedHours >= 72) return { text: "Uji Publik Selesai", tone: "warning" };
    return { text: `Uji Publik ${elapsedHours}j / 48j`, tone: "warning" };
  }

  const deadlineMs = parseTimeMs(ticket.slaDeadline);
  if (deadlineMs === null) return { text: "SLA belum tersedia", tone: "normal" };

  const remaining = deadlineMs - nowMs;
  if (status === "OVERDUE" || remaining <= 0) {
    return { text: `Terlambat +${formatDuration(Math.abs(remaining))}`, tone: "overdue" };
  }
  if (remaining <= 6 * 3600 * 1000) {
    return { text: `Sisa ${formatDuration(remaining)}`, tone: "warning" };
  }
  return { text: `Sisa ${formatDuration(remaining)}`, tone: "normal" };
}

function resolveCategory(ticket: { category?: string; categoryLabel?: string; tier?: string }) {
  return CATEGORY_BY_CODE.get(String(ticket.category || ""));
}

function resolveTier(ticket: { tier?: string; category?: string }): SlaTierCode {
  const explicit = String(ticket.tier || "");
  if (explicit === "DARURAT" || explicit === "MENENGAH" || explicit === "STANDAR") {
    return explicit;
  }
  const category = resolveCategory(ticket);
  const tier = String(category?.tier || "STANDAR");
  return tier === "DARURAT" || tier === "MENENGAH" ? (tier as SlaTierCode) : "STANDAR";
}

function initialWindowHours(ticket: { category?: string; tier?: string; slaInitialHours?: number | null }) {
  const explicitHours = Number(ticket.slaInitialHours);
  if (Number.isFinite(explicitHours) && explicitHours > 0) {
    return Math.min(24, explicitHours * 0.5);
  }
  const category = resolveCategory(ticket);
  const categoryHours = Number(category?.slaHours);
  if (Number.isFinite(categoryHours) && categoryHours > 0) {
    return Math.min(24, categoryHours * 0.5);
  }
  const tier = resolveTier(ticket);
  const tierHours = Number(SLA_TIERS[tier]?.hours);
  return Math.min(24, (Number.isFinite(tierHours) ? tierHours : 168) * 0.5);
}

export function buildDinasTicketActions(
  ticket: {
    id?: string;
    status: string;
    category?: string;
    tier?: string;
    slaInitialHours?: number | null;
    syncedAt?: string | Date | null;
    transferCount?: number;
    appealUsed?: boolean;
  },
  nowMs: number = Date.now()
): TicketActionItem[] {
  const status = String(ticket.status || "").toUpperCase() as TicketStatusCode;
  const transferCount = Number(ticket.transferCount || 0);
  const syncedAtMs = parseTimeMs(ticket.syncedAt);
  const windowHours = initialWindowHours(ticket);
  const withinWindow =
    syncedAtMs === null || nowMs - syncedAtMs <= windowHours * 3600 * 1000;
  const windowLabel = Number.isInteger(windowHours)
    ? `${windowHours} jam`
    : `${windowHours.toFixed(1)} jam`;

  if (status === "OPEN") {
    const transferDisabled = transferCount >= 1 || !withinWindow;
    const transferReason =
      transferCount >= 1
        ? "Oper Tiket hanya diperbolehkan maksimal 1 kali per laporan."
        : !withinWindow
          ? `Batas Oper Tiket (${windowLabel} sejak laporan masuk) sudah berakhir.`
          : undefined;
    const rejectDisabled = !withinWindow;
    return [
      { id: "process", label: "Mulai Kerjakan", variant: "primary" },
      {
        id: "transfer",
        label: "Oper Tiket",
        variant: "secondary",
        disabled: transferDisabled,
        disabledReason: transferReason,
      },
      { id: "out-of-scope", label: "Rujuk Instansi Lain", variant: "secondary" },
      {
        id: "reject-spam",
        label: "Tolak Spam",
        variant: "danger",
        disabled: rejectDisabled,
        disabledReason: rejectDisabled
          ? `Batas Tolak Spam (${windowLabel} sejak laporan masuk) sudah berakhir.`
          : undefined,
      },
    ];
  }

  if (status === "IN_PROGRESS" || status === "OVERDUE") {
    return [{ id: "resolve", label: "Laporkan Selesai", variant: "primary" }];
  }

  if (status === "DISPUTED") {
    const appealUsed = Boolean(ticket.appealUsed);
    return [
      {
        id: "reprocess-disputed",
        label: "Proses Perbaikan Ulang",
        variant: "primary",
      },
      {
        id: "counter-dispute",
        label: "Ajukan Banding Bukti (1×)",
        variant: "secondary",
        disabled: appealUsed,
        disabledReason: appealUsed
          ? "Ajukan Banding Bukti hanya boleh dipakai maksimal 1 kali per laporan."
          : undefined,
      },
    ];
  }

  if (status === "ESCALATED") {
    return [
      {
        id: "resolve-escalated",
        label: "Unggah Berita Acara & Foto Live",
        variant: "danger",
      },
    ];
  }

  return [];
}

export function computeDinasQueueCounts(
  tickets: Array<{ status: string }>
): {
  ALL: number;
  OVERDUE: number;
  DISPUTED: number;
  ESCALATED: number;
  PENDING_VALIDATION: number;
  CLOSED: number;
} {
  const counts = {
    ALL: tickets.length,
    OVERDUE: 0,
    DISPUTED: 0,
    ESCALATED: 0,
    PENDING_VALIDATION: 0,
    CLOSED: 0,
  };
  for (const ticket of tickets) {
    const status = String(ticket.status || "").toUpperCase();
    if (status in counts && status !== "ALL") {
      counts[status as keyof typeof counts] += 1;
    }
  }
  return counts;
}

function locationLabel(lat: number | null, lng: number | null): {
  location: string;
  region: "Surabaya" | "Sidoarjo";
  coords: string;
} {
  const hasCoords = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  const region = hasCoords ? inferRegionFromCoords(lat, lng) : "Surabaya";
  if (!hasCoords) {
    return { location: `${region} · Lokasi disamarkan`, region, coords: "" };
  }
  const coords = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  return { location: `${region} · ${coords}`, region, coords };
}

export function mapDinasTicketsToRows(
  apiTickets: ApiDinasTicket[],
  nowMs: number = Date.now()
): DinasTicketViewRow[] {
  return (apiTickets || []).map((ticket) => {
    const category = resolveCategory(ticket);
    const status = String(ticket.status || "OPEN").toUpperCase() as TicketStatusCode;
    const lat = ticket.publicLat == null ? null : Number(ticket.publicLat);
    const lng = ticket.publicLng == null ? null : Number(ticket.publicLng);
    const { location, region, coords } = locationLabel(lat, lng);
    const sla = formatSlaRemaining(ticket, nowMs);
    const code = String(ticket.code || ticket.id || "");
    return {
      id: ticket.id,
      code,
      displayCode: `#${code}`,
      status,
      category: String(ticket.category || ""),
      categoryTitle: ticket.title || ticket.categoryLabel || "Laporan Fasilitas",
      categoryLabel: ticket.categoryLabel || category?.label || "Laporan Fasilitas",
      tier: resolveTier(ticket),
      location,
      region,
      slaText: sla.text,
      slaTone: sla.tone,
      supportCount: Number(ticket.supportCount || 0),
      actions: buildDinasTicketActions(ticket, nowMs),
      reporterAlias: ticket.reporterAlias || "Warga-Anonim",
      publicLat: lat,
      publicLng: lng,
      publicCoords: coords,
      syncedAt: ticket.syncedAt || null,
      disputedAt: ticket.disputedAt || null,
      transferCount: Number(ticket.transferCount || 0),
      appealUsed: Boolean(ticket.appealUsed),
      isChronicOverdue: Boolean(ticket.isChronicOverdue),
      isDemoData: Boolean(ticket.isDemoData),
      description: ticket.description || "",
      afterPhotoUrl: ticket.afterPhotoUrl || null,
      isLowQualityOverride: Boolean(ticket.isLowQualityOverride),
    };
  });
}

function mapPublicTicket(
  ticket: ApiPublicTicket,
  nowMs: number
): WargaFeedTicketView {
  const category = resolveCategory(ticket);
  const status = String(ticket.status || "OPEN").toUpperCase() as TicketStatusCode;
  const lat = ticket.publicLat == null ? null : Number(ticket.publicLat);
  const lng = ticket.publicLng == null ? null : Number(ticket.publicLng);
  const { location, region } = locationLabel(lat, lng);
  const sla = formatSlaRemaining(ticket, nowMs);
  const code = String(ticket.code || ticket.id || "");
  return {
    id: ticket.id,
    code,
    displayCode: `#${code}`,
    status,
    category: String(ticket.category || ""),
    categoryLabel: ticket.categoryLabel || category?.label || "Laporan Fasilitas",
    title: ticket.title || ticket.categoryLabel || "Laporan Fasilitas",
    location,
    region,
    slaText: sla.text,
    slaTone: sla.tone,
    supportCount: Number(ticket.supportCount || 0),
    departmentLabel: ticket.department?.shortName || ticket.department?.code || "Dinas terkait",
    publicLat: lat,
    publicLng: lng,
    isNsfwPendingReview: Boolean(ticket.isNsfwPendingReview),
  };
}

export function mapPublicTicketsToWargaFeed(
  apiTickets: ApiPublicTicket[],
  nowMs: number = Date.now()
): WargaFeedTicketView[] {
  return (apiTickets || [])
    .filter((ticket) => String(ticket.status || "").toUpperCase() !== "REJECTED_SPAM")
    .map((ticket) => mapPublicTicket(ticket, nowMs));
}

export function mapPublicTicketsToWargaPins(
  apiTickets: ApiPublicTicket[],
  nowMs: number = Date.now()
): WargaMapPinView[] {
  return mapPublicTicketsToWargaFeed(apiTickets, nowMs).map((ticket) => {
    const { mapX, mapY } = projectCoordToMapPercent(
      ticket.publicLat ?? Number.NaN,
      ticket.publicLng ?? Number.NaN
    );
    return { ...ticket, mapX, mapY };
  });
}

function ratioToPercent(ratio: number): number {
  const numeric = Number(ratio);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 1000) / 10;
}

function buildClusters(
  points: ApiRaporClusterPoint[],
  regionFilter?: string
): RaporClusterView[] {
  const wantedRegion = regionFilter && regionFilter !== "ALL" ? regionFilter : null;
  const buckets = new Map<
    string,
    { latSum: number; lngSum: number; count: number; region: "Surabaya" | "Sidoarjo" }
  >();

  for (const point of points || []) {
    const status = String(point.status || "").toUpperCase();
    if (status === "REJECTED_SPAM") continue;
    const lat = Number(point.lat);
    const lng = Number(point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const region = inferRegionFromCoords(lat, lng);
    if (wantedRegion && region !== wantedRegion) continue;
    const cellLat = Math.floor(lat / CLUSTER_BUCKET_DEG);
    const cellLng = Math.floor(lng / CLUSTER_BUCKET_DEG);
    const key = `${cellLat}:${cellLng}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.latSum += lat;
      bucket.lngSum += lng;
      bucket.count += 1;
    } else {
      buckets.set(key, { latSum: lat, lngSum: lng, count: 1, region });
    }
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => {
      const { mapX, mapY } = projectCoordToMapPercent(
        bucket.latSum / bucket.count,
        bucket.lngSum / bucket.count
      );
      const sizePx =
        bucket.count >= 12 ? 52 : bucket.count >= 7 ? 44 : bucket.count >= 4 ? 38 : 36;
      return {
        id: `cluster-${key.replace(":", "-")}`,
        label: `${bucket.region} · ${bucket.count} titik`,
        region: bucket.region,
        count: bucket.count,
        mapX,
        mapY,
        sizePx,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function mapRaporResponse(
  apiRapor: ApiRaporResponse,
  options: { region?: string } = {}
): RaporViewModel {
  const departments = apiRapor?.departments || [];
  const clusterPoints = apiRapor?.clusterPoints || [];

  const departmentViews: RaporDinasCardView[] = departments.map((department) => {
    const totalTickets = Number(department.totalTickets || 0);
    const totalResolved = Number(department.totalResolved || 0);
    const onTimeResolved = Number(department.onTimeResolved || 0);
    const slaRatio =
      totalResolved > 0 && Number.isFinite(Number(department.slaOnTimeRatio))
        ? Number(department.slaOnTimeRatio)
        : 1;
    const score = Math.max(0, Math.min(100, Math.round(Number(department.integrityScore) || 0)));
    const code = String(department.code || department.id || "");
    return {
      id: department.id,
      name: department.name,
      mobileName: department.shortName || department.name,
      fullName: department.name,
      scope: DEPARTMENT_SCOPES[code] || `${department.shortName || department.name} · ${totalTickets} tiket`,
      score,
      slaCompliance: `${(slaRatio * 100).toFixed(1)}%`,
      overdueEscalated: `${Number(department.overdueCount || 0)} / ${Number(department.escalatedCount || 0)}`,
      chronicCount: Number(department.chronicOverdueCnt || 0),
      disputedCount: 0,
      isChronicOverdue: Boolean(department.isChronicWarning),
      outOfScopePct: ratioToPercent(department.outOfScopeRatio),
      rejectedSpamPct: ratioToPercent(department.rejectedSpamRatio),
      totalTickets,
      totalResolved,
      onTimeResolved,
      overdueCount: Number(department.overdueCount || 0),
      escalatedCount: Number(department.escalatedCount || 0),
      outOfScopeWarning: Boolean(department.outOfScopeWarning),
      rejectedSpamWarning: Boolean(department.rejectedSpamWarning),
    };
  });

  const totalTickets = departmentViews.reduce((sum, d) => sum + d.totalTickets, 0);
  const totalResolved = departmentViews.reduce((sum, d) => sum + d.totalResolved, 0);
  const onTimeResolved = departmentViews.reduce((sum, d) => sum + d.onTimeResolved, 0);
  const overdueCount = departmentViews.reduce((sum, d) => sum + d.overdueCount, 0);
  const escalatedCount = departmentViews.reduce((sum, d) => sum + d.escalatedCount, 0);
  const slaRatio = totalResolved > 0 ? onTimeResolved / totalResolved : 1;
  const averageScore =
    departmentViews.length > 0
      ? Math.round(
          departmentViews.reduce((sum, d) => sum + d.score, 0) / departmentViews.length
        )
      : 0;

  const clusters = buildClusters(clusterPoints, options.region);
  const pendingValidationCount = clusterPoints.filter((point) => {
    if (String(point.status || "").toUpperCase() !== "PENDING_VALIDATION") return false;
    if (options.region && options.region !== "ALL") {
      return inferRegionFromCoords(Number(point.lat), Number(point.lng)) === options.region;
    }
    return true;
  }).length;

  const wargaKpiStats: KpiStatItem[] = [
    {
      id: "total",
      label: "Total Laporan Masuk",
      value: String(totalTickets),
      meta: `${totalResolved} tuntas · ${Math.max(0, totalTickets - totalResolved)} aktif`,
      valueTone: "default",
    },
    {
      id: "sla",
      label: "Selesai Tepat Waktu",
      value: `${(slaRatio * 100).toFixed(1)}%`,
      meta: `${departmentViews.length} instansi mitra`,
      valueTone: "brand",
    },
    {
      id: "late",
      label: "Terlambat Parah",
      value: String(overdueCount),
      meta: "Penalti aktif -3 / -6",
      valueTone: "error",
    },
    {
      id: "escalation",
      label: "Eskalasi Pengawasan",
      value: String(escalatedCount),
      meta: "Wajib Berita Acara",
      valueTone: "error",
    },
  ];

  const kpiStats: KpiStatItem[] = [
    {
      id: "total",
      label: "Total Laporan Masuk",
      value: String(totalTickets),
      meta: `${totalResolved} tuntas · ${Math.max(0, totalTickets - totalResolved)} dalam proses`,
      valueTone: "default",
    },
    {
      id: "sla",
      label: "Kepatuhan SLA (%)",
      value: `${(slaRatio * 100).toFixed(1)}%`,
      meta: `${onTimeResolved} dari ${totalResolved} selesai tepat waktu`,
      valueTone: "brand",
    },
    {
      id: "late",
      label: "Telat / Eskalasi",
      value: `${overdueCount} / ${escalatedCount}`,
      meta: `${overdueCount} Overdue · ${escalatedCount} Escalated`,
      valueTone: "error",
    },
    {
      id: "score",
      label: "Skor Rata-Rata Dinas",
      value: String(averageScore),
      meta: "Skala 0–100 · Awal mitra 80",
      valueTone: "brand",
    },
  ];

  return {
    kpiStats,
    wargaKpiStats,
    departments: departmentViews,
    clusters,
    pendingValidationCount,
  };
}
