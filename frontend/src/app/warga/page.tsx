import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Eye, LocateFixed, ThumbsUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
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
  getTicketDetail,
  getTicketMediaSignedUrl,
  listTickets,
  onJuryEvent,
} from "../../lib/api.js";
import {
  mapPublicTicketsToWargaPins,
  mapRaporResponse,
} from "../../lib/ticketMappers.ts";
import type { WargaMapPinView } from "../../lib/ticketMappers.ts";
import { CATEGORIES, TICKET_STATUSES } from "../../constants/designTokens.js";

const SLA_CHIP_CLASS: Record<WargaMapPinView["slaTone"], string> = {
  overdue: "bg-red-50 text-red-700",
  disputed: "bg-purple-50 text-purple-800",
  warning: "bg-orange-50 text-orange-700",
  normal: "bg-blue-50 text-blue-800",
  muted: "bg-surface-2 text-fg-muted",
};

interface TicketDetailView {
  beforePhotoUrl: string | null;
  isNsfwPendingReview: boolean;
  isLowQualityOverride: boolean;
  description: string;
}

interface UserCoords {
  lat: number;
  lng: number;
}

function distanceKm(a: UserCoords, b: UserCoords): number {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

/**
 * Beranda & Peta Warga (/) — live `/api/tickets` data on the Figma-sliced canvas.
 */
export function WargaBerandaPage() {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();

  const [tickets, setTickets] = useState<WargaMapPinView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Semua");
  const [revealedPhotos, setRevealedPhotos] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, TicketDetailView>>({});
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const loadTickets = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await listTickets();
        setTickets(mapPublicTicketsToWargaPins(data));
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
        distanceKm(userCoords, { lat: a.publicLat, lng: a.publicLng }) -
        distanceKm(userCoords, { lat: b.publicLat, lng: b.publicLng })
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

  const topIdsKey = visiblePins
    .slice(0, 3)
    .map((ticket) => ticket.id)
    .join("|");

  useEffect(() => {
    if (!topIdsKey) return undefined;
    let cancelled = false;
    const ids = topIdsKey.split("|");
    Promise.all(
      ids.map(async (id) => {
        try {
          const detail = await getTicketDetail(id, {}, accessToken);
          return [
            id,
            {
              beforePhotoUrl: detail?.beforePhotoUrl || null,
              isNsfwPendingReview: Boolean(detail?.isNsfwPendingReview),
              isLowQualityOverride: Boolean(detail?.isLowQualityOverride),
              description: detail?.description || "",
            },
          ] as const;
        } catch {
          return null;
        }
      })
    ).then((rows) => {
      if (cancelled) return;
      setDetails((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (row) next[row[0]] = row[1];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [topIdsKey, accessToken]);

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

  const handleProfileClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    showToast({
      type: "info",
      title: user.aliasName,
      message: `Trust Score ${Number(user.trustScore ?? 0).toFixed(1)} · ${
        user.activeTicketCount ?? 0
      } laporan aktif.`,
    });
  };

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
    <div className="min-h-screen bg-bg text-fg flex flex-col pb-24 md:pb-10">
      <div className="hidden md:block">
        <TopNavbar onProfileClick={handleProfileClick} />
      </div>
      <div className="md:hidden">
        <Header onProfileClick={handleProfileClick} />
      </div>

      <main className="max-w-7xl w-full mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8 flex flex-col gap-5 md:gap-7">
        <Card
          tone="secondary"
          density="none"
          className="p-4 md:p-6 flex flex-col gap-3 md:gap-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-head font-bold text-xl md:text-3xl leading-snug text-fg">
              Foto Masalahnya, Pantau Tenggat Dinasnya, Kawal Sampai Beres.
            </h1>

            <svg
              viewBox="0 0 84 68"
              className="w-[84px] h-[68px] md:w-28 md:h-[90px] shrink-0"
              aria-hidden="true"
            >
              <circle cx="26" cy="34" r="22" fill="#CCFBF1" />
              <path d="M10 60c0-9 7-15 16-15s16 6 16 15" fill="#0F766E" />
              <circle cx="26" cy="30" r="11" fill="#FDE68A" stroke="#1C1917" strokeWidth="1.5" />
              <path d="M15 27c2-7 6-10 11-10s9 3 11 10H15z" fill="#0F766E" stroke="#1C1917" strokeWidth="1.5" />
              <circle cx="58" cy="34" r="22" fill="#DBEAFE" />
              <path d="M42 60c0-9 7-15 16-15s16 6 16 15" fill="#1E40AF" />
              <circle cx="58" cy="30" r="11" fill="#FDE68A" stroke="#1C1917" strokeWidth="1.5" />
              <path d="M46 27c2-7 7-11 12-11s10 4 12 11H46z" fill="#F59E0B" stroke="#1C1917" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {[
              { id: "aktif", value: counters.active, label: "Aktif", toneClass: "text-brand" },
              { id: "uji", value: counters.pending, label: "Uji Publik", toneClass: "text-orange-700" },
              { id: "tuntas", value: counters.resolved, label: "Tuntas", toneClass: "text-green-700" },
            ].map((counter) => (
              <Card
                key={counter.id}
                density="none"
                className="px-2.5 py-2 md:px-4 md:py-3 rounded-xl flex flex-col items-center text-center gap-0.5"
              >
                <span
                  className={[
                    "font-mono font-bold text-lg md:text-2xl leading-tight tabular-nums",
                    counter.toneClass,
                  ].join(" ")}
                >
                  {counter.value}
                </span>
                <span className="font-sans font-semibold text-[11px] md:text-xs text-fg-muted">
                  {counter.label}
                </span>
              </Card>
            ))}
          </div>
        </Card>

        <section aria-label="Filter dan peta laporan" className="flex flex-col gap-2.5">
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
            <div className="relative h-[250px] md:h-[360px] w-full rounded-2xl border border-line bg-[#EDF2EA] overflow-hidden">
              <svg
                viewBox="0 0 380 250"
                preserveAspectRatio="none"
                className="absolute inset-0 size-full pointer-events-none"
                aria-hidden="true"
              >
                <path d="M190 -20 L235 270" stroke="#CFE4F5" strokeWidth="22" fill="none" />
                <line x1="-15" y1="135" x2="395" y2="105" stroke="#FFFFFF" strokeWidth="8" />
                <line x1="125" y1="-15" x2="95" y2="265" stroke="#FFFFFF" strokeWidth="8" />
                <polygon
                  points="100,25 240,25 312,125 240,225 100,225 32,125"
                  fill="rgba(15, 118, 110, 0.07)"
                  stroke="#0F766E"
                  strokeOpacity="0.75"
                  strokeWidth="1.5"
                  strokeDasharray="6 5"
                />
              </svg>

              {clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  title={`${cluster.label}`}
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

              {visiblePins.slice(0, 40).map((pin) => {
                const status = TICKET_STATUSES[pin.status] || TICKET_STATUSES.OPEN;
                const PinIcon = status.Icon;
                return (
                  <button
                    key={pin.id}
                    type="button"
                    title={`${pin.title} · ${pin.displayCode}`}
                    aria-label={`${pin.title} ${pin.displayCode}`}
                    onClick={() => navigate(`/tiket/${pin.id}`)}
                    style={{
                      left: `${pin.mapX}%`,
                      top: `${pin.mapY}%`,
                      backgroundColor: status.pinHex,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 size-7 rounded-full border-2 border-surface text-white flex items-center justify-center shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <PinIcon className="size-3.5" aria-hidden="true" />
                  </button>
                );
              })}

              <Button
                variant="secondary"
                density="icon"
                aria-label="Lokasi Saya"
                loading={gpsLoading}
                onClick={focusGps}
                className="absolute bottom-3 right-3 !size-12 shadow-elevated text-brand"
              >
                <LocateFixed className="size-5" aria-hidden="true" />
              </Button>
            </div>
          )}
        </section>

        <section aria-label="Daftar laporan sekitar" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-head font-semibold text-lg md:text-xl text-fg">
              Laporan Sekitar
            </h2>
            <span className="font-mono font-medium text-xs text-brand">
              {userCoords ? "Radius 2 km · Terdekat" : "Surabaya–Sidoarjo"}
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
                const detail = details[ticket.id];
                const isNsfw = detail?.isNsfwPendingReview ?? ticket.isNsfwPendingReview;
                const revealedUrl = revealedPhotos[ticket.id];
                const photoUrl = revealedUrl || detail?.beforePhotoUrl;
                const showBlur = Boolean(isNsfw && !revealedUrl);

                return (
                  <Card
                    key={ticket.id}
                    density="none"
                    interactive
                    onClick={() => navigate(`/tiket/${ticket.id}`)}
                    className="p-4 flex flex-col gap-3"
                  >
                    <div
                      className={[
                        "relative h-[175px] w-full rounded-xl overflow-hidden flex flex-col",
                        showBlur
                          ? "bg-gradient-to-br from-slate-600 to-slate-800 items-center justify-center gap-2 p-3 text-center"
                          : "bg-gradient-to-br from-[#175C59] to-[#0F172A]",
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
                        <img
                          src={photoUrl}
                          alt={`Foto laporan ${ticket.title}`}
                          className="size-full object-cover"
                          loading="lazy"
                        />
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
                      <h3 className="font-head font-semibold text-[17px] leading-[22px] text-fg">
                        {ticket.title}
                      </h3>
                      <p className="font-sans text-[13px] leading-[18px] text-fg-muted">
                        {ticket.location} · {ticket.departmentLabel}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
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

      <BottomNavbar activeTab="beranda" onProfileClick={handleProfileClick} />
    </div>
  );
}

export default WargaBerandaPage;
