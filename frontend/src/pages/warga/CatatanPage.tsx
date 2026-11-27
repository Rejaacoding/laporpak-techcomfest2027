import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Award,
  Info,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import {
  BottomNavbar,
  Header,
  TopNavbar,
} from "../../components/layout/index.ts";
import { Badge, Button, Card, Skeleton, useToast } from "../../components/ui/index.js";
import { CivicLeafletMap } from "../../components/map/CivicLeafletMap.tsx";
import { useLiveSync } from "../../hooks/useLiveSync.ts";
import { getRapor, onJuryEvent } from "../../services/api.js";
import {
  mapRaporResponse,
  type RaporDinasCardView,
  type RaporViewModel,
} from "../../utils/ticketMappers.ts";

const KPI_TONE_CLASSES: Record<string, string> = {
  default: "text-fg",
  brand: "text-brand",
  error: "text-semantic-error",
  purple: "text-purple-800",
};

const FORMULA_SUMMARY =
  "Nilai awal mitra 80 (skala 0–100): Selesai tepat waktu +2 · Terlambat -3 (-6 jika ≥10 dukungan) · Eskalasi Pengawasan -5 · Tutup otomatis 72 jam = 0.";

function renderDinasBadges(dinas: RaporDinasCardView) {
  const warnings: Array<{
    key: string;
    variant: "warning" | "error";
    icon: "warn" | "siren";
    label: string;
  }> = [];

  if (dinas.rejectedSpamPct > 20) {
    warnings.push({
      key: "spam",
      variant: "warning",
      icon: "warn",
      label: `Sering Tolak Laporan > 20% (${dinas.rejectedSpamPct.toFixed(1)}%)`,
    });
  }
  if (dinas.outOfScopePct > 25) {
    warnings.push({
      key: "scope",
      variant: "warning",
      icon: "warn",
      label: `Sering Lempar Laporan > 25% (${dinas.outOfScopePct.toFixed(1)}%)`,
    });
  }
  if (dinas.isChronicOverdue) {
    warnings.push({
      key: "chronic",
      variant: "error",
      icon: "siren",
      label: "Terlambat Parah Aktif",
    });
  }

  if (warnings.length === 0) {
    return (
      <Badge
        variant="brand"
        size="sm"
        icon={<ShieldCheck className="size-3" aria-hidden="true" />}
      >
        Rasio Lempar &amp; Tolak Sehat
      </Badge>
    );
  }

  return warnings.map((warning) => (
    <Badge
      key={warning.key}
      variant={warning.variant}
      size="sm"
      icon={
        warning.icon === "siren" ? (
          <Siren className="size-3" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-3" aria-hidden="true" />
        )
      }
    >
      {warning.label}
    </Badge>
  ));
}

/**
 * Catatan (/catatan) — live `GET /api/rapor` plain-language board.
 */
export function WargaCatatanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [data, setData] = useState<RaporViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [showFormula, setShowFormula] = useState(false);
  const [activeClusterId, setActiveClusterId] = useState<string>("");

  const loadRapor = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const payload = await getRapor();
        setData(mapRaporResponse(payload));
      } catch (err) {
        if (!silent) setError(err);
        showToast({ type: "error", error: err });
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  const { syncLabel, markSynced } = useLiveSync({
    onRefresh: () => loadRapor({ silent: true }),
    intervalMs: 30_000,
    realtimeTable: "DepartmentRating",
  });

  useEffect(() => {
    loadRapor().then(markSynced).catch(() => {});
  }, [loadRapor]);

  useEffect(
    () => onJuryEvent("reset", () => loadRapor({ silent: true }).then(markSynced)),
    [loadRapor]
  );

  const profileLabel =
    user?.role === "ADMIN_DINAS"
      ? `Admin · ${user.departmentShortName || "Dinas"}`
      : user?.aliasName;

  const stats = data?.wargaKpiStats ?? [];
  const departments = data?.departments ?? [];
  const clusters = data?.clusters ?? [];
  const pendingValidationCount = data?.pendingValidationCount ?? 0;
  const activeCluster =
    clusters.find((cluster) => cluster.id === activeClusterId) || clusters[0] || null;

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <div className="hidden md:block">
        <TopNavbar profileLabel={profileLabel} />
      </div>
      <div className="md:hidden">
        <Header
          regionLabel="Sidoarjo • Surabaya"
          aliasName={user?.aliasName}
          onLoginClick={() => navigate("/login")}
        />
      </div>

      <main className="max-w-[1440px] w-full mx-auto flex-1 px-4 sm:px-6 lg:px-9 pt-[18px] pb-24 md:py-7 flex flex-col gap-5 md:gap-6">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="font-head font-bold text-[22px] leading-7 md:text-[30px] md:leading-9 text-fg">
              Catatan Kerja Dinas
            </h1>
            <p className="font-sans text-[13px] leading-[18px] md:text-sm md:leading-5 text-fg-muted">
              Transparansi penyelesaian laporan, rasio lempar/tolak, rating warga, dan nilai
              kerja layanan Surabaya dan Sidoarjo.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-fg-muted shrink-0">
            <span className="size-2 rounded-full bg-green-600" aria-hidden="true" />
            Sinkron {syncLabel}
          </span>
        </header>

        {loading && !data ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </>
        ) : error && !data ? (
          <Card className="text-center py-10 flex flex-col items-center gap-3">
            <h2 className="font-head font-semibold text-base text-fg">
              Catatan belum bisa dimuat
            </h2>
            <p className="font-sans text-sm text-fg-muted max-w-md">
              Periksa koneksi internet lalu muat ulang data rapor publik.
            </p>
            <Button variant="secondary" size="sm" onClick={() => void loadRapor()}>
              Coba Lagi
            </Button>
          </Card>
        ) : (
          <>
            <section
              aria-label="Ringkasan statistik rapor"
              className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4"
            >
              {stats.map((stat) => (
                <Card
                  key={stat.id}
                  density="none"
                  className="px-3.5 py-3 md:px-5 md:py-4 flex flex-col gap-0.5 md:gap-1"
                >
                  <span className="font-sans font-semibold text-xs leading-4 text-fg-muted">
                    {stat.label}
                  </span>
                  <span
                    className={[
                      "font-mono font-bold text-[22px] leading-7 md:text-[28px] md:leading-[34px] tabular-nums",
                      KPI_TONE_CLASSES[stat.valueTone] || "text-fg",
                    ].join(" ")}
                  >
                    {stat.value}
                  </span>
                  <span className="font-sans text-[11px] leading-[14px] md:text-xs md:leading-4 text-fg-muted">
                    {stat.meta}
                  </span>
                </Card>
              ))}
            </section>

            <section
              aria-label="Papan peringkat instansi mitra"
              className="flex flex-col gap-2.5 md:gap-3"
            >
              <div className="flex items-start md:items-center gap-2">
                <Award
                  className="size-[18px] md:size-5 text-brand shrink-0 mt-0.5 md:mt-0"
                  aria-hidden="true"
                />
                <h2 className="font-head font-semibold text-base leading-[22px] md:text-xl md:leading-7 text-fg">
                  Nilai Kerja Dinas (Awal 80)
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-4">
                {departments.map((dinas, index) => {
                  const isAmber = dinas.score < 75;
                  const metrics = [
                    { key: "Selesai Tepat", val: dinas.slaCompliance },
                    {
                      key: "Terlambat Parah",
                      val: dinas.chronicCount ? `${dinas.chronicCount} Kronis` : "0",
                    },
                    { key: "Dibantah", val: String(dinas.disputedCount ?? 0) },
                    { key: "Lempar Lain", val: `${dinas.outOfScopePct.toFixed(1)}%` },
                    { key: "Tolak Laporan", val: `${dinas.rejectedSpamPct.toFixed(1)}%` },
                  ];

                  return (
                    <Card
                      key={dinas.id}
                      density="none"
                      className={[
                        "p-3.5 md:p-4 flex flex-col gap-2.5",
                        dinas.isChronicOverdue ? "border-amber-200" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="size-[30px] rounded-lg bg-surface-2 flex items-center justify-center font-mono font-bold text-xs text-fg shrink-0">
                          #{index + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-head font-semibold text-sm leading-[18px] text-fg truncate">
                            {dinas.mobileName || dinas.name}
                          </h3>
                          <p className="font-sans text-[11px] leading-[14px] text-fg-muted truncate">
                            {dinas.scope}
                          </p>
                        </div>

                        <span
                          className={[
                            "rounded-[10px] px-2.5 py-1 font-mono font-bold text-lg leading-[22px] tabular-nums shrink-0",
                            isAmber
                              ? "bg-amber-50 text-amber-700"
                              : "bg-green-50 text-green-700",
                          ].join(" ")}
                        >
                          {dinas.score}
                        </span>
                      </div>

                      <div
                        className="w-full h-[7px] rounded-full bg-surface-2 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={dinas.score}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Nilai kerja ${dinas.mobileName || dinas.name}`}
                      >
                        <div
                          className={[
                            "h-full rounded-full transition-all",
                            isAmber ? "bg-amber-600" : "bg-green-600",
                          ].join(" ")}
                          style={{ width: `${dinas.score}%` }}
                        />
                      </div>

                      <div className="rounded-[10px] bg-bg border border-line px-2.5 py-2 grid grid-cols-5 gap-1.5">
                        {metrics.map((metric) => (
                          <div key={metric.key} className="flex flex-col gap-px min-w-0">
                            <span className="font-sans text-[10px] leading-[13px] text-fg-muted truncate">
                              {metric.key}
                            </span>
                            <span className="font-mono font-bold text-[11px] leading-[14px] text-fg tabular-nums truncate">
                              {metric.val}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {renderDinasBadges(dinas)}
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

              <div className="flex flex-col items-start gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  density="warga"
                  onClick={() => setShowFormula((value) => !value)}
                  aria-expanded={showFormula}
                  leftIcon={<Info className="size-4" aria-hidden="true" />}
                  className="!min-h-0 !h-auto !px-0 !py-0.5 text-semantic-info hover:text-semantic-info hover:bg-transparent font-semibold text-xs"
                >
                  Cara Hitung Nilai Kerja
                </Button>

                {showFormula && (
                  <div
                    role="note"
                    className="w-full rounded-xl bg-semantic-info-soft border border-sky-200 px-3.5 py-2.5 font-sans text-xs leading-[18px] text-semantic-info font-medium"
                  >
                    {FORMULA_SUMMARY}
                  </div>
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <section
                aria-label="Peta klaster rawan Sidoarjo Surabaya"
                className="lg:col-span-7 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-head font-semibold text-base leading-[22px] md:text-lg text-fg">
                    Peta Klaster Rawan Sidoarjo–Surabaya
                  </h2>
                  <span className="font-sans text-xs font-semibold text-brand">
                    {activeCluster
                      ? `${activeCluster.label}`
                      : "Belum ada titik pada filter ini"}
                  </span>
                </div>

                <div className="relative h-[250px] md:h-[300px] rounded-2xl border border-line overflow-hidden shadow-card">
                  <CivicLeafletMap
                    clusters={clusters.map((c) => ({
                      id: c.id,
                      label: c.label,
                      count: c.count,
                      lat: c.lat,
                      lng: c.lng,
                    }))}
                    selectedClusterId={activeCluster?.id ?? null}
                    onSelectCluster={setActiveClusterId}
                    ariaLabel="Peta klaster titik rawan Surabaya dan Sidoarjo"
                  />

                  {clusters.length === 0 && (
                    <div className="absolute inset-0 z-[400] flex items-center justify-center p-4 pointer-events-none">
                      <p className="rounded-xl bg-surface/95 border border-line px-3 py-2 text-xs font-medium text-fg-muted text-center shadow-card">
                        Belum ada titik kerusakan pada filter ini.
                      </p>
                    </div>
                  )}

                  <div className="absolute left-2.5 bottom-2.5 z-[400] rounded-[10px] bg-surface/95 border border-line px-2.5 py-1.5 flex items-center gap-1.5 shadow-card">
                    <span className="font-sans font-medium text-[9px] leading-3 text-fg-muted">
                      Rendah
                    </span>
                    <span
                      className="w-[72px] h-2 rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, #14B8A6 0%, #FACC15 55%, #DC2626 100%)",
                      }}
                      aria-hidden="true"
                    />
                    <span className="font-sans font-bold text-[9px] leading-3 text-semantic-error">
                      Rawan Tinggi
                    </span>
                  </div>
                </div>
              </section>

              <div className="lg:col-span-5 flex flex-col justify-end">
                <Card
                  tone="secondary"
                  density="none"
                  className="p-4 md:p-5 flex flex-col gap-2.5 h-full justify-between"
                >
                  <div className="flex flex-col gap-2">
                    <h2 className="font-head font-bold text-base leading-[22px] md:text-lg text-fg">
                      {pendingValidationCount} Tiket Menunggu Cek Warga
                    </h2>
                    <p className="font-sans text-[13px] leading-[18px] md:text-sm text-fg-muted">
                      Bantu verifikasi foto perbaikan dinas di sekitarmu agar
                      klaim selesai tidak palsu dan naikkan Trust Score (+0.1).
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => navigate("/peta")}
                    className="w-full"
                  >
                    Kawal di Peta Utama
                  </Button>
                </Card>
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNavbar activeTab="rapor" />
    </div>
  );
}

export default WargaCatatanPage;
