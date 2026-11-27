import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ChevronDown,
  Info,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Siren,
  Star,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { DinasSidebar } from "../../components/layout/index.ts";
import type { DinasQueueFilterKey } from "../../components/layout/index.ts";
import { Badge, Button, Card, Skeleton } from "../../components/ui/index.js";
import { CATEGORIES, TICKET_STATUSES } from "../../constants/designTokens.js";
import { getRapor, onJuryEvent } from "../../lib/api.js";
import { humanizeError } from "../../lib/humanize.js";

export interface DinasRaporPageProps {
  /** Tampilkan DinasSidebar saat diakses admin dinas (/dinas/rapor) */
  showSidebar?: boolean;
}

interface RecentRatingItem {
  id: string;
  stars: number;
  comment: string;
  citizenAlias: string;
  ticketCode: string;
  createdAt: string;
}

interface DepartmentCardData {
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
  averageRating?: number | null;
  ratingCount?: number;
  recentRatings?: RecentRatingItem[];
}

interface ClusterPoint {
  id: string;
  category: string;
  status: string;
  lat: number;
  lng: number;
}

interface RaporPayload {
  scoreExplanation: string;
  departments: DepartmentCardData[];
  clusterPoints: ClusterPoint[];
}

const DEPT_SCOPE_HINTS: Record<string, string> = {
  DISHUB: "Lampu jalan & kabel bahaya",
  DPU: "Jalan rusak, ambles & saluran air",
  DLH: "Sampah liar & pohon tumbang",
  SATPOLPP: "Reklame & bangunan liar",
};

// Surabaya-Sidoarjo bounding box for clean relative dot placement on overview map
const BOUNDS = {
  minLat: -7.56,
  maxLat: -7.18,
  minLng: 112.55,
  maxLng: 112.88,
};

function projectPoint(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return {
    left: `${Math.min(92, Math.max(8, x)).toFixed(1)}%`,
    top: `${Math.min(90, Math.max(10, y)).toFixed(1)}%`,
  };
}

function getScoreBadgeClasses(score: number) {
  if (score < 40) {
    return "bg-semantic-error-soft text-semantic-error border-red-400/40";
  }
  if (score < 70) {
    return "bg-semantic-warning-soft text-semantic-warning border-amber-400/40";
  }
  return "bg-semantic-success-soft text-semantic-success border-emerald-400/40";
}

function getScoreBarClasses(score: number) {
  if (score < 40) return "bg-red-500";
  if (score < 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function getScoreVerdict(score: number) {
  if (score >= 85) return "Sangat Baik";
  if (score >= 70) return "Baik";
  if (score >= 50) return "Perlu Perbaikan";
  return "Kinerja Rendah";
}

/**
 * Halaman Publik "Catatan Kerja Dinas" (/rapor) & tampilan dinas (/dinas/rapor).
 * Terhubung 100% ke GET /api/rapor tanpa data mock dan bebas jargon teknis.
 */
export function DinasRaporPage({ showSidebar = false }: DinasRaporPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState("");
  const [data, setData] = useState<RaporPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchRapor = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const payload = await getRapor(
        selectedCategory ? { category: selectedCategory } : {}
      );
      setData(payload);
    } catch (err) {
      setErrorMsg(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchRapor();
  }, [fetchRapor]);

  useEffect(() => {
    return onJuryEvent("reset", () => {
      fetchRapor();
    });
  }, [fetchRapor]);

  const departments = data?.departments || [];
  const clusterPoints = data?.clusterPoints || [];

  const summary = useMemo(() => {
    const totalTickets = departments.reduce((sum, d) => sum + d.totalTickets, 0);
    const totalResolved = departments.reduce((sum, d) => sum + d.totalResolved, 0);
    const totalOnTime = departments.reduce((sum, d) => sum + d.onTimeResolved, 0);
    const totalOverdue = departments.reduce((sum, d) => sum + d.overdueCount, 0);
    const totalEscalated = departments.reduce((sum, d) => sum + d.escalatedCount, 0);
    const avgScore =
      departments.length > 0
        ? Math.round(
            departments.reduce((sum, d) => sum + d.integrityScore, 0) /
              departments.length
          )
        : 0;
    const onTimePct =
      totalResolved > 0 ? Math.round((totalOnTime / totalResolved) * 100) : 100;

    return {
      totalTickets,
      totalResolved,
      totalOnTime,
      totalOverdue,
      totalEscalated,
      avgScore,
      onTimePct,
    };
  }, [departments]);

  const currentUserDept = useMemo(
    () => departments.find((d) => d.id === user?.departmentId),
    [departments, user?.departmentId]
  );

  const handleSidebarFilter = (next: DinasQueueFilterKey) => {
    navigate(next === "ALL" ? "/dinas" : `/dinas?status=${next}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-bg text-fg flex flex-col pb-20 md:pb-8">
      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
        {showSidebar && user?.role === "ADMIN_DINAS" && (
          <DinasSidebar
            departmentName={
              currentUserDept?.name || user?.departmentName || "Instansi Mitra"
            }
            regionLabel="Kota Surabaya & Kab. Sidoarjo"
            isVerifiedPartner
            integrityScore={currentUserDept?.integrityScore ?? 80}
            activeFilter="ALL"
            onFilterChange={handleSidebarFilter}
            counts={{
              ALL: currentUserDept?.totalTickets ?? 0,
              OVERDUE: currentUserDept?.overdueCount ?? 0,
              ESCALATED: currentUserDept?.escalatedCount ?? 0,
            }}
          />
        )}

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-9 py-7 flex flex-col gap-6">
          {/* Header & Filter Kategori */}
          <section
            aria-label="Judul dan cara penilaian dinas"
            className="flex flex-col gap-3.5"
          >
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <h1 className="font-head font-bold text-2xl md:text-[30px] md:leading-9 text-fg">
                  Catatan Kerja Dinas
                </h1>
                <p className="font-sans text-sm leading-5 text-fg-muted">
                  Papan nilai terbuka 4 instansi di Surabaya &amp; Sidoarjo ·
                  Dihitung otomatis dari laporan lapangan dan ketepatan waktu
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="relative w-full sm:w-[250px]">
                  <select
                    aria-label="Filter jenis kerusakan"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full min-h-[42px] appearance-none rounded-xl border border-line bg-surface pl-3.5 pr-9 font-sans font-semibold text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                  >
                    <option value="">Semua Jenis Kerusakan (8)</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="size-4 text-fg-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={fetchRapor}
                  loading={loading}
                  aria-label="Segarkan data catatan kerja"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  <span>Segarkan</span>
                </Button>
              </div>
            </header>

            {/* Panduan Cara Hitung Nilai (ramah tema gelap & terang) */}
            <div className="rounded-2xl bg-semantic-info-soft border border-line px-4 py-3 flex items-start sm:items-center gap-3">
              <Info
                className="size-4 text-semantic-info shrink-0 mt-0.5 sm:mt-0"
                aria-hidden="true"
              />
              <p className="font-sans text-xs sm:text-sm leading-5 text-fg">
                <strong className="text-semantic-info">Cara hitung nilai (0–100):</strong>{" "}
                Setiap dinas mulai dari nilai <strong>80</strong> · Selesai tepat
                waktu <strong>+2</strong> · Lewat batas waktu{" "}
                <strong>-3</strong> (<strong>-6</strong> bila didukung &ge;10
                warga) · Dibantah sampai pengawasan <strong>-5</strong> · Tutup
                otomatis 72 jam <strong>+0</strong>.
              </p>
            </div>
          </section>

          {/* Error State */}
          {errorMsg && (
            <Card className="border-red-400/50 bg-semantic-error-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-sm text-semantic-error">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Gagal memuat Catatan Kerja Dinas</p>
                  <p className="text-xs opacity-90">{errorMsg}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchRapor}>
                Coba Lagi
              </Button>
            </Card>
          )}

          {/* Loading Skeleton */}
          {loading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx} className="space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-4 w-40" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Ringkasan 4 Angka Utama (Data Asli DB) */}
              <section
                aria-label="Ringkasan angka catatan kerja"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
              >
                <Card density="none" className="px-5 py-4 flex flex-col gap-1">
                  <span className="font-sans text-xs text-fg-muted">
                    Total Laporan Tercatat
                  </span>
                  <span className="font-mono font-bold text-[28px] leading-[34px] text-fg tabular-nums">
                    {summary.totalTickets}
                  </span>
                  <span className="font-sans text-xs text-fg-muted">
                    {summary.totalResolved} laporan selesai diverifikasi
                  </span>
                </Card>

                <Card density="none" className="px-5 py-4 flex flex-col gap-1">
                  <span className="font-sans text-xs text-fg-muted">
                    Rata-Rata Nilai 4 Dinas
                  </span>
                  <span className="font-mono font-bold text-[28px] leading-[34px] text-brand tabular-nums">
                    {summary.avgScore} / 100
                  </span>
                  <span className="font-sans text-xs text-fg-muted">
                    Predikat rata-rata: {getScoreVerdict(summary.avgScore)}
                  </span>
                </Card>

                <Card density="none" className="px-5 py-4 flex flex-col gap-1">
                  <span className="font-sans text-xs text-fg-muted">
                    Selesai Tepat Waktu
                  </span>
                  <span className="font-mono font-bold text-[28px] leading-[34px] text-semantic-success tabular-nums">
                    {summary.onTimePct}%
                  </span>
                  <span className="font-sans text-xs text-fg-muted">
                    {summary.totalOnTime} dari {summary.totalResolved} laporan tuntas
                  </span>
                </Card>

                <Card density="none" className="px-5 py-4 flex flex-col gap-1">
                  <span className="font-sans text-xs text-fg-muted">
                    Terlambat &amp; Pengawasan
                  </span>
                  <span className="font-mono font-bold text-[28px] leading-[34px] text-semantic-error tabular-nums">
                    {summary.totalOverdue + summary.totalEscalated}
                  </span>
                  <span className="font-sans text-xs text-fg-muted">
                    {summary.totalOverdue} lewat waktu · {summary.totalEscalated} pengawasan
                  </span>
                </Card>
              </section>

              {/* 4 Kartu Nilai Dinas (Data Asli DB) */}
              <section
                aria-label="Nilai kinerja 4 instansi mitra"
                className="flex flex-col gap-3"
              >
                <h2 className="font-head font-semibold text-xl md:text-2xl text-fg">
                  Nilai Kinerja 4 Instansi Mitra
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {departments.map((d) => {
                    const scoreRounded = Math.round(d.integrityScore);
                    const hasWarnings =
                      d.outOfScopeWarning ||
                      d.rejectedSpamWarning ||
                      d.isChronicWarning;
                    const oosPct = Math.round(d.outOfScopeRatio * 1000) / 10;
                    const spamPct = Math.round(d.rejectedSpamRatio * 1000) / 10;

                    return (
                      <Card
                        key={d.id}
                        density="none"
                        className={[
                          "p-[18px] flex flex-col justify-between gap-3.5",
                          scoreRounded < 70 ? "border-amber-500/50" : "",
                          scoreRounded < 40 ? "border-red-500/60" : "",
                        ].join(" ")}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-head font-semibold text-base text-fg truncate">
                                {d.name}
                              </h3>
                              <p className="font-sans text-xs text-fg-muted mt-0.5">
                                {DEPT_SCOPE_HINTS[d.id] || d.shortName}
                              </p>
                            </div>
                            <span
                              className={[
                                "inline-flex items-center justify-center rounded-xl border px-2.5 py-1",
                                "font-mono font-bold text-lg tabular-nums shrink-0",
                                getScoreBadgeClasses(scoreRounded),
                              ].join(" ")}
                            >
                              {scoreRounded}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-fg-muted">
                                {getScoreVerdict(scoreRounded)}
                              </span>
                              <span className="font-mono text-fg-muted tabular-nums">
                                {d.totalTickets} laporan
                              </span>
                            </div>
                            <div
                              role="progressbar"
                              aria-label={`Nilai kinerja ${d.name}`}
                              aria-valuenow={scoreRounded}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              className="h-2 w-full rounded-full bg-surface-2 overflow-hidden"
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${getScoreBarClasses(scoreRounded)}`}
                                style={{
                                  width: `${Math.max(0, Math.min(100, scoreRounded))}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-line">
                            <div>
                              <span className="text-fg-muted block">Tepat waktu</span>
                              <strong className="font-mono text-fg tabular-nums">
                                {Math.round(d.slaOnTimeRatio * 100)}% ({d.onTimeResolved}/{d.totalResolved})
                              </strong>
                            </div>
                            <div>
                              <span className="text-fg-muted block">Rating warga</span>
                              <strong className="inline-flex items-center gap-1 font-mono text-fg tabular-nums">
                                <Star className="size-3.5 text-amber-400 fill-amber-400 shrink-0" aria-hidden="true" />
                                {d.averageRating !== null && d.averageRating !== undefined
                                  ? `${d.averageRating}/5 (${d.ratingCount || 0})`
                                  : "Belum ada"}
                              </strong>
                            </div>
                          </div>

                          {d.recentRatings && d.recentRatings.length > 0 && (
                            <div className="rounded-xl bg-surface-2/80 border border-line px-3 py-2 text-xs space-y-1">
                              <p className="text-fg italic line-clamp-2">
                                &ldquo;{d.recentRatings[0].comment}&rdquo;
                              </p>
                              <p className="font-mono text-[11px] text-fg-muted">
                                {d.recentRatings[0].citizenAlias} · {d.recentRatings[0].ticketCode}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {!hasWarnings && (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-semantic-success-soft text-semantic-success">
                              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                              Kerja Normal · Tanpa Peringatan
                            </span>
                          )}
                          {d.outOfScopeWarning && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-semantic-warning-soft text-semantic-warning">
                              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                              Sering Lempar Laporan ({oosPct}%)
                            </span>
                          )}
                          {d.rejectedSpamWarning && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-semantic-warning-soft text-semantic-warning">
                              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                              Sering Tolak Laporan ({spamPct}%)
                            </span>
                          )}
                          {d.isChronicWarning && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-semantic-error-soft text-semantic-error">
                              <Siren className="size-3.5 shrink-0" aria-hidden="true" />
                              Keterlambatan Parah ({d.chronicOverdueCnt})
                            </span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>

              {/* Tabel Perbandingan Kinerja 4 Instansi */}
              <section
                aria-label="Tabel perbandingan kinerja 4 instansi"
                className="flex flex-col gap-3"
              >
                <h2 className="font-head font-semibold text-xl md:text-2xl text-fg">
                  Perbandingan Lengkap 4 Instansi
                </h2>

                <Card density="none" className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="bg-surface-2 border-b border-line text-xs font-mono uppercase text-fg-muted">
                          <th className="py-3 px-4">Instansi</th>
                          <th className="py-3 px-4">Nilai Kerja</th>
                          <th className="py-3 px-4">Tepat Waktu</th>
                          <th className="py-3 px-4">Terlambat</th>
                          <th className="py-3 px-4">Lempar Instansi Lain</th>
                          <th className="py-3 px-4">Tolak Spam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {departments.map((d) => {
                          const scoreRounded = Math.round(d.integrityScore);
                          const oosPct = Math.round(d.outOfScopeRatio * 1000) / 10;
                          const spamPct = Math.round(d.rejectedSpamRatio * 1000) / 10;
                          return (
                            <tr
                              key={d.id}
                              className="hover:bg-surface-2/50 transition-colors"
                            >
                              <td className="py-3 px-4 font-head font-semibold text-fg">
                                {d.name}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={[
                                    "inline-flex items-center rounded-lg border px-2 py-0.5 font-mono font-bold text-xs tabular-nums",
                                    getScoreBadgeClasses(scoreRounded),
                                  ].join(" ")}
                                >
                                  {scoreRounded} / 100
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-fg tabular-nums">
                                {Math.round(d.slaOnTimeRatio * 100)}% ({d.onTimeResolved}/{d.totalResolved})
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums">
                                <span className={d.overdueCount > 0 ? "text-semantic-error font-semibold" : "text-fg-muted"}>
                                  {d.overdueCount}
                                </span>
                                {d.isChronicWarning && (
                                  <span className="ml-1.5 text-[11px] text-semantic-error">
                                    ({d.chronicOverdueCnt} parah)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums">
                                <span className={d.outOfScopeWarning ? "text-semantic-warning font-bold" : "text-fg-muted"}>
                                  {oosPct}% ({d.outOfScopeCount})
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums">
                                <span className={d.rejectedSpamWarning ? "text-semantic-warning font-bold" : "text-fg-muted"}>
                                  {spamPct}% ({d.rejectedSpamCount})
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </section>

              {/* Peta Titik Rawan Kerusakan (Titik Asli dari clusterPoints DB) */}
              <section
                aria-label="Sebaran titik kerusakan Surabaya dan Sidoarjo"
                className="flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-head font-semibold text-xl md:text-2xl text-fg">
                      Sebaran Titik Kerusakan Surabaya–Sidoarjo
                    </h2>
                    <p className="text-xs text-fg-muted">
                      Menampilkan {clusterPoints.length} titik laporan nyata dari database
                      (koordinat publik disamarkan &plusmn;11 m). Klik titik untuk membuka detail.
                    </p>
                  </div>
                  {selectedCategory && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedCategory("")}
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      Lihat Semua Kategori
                    </Button>
                  )}
                </div>

                {clusterPoints.length === 0 ? (
                  <Card className="py-10 text-center flex flex-col items-center gap-3">
                    <MapPin className="size-8 text-fg-muted" aria-hidden="true" />
                    <p className="font-head font-semibold text-base text-fg">
                      Belum ada titik kerusakan pada kategori ini
                    </p>
                    <p className="text-sm text-fg-muted max-w-md">
                      Coba pilih kategori lain atau tampilkan semua jenis kerusakan di wilayah Surabaya dan Sidoarjo.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedCategory("")}
                    >
                      Lihat Semua Kategori
                    </Button>
                  </Card>
                ) : (
                  <Card density="none" className="p-4">
                    <div className="relative h-[320px] sm:h-[360px] rounded-xl border border-line bg-surface-2 overflow-hidden">
                      {/* Grid panduan wilayah */}
                      <div
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle, currentColor 1px, transparent 1px)",
                          backgroundSize: "24px 24px",
                        }}
                      />
                      <span className="absolute top-3 left-3 text-[11px] font-mono font-semibold text-fg-muted bg-surface/90 border border-line px-2.5 py-1 rounded-lg">
                        Kota Surabaya (Utara)
                      </span>
                      <span className="absolute bottom-3 left-3 text-[11px] font-mono font-semibold text-fg-muted bg-surface/90 border border-line px-2.5 py-1 rounded-lg">
                        Kab. Sidoarjo (Selatan)
                      </span>

                      {clusterPoints.map((pt) => {
                        const pos = projectPoint(pt.lat, pt.lng);
                        const meta =
                          TICKET_STATUSES[pt.status as keyof typeof TICKET_STATUSES];
                        const pinHex = meta?.pinHex || "#2563EB";
                        return (
                          <button
                            key={pt.id}
                            type="button"
                            onClick={() => navigate(`/tiket/${pt.id}`)}
                            title={`${meta?.label || pt.status} (${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)})`}
                            style={{
                              left: pos.left,
                              top: pos.top,
                              backgroundColor: pinHex,
                            }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-surface shadow-sm hover:scale-125 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            aria-label={`Buka laporan ${pt.id} status ${meta?.label || pt.status}`}
                          />
                        );
                      })}
                    </div>
                  </Card>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default DinasRaporPage;
