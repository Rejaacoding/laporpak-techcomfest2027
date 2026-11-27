import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LocateFixed, Search } from "lucide-react";
import {
  BottomNavbar,
  Header,
  TopNavbar,
} from "../../components/layout/index.ts";
import {
  Badge,
  Button,
  Card,
  Input,
  MapSkeleton,
  useToast,
} from "../../components/ui/index.js";
import { listTickets, onJuryEvent } from "../../lib/api.js";
import {
  mapPublicTicketsToWargaPins,
  mapRaporResponse,
} from "../../lib/ticketMappers.ts";
import type { WargaMapPinView } from "../../lib/ticketMappers.ts";
import { CATEGORIES, TICKET_STATUSES } from "../../constants/designTokens.js";

const SLA_TEXT_CLASS: Record<WargaMapPinView["slaTone"], string> = {
  overdue: "text-semantic-error",
  disputed: "text-purple-800",
  warning: "text-orange-700",
  normal: "text-fg-muted",
  muted: "text-fg-muted",
};

interface UserCoords {
  lat: number;
  lng: number;
}

function distanceKm(a: UserCoords, b: UserCoords): number {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

/**
 * Peta Detail Warga (/peta) — live `/api/tickets` pins, clusters, and inspector sheet.
 */
export function WargaPetaPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [tickets, setTickets] = useState<WargaMapPinView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<string>("Semua");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const loadTickets = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await listTickets();
        const mapped = mapPublicTicketsToWargaPins(data);
        setTickets(mapped);
        setSelectedId((current) => current || mapped[0]?.id || null);
      } catch (err) {
        setError(err);
        if (silent) showToast({ type: "error", error: err });
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(
    () => onJuryEvent("reset", () => loadTickets({ silent: true })),
    [loadTickets]
  );

  useEffect(
    () =>
      onJuryEvent("gps", (coords: { lat?: number; lng?: number }) => {
        const lat = Number(coords?.lat);
        const lng = Number(coords?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setUserCoords({ lat, lng });
          showToast({ type: "info", message: "Lokasi simulasi juri diterapkan." });
        }
      }),
    [showToast]
  );

  const categoryOptions = useMemo(() => {
    const countByCategory = new Map<string, number>();
    for (const ticket of tickets) {
      countByCategory.set(ticket.category, (countByCategory.get(ticket.category) || 0) + 1);
    }
    return [
      { code: "Semua", label: `Semua (${tickets.length})` },
      ...CATEGORIES.map((category: { code: string; label: string }) => ({
        code: category.code,
        label: `${category.label} (${countByCategory.get(category.code) || 0})`,
      })),
    ];
  }, [tickets]);

  const visiblePins = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = tickets.filter((pin) => {
      if (chip !== "Semua" && pin.category !== chip) return false;
      if (!normalizedQuery) return true;
      return (
        pin.id.toLowerCase().includes(normalizedQuery) ||
        pin.code.toLowerCase().includes(normalizedQuery) ||
        pin.title.toLowerCase().includes(normalizedQuery) ||
        pin.location.toLowerCase().includes(normalizedQuery) ||
        pin.categoryLabel.toLowerCase().includes(normalizedQuery)
      );
    });
    if (!userCoords) return filtered;
    return [...filtered].sort((a, b) => {
      if (a.publicLat == null || a.publicLng == null) return 1;
      if (b.publicLat == null || b.publicLng == null) return -1;
      return (
        distanceKm(userCoords, { lat: a.publicLat, lng: a.publicLng }) -
        distanceKm(userCoords, { lat: b.publicLat, lng: b.publicLng })
      );
    });
  }, [tickets, chip, query, userCoords]);

  const selectedPin =
    visiblePins.find((pin) => pin.id === selectedId) || visiblePins[0] || null;

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

  const focusGps = useCallback(() => {
    if (!navigator.geolocation) {
      showToast({
        type: "warning",
        title: "GPS tidak tersedia",
        message: "Perangkat ini belum mendukung pembacaan lokasi.",
      });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsLoading(false);
        showToast({
          type: "success",
          title: "Lokasi ditemukan",
          message: `Pin diurutkan dari posisimu (akurasi ${Math.round(position.coords.accuracy)} m).`,
        });
      },
      (err) => {
        setGpsLoading(false);
        showToast({
          type: "warning",
          title: "Izin lokasi diperlukan",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Ketuk ikon gembok di bilah alamat lalu pilih Izinkan Lokasi."
              : "Posisi GPS belum terkunci. Coba lagi di area terbuka.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [showToast]);

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col pb-16 md:pb-0">
      <div className="hidden md:block">
        <TopNavbar />
      </div>
      <div className="md:hidden">
        <Header />
      </div>

      <div className="bg-surface border-b border-line px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-2.5">
          <Input
            density="dinas"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari jalan, kecamatan, atau #ID..."
            aria-label="Cari jalan, kecamatan, atau ID tiket"
            leftIcon={<Search className="size-4" />}
            wrapperClassName="w-full md:w-[320px]"
            className="!bg-bg min-h-11"
          />

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 md:pb-0">
            {categoryOptions.map((category) => (
              <Button
                key={category.code}
                variant={chip === category.code ? "primary" : "secondary"}
                size="sm"
                onClick={() => setChip(category.code)}
                className="rounded-full shrink-0"
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <main className="relative flex-1 min-h-[540px] bg-[#EDF2EA] overflow-hidden">
        <svg
          viewBox="0 0 380 560"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full pointer-events-none"
          aria-hidden="true"
        >
          <path d="M200 -40 L260 560" stroke="#CFE4F5" strokeWidth="26" fill="none" />
          <line x1="-10" y1="185" x2="390" y2="165" stroke="#FFFFFF" strokeWidth="10" />
          <line x1="145" y1="-20" x2="105" y2="540" stroke="#FFFFFF" strokeWidth="10" />
          <polygon
            points="110,30 265,30 342,160 265,290 110,290 32,160"
            fill="rgba(15, 118, 110, 0.06)"
            stroke="#0F766E"
            strokeOpacity="0.75"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
        </svg>

        {loading && tickets.length === 0 ? (
          <div className="absolute inset-4">
            <MapSkeleton className="h-full" />
          </div>
        ) : error && tickets.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <Card className="max-w-md text-center flex flex-col items-center gap-3">
              <h2 className="font-head font-semibold text-base text-fg">
                Peta laporan belum bisa dimuat
              </h2>
              <p className="font-sans text-sm text-fg-muted">
                Periksa koneksi internet lalu muat ulang data laporan publik.
              </p>
              <Button variant="secondary" size="sm" onClick={() => loadTickets()}>
                Muat Ulang
              </Button>
            </Card>
          </div>
        ) : (
          <>
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                title={cluster.label}
                style={{
                  left: `${cluster.mapX}%`,
                  top: `${cluster.mapY}%`,
                  width: `${cluster.sizePx}px`,
                  height: `${cluster.sizePx}px`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand text-brand-fg border-[2.5px] border-surface flex items-center justify-center font-mono font-bold text-xs shadow-md"
              >
                {cluster.count}
              </div>
            ))}

            {visiblePins.map((pin) => {
              const isSelected = selectedPin?.id === pin.id;
              const status = TICKET_STATUSES[pin.status] || TICKET_STATUSES.OPEN;
              const PinIcon = status.Icon;
              return (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => setSelectedId(pin.id)}
                  aria-label={`${pin.title} (${pin.displayCode})`}
                  aria-pressed={isSelected}
                  style={{
                    left: `${pin.mapX}%`,
                    top: `${pin.mapY}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus-visible:outline-none"
                >
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[52px] rounded-full bg-brand/20 border-2 border-brand/70"
                    />
                  )}
                  <span
                    style={{ backgroundColor: status.pinHex }}
                    className={[
                      "relative rounded-full flex items-center justify-center text-white shadow-md transition-transform duration-150",
                      isSelected
                        ? "size-[38px] border-[3px] border-brand scale-110"
                        : "size-[30px] border-2 border-surface hover:scale-110",
                    ].join(" ")}
                  >
                    <PinIcon className={isSelected ? "size-[18px]" : "size-3.5"} aria-hidden="true" />
                  </span>
                </button>
              );
            })}

            <Button
              variant="secondary"
              density="icon"
              aria-label="Lokasi Saya"
              loading={gpsLoading}
              onClick={focusGps}
              className="absolute right-4 bottom-40 md:bottom-6 !size-12 shadow-elevated text-brand z-10"
            >
              <LocateFixed className="size-5" aria-hidden="true" />
            </Button>

            {selectedPin && (
              <div className="absolute inset-x-3.5 bottom-5 md:left-6 md:right-auto md:w-[380px] z-10">
                <Card
                  density="none"
                  interactive
                  onClick={() => navigate(`/tiket/${selectedPin.id}`)}
                  className="px-3.5 py-3 !border-[1.5px] !border-brand !shadow-elevated flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge status={selectedPin.status} />
                    <span
                      className={[
                        "font-mono font-bold text-[11px] tabular-nums",
                        SLA_TEXT_CLASS[selectedPin.slaTone],
                      ].join(" ")}
                    >
                      {selectedPin.slaText}
                    </span>
                  </div>

                  <h2 className="font-head font-semibold text-[15px] leading-5 text-fg">
                    {selectedPin.title} · {selectedPin.displayCode}
                  </h2>

                  <p className="font-sans text-xs text-fg-muted truncate">
                    {selectedPin.location} · {selectedPin.departmentLabel}
                  </p>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-sans text-fg-muted">
                      {selectedPin.categoryLabel}
                    </span>
                    <span className="font-head font-semibold text-brand shrink-0">
                      {selectedPin.supportCount} Dukungan · Lihat Detail →
                    </span>
                  </div>
                </Card>
              </div>
            )}

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
                      setChip("Semua");
                      setQuery("");
                    }}
                  >
                    Reset Filter
                  </Button>
                </Card>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNavbar activeTab="peta" />
    </div>
  );
}

export default WargaPetaPage;
