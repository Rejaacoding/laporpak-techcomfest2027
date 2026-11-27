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
import {
  CivicLeafletMap,
  type MapFocusTarget,
} from "../../components/map/CivicLeafletMap.tsx";
import { useLiveSync } from "../../hooks/useLiveSync.ts";
import { listTickets, onJuryEvent } from "../../services/api.js";
import {
  distanceMeters,
  mapPublicTicketsToWargaPins,
  type ApiPublicTicket,
  type WargaMapPinView,
} from "../../utils/ticketMappers.ts";
import { CATEGORIES } from "../../constants/designTokens.js";

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

/**
 * Peta Detail Warga (/peta) - real interactive Leaflet map, live sync, and inspector sheet.
 */
export function WargaPetaPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [rawTickets, setRawTickets] = useState<ApiPublicTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<string>("Semua");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const loadTickets = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await listTickets();
        const list = Array.isArray(data) ? data : [];
        setRawTickets(list);
        setSelectedId((current) => current || list[0]?.id || null);
      } catch (err) {
        if (!silent) setError(err);
        if (silent) showToast({ type: "error", error: err });
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  const { nowMs, syncLabel, markSynced } = useLiveSync({
    onRefresh: () => loadTickets({ silent: true }),
    intervalMs: 25_000,
    realtimeTable: "Ticket",
  });

  useEffect(() => {
    loadTickets().then(markSynced).catch(() => {});
  }, [loadTickets]);

  useEffect(
    () => onJuryEvent("reset", () => loadTickets({ silent: true }).then(markSynced)),
    [loadTickets]
  );

  useEffect(
    () =>
      onJuryEvent("gps", (coords: { lat?: number; lng?: number }) => {
        const lat = Number(coords?.lat);
        const lng = Number(coords?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setUserCoords({ lat, lng });
          setFocusTarget({ lat, lng, zoom: 14, seq: Date.now() });
          showToast({ type: "info", message: "Lokasi simulasi juri diterapkan." });
        }
      }),
    [showToast]
  );

  const tickets = useMemo(
    () => mapPublicTicketsToWargaPins(rawTickets, nowMs),
    [rawTickets, nowMs]
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
        distanceMeters(userCoords, { lat: a.publicLat, lng: a.publicLng }) -
        distanceMeters(userCoords, { lat: b.publicLat, lng: b.publicLng })
      );
    });
  }, [tickets, chip, query, userCoords]);

  const selectedPin =
    visiblePins.find((pin) => pin.id === selectedId) || visiblePins[0] || null;

  const mapPins = useMemo(
    () =>
      visiblePins.map((pin) => ({
        id: pin.id,
        title: pin.title,
        code: pin.code,
        displayCode: pin.displayCode,
        status: pin.status,
        lat: pin.publicLat,
        lng: pin.publicLng,
      })),
    [visiblePins]
  );

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
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserCoords(next);
        setFocusTarget({ lat: next.lat, lng: next.lng, zoom: 14, seq: Date.now() });
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

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 md:pb-0 flex-1">
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

          <span className="hidden xl:inline-flex items-center gap-1.5 text-[11px] font-mono text-fg-muted shrink-0">
            <span className="size-2 rounded-full bg-green-600" aria-hidden="true" />
            {syncLabel}
          </span>
        </div>
      </div>

      <main className="relative flex-1 min-h-[540px] bg-surface-2 overflow-hidden">
        <h1 className="sr-only">Peta Laporan Warga</h1>

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
            <CivicLeafletMap
              pins={mapPins}
              selectedPinId={selectedPin?.id ?? null}
              onSelectPin={setSelectedId}
              userCoords={userCoords}
              focusTarget={focusTarget}
              className="absolute inset-0 h-full w-full"
              ariaLabel="Peta penuh laporan fasilitas Surabaya dan Sidoarjo"
            />

            <Button
              variant="secondary"
              density="icon"
              aria-label="Fokus ke lokasi saya"
              loading={gpsLoading}
              onClick={focusGps}
              className="absolute right-3 bottom-44 md:bottom-6 !size-11 shadow-popover text-brand z-[400]"
            >
              <LocateFixed className="size-5" aria-hidden="true" />
            </Button>

            {selectedPin && (
              <div
                key={selectedPin.id}
                className="absolute inset-x-3.5 bottom-5 md:left-6 md:right-auto md:w-[390px] z-[400] animate-lapor-sheet"
              >
                <Card
                  density="none"
                  interactive
                  onClick={() => navigate(`/tiket/${selectedPin.id}`)}
                  className="px-4 py-3.5 !border-[1.5px] !border-brand !shadow-elevated flex flex-col gap-2"
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

                  <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-line/70">
                    <span className="font-sans text-fg-muted">
                      {selectedPin.categoryLabel}
                    </span>
                    <span className="font-head font-semibold text-brand shrink-0">
                      {selectedPin.supportCount} Dukungan · Buka Detail
                    </span>
                  </div>
                </Card>
              </div>
            )}

            {!loading && visiblePins.length === 0 && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center p-6 pointer-events-none">
                <Card className="max-w-sm text-center flex flex-col items-center gap-2 pointer-events-auto shadow-elevated">
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
