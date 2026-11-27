import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronDown,
  Clock,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Search,
  Send,
  ThumbsUp,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { TopNavbar, DinasSidebar } from "../../components/layout/index.ts";
import type { DinasQueueFilterKey } from "../../components/layout/index.ts";
import { DinasActionModal } from "../../components/dinas/index.ts";
import {
  Badge,
  Button,
  Card,
  Input,
  MapSkeleton,
  Skeleton,
  useToast,
} from "../../components/ui/index.js";
import {
  getRapor,
  getTicketDetail,
  getTicketMediaSignedUrl,
  listDinasTickets,
  onJuryEvent,
} from "../../services/api.js";
import {
  computeDinasQueueCounts,
  mapDinasTicketsToRows,
  mapRaporResponse,
  projectCoordToMapPercent,
} from "../../utils/ticketMappers.ts";
import type {
  DinasTicketViewRow,
  RaporViewModel,
  TicketActionItem,
} from "../../utils/ticketMappers.ts";
import { CATEGORIES, TICKET_STATUSES } from "../../constants/designTokens.js";

interface DinasMapPin extends DinasTicketViewRow {
  mapX: number;
  mapY: number;
}

interface TicketDetailView {
  id: string;
  description?: string;
  categoryLabel?: string;
  publicLat?: number;
  publicLng?: number;
  reporterAlias?: string;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  isNsfwPendingReview?: boolean;
  isLowQualityOverride?: boolean;
  supportCount?: number;
}

const SLA_CHIP_STYLES: Record<DinasTicketViewRow["slaTone"], string> = {
  overdue: "bg-red-50 border-red-200 text-semantic-error",
  disputed: "bg-purple-50 border-purple-200 text-purple-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  normal: "bg-surface-2 border-line text-fg",
  muted: "bg-surface-2 border-line text-fg-muted",
};

const LEGEND_STATUSES = ["OVERDUE", "ESCALATED", "DISPUTED", "IN_PROGRESS", "OPEN"];

/**
 * Peta Laporan Dinas (/dinas/peta) — live projected pins, inspector and actions.
 */
export function DinasPetaPage() {
  const { user, accessToken, isJuryMode } = useAuth();
  const { showToast } = useToast();

  const [rows, setRows] = useState<DinasTicketViewRow[]>([]);
  const [rapor, setRapor] = useState<RaporViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [activeFilter, setActiveFilter] = useState<DinasQueueFilterKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [detail, setDetail] = useState<TicketDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [revealedPhotoUrl, setRevealedPhotoUrl] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{
    ticket: DinasTicketViewRow;
    action: TicketActionItem;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [ticketPayload, raporPayload] = await Promise.all([
        listDinasTickets({}, accessToken),
        getRapor(),
      ]);
      const mapped = mapDinasTicketsToRows(ticketPayload);
      setRows(mapped);
      setRapor(mapRaporResponse(raporPayload));
      setSelectedPinId((current) => current || mapped[0]?.id || null);
    } catch (err) {
      setError(err);
      showToast({ type: "error", error: err });
    } finally {
      setLoading(false);
    }
  }, [user, accessToken, showToast]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, loadData]);

  useEffect(
    () => onJuryEvent("reset", () => loadData()),
    [loadData]
  );

  const pins: DinasMapPin[] = useMemo(
    () =>
      rows.map((row) => {
        const { mapX, mapY } = projectCoordToMapPercent(
          row.publicLat ?? Number.NaN,
          row.publicLng ?? Number.NaN
        );
        return { ...row, mapX, mapY };
      }),
    [rows]
  );

  const categoryOptions = useMemo(() => {
    const countsByCategory = new Map<string, number>();
    for (const row of rows) {
      countsByCategory.set(row.category, (countsByCategory.get(row.category) || 0) + 1);
    }
    const present = CATEGORIES.filter((category: { code: string }) =>
      countsByCategory.has(category.code)
    ).map((category: { code: string; label: string }) => ({
      code: category.code,
      label: `${category.label} (${countsByCategory.get(category.code) || 0})`,
    }));
    return [
      { code: "ALL", label: `Kategori: Semua (${rows.length})` },
      ...present,
    ];
  }, [rows]);

  const visiblePins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return pins.filter((pin) => {
      if (activeFilter !== "ALL" && pin.status !== activeFilter) return false;
      if (categoryFilter !== "ALL" && pin.category !== categoryFilter) return false;
      if (!query) return true;
      return (
        pin.displayCode.toLowerCase().includes(query) ||
        pin.code.toLowerCase().includes(query) ||
        pin.categoryTitle.toLowerCase().includes(query) ||
        pin.location.toLowerCase().includes(query)
      );
    });
  }, [pins, activeFilter, categoryFilter, searchQuery]);

  const selectedPin =
    selectedPinId === null
      ? null
      : visiblePins.find((pin) => pin.id === selectedPinId) || visiblePins[0] || null;

  const clusters = useMemo(() => {
    if (visiblePins.length === 0) return [];
    const mapped = mapRaporResponse({
      departments: [],
      clusterPoints: visiblePins.map((pin) => ({
        id: pin.id,
        category: pin.category,
        status: pin.status,
        lat: pin.publicLat ?? Number.NaN,
        lng: pin.publicLng ?? Number.NaN,
      })),
    });
    return mapped.clusters.filter((cluster) => cluster.count >= 2).slice(0, 3);
  }, [visiblePins]);

  useEffect(() => {
    setRevealedPhotoUrl(null);
    setDetail(null);
  }, [selectedPin?.id]);

  useEffect(() => {
    if (!selectedPin) {
      setDetail(null);
      return undefined;
    }
    let cancelled = false;
    setDetailLoading(true);
    getTicketDetail(selectedPin.id, {}, accessToken)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((err) => {
        if (!cancelled) showToast({ type: "error", error: err });
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPin, accessToken, detailRefresh, showToast]);

  const counts = useMemo(() => computeDinasQueueCounts(rows), [rows]);
  const departmentName = user?.departmentName || "Dinas PU Bina Marga & Pematusan";
  const profileLabel = user?.departmentShortName
    ? `Admin · ${user.departmentShortName}`
    : "Admin · Dinas";

  const primaryAction = selectedPin?.actions[0];
  const secondaryActions = selectedPin?.actions.slice(1) ?? [];

  const handleRevealPhoto = async () => {
    if (!selectedPin) return;
    setRevealing(true);
    try {
      const media = await getTicketMediaSignedUrl(
        selectedPin.id,
        "before",
        accessToken
      );
      setRevealedPhotoUrl(media.signedUrl);
    } catch (err) {
      showToast({ type: "error", error: err });
    } finally {
      setRevealing(false);
    }
  };

  const handleAction = (
    ticket: DinasTicketViewRow,
    action: TicketActionItem
  ) => {
    if (action.disabled) {
      showToast({
        type: "warning",
        title: "Aksi terkunci",
        message: action.disabledReason || "Aksi ini belum tersedia untuk tiket tersebut.",
      });
      return;
    }
    setSelectedAction({ ticket, action });
  };

  const activeCount = rows.filter(
    (row) => !TICKET_STATUSES[row.status]?.terminal
  ).length;

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <TopNavbar profileLabel={profileLabel} />

      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
        <DinasSidebar
          departmentName={departmentName}
          regionLabel="Kota Surabaya & Kab. Sidoarjo"
          isVerifiedPartner
          integrityScore={
            rapor?.departments.find((department) => department.id === user?.departmentId)
              ?.score ?? 80
          }
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={counts}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
          <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="font-head font-bold text-2xl md:text-[30px] md:leading-9 text-fg">
                Peta Sebaran Laporan Wilayah
              </h1>
              <p className="font-sans text-sm leading-5 text-fg-muted">
                {departmentName} · {activeCount} titik aktif · {rows.length} total
                tiket
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
              <Input
                density="dinas"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari jalan, kecamatan, atau #ID..."
                aria-label="Cari jalan, kecamatan, atau ID tiket"
                leftIcon={<Search className="size-4" />}
                wrapperClassName="w-full sm:w-[250px]"
                className="min-h-11"
              />

              <div className="relative w-full sm:w-[260px]">
                <select
                  aria-label="Filter kategori wewenang dinas"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full min-h-11 appearance-none rounded-xl border-[1.5px] border-brand bg-surface pl-3.5 pr-10 font-sans font-semibold text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg cursor-pointer"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.code} value={category.code}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none size-4 text-brand absolute right-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
              </div>
            </div>
          </header>

          <div className="flex flex-col xl:flex-row items-stretch gap-5 flex-1">
            <section
              aria-label="Kanvas peta laporan wilayah Surabaya dan Sidoarjo"
              className="relative flex-1 min-h-[460px] xl:min-h-[700px] rounded-2xl border border-line bg-[#EDF2EA] overflow-hidden select-none"
            >
              {loading ? (
                <MapSkeleton className="h-full min-h-[460px] rounded-none border-0" />
              ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <Card className="max-w-md text-center flex flex-col items-center gap-3">
                    <h2 className="font-head font-semibold text-base text-fg">
                      Peta laporan dinas belum bisa dimuat
                    </h2>
                    <p className="font-sans text-sm text-fg-muted">
                      Periksa koneksi internet lalu muat ulang antrean.
                    </p>
                    <Button variant="secondary" size="sm" onClick={loadData}>
                      Muat Ulang
                    </Button>
                  </Card>
                </div>
              ) : (
                <>
                  <div
                    className="absolute inset-0 transition-transform duration-200 ease-out motion-reduce:transition-none origin-center"
                    style={{ transform: `scale(${zoomScale})` }}
                  >
                    <svg
                      viewBox="0 0 1000 740"
                      preserveAspectRatio="none"
                      className="absolute inset-0 size-full pointer-events-none"
                      aria-hidden="true"
                    >
                      <path d="M540 -40 L640 780" stroke="#CFE4F5" strokeWidth="44" fill="none" />
                      <rect x="230" y="180" width="150" height="90" rx="18" fill="#DCEAD3" />
                      <rect x="560" y="490" width="170" height="100" rx="20" fill="#DCEAD3" />
                      <line x1="-20" y1="330" x2="1020" y2="290" stroke="#FFFFFF" strokeWidth="12" />
                      <line x1="140" y1="465" x2="880" y2="495" stroke="#FFFFFF" strokeWidth="10" />
                      <line x1="360" y1="-20" x2="310" y2="760" stroke="#FFFFFF" strokeWidth="12" />
                      <line x1="650" y1="10" x2="620" y2="750" stroke="#FFFFFF" strokeWidth="10" />
                      <line x1="40" y1="145" x2="900" y2="200" stroke="#FFFFFF" strokeWidth="8" />
                      <polygon
                        points="290,75 680,75 860,355 680,635 290,635 110,355"
                        fill="rgba(15, 118, 110, 0.08)"
                        stroke="#0F766E"
                        strokeOpacity="0.85"
                        strokeWidth="2"
                        strokeDasharray="8 6"
                      />
                    </svg>

                    <span className="absolute left-[32%] top-[13%] font-mono font-bold text-[10px] text-slate-500/80 pointer-events-none">
                      SURABAYA PUSAT
                    </span>
                    <span className="absolute left-[17%] top-[47%] font-mono font-bold text-[10px] text-slate-500/80 pointer-events-none">
                      SURABAYA SELATAN · GAYUNGAN
                    </span>
                    <span className="absolute left-[71%] top-[36%] font-mono font-bold text-[10px] text-slate-500/80 pointer-events-none">
                      RUNGKUT
                    </span>
                    <span className="absolute left-[48%] top-[73%] font-mono font-bold text-[10px] text-slate-500/80 pointer-events-none">
                      WARU · SIDOARJO
                    </span>

                    <div className="absolute left-[16%] top-[12%] inline-flex items-center rounded-full bg-surface/95 border border-brand px-2.5 py-1 shadow-sm pointer-events-none">
                      <span className="font-mono font-bold text-[10px] leading-[14px] text-brand">
                        Poligon Layanan Surabaya &amp; Sidoarjo
                      </span>
                    </div>

                    {clusters.map((cluster) => (
                      <button
                        key={cluster.id}
                        type="button"
                        onClick={() =>
                          setZoomScale((zoom) =>
                            Math.min(1.4, Number((zoom + 0.15).toFixed(2)))
                          )
                        }
                        title={cluster.label}
                        aria-label={`Klaster ${cluster.label}`}
                        style={{
                          left: `${cluster.mapX}%`,
                          top: `${cluster.mapY}%`,
                          width: `${cluster.sizePx}px`,
                          height: `${cluster.sizePx}px`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand text-brand-fg border-[3px] border-surface shadow-elevated flex items-center justify-center font-mono font-bold text-sm hover:scale-105 transition duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                      >
                        {cluster.count}
                      </button>
                    ))}

                    {visiblePins.map((pin) => {
                      const isSelected = selectedPin?.id === pin.id;
                      const status = TICKET_STATUSES[pin.status] || TICKET_STATUSES.OPEN;
                      const PinIcon = status.Icon;
                      return (
                        <button
                          key={pin.id}
                          type="button"
                          onClick={() => setSelectedPinId(pin.id)}
                          aria-label={`${pin.displayCode} ${pin.categoryTitle}`}
                          aria-pressed={isSelected}
                          style={{
                            left: `${pin.mapX}%`,
                            top: `${pin.mapY}%`,
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer focus-visible:outline-none"
                        >
                          {(pin.status === "OVERDUE" || isSelected) && (
                            <span
                              aria-hidden="true"
                              className={[
                                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                                isSelected
                                  ? "size-[60px] bg-brand/20 border-2 border-brand/60"
                                  : "size-12 bg-red-600/20 border border-red-600/50 animate-pulse motion-reduce:animate-none",
                              ].join(" ")}
                            />
                          )}
                          <span
                            style={{ backgroundColor: status.pinHex }}
                            className={[
                              "relative rounded-full flex items-center justify-center text-white shadow-md transition-transform duration-150",
                              isSelected
                                ? "size-[38px] border-[3px] border-brand scale-110"
                                : "size-8 border-2 border-surface group-hover:scale-110",
                            ].join(" ")}
                          >
                            <PinIcon
                              className={isSelected ? "size-[18px]" : "size-[15px]"}
                              aria-hidden="true"
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-0.5 rounded-xl bg-surface border border-line p-1 shadow-card">
                    <button
                      type="button"
                      aria-label="Perbesar peta"
                      onClick={() =>
                        setZoomScale((zoom) =>
                          Math.min(1.4, Number((zoom + 0.15).toFixed(2)))
                        )
                      }
                      className="size-[34px] rounded-lg flex items-center justify-center text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Perkecil peta"
                      onClick={() =>
                        setZoomScale((zoom) =>
                          Math.max(0.85, Number((zoom - 0.15).toFixed(2)))
                        )
                      }
                      className="size-[34px] rounded-lg flex items-center justify-center text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Reset posisi peta"
                      onClick={() => setZoomScale(1)}
                      className="size-[34px] rounded-lg flex items-center justify-center text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                    >
                      <LocateFixed className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="absolute bottom-4 left-4 z-10 max-w-[350px] rounded-[14px] bg-surface/95 border border-line px-3.5 py-3 shadow-popover">
                    <p className="font-mono font-bold text-[10px] leading-[14px] text-fg-muted mb-2">
                      LEGENDA PETA &amp; STATUS
                    </p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {LEGEND_STATUSES.map((statusCode) => {
                        const status = TICKET_STATUSES[statusCode];
                        return (
                          <div
                            key={statusCode}
                            className="inline-flex items-center gap-1.5 min-w-0"
                          >
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: status.pinHex }}
                              aria-hidden="true"
                            />
                            <span className="font-sans text-xs leading-4 text-fg truncate">
                              {status.label}
                            </span>
                          </div>
                        );
                      })}
                      <div className="inline-flex items-center gap-1.5 min-w-0">
                        <span
                          className="size-2.5 rounded-full shrink-0 bg-brand"
                          aria-hidden="true"
                        />
                        <span className="font-sans text-xs leading-4 text-fg truncate">
                          Klaster Area
                        </span>
                      </div>
                    </div>
                  </div>

                  {!loading && visiblePins.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                      <Card className="max-w-sm text-center flex flex-col items-center gap-2">
                        <h2 className="font-head font-semibold text-base text-fg">
                          Tidak ada pin pada filter ini
                        </h2>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setActiveFilter("ALL");
                            setCategoryFilter("ALL");
                            setSearchQuery("");
                          }}
                        >
                          Reset Filter
                        </Button>
                      </Card>
                    </div>
                  )}
                </>
              )}
            </section>

            {selectedPin ? (
              <aside
                aria-label="Panel inspektur tiket terpilih"
                className="w-full xl:w-[400px] shrink-0"
              >
                <Card
                  density="none"
                  className="p-5 !border-[1.5px] !border-brand !shadow-elevated flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge status={selectedPin.status} />
                        <Badge status={selectedPin.tier} size="sm" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPinId(null)}
                        aria-label="Tutup panel inspektur"
                        className="size-[30px] rounded-lg bg-bg border border-line flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer shrink-0"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>

                    <p className="font-mono font-medium text-[11px] leading-4 text-fg-muted">
                      {selectedPin.displayCode} · Pin Dipilih di Peta
                    </p>

                    <h2 className="font-head font-semibold text-lg leading-6 text-fg">
                      {selectedPin.categoryTitle}
                    </h2>

                    <p className="inline-flex items-start gap-1.5 font-sans text-sm leading-5 text-fg-muted">
                      <MapPin className="size-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{selectedPin.location}</span>
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5",
                          "font-mono font-bold text-xs leading-4 tabular-nums",
                          SLA_CHIP_STYLES[selectedPin.slaTone],
                        ].join(" ")}
                      >
                        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{selectedPin.slaText}</span>
                      </span>

                      <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-surface-2 px-2.5 py-1.5 font-sans font-semibold text-xs leading-4 text-fg">
                        <ThumbsUp className="size-3.5 text-brand shrink-0" aria-hidden="true" />
                        <span>{selectedPin.supportCount} Dukungan</span>
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-bg border border-line p-3 flex flex-col gap-2.5">
                    {detailLoading ? (
                      <Skeleton className="h-[175px] w-full" />
                    ) : revealedPhotoUrl || detail?.beforePhotoUrl ? (
                      <img
                        src={revealedPhotoUrl || detail?.beforePhotoUrl || ""}
                        alt={`Foto laporan ${selectedPin.categoryTitle}`}
                        className="h-[175px] w-full rounded-[10px] object-cover border border-line"
                      />
                    ) : detail?.isNsfwPendingReview ? (
                      <div className="relative h-[175px] w-full rounded-[10px] bg-gradient-to-br from-slate-600 to-slate-800 flex flex-col items-center justify-center gap-2 text-center p-3">
                        <span className="font-sans text-xs font-semibold text-slate-200">
                          Foto disamarkan (sedang ditinjau)
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={revealing}
                          onClick={handleRevealPhoto}
                        >
                          Tampilkan Gambar
                        </Button>
                      </div>
                    ) : (
                      <div className="h-[175px] w-full rounded-[10px] bg-gradient-to-br from-[#175C59] to-[#0F172A] flex items-end p-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 font-mono font-medium text-[10px] leading-[14px] text-slate-100">
                          <Camera className="size-3 text-[#2DD4BF] shrink-0" aria-hidden="true" />
                          <span>Foto lapangan belum tersedia</span>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium text-[11px] leading-4 text-brand tabular-nums">
                        {detail?.publicLat != null && detail?.publicLng != null
                          ? `${Number(detail.publicLat).toFixed(4)}, ${Number(detail.publicLng).toFixed(4)}`
                          : selectedPin.publicCoords || "Koordinat disamarkan"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface border border-line px-2 py-[3px] font-mono font-medium text-[10px] leading-[14px] text-fg-muted">
                        <User className="size-[11px]" aria-hidden="true" />
                        <span>{detail?.reporterAlias || selectedPin.reporterAlias}</span>
                      </span>
                    </div>

                    <p className="font-sans text-sm leading-5 text-fg">
                      {detail?.description || selectedPin.description || "Belum ada catatan tambahan dari pelapor."}
                    </p>
                  </div>

                  <hr className="border-line" />

                  <div className="flex flex-col gap-2.5">
                    <span className="font-mono font-bold text-[10px] leading-[14px] text-fg-muted tracking-wide">
                      AKSI DINAS LANGSUNG
                    </span>

                    {primaryAction && (
                      <Button
                        variant={primaryAction.variant}
                        size="md"
                        disabled={primaryAction.disabled}
                        leftIcon={<Send className="size-4" />}
                        onClick={() => handleAction(selectedPin, primaryAction)}
                        className="w-full"
                      >
                        {primaryAction.label}
                      </Button>
                    )}

                    {secondaryActions.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {secondaryActions.map((action) => (
                          <Button
                            key={action.id}
                            variant={action.variant}
                            size="sm"
                            disabled={action.disabled}
                            onClick={() => handleAction(selectedPin, action)}
                            className="w-full"
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    {selectedPin.actions.length === 0 && (
                      <p className="font-sans text-xs leading-4 text-fg-muted">
                        Tidak ada aksi yang tersedia untuk status tiket ini.
                      </p>
                    )}

                    {selectedPin.actions
                      .filter((action) => action.disabled && action.disabledReason)
                      .map((action) => (
                        <p
                          key={`${action.id}-reason`}
                          className="font-sans text-xs leading-4 text-fg-muted"
                        >
                          {action.disabledReason}
                        </p>
                      ))}
                  </div>
                </Card>
              </aside>
            ) : (
              <aside className="w-full xl:w-[400px] shrink-0">
                <Card className="text-center py-10 flex flex-col items-center gap-2.5">
                  <MapPin className="size-8 text-brand" aria-hidden="true" />
                  <h2 className="font-head font-semibold text-base text-fg">
                    Pilih Pin Laporan di Peta
                  </h2>
                  <p className="font-sans text-sm text-fg-muted">
                    Klik salah satu pin status di kanvas peta untuk melihat foto
                    bukti live, koordinat publik, dan tombol aksi dinas.
                  </p>
                </Card>
              </aside>
            )}
          </div>
        </main>
      </div>

      <DinasActionModal
        open={Boolean(selectedAction)}
        ticket={selectedAction?.ticket ?? null}
        action={selectedAction?.action ?? null}
        currentDepartmentId={user?.departmentId}
        accessToken={accessToken}
        isJuryMode={isJuryMode}
        onClose={() => setSelectedAction(null)}
        onSuccess={() => {
          loadData();
          setDetailRefresh((value) => value + 1);
        }}
      />
    </div>
  );
}

export default DinasPetaPage;
