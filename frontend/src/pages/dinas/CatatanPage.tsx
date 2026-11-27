import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ChevronDown,
  Info,
  RotateCcw,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { TopNavbar, DinasSidebar } from "../../components/layout/index.ts";
import type { DinasQueueFilterKey } from "../../components/layout/index.ts";
import { Badge, Button, Card, Skeleton, useToast } from "../../components/ui/index.js";
import { CivicLeafletMap } from "../../components/map/CivicLeafletMap.tsx";
import { useLiveSync } from "../../hooks/useLiveSync.ts";
import { getRapor, listDinasTickets, onJuryEvent } from "../../services/api.js";
import {
  computeDinasQueueCounts,
  mapRaporResponse,
  type ApiRaporResponse,
  type RaporDinasCardView,
} from "../../utils/ticketMappers.ts";
import { CATEGORIES } from "../../constants/designTokens.js";

export interface DinasCatatanPageProps {
  /** Tampilkan DinasSidebar saat diakses admin dinas (/dinas/catatan) */
  showSidebar?: boolean;
}

const STAT_TONE_CLASSES: Record<string, string> = {
  default: "text-fg",
  brand: "text-brand",
  error: "text-semantic-error",
  purple: "text-purple-800",
};

const REGION_OPTIONS = [
  { value: "ALL", label: "Peta: Surabaya & Sidoarjo" },
  { value: "Surabaya", label: "Peta: Kota Surabaya" },
  { value: "Sidoarjo", label: "Peta: Kab. Sidoarjo" },
];

const FORMULA_TEXT =
  "Aturan Nilai Kerja (Skala 0–100 · Awal Mitra: 80): Selesai tepat waktu +2 · Terlambat -3 (-6 jika ≥10 dukungan) · Eskalasi Pengawasan -5 · Tutup Otomatis 72j = 0 (netral).";

/**
 * Catatan (/dinas/catatan) — live `GET /api/rapor` board, filters and matrix.
 */
export function DinasCatatanPage({ showSidebar = true }: DinasCatatanPageProps) {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();

  const [apiRapor, setApiRapor] = useState<ApiRaporResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [queueCounts, setQueueCounts] = useState(
    computeDinasQueueCounts([])
  );

  const loadData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const filters = selectedCategory === "ALL" ? {} : { category: selectedCategory };
        const shouldLoadQueue = showSidebar && user?.role === "ADMIN_DINAS";
        const [raporPayload, tickets] = await Promise.all([
          getRapor(filters),
          shouldLoadQueue
            ? listDinasTickets({}, accessToken).catch(() => null)
            : Promise.resolve(null),
        ]);
        setApiRapor(raporPayload);
        if (Array.isArray(tickets)) {
          setQueueCounts(computeDinasQueueCounts(tickets));
        }
      } catch (err) {
        if (!silent) setError(err);
        showToast({ type: "error", error: err });
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory, showSidebar, user?.role, accessToken, showToast]
  );

  const { markSynced } = useLiveSync({
    onRefresh: () => loadData({ silent: true }),
    intervalMs: 30_000,
    realtimeTable: "DepartmentRating",
  });

  useEffect(() => {
    loadData().then(markSynced).catch(() => {});
  }, [loadData]);

  useEffect(
    () => onJuryEvent("reset", () => loadData({ silent: true }).then(markSynced)),
    [loadData]
  );

  const mapped = useMemo(
    () =>
      apiRapor
        ? mapRaporResponse(apiRapor, { region: selectedRegion })
        : null,
    [apiRapor, selectedRegion]
  );

  const departments = mapped?.departments ?? [];
  const clusters = mapped?.clusters ?? [];
  const kpiStats = mapped?.kpiStats ?? [];

  const categoryOptions = useMemo(
    () => [
      { value: "ALL", label: "Kategori: Semua" },
      ...CATEGORIES.map((category: { code: string; label: string }) => ({
        value: category.code,
        label: category.label,
      })),
    ],
    []
  );

  const departmentName = user?.departmentName || "Dinas PU Bina Marga & Pematusan";
  const profileLabel = user?.role === "ADMIN_DINAS"
    ? `Admin · ${user.departmentShortName || "Dinas"}`
    : user?.aliasName;
  const myScore =
    departments.find((department) => department.id === user?.departmentId)?.score ??
    80;

  const handleResetFilters = () => {
    setSelectedCategory("ALL");
    setSelectedRegion("ALL");
  };

  if (loading && !apiRapor) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col">
        <TopNavbar profileLabel={profileLabel} />
        <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
          {showSidebar && user?.role === "ADMIN_DINAS" && (
            <div className="w-full lg:w-64 shrink-0 border-b lg:border-r border-line p-[18px]">
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-9 py-7 flex flex-col gap-5">
            <Skeleton className="h-9 w-80" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <TopNavbar profileLabel={profileLabel} />

      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
        {showSidebar && user?.role === "ADMIN_DINAS" && (
          <DinasSidebar
            departmentName={departmentName}
            regionLabel="Kota Surabaya & Kab. Sidoarjo"
            isVerifiedPartner
            integrityScore={myScore}
            activeFilter="ALL"
            onFilterChange={(next: DinasQueueFilterKey) =>
              navigate(next === "ALL" ? "/dinas" : `/dinas?status=${next}`)
            }
            counts={queueCounts}
          />
        )}

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-9 py-7 flex flex-col gap-6">
          <section
            aria-label="Judul dan panduan nilai kerja"
            className="flex flex-col gap-3.5"
          >
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <h1 className="font-head font-bold text-2xl md:text-[30px] md:leading-9 text-fg">
                  Catatan
                </h1>
                <p className="font-sans text-sm leading-5 text-fg-muted">
                  Papan transparansi publik instansi mitra Kota Surabaya &amp;
                  Kab. Sidoarjo · Diperbarui otomatis setiap transaksi selesai
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
                <div className="relative w-full sm:w-[220px]">
                  <select
                    aria-label="Filter kategori laporan"
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                    className="w-full min-h-[42px] appearance-none rounded-xl border border-line bg-surface pl-3.5 pr-9 font-sans font-semibold text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none size-4 text-fg-muted absolute right-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                </div>

                <div className="relative w-full sm:w-[235px]">
                  <select
                    aria-label="Filter wilayah pada peta"
                    value={selectedRegion}
                    onChange={(event) => setSelectedRegion(event.target.value)}
                    className="w-full min-h-[42px] appearance-none rounded-xl border border-line bg-surface pl-3.5 pr-9 font-sans font-semibold text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                  >
                    {REGION_OPTIONS.map((region) => (
                      <option key={region.value} value={region.value}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none size-4 text-fg-muted absolute right-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </header>

            <div
              role="note"
              className="rounded-[14px] bg-semantic-info-soft border border-sky-200 px-4 py-3 flex items-start sm:items-center gap-3"
            >
              <Info
                className="size-[18px] text-semantic-info shrink-0 mt-0.5 sm:mt-0"
                aria-hidden="true"
              />
              <p className="font-sans font-semibold text-[13px] leading-[18px] text-semantic-info">
                {FORMULA_TEXT}
              </p>
            </div>
          </section>

          {error && !apiRapor ? (
            <Card className="text-center py-10 flex flex-col items-center gap-3">
              <h2 className="font-head font-semibold text-base text-fg">
                Catatan belum bisa dimuat
              </h2>
              <p className="font-sans text-sm text-fg-muted max-w-md">
                Periksa koneksi internet lalu muat ulang data rapor.
              </p>
              <Button variant="secondary" size="sm" onClick={() => void loadData()}>
                Coba Lagi
              </Button>
            </Card>
          ) : (
            <>
              <section
                aria-label="Ringkasan statistik rapor"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
              >
                {kpiStats.map((stat) => (
                  <Card
                    key={stat.id}
                    density="none"
                    className="px-5 py-4 flex flex-col gap-1"
                  >
                    <span className="font-sans text-xs leading-4 text-fg-muted">
                      {stat.label}
                    </span>
                    <span
                      className={[
                        "font-mono font-bold text-[28px] leading-[34px] tabular-nums",
                        STAT_TONE_CLASSES[stat.valueTone] || "text-fg",
                      ].join(" ")}
                    >
                      {stat.value}
                    </span>
                    <span className="font-sans text-xs leading-4 text-fg-muted">
                      {stat.meta}
                    </span>
                  </Card>
                ))}
              </section>

              <section
                aria-label="Nilai kerja instansi mitra"
                className="flex flex-col gap-3"
              >
                <h2 className="font-head font-semibold text-xl md:text-2xl leading-[30px] text-fg">
                  Nilai Kerja Instansi Mitra
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {departments.map((dinas) => {
                    const isMidScore = dinas.score < 70 && dinas.score >= 40;
                    const isLowScore = dinas.score < 40;
                    const showOutOfScope = dinas.outOfScopePct > 25;
                    const showSpam = dinas.rejectedSpamPct > 20;
                    const hasWarnings =
                      showOutOfScope || showSpam || dinas.isChronicOverdue;

                    return (
                      <Card
                        key={dinas.id}
                        density="none"
                        className={[
                          "p-[18px] flex flex-col justify-between gap-3",
                          isMidScore ? "!border-amber-200" : "",
                          isLowScore ? "!border-red-300" : "",
                        ].join(" ")}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <h3 className="font-head font-semibold text-[15px] leading-5 text-fg">
                                {dinas.name}
                              </h3>
                              <p className="font-sans text-xs leading-4 text-fg-muted">
                                {dinas.scope}
                              </p>
                            </div>

                            <span
                              className={[
                                "inline-flex items-center justify-center rounded-xl border px-2.5 py-1.5",
                                "font-mono font-bold text-[22px] leading-[26px] tabular-nums shrink-0",
                                isLowScore
                                  ? "bg-red-50 border-red-200 text-red-700"
                                  : isMidScore
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : "bg-green-50 border-green-200 text-green-700",
                              ].join(" ")}
                            >
                              {dinas.score}
                            </span>
                          </div>

                          <div
                            role="progressbar"
                            aria-label={`Nilai kerja ${dinas.name}`}
                            aria-valuenow={dinas.score}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="h-2 w-full rounded-full bg-surface-2 overflow-hidden"
                          >
                            <div
                              className={[
                                "h-full rounded-full transition-all duration-300",
                                isLowScore
                                  ? "bg-red-600"
                                  : isMidScore
                                    ? "bg-amber-600"
                                    : "bg-green-600",
                              ].join(" ")}
                              style={{ width: `${dinas.score}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {!hasWarnings && (
                            <Badge
                              variant="brand"
                              size="sm"
                              icon={<ShieldCheck className="size-3" />}
                            >
                              Rasio Sehat · Tidak Ada Peringatan
                            </Badge>
                          )}

                          {showSpam && (
                            <Badge
                              variant="warning"
                              size="sm"
                              icon={<AlertTriangle className="size-3" />}
                              className="!bg-amber-100 !text-amber-800 !border-amber-200 font-mono text-[10px]"
                            >
                              Tolak Laporan &gt;20% ({dinas.rejectedSpamPct.toFixed(1)}%)
                            </Badge>
                          )}

                          {showOutOfScope && (
                            <Badge
                              variant="warning"
                              size="sm"
                              icon={<AlertTriangle className="size-3" />}
                              className="!bg-amber-100 !text-amber-800 !border-amber-200 font-mono text-[10px]"
                            >
                              Lempar Instansi &gt;25% ({dinas.outOfScopePct.toFixed(1)}%)
                            </Badge>
                          )}

                          {dinas.isChronicOverdue && (
                            <Badge
                              variant="error"
                              size="sm"
                              icon={<Siren className="size-3" />}
                              className="!bg-red-100 !text-red-800 !border-red-200 font-mono text-[10px]"
                            >
                              Terlambat Parah
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-col gap-0.5 border-t border-line pt-1.5">
                          <span className="font-mono text-[11px] font-bold text-amber-600">
                            ★ {dinas.ratingAverage != null ? dinas.ratingAverage.toFixed(1) : "—"}/5{" "}
                            <span className="font-sans font-medium text-fg-muted">
                              ({dinas.ratingCount} ulasan warga)
                            </span>
                          </span>
                          {dinas.recentRatings[0] && (
                            <span className="font-sans text-[11px] leading-4 text-fg-muted line-clamp-2">
                              “{dinas.recentRatings[0].comment}” —{" "}
                              {dinas.recentRatings[0].citizenAlias}
                            </span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>

              <section
                aria-label="Matriks perbandingan kinerja instansi"
                className="flex flex-col gap-3"
              >
                <h2 className="font-head font-semibold text-xl md:text-2xl leading-[30px] text-fg">
                  Matriks Perbandingan Catatan
                </h2>

                <Card density="none" className="hidden md:block overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-surface-2 border-b border-line">
                          <th className="py-3 pl-5 pr-4 font-mono font-bold text-[11px] leading-4 text-fg-muted">
                            INSTANSI &amp; NILAI KERJA
                          </th>
                          <th className="py-3 px-4 w-[150px] font-mono font-bold text-[11px] leading-4 text-fg-muted">
                            SELESAI TEPAT WAKTU
                          </th>
                          <th className="py-3 px-4 w-[180px] font-mono font-bold text-[11px] leading-4 text-fg-muted">
                            TERLAMBAT / PENGAWASAN
                          </th>
                          <th className="py-3 px-4 w-[140px] font-mono font-bold text-[11px] leading-4 text-fg-muted">
                            TERLAMBAT PARAH
                          </th>
                          <th className="py-3 px-4 w-[165px] font-mono font-bold text-[11px] leading-4 text-fg-muted">
                            LEMPAR INSTANSI LAIN %
                          </th>
                          <th className="py-3 pl-4 pr-5 w-[165px] font-mono font-bold text-[11px] leading-4 text-fg-muted">
                            TOLAK LAPORAN %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {departments.map((row, index) => {
                          const outOfScopeWarn = row.outOfScopePct > 25;
                          const spamWarn = row.rejectedSpamPct > 20;
                          return (
                            <tr
                              key={row.id}
                              className={index % 2 === 1 ? "bg-bg/60" : "bg-surface"}
                            >
                              <td className="py-3 pl-5 pr-4">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-head font-semibold text-sm leading-5 text-fg">
                                    {row.fullName}
                                  </span>
                                  <span
                                    className={[
                                      "font-mono font-bold text-[13px] leading-[18px] tabular-nums shrink-0",
                                      row.score >= 70 ? "text-green-700" : "text-amber-700",
                                    ].join(" ")}
                                  >
                                    {row.score} / 100
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono font-medium text-[13px] text-fg tabular-nums">
                                {row.slaCompliance}
                              </td>
                              <td className="py-3 px-4 font-mono font-medium text-[13px] text-fg tabular-nums">
                                {row.overdueEscalated}
                              </td>
                              <td className="py-3 px-4">
                                {row.isChronicOverdue ? (
                                  <Badge
                                    variant="error"
                                    size="sm"
                                    icon={null}
                                    className="!bg-red-100 !text-red-800 !border-red-200 font-mono"
                                  >
                                    Ya (Kronis)
                                  </Badge>
                                ) : (
                                  <span className="font-mono font-medium text-[13px] text-fg-muted">
                                    Tidak
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {outOfScopeWarn ? (
                                  <Badge
                                    variant="warning"
                                    size="sm"
                                    icon={null}
                                    className="!bg-amber-100 !text-amber-800 !border-amber-200 font-mono"
                                  >
                                    {row.outOfScopePct.toFixed(1)}%
                                  </Badge>
                                ) : (
                                  <span className="font-mono font-medium text-[13px] text-fg tabular-nums">
                                    {row.outOfScopePct.toFixed(1)}%
                                  </span>
                                )}
                              </td>
                              <td className="py-3 pl-4 pr-5">
                                {spamWarn ? (
                                  <Badge
                                    variant="warning"
                                    size="sm"
                                    icon={null}
                                    className="!bg-amber-100 !text-amber-800 !border-amber-200 font-mono"
                                  >
                                    {row.rejectedSpamPct.toFixed(1)}%
                                  </Badge>
                                ) : (
                                  <span className="font-mono font-medium text-[13px] text-fg tabular-nums">
                                    {row.rejectedSpamPct.toFixed(1)}%
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <div className="flex flex-col gap-2.5 md:hidden">
                  {departments.map((row) => (
                    <Card key={row.id} density="dinas" className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-head font-semibold text-sm text-fg">
                          {row.fullName}
                        </span>
                        <span
                          className={[
                            "font-mono font-bold text-sm tabular-nums",
                            row.score >= 70 ? "text-green-700" : "text-amber-700",
                          ].join(" ")}
                        >
                          {row.score} / 100
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-line font-mono">
                        <div>
                          <span className="text-fg-muted block font-sans">Selesai Tepat</span>
                          <span className="font-semibold text-fg">{row.slaCompliance}</span>
                        </div>
                        <div>
                          <span className="text-fg-muted block font-sans">Terlambat / Pengawasan</span>
                          <span className="font-semibold text-fg">{row.overdueEscalated}</span>
                        </div>
                        <div>
                          <span className="text-fg-muted block font-sans">Lempar Instansi Lain</span>
                          <span className={row.outOfScopePct > 25 ? "font-bold text-amber-800" : "text-fg"}>
                            {row.outOfScopePct.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-fg-muted block font-sans">Tolak Laporan</span>
                          <span className={row.rejectedSpamPct > 20 ? "font-bold text-amber-800" : "text-fg"}>
                            {row.rejectedSpamPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>

              <section
                aria-label="Peta klaster rawan Sidoarjo dan Surabaya"
                className="flex flex-col gap-3"
              >
                <h2 className="font-head font-semibold text-xl md:text-2xl leading-[30px] text-fg">
                  Peta Klaster Rawan Sidoarjo dan Surabaya
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-8 relative h-[320px] sm:h-[360px] rounded-2xl border border-line overflow-hidden shadow-card">
                    <CivicLeafletMap
                      clusters={clusters.map((c) => ({
                        id: c.id,
                        label: c.label,
                        count: c.count,
                        lat: c.lat,
                        lng: c.lng,
                      }))}
                      ariaLabel="Peta klaster titik rawan kerusakan Sidoarjo dan Surabaya"
                    />

                    <div className="absolute bottom-4 left-4 z-[400] inline-flex items-center gap-2.5 rounded-xl bg-surface/95 border border-line px-3 py-2 shadow-card">
                      <span className="font-mono font-medium text-[10px] text-fg-muted">
                        Rendah
                      </span>
                      <span
                        className="h-2.5 w-[100px] sm:w-[120px] rounded-full"
                        style={{
                          background:
                            "linear-gradient(90deg, #14B8A6 0%, #FACC15 50%, #DC2626 100%)",
                        }}
                        aria-hidden="true"
                      />
                      <span className="font-mono font-bold text-[10px] text-semantic-error">
                        Rawan Tinggi
                      </span>
                    </div>
                  </div>

                  {clusters.length === 0 ? (
                    <Card
                      density="none"
                      className="lg:col-span-4 p-6 flex flex-col items-center justify-center text-center gap-3.5 min-h-[320px] sm:min-h-[360px]"
                    >
                      <span className="font-mono font-bold text-[10px] leading-[14px] text-fg-muted tracking-wider">
                        HASIL FILTER KOSONG
                      </span>

                      <svg
                        viewBox="0 0 96 96"
                        className="size-24 shrink-0"
                        aria-hidden="true"
                      >
                        <circle cx="48" cy="48" r="44" fill="#FEF3E2" stroke="#E7DFD3" strokeWidth="2" />
                        <path d="M26 76c0-12 10-20 22-20s22 8 22 20" fill="#0F766E" />
                        <circle cx="48" cy="40" r="16" fill="#FDE68A" stroke="#1C1917" strokeWidth="2" />
                        <path d="M31 36c2-11 10-16 17-16s15 5 17 16H31z" fill="#0F766E" stroke="#1C1917" strokeWidth="2" />
                        <rect x="42" y="24" width="12" height="5" rx="2" fill="#CCFBF1" />
                        <circle cx="42" cy="41" r="2.2" fill="#1C1917" />
                        <circle cx="54" cy="41" r="2.2" fill="#1C1917" />
                        <path d="M43 48h10" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="72" cy="28" r="10" fill="#DC2626" />
                        <path d="M72 23v5M72 31h.01" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>

                      <div className="flex flex-col gap-1.5">
                        <h3 className="font-head font-semibold text-base leading-[22px] text-fg">
                          Belum ada titik kerusakan di kategori ini
                        </h3>
                        <p className="font-sans text-sm leading-5 text-fg-muted">
                          Coba ubah filter wilayah atau atur ulang filter kategori
                          untuk melihat seluruh sebaran laporan aktif.
                        </p>
                      </div>

                      <Button
                        variant="primary"
                        size="md"
                        leftIcon={<RotateCcw className="size-4" />}
                        onClick={handleResetFilters}
                      >
                        Reset Filter Peta
                      </Button>
                    </Card>
                  ) : (
                    <Card
                      density="none"
                      className="lg:col-span-4 p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[320px] sm:min-h-[360px]"
                    >
                      <span className="font-mono font-bold text-[10px] leading-[14px] text-fg-muted tracking-wider">
                        RINGKASAN KLASTER
                      </span>
                      <span className="font-mono font-bold text-[40px] leading-none text-brand tabular-nums">
                        {clusters.reduce((sum, cluster) => sum + cluster.count, 0)}
                      </span>
                      <h3 className="font-head font-semibold text-base text-fg">
                        Titik laporan dalam {clusters.length} klaster
                      </h3>
                      <p className="font-sans text-sm text-fg-muted">
                        Klik pin status pada peta dinas untuk menindaklanjuti
                        laporan per titik.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<RotateCcw className="size-4" />}
                        onClick={handleResetFilters}
                      >
                        Reset Filter
                      </Button>
                    </Card>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default DinasCatatanPage;
