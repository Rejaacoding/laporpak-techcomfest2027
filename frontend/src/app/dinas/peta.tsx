import { useMemo, useState } from "react";
import {
  AlarmClock,
  Camera,
  ChevronDown,
  CircleDot,
  Clock,
  LocateFixed,
  MapPin,
  MessageSquareWarning,
  Minus,
  Plus,
  Scale,
  Search,
  Send,
  Siren,
  ThumbsUp,
  User,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { TopNavbar, DinasSidebar } from "../../components/layout/index.ts";
import type { DinasQueueFilterKey } from "../../components/layout/index.ts";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  useToast,
} from "../../components/ui/index.js";
import {
  DINAS_DEPARTMENT_META,
  DINAS_MAP_CLUSTERS,
  DINAS_MAP_PINS,
  DINAS_PU_CATEGORIES,
  DINAS_QUEUE_COUNTS,
  MAP_LEGEND_ITEMS,
} from "../../data/mockTickets.ts";
import type {
  DinasMapPin,
  TicketActionItem,
  TicketStatusCode,
} from "../../data/mockTickets.ts";

const PIN_STYLE: Record<
  TicketStatusCode,
  { bgClass: string; Icon: LucideIcon }
> = {
  OVERDUE: { bgClass: "bg-[#DC2626]", Icon: AlarmClock },
  ESCALATED: { bgClass: "bg-[#7F1D1D]", Icon: Siren },
  DISPUTED: { bgClass: "bg-[#9333EA]", Icon: MessageSquareWarning },
  OPEN: { bgClass: "bg-[#2563EB]", Icon: CircleDot },
  IN_PROGRESS: { bgClass: "bg-[#EAB308]", Icon: Wrench },
  PENDING_VALIDATION: { bgClass: "bg-[#F97316]", Icon: Scale },
  CLOSED: { bgClass: "bg-[#16A34A]", Icon: CircleDot },
  AUTO_CLOSED: { bgClass: "bg-[#86EFAC]", Icon: Clock },
  OUT_OF_SCOPE: { bgClass: "bg-[#9CA3AF]", Icon: CircleDot },
  REJECTED_SPAM: { bgClass: "bg-[#4B5563]", Icon: CircleDot },
};

const SLA_CHIP_STYLES: Record<DinasMapPin["slaTone"], string> = {
  overdue: "bg-red-50 border-red-200 text-semantic-error",
  disputed: "bg-purple-50 border-purple-200 text-purple-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  normal: "bg-surface-2 border-line text-fg",
  muted: "bg-surface-2 border-line text-fg-muted",
};

/**
 * Peta Laporan Dinas (/dinas/peta) — sliced from Figma "07 — Peta Laporan (/peta)"
 * Uses TopNavbar, DinasSidebar, interactive map canvas (pins, clusters, geofence polygon,
 * floating legend, zoom controls), and slide-over Ticket Inspector panel.
 */
export function DinasPetaPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeFilter, setActiveFilter] = useState<DinasQueueFilterKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryGroup, setCategoryGroup] =
    useState<DinasMapPin["categoryGroup"]>("Semua");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(
    DINAS_MAP_PINS[0].id
  );
  const [zoomScale, setZoomScale] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    pin: DinasMapPin;
    action: TicketActionItem;
  } | null>(null);

  const visiblePins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return DINAS_MAP_PINS.filter((pin) => {
      if (activeFilter !== "ALL" && pin.status !== activeFilter) return false;
      if (categoryGroup !== "Semua" && pin.categoryGroup !== categoryGroup) {
        return false;
      }
      if (!q) return true;
      return (
        pin.id.toLowerCase().includes(q) ||
        pin.categoryTitle.toLowerCase().includes(q) ||
        pin.location.toLowerCase().includes(q)
      );
    });
  }, [activeFilter, categoryGroup, searchQuery]);

  const selectedPin = useMemo(() => {
    if (!selectedPinId) return null;
    return (
      visiblePins.find((p) => p.id === selectedPinId) ||
      visiblePins[0] ||
      null
    );
  }, [selectedPinId, visiblePins]);

  const departmentName =
    user?.departmentName || DINAS_DEPARTMENT_META.departmentName;
  const profileLabel = user?.departmentShortName
    ? `Admin · ${user.departmentShortName}`
    : `Admin · ${DINAS_DEPARTMENT_META.departmentShortName}`;

  const primaryAction = selectedPin?.actions[0];
  const secondaryActions = selectedPin?.actions.slice(1) ?? [];

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    showToast({
      type: "success",
      title: `${confirmAction.action.label} diproses`,
      message: `${confirmAction.pin.id} (${confirmAction.pin.categoryTitle}) berhasil diperbarui.`,
    });
    setConfirmAction(null);
  };

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col">
      <TopNavbar profileLabel={profileLabel} />

      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
        <DinasSidebar
          departmentName={departmentName}
          regionLabel={DINAS_DEPARTMENT_META.regionLabel}
          isVerifiedPartner={DINAS_DEPARTMENT_META.isVerifiedPartner}
          integrityScore={DINAS_DEPARTMENT_META.integrityScore}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={DINAS_QUEUE_COUNTS}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
          {/* Toolbar / Header & Filters */}
          <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="font-head font-bold text-2xl md:text-[30px] md:leading-9 text-fg">
                Peta Sebaran Laporan Wilayah
              </h1>
              <p className="font-sans text-sm leading-5 text-fg-muted">
                {departmentName} · Wilayah Layanan{" "}
                {DINAS_DEPARTMENT_META.regionLabel} · 42 Titik Aktif
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
              <Input
                density="dinas"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari jalan, kecamatan, atau #ID..."
                aria-label="Cari jalan, kecamatan, atau ID tiket"
                leftIcon={<Search className="size-4" />}
                wrapperClassName="w-full sm:w-[250px]"
                className="min-h-11"
              />

              <div className="relative w-full sm:w-[260px]">
                <select
                  aria-label="Filter kategori wewenang dinas"
                  value={categoryGroup}
                  onChange={(e) =>
                    setCategoryGroup(
                      e.target.value as DinasMapPin["categoryGroup"]
                    )
                  }
                  className="w-full min-h-11 appearance-none rounded-xl border-[1.5px] border-brand bg-surface pl-3.5 pr-10 font-sans font-semibold text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg cursor-pointer"
                >
                  {DINAS_PU_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
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

          {/* Split View: Interactive Map Canvas (Left) + Slide-Over Inspector Panel (Right) */}
          <div className="flex flex-col xl:flex-row items-stretch gap-5 flex-1">
            {/* Map Canvas */}
            <section
              aria-label="Kanvas peta laporan wilayah Surabaya dan Sidoarjo"
              className="relative flex-1 min-h-[460px] xl:min-h-[700px] rounded-2xl border border-line bg-[#EDF2EA] overflow-hidden select-none"
            >
              {/* Zoomable Geography Layer */}
              <div
                className="absolute inset-0 transition-transform duration-200 ease-out motion-reduce:transition-none origin-center"
                style={{ transform: `scale(${zoomScale})` }}
              >
                {/* Dummy Surabaya & Sidoarjo Geography SVG */}
                <svg
                  viewBox="0 0 1000 740"
                  preserveAspectRatio="none"
                  className="absolute inset-0 size-full pointer-events-none"
                  aria-hidden="true"
                >
                  {/* Kali Mas River */}
                  <path
                    d="M540 -40 L640 780"
                    stroke="#CFE4F5"
                    strokeWidth="44"
                    fill="none"
                  />
                  {/* Parks */}
                  <rect
                    x="230"
                    y="180"
                    width="150"
                    height="90"
                    rx="18"
                    fill="#DCEAD3"
                  />
                  <rect
                    x="560"
                    y="490"
                    width="170"
                    height="100"
                    rx="20"
                    fill="#DCEAD3"
                  />
                  {/* Major Roads */}
                  <line
                    x1="-20"
                    y1="330"
                    x2="1020"
                    y2="290"
                    stroke="#FFFFFF"
                    strokeWidth="12"
                  />
                  <line
                    x1="140"
                    y1="465"
                    x2="880"
                    y2="495"
                    stroke="#FFFFFF"
                    strokeWidth="10"
                  />
                  <line
                    x1="360"
                    y1="-20"
                    x2="310"
                    y2="760"
                    stroke="#FFFFFF"
                    strokeWidth="12"
                  />
                  <line
                    x1="650"
                    y1="10"
                    x2="620"
                    y2="750"
                    stroke="#FFFFFF"
                    strokeWidth="10"
                  />
                  <line
                    x1="40"
                    y1="145"
                    x2="900"
                    y2="200"
                    stroke="#FFFFFF"
                    strokeWidth="8"
                  />
                  {/* Poligon Batas Wilayah Surabaya-Sidoarjo */}
                  <polygon
                    points="290,75 680,75 860,355 680,635 290,635 110,355"
                    fill="rgba(15, 118, 110, 0.08)"
                    stroke="#0F766E"
                    strokeOpacity="0.85"
                    strokeWidth="2"
                    strokeDasharray="8 6"
                  />
                </svg>

                {/* District Labels */}
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

                {/* Geofence Badge */}
                <div className="absolute left-[16%] top-[12%] inline-flex items-center rounded-full bg-surface/95 border border-brand px-2.5 py-1 shadow-sm pointer-events-none">
                  <span className="font-mono font-bold text-[10px] leading-[14px] text-brand">
                    Poligon Layanan Surabaya &amp; Sidoarjo
                  </span>
                </div>

                {/* Cluster Markers */}
                {DINAS_MAP_CLUSTERS.map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    onClick={() =>
                      setZoomScale((z) => Math.min(1.4, Number((z + 0.15).toFixed(2))))
                    }
                    title={`Klaster ${cluster.label}: ${cluster.count} tiket`}
                    aria-label={`Klaster ${cluster.label} berisi ${cluster.count} tiket`}
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

                {/* Interactive Status Pins */}
                {visiblePins.map((pin) => {
                  const isSelected = selectedPin?.id === pin.id;
                  const styleCfg = PIN_STYLE[pin.status] || PIN_STYLE.OPEN;
                  const PinIcon = styleCfg.Icon;

                  return (
                    <button
                      key={pin.id}
                      type="button"
                      onClick={() => setSelectedPinId(pin.id)}
                      aria-label={`${pin.id} ${pin.categoryTitle}`}
                      aria-pressed={isSelected}
                      style={{
                        left: `${pin.mapX}%`,
                        top: `${pin.mapY}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer focus-visible:outline-none"
                    >
                      {(pin.critical || isSelected) && (
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
                        className={[
                          "relative rounded-full flex items-center justify-center text-white shadow-md transition-transform duration-150",
                          styleCfg.bgClass,
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

              {/* Map Zoom Controls (Top Right) */}
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-0.5 rounded-xl bg-surface border border-line p-1 shadow-card">
                <button
                  type="button"
                  aria-label="Perbesar peta"
                  onClick={() =>
                    setZoomScale((z) => Math.min(1.4, Number((z + 0.15).toFixed(2))))
                  }
                  className="size-[34px] rounded-lg flex items-center justify-center text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Perkecil peta"
                  onClick={() =>
                    setZoomScale((z) => Math.max(0.85, Number((z - 0.15).toFixed(2))))
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

              {/* Floating Map Legend (Bottom Left) */}
              <div className="absolute bottom-4 left-4 z-10 max-w-[350px] rounded-[14px] bg-surface/95 border border-line px-3.5 py-3 shadow-popover">
                <p className="font-mono font-bold text-[10px] leading-[14px] text-fg-muted mb-2">
                  LEGENDA PETA &amp; STATUS
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {MAP_LEGEND_ITEMS.map((item) => (
                    <div
                      key={item.label}
                      className="inline-flex items-center gap-1.5 min-w-0"
                    >
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.colorHex }}
                        aria-hidden="true"
                      />
                      <span className="font-sans text-xs leading-4 text-fg truncate">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Right: Slide-Over Panel Inspektur Tiket (400px on xl) */}
            {selectedPin ? (
              <aside
                aria-label="Panel inspektur tiket terpilih"
                className="w-full xl:w-[400px] shrink-0"
              >
                <Card
                  density="none"
                  className="p-5 !border-[1.5px] !border-brand !shadow-elevated flex flex-col gap-4"
                >
                  {/* a. Header Kartu */}
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
                      {selectedPin.id} · Pin Dipilih di Peta
                    </p>

                    <h2 className="font-head font-semibold text-lg leading-6 text-fg">
                      {selectedPin.categoryTitle}
                    </h2>

                    <p className="inline-flex items-start gap-1.5 font-sans text-sm leading-5 text-fg-muted">
                      <MapPin
                        className="size-3.5 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
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
                        <ThumbsUp
                          className="size-3.5 text-brand shrink-0"
                          aria-hidden="true"
                        />
                        <span>{selectedPin.supportCount} Dukungan</span>
                      </span>
                    </div>
                  </div>

                  {/* b. Bukti Visual & Koordinat */}
                  <div className="rounded-xl bg-bg border border-line p-3 flex flex-col gap-2.5">
                    <div className="relative h-[175px] w-full rounded-[10px] overflow-hidden bg-gradient-to-br from-[#175C59] to-[#0F172A] p-2.5 flex items-end">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 font-mono font-medium text-[10px] leading-[14px] text-slate-100">
                        <Camera
                          className="size-3 text-[#2DD4BF] shrink-0"
                          aria-hidden="true"
                        />
                        <span>{selectedPin.liveProofWatermark}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium text-[11px] leading-4 text-brand tabular-nums">
                        {selectedPin.publicCoords}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface border border-line px-2 py-[3px] font-mono font-medium text-[10px] leading-[14px] text-fg-muted">
                        <User className="size-[11px]" aria-hidden="true" />
                        <span>{selectedPin.reporterAlias}</span>
                      </span>
                    </div>

                    <p className="font-sans text-sm leading-5 text-fg">
                      {selectedPin.citizenNote}
                    </p>
                  </div>

                  <hr className="border-line" />

                  {/* c. Tombol Aksi Langsung */}
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
                        onClick={() =>
                          setConfirmAction({
                            pin: selectedPin,
                            action: primaryAction,
                          })
                        }
                        className="w-full"
                      >
                        {primaryAction.label}
                      </Button>
                    )}

                    {secondaryActions.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {secondaryActions.map((act) => (
                          <Button
                            key={act.id}
                            variant={act.variant}
                            size="sm"
                            disabled={act.disabled}
                            onClick={() =>
                              setConfirmAction({ pin: selectedPin, action: act })
                            }
                            className="w-full"
                          >
                            {act.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    {selectedPin.lockedReason && (
                      <p className="font-sans text-xs leading-4 text-fg-muted">
                        {selectedPin.lockedReason}
                      </p>
                    )}
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

      {/* Confirmation Modal */}
      <Modal
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction
            ? `${confirmAction.action.label} — ${confirmAction.pin.id}`
            : undefined
        }
        description={
          confirmAction
            ? `${confirmAction.pin.categoryTitle} · ${confirmAction.pin.location}`
            : undefined
        }
      >
        <div className="flex flex-col gap-4">
          <p className="font-sans text-sm text-fg-muted">
            Aksi langsung dari peta ini dicatat ke rantai audit kriptografi{" "}
            <span className="font-mono text-xs text-fg">AuditLog</span> dan
            langsung memperbarui status pin pada peta publik.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setConfirmAction(null)}
            >
              Batal
            </Button>
            <Button
              variant={
                confirmAction?.action.variant === "danger"
                  ? "danger"
                  : "primary"
              }
              size="md"
              onClick={handleConfirmAction}
            >
              Konfirmasi {confirmAction?.action.label}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DinasPetaPage;
