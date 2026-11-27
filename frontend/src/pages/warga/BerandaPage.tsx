import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Clock, Eye, LocateFixed, Map as MapIcon, ThumbsUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { CitizenOnly } from "../../components/auth/index.ts";
import {
  BottomNavbar,
  Header,
  TopNavbar,
} from "../../components/layout/index.ts";
import {
  Badge,
  Button,
  Card,
  MapSkeleton,
  TicketCardSkeleton,
  useToast,
} from "../../components/ui/index.js";
import {
  CivicLeafletMap,
  type MapFocusTarget,
} from "../../components/map/CivicLeafletMap.tsx";
import { useLiveSync } from "../../hooks/useLiveSync.ts";
import {
  getTicketMediaSignedUrl,
  listTickets,
  onJuryEvent,
} from "../../services/api.js";
import {
  distanceMeters,
  mapPublicTicketsToWargaPins,
  type ApiPublicTicket,
  type WargaMapPinView,
} from "../../utils/ticketMappers.ts";
import { CATEGORIES, TICKET_STATUSES } from "../../constants/designTokens.js";

const SLA_CHIP_CLASS: Record<WargaMapPinView["slaTone"], string> = {
  overdue: "bg-red-50 text-red-700",
  disputed: "bg-purple-50 text-purple-800",
  warning: "bg-orange-50 text-orange-700",
  normal: "bg-blue-50 text-blue-800",
  muted: "bg-surface-2 text-fg-muted",
};

interface UserCoords {
  lat: number;
  lng: number;
}

/**
 * Beranda & Peta Warga (/) - real interactive Leaflet map, live sync, and public feed.
 */
export function WargaBerandaPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { showToast } = useToast();

  const [rawTickets, setRawTickets] = useState<ApiPublicTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Semua");
  const [revealedPhotos, setRevealedPhotos] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const loadTickets = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await listTickets();
        setRawTickets(Array.isArray(data) ? data : []);
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

  const categoryOptions = useMemo(
    () => [
      { code: "Semua", label: "Semua" },
      ...CATEGORIES.map((category: { code: string; label: string }) => ({
        code: category.code,
        label: category.label,
      })),
    ],
    []
  );

  const visiblePins = useMemo(() => {
    const filtered =
      activeCategory === "Semua"
        ? tickets
        : tickets.filter((ticket) => ticket.category === activeCategory);
    if (!userCoords) return filtered;
    return [...filtered].sort((a, b) => {
      if (a.publicLat == null || a.publicLng == null) return 1;
      if (b.publicLat == null || b.publicLng == null) return -1;
      return (
        distanceMeters(userCoords, { lat: a.publicLat, lng: a.publicLng }) -
        distanceMeters(userCoords, { lat: b.publicLat, lng: b.publicLng })
      );
    });
  }, [tickets, activeCategory, userCoords]);

  const counters = useMemo(() => {
    let active = 0;
    let pending = 0;
    let resolved = 0;
    for (const ticket of tickets) {
      const status = TICKET_STATUSES[ticket.status];
      if (!status?.terminal) active += 1;
      if (ticket.status === "PENDING_VALIDATION") pending += 1;
      if (ticket.status === "CLOSED" || ticket.status === "AUTO_CLOSED") resolved += 1;
    }
    return { active, pending, resolved };
  }, [tickets]);

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
          message: `Menampilkan laporan terdekat dari posisimu (akurasi ${Math.round(position.coords.accuracy)} m).`,
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

  const handleRevealPhoto = async (
    event: React.MouseEvent,
    ticket: WargaMapPinView
  ) => {
    event.stopPropagation();
    if (revealedPhotos[ticket.id]) return;
    setRevealingId(ticket.id);
    try {
      const media = await getTicketMediaSignedUrl(ticket.id, "before", accessToken);
      setRevealedPhotos((prev) => ({ ...prev, [ticket.id]: media.signedUrl }));
    } catch (err) {
      showToast({ type: "error", error: err });
    } finally {
      setRevealingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col pb-24 md:pb-12">
      <div className="hidden md:block">
        <TopNavbar />
      </div>
      <div className="md:hidden">
        <Header />
      </div>

      <main className="max-w-7xl w-full mx-auto px-4 md:px-6 lg:px-8 pt-5 md:pt-9 flex flex-col gap-6 md:gap-9">
        {/* Editorial Civic Hero: open ground plane, clear primary CTA, hairline stats */}
        <section
          aria-label="Ringkasan LaporPAK!"
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-end border-b border-line pb-6 md:pb-8"
        >
          <div className="lg:col-span-7 flex flex-col gap-3">
            <h1 className="font-head font-bold text-2xl sm:text-3xl md:text-[38px] md:leading-[1.15] tracking-tight text-fg">
              Foto Masalahnya, Pantau Tenggat Dinasnya, Kawal Sampai Beres.
            </h1>
            <p className="font-sans text-sm md:text-base leading-relaxed text-fg-muted max-w-2xl">
              Peta terbuka pengaduan fasilitas publik Kota Surabaya dan Kab. Sidoarjo.
              Identitas pelapor disamarkan otomatis, setiap tenggat kerja dinas diawasi bersama.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <CitizenOnly>
                <Link
                  to="/lapor"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand text-brand-fg min-h-11 px-5 text-sm font-head font-semibold shadow-elevated hover:brightness-110 active:brightness-95 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  <Camera className="size-4" aria-hidden="true" />
                  <span>Lapor Kerusakan</span>
                </Link>
              </CitizenOnly>
              <Link
                to="/peta"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface text-fg min-h-11 px-4 text-sm font-head font-semibold hover:bg-surface-2 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <MapIcon className="size-4 text-brand" aria-hidden="true" />
                <span>Buka Peta Penuh</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-2.5 lg:items-end">
            <div className="grid grid-cols-3 w-full divide-x divide-line rounded-2xl border border-line bg-surface px-2 py-3">
              {[
                { id: "aktif", value: counters.active, label: "Aktif", toneClass: "text-brand" },
                { id: "uji", value: counters.pending, label: "Uji Publik", toneClass: "text-orange-700" },
                { id: "tuntas", value: counters.resolved, label: "Tuntas", toneClass: "text-green-700" },
              ].map((counter) => (
                <div key={counter.id} className="px-3 flex flex-col items-center text-center gap-0.5">
                  <span
                    className={[
                      "font-mono font-bold text-xl md:text-2xl leading-tight tabular-nums",
                      counter.toneClass,
                    ].join(" ")}
                  >
                    {counter.value}
                  </span>
                  <span className="font-sans font-medium text-[11px] md:text-xs text-fg-muted">
                    {counter.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="inline-flex items-center gap-2 text-[11px] font-mono text-fg-muted">
              <span className="size-2 rounded-full bg-green-600 shrink-0" aria-hidden="true" />
              <span>Data langsung Supabase · Sinkron {syncLabel}</span>
            </div>
          </div>
        </section>

        <section aria-label="Filter dan peta laporan" className="flex flex-col gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categoryOptions.map((cat) => {
              const active = activeCategory === cat.code;
              return (
                <Button
                  key={cat.code}
                  variant={active ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setActiveCategory(cat.code)}
                  className="min-h-10 rounded-full shrink-0"
                >
                  {cat.label}
                </Button>
              );
            })}
          </div>

          {loading && tickets.length === 0 ? (
            <MapSkeleton />
          ) : error && tickets.length === 0 ? (
            <Card className="text-center py-8 flex flex-col items-center gap-3">
              <p className="font-head font-semibold text-base text-fg">
                Peta laporan belum bisa dimuat
              </p>
              <p className="font-sans text-sm text-fg-muted max-w-md">
                Koneksi ke server terputus. Data yang sudah tampil tetap aman.
              </p>
              <Button variant="secondary" size="sm" onClick={() => loadTickets()}>
                Coba Lagi
              </Button>
            </Card>
          ) : (
            <div className="relative h-[300px] md:h-[420px] w-full rounded-2xl border border-line overflow-hidden shadow-card">
              <CivicLeafletMap
                pins={mapPins}
                userCoords={userCoords}
                focusTarget={focusTarget}
                onSelectPin={(pinId) => navigate(`/tiket/${pinId}`)}
                ariaLabel="Peta interaktif laporan warga Surabaya dan Sidoarjo"
              />

              <div className="pointer-events-none absolute top-3 left-3 z-[400] hidden sm:inline-flex items-center gap-2 rounded-xl bg-surface/95 border border-line px-3 py-1.5 text-xs text-fg shadow-card">
                <span className="font-mono font-bold text-brand">{visiblePins.length}</span>
                <span>titik di peta · Klik pin untuk detail</span>
              </div>

              <Button
                variant="secondary"
                density="icon"
                aria-label="Fokus ke lokasi saya"
                loading={gpsLoading}
                onClick={focusGps}
                className="absolute bottom-4 right-3 z-[400] !size-11 shadow-popover text-brand"
              >
                <LocateFixed className="size-5" aria-hidden="true" />
              </Button>
            </div>
          )}
        </section>

        <section aria-label="Daftar laporan sekitar" className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-head font-semibold text-lg md:text-xl text-fg">
              Laporan Sekitar
            </h2>
            <span className="font-mono font-medium text-xs text-brand">
              {userCoords ? "Diurutkan terdekat dari GPS" : "Surabaya dan Sidoarjo"}
            </span>
          </div>

          {loading && tickets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((index) => (
                <TicketCardSkeleton key={index} />
              ))}
            </div>
          ) : visiblePins.length === 0 ? (
            <Card className="text-center py-8 flex flex-col items-center gap-3">
              <p className="font-head font-semibold text-base text-fg">
                Belum ada laporan pada kategori ini
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveCategory("Semua")}
              >
                Reset Filter Peta
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {visiblePins.slice(0, 9).map((ticket) => {
                const isNsfw = Boolean(ticket.isNsfwPendingReview);
                const revealedUrl = revealedPhotos[ticket.id];
                const photoUrl = revealedUrl || ticket.beforePhotoUrl || null;
                const showBlur = Boolean(isNsfw && !revealedUrl);

                return (
                  <Card
                    key={ticket.id}
                    density="none"
                    interactive
                    onClick={() => navigate(`/tiket/${ticket.id}`)}
                    className="lapor-cv-auto group p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40"
                  >
                    <div
                      className={[
                        "relative h-[180px] w-full rounded-xl overflow-hidden flex flex-col",
                        showBlur
                          ? "bg-gradient-to-br from-slate-600 to-slate-800 items-center justify-center gap-2 p-3 text-center"
                          : "bg-surface-2",
                      ].join(" ")}
                    >
                      {showBlur ? (
                        <>
                          <span className="font-sans font-semibold text-xs text-slate-200">
                            Foto disamarkan (sedang ditinjau)
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={revealingId === ticket.id}
                            leftIcon={<Eye className="size-3.5" />}
                            onClick={(event) => handleRevealPhoto(event, ticket)}
                          >
                            Tampilkan Gambar
                          </Button>
                        </>
                      ) : photoUrl ? (
                        <>
                          <img
                            src={photoUrl}
                            alt={`Foto laporan ${ticket.title}`}
                            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="absolute top-2.5 left-2.5">
                            <Badge status={ticket.status} size="sm" />
                          </div>
                        </>
                      ) : (
                        <div className="p-3">
                          <Badge status={ticket.status} />
                        </div>
                      )}
                    </div>

                    {showBlur && (
                      <div className="self-start">
                        <Badge status={ticket.status} />
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <h3 className="font-head font-semibold text-[16px] leading-[22px] text-fg group-hover:text-brand transition-colors">
                        {ticket.title}
                      </h3>
                      <p className="font-sans text-[13px] leading-[18px] text-fg-muted">
                        {ticket.location} · {ticket.departmentLabel}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 border-t border-line/70">
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono font-bold text-[11px] tabular-nums",
                          SLA_CHIP_CLASS[ticket.slaTone],
                        ].join(" ")}
                      >
                        <Clock className="size-3 shrink-0" aria-hidden="true" />
                        <span>{ticket.slaText}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 font-sans font-semibold text-xs text-fg">
                        <ThumbsUp
                          className="size-3 text-brand shrink-0"
                          aria-hidden="true"
                        />
                        <span>{ticket.supportCount} Dukungan</span>
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <BottomNavbar activeTab="beranda" />
    </div>
  );
}

export default WargaBerandaPage;
