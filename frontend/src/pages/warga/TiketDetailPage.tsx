import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  LocateFixed,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { Header, TopNavbar } from "../../components/layout/index.ts";
import {
  Badge,
  Button,
  Card,
  Skeleton,
  Textarea,
  useToast,
} from "../../components/ui/index.js";
import {
  fetchSampleAsBase64,
  getTicketDetail,
  getTicketMediaSignedUrl,
  issueCaptureNonce,
  onJuryEvent,
  rateTicket,
  supportTicket,
  validateTicket,
  verifyTicketAudit,
} from "../../services/api.js";
import { humanizeError } from "../../utils/humanize.js";
import { useLiveSync } from "../../hooks/useLiveSync.ts";
import LiveCameraCapture from "../../components/camera/LiveCameraCapture.jsx";

interface TicketDetailView {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  tier: string;
  status: string;
  statusLabel: string;
  publicLat: number;
  publicLng: number;
  reporterAlias: string;
  department?: { name?: string; shortName?: string } | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  repairCapturedAt?: string | null;
  repairDistanceMeters?: number | null;
  isFastResolveAnomaly?: boolean;
  beritaAcaraUrl?: string | null;
  isNsfwPendingReview?: boolean;
  isLowQualityOverride?: boolean;
  syncedAt?: string | null;
  slaDeadline?: string | null;
  validationStartedAt?: string | null;
  coolingEndsAt?: string | null;
  disputedAt?: string | null;
  disputeCount?: number;
  isAppealRound?: boolean;
  supportCount?: number;
  outOfScopeAgency?: string | null;
  outOfScopeReason?: string | null;
  rejectedSpamReason?: string | null;
  closedResolutionNote?: string | null;
  quorum: {
    currentWeight: number;
    targetWeight: number;
    uniqueValidators: number;
    minValidators: number;
    hasEarlySupporter?: boolean;
    isCoolingHold?: boolean;
    coolingEndsAt?: string | null;
    phase?: string | null;
  };
  ratings?: {
    average?: number | null;
    count?: number;
    hasRated?: boolean;
    canRate?: boolean;
    items: Array<{
      id: string;
      stars: number;
      comment: string;
      citizenAlias: string;
      createdAt: string;
    }>;
  };
  timeline?: Array<{
    id: string;
    actorDisplayLabel?: string;
    action: string;
    note?: string;
    toStatusLabel?: string;
    createdAt: string;
    currentHash?: string;
  }>;
  uiFlags: {
    canSupport: boolean;
    canVoteConfirm: boolean;
    canDispute: boolean;
    canConfirmAsReporter48_72: boolean;
    disabledReasons: Record<string, string>;
  };
}

interface Coordinates {
  lat: number;
  lng: number;
  accuracy: number;
}

function formatWib(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

function starRow(stars: number): string {
  const filled = Math.max(0, Math.min(5, stars));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

function gpsLabel(coords: Coordinates | null): string {
  if (!coords) return "Lokasi belum dikunci";
  return `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} · akurasi ${Math.round(coords.accuracy)} m`;
}

/**
 * Detail Laporan & Uji Publik (/tiket/:id) — foto before/after, kuorum,
 * validasi warga, segel audit, dan rating Catatan.
 */
export function WargaTiketPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();

  const [detail, setDetail] = useState<TicketDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [slider, setSlider] = useState(50);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [clientNsfwScore, setClientNsfwScore] = useState(0);
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState<
    "support" | "confirm" | "dispute" | "rating" | null
  >(null);
  const [actionError, setActionError] = useState("");
  const [audit, setAudit] = useState<{
    verifiedChain: boolean;
    totalEntries: number;
    tamperedAtIndex?: number | null;
  } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    setDetail(null);
    setBeforePhotoUrl(null);
    setEvidencePhoto(null);
    setNote("");
    setAudit(null);
    setActionError("");
    setSlider(50);
    setRatingStars(5);
    setRatingComment("");
  }, [id]);

  const loadDetail = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!id) return;
      const requestId = ++requestIdRef.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const query = coords
          ? { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy }
          : {};
        const payload = await getTicketDetail(id, query, accessToken);
        if (requestId === requestIdRef.current) setDetail(payload);
      } catch (err) {
        if (!silent && requestId === requestIdRef.current) setError(err);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [id, accessToken, user?.aliasName, coords]
  );

  const { nowMs, syncLabel, markSynced } = useLiveSync({
    onRefresh: () => loadDetail({ silent: true }),
    intervalMs: 25_000,
    enabled: Boolean(id),
    realtimeTable: "Ticket",
  });

  useEffect(() => {
    loadDetail().then(markSynced).catch(() => {});
  }, [loadDetail]);

  useEffect(
    () => onJuryEvent("reset", () => loadDetail({ silent: true }).then(markSynced)),
    [loadDetail]
  );

  useEffect(
    () =>
      onJuryEvent("gps", (simulated: { lat?: number; lng?: number; accuracyMeters?: number }) => {
        const lat = Number(simulated?.lat);
        const lng = Number(simulated?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setGpsDenied(false);
        setCoords({ lat, lng, accuracy: Number(simulated?.accuracyMeters ?? 10) });
        showToast({ type: "info", message: "GPS simulasi juri diterapkan." });
      }),
    [showToast]
  );

  useEffect(
    () =>
      onJuryEvent("capture", async (simulated: { samplePath?: string }) => {
        if (!simulated?.samplePath) return;
        try {
          const photo = await fetchSampleAsBase64(simulated.samplePath);
          setEvidencePhoto(photo);
          setClientNsfwScore(0);
          showToast({ type: "success", message: "Foto bukti simulasi juri siap dikirim." });
        } catch (err) {
          showToast({ type: "error", error: err });
        }
      }),
    [showToast]
  );

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsDenied(true);
      return;
    }
    setGpsLoading(true);
    setGpsDenied(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) setGpsDenied(true);
        else {
          showToast({
            type: "warning",
            message: "Posisi GPS belum terkunci. Coba lagi di area terbuka.",
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [showToast]);

  if (!id) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col">
        <TopNavbar />
        <main className="max-w-lg mx-auto p-6">
          <Card className="text-center py-10">
            <p className="font-head font-semibold">Laporan tidak ditemukan.</p>
          </Card>
        </main>
      </div>
    );
  }

  const status = detail?.status || "";
  const isPending = status === "PENDING_VALIDATION";
  const isDisputed = status === "DISPUTED";
  const isEscalated = status === "ESCALATED";
  const isClosed = status === "CLOSED" || status === "AUTO_CLOSED";
  const isTerminal = ["CLOSED", "AUTO_CLOSED", "OUT_OF_SCOPE", "REJECTED_SPAM"].includes(status);
  const gpsReady =
    coords !== null && Number.isFinite(coords.accuracy) && coords.accuracy <= 50;
  const reporterFreeConfirm = Boolean(detail?.uiFlags.canConfirmAsReporter48_72);
  const canConfirm = Boolean(
    detail?.uiFlags.canVoteConfirm && (reporterFreeConfirm || gpsReady)
  );
  const canDispute = Boolean(detail?.uiFlags.canDispute && gpsReady);
  const disabledReasons = detail?.uiFlags.disabledReasons || {};
  const beforeSrc = beforePhotoUrl || detail?.beforePhotoUrl || null;
  const afterSrc = detail?.afterPhotoUrl || null;
  const showBeforeBlur = Boolean(detail?.isNsfwPendingReview && !beforeSrc);
  const quorum = detail?.quorum;
  const ratings = detail?.ratings;
  const coolingHold =
    Boolean(quorum?.isCoolingHold) &&
    Boolean(quorum?.coolingEndsAt) &&
    new Date(quorum.coolingEndsAt).getTime() > nowMs;

  const requireLogin = () => {
    if (user) return true;
    showToast({
      type: "info",
      title: "Masuk dulu untuk ikut menilai",
      message: "Akun warga diperlukan agar setiap suara tercatat adil.",
    });
    navigate("/login", { state: { from: `/tiket/${id}` } });
    return false;
  };

  const handleSupport = async () => {
    if (!detail || !requireLogin()) return;
    setActionError("");
    setActionLoading("support");
    try {
      await supportTicket(detail.id, accessToken);
      showToast({
        type: "success",
        title: "Dukungan tercatat",
        message: "Dukungan membantu mempercepat batas SLA dinas.",
      });
      await loadDetail();
    } catch (err) {
      const message = humanizeError(err);
      setActionError(message);
      showToast({ type: "error", error: err });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirm = async () => {
    if (!detail || !requireLogin()) return;
    if (!canConfirm) {
      showToast({
        type: "warning",
        title: "Belum bisa menekan Sudah Beres",
        message: reporterFreeConfirm
          ? "Suaramu sudah tercatat pada putaran ini."
          : disabledReasons.confirm || "Kunci GPS dalam radius 100 m terlebih dahulu.",
      });
      return;
    }
    setActionError("");
    setActionLoading("confirm");
    try {
      const body: Record<string, unknown> = { type: "CONFIRM_RESOLVED" };
      if (!reporterFreeConfirm && coords) {
        body.lat = coords.lat;
        body.lng = coords.lng;
        body.gpsAccuracyMeters = coords.accuracy;
      }
      const result = await validateTicket(detail.id, body, accessToken);
      showToast({
        type: "success",
        title: result?.closed
          ? "Laporan tuntas"
          : result?.coolingHold
            ? "Kuorum tercapai (masa tayang 6 jam)"
            : "Suara 'Sudah Beres' tercatat",
        message: result?.closed
          ? "Kuorum warga terpenuhi. Terima kasih sudah menjaga fasilitas publik."
          : result?.coolingHold
            ? "Suara warga sudah cukup — laporan menunggu masa tayang publik 6 jam sebelum dikunci agar transparan."
            : `Kuorum sementara ${result?.quorumWeight ?? 0} / ${result?.targetWeight ?? quorum?.targetWeight ?? 2} poin.`,
      });
      await loadDetail();
    } catch (err) {
      const message = humanizeError(err);
      setActionError(message);
      showToast({ type: "error", error: err });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDispute = async () => {
    if (!detail || !requireLogin()) return;
    if (!canDispute) {
      showToast({
        type: "warning",
        title: "Klaim Palsu belum bisa dikirim",
        message: disabledReasons.dispute || "Kunci GPS dalam radius 100 m terlebih dahulu.",
      });
      return;
    }
    if (!evidencePhoto) {
      setCameraOpen(true);
      showToast({
        type: "info",
        title: "Ambil foto bukti",
        message: "Klaim Palsu wajib disertai foto langsung dari lokasi.",
      });
      return;
    }
    setActionError("");
    setActionLoading("dispute");
    try {
      const nonce = await issueCaptureNonce(
        { actionType: "DISPUTE_TICKET", ticketId: detail.id },
        accessToken
      );
      const captureNonce = nonce?.captureNonce || nonce?.nonce;
      if (!captureNonce) throw new Error("Kupon foto tidak diterima. Silakan ambil ulang.");
      await validateTicket(
        detail.id,
        {
          type: "DISPUTE_FALSE",
          lat: coords?.lat,
          lng: coords?.lng,
          gpsAccuracyMeters: coords?.accuracy,
          captureNonce,
          photoBase64: evidencePhoto,
          clientNsfwScore,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        accessToken
      );
      setEvidencePhoto(null);
      setNote("");
      showToast({
        type: "success",
        title: "Klaim Palsu terkirim",
        message: "Dinas wajib merespons maksimal 24 jam.",
      });
      await loadDetail();
    } catch (err) {
      const message = humanizeError(err);
      setActionError(message);
      showToast({ type: "error", error: err });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRate = async () => {
    if (!detail || !ratings?.canRate) return;
    if (ratingComment.trim().length < 5) {
      setActionError("Alasan singkat minimal 5 karakter.");
      return;
    }
    setActionError("");
    setActionLoading("rating");
    try {
      await rateTicket(
        detail.id,
        { stars: ratingStars, comment: ratingComment.trim() },
        accessToken
      );
      setRatingComment("");
      showToast({
        type: "success",
        title: "Rating terkirim",
        message: "Terima kasih, ulasanmu membantu warga lain menilai layanan dinas.",
      });
      await loadDetail();
    } catch (err) {
      const message = humanizeError(err);
      setActionError(message);
      showToast({ type: "error", error: err });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevealBefore = async () => {
    if (!detail) return;
    setRevealing(true);
    try {
      const media = await getTicketMediaSignedUrl(detail.id, "before", accessToken);
      setBeforePhotoUrl(media.signedUrl);
    } catch (err) {
      showToast({ type: "error", error: err });
    } finally {
      setRevealing(false);
    }
  };

  const handleVerifyAudit = async () => {
    if (!detail) return;
    setAuditLoading(true);
    try {
      const payload = await verifyTicketAudit(detail.id);
      setAudit(payload);
    } catch (err) {
      showToast({ type: "error", error: err });
    } finally {
      setAuditLoading(false);
    }
  };

  if (loading && !detail) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col">
        <div className="hidden md:block">
          <TopNavbar />
        </div>
        <div className="md:hidden">
          <Header />
        </div>
        <main className="max-w-4xl w-full mx-auto px-4 py-6 flex flex-col gap-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col">
        <div className="hidden md:block">
          <TopNavbar />
        </div>
        <div className="md:hidden">
          <Header />
        </div>
        <main className="max-w-lg w-full mx-auto px-4 py-16">
          <Card className="text-center flex flex-col items-center gap-3 py-10">
            <AlertTriangle className="size-10 text-semantic-error" aria-hidden="true" />
            <h1 className="font-head font-bold text-xl text-fg">
              Laporan belum bisa dimuat
            </h1>
            <p className="font-sans text-sm text-fg-muted">
              {humanizeError(error)}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => loadDetail()}>
                Coba Lagi
              </Button>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-xl border border-line bg-surface px-3.5 min-h-9 text-[13px] font-semibold text-fg"
              >
                Kembali ke Peta
              </Link>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (!detail || !quorum) return null;

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col pb-10">
      <div className="hidden md:block">
        <TopNavbar />
      </div>
      <div className="md:hidden">
        <Header
          aliasName={user?.aliasName}
          onLoginClick={() => navigate("/login", { state: { from: `/tiket/${id}` } })}
        />
      </div>

      <main className="max-w-4xl w-full mx-auto px-4 md:px-6 py-5 md:py-8 flex flex-col gap-4 md:gap-5">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-brand hover:bg-brand-soft"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke Peta
          </Link>
          <span className="font-mono text-[11px] text-fg-muted">
            {detail.code} · Sinkron {syncLabel}
          </span>
        </div>

        <Card density="none" className="p-4 md:p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={detail.status} />
            <Badge status={detail.tier} size="sm" />
            {detail.isLowQualityOverride && (
              <Badge variant="warning" size="sm" icon={<AlertTriangle className="size-3" />}>
                Kualitas Gambar Rendah
              </Badge>
            )}
            {detail.isFastResolveAnomaly && (
              <Badge variant="warning" size="sm" icon={<AlertTriangle className="size-3" />}>
                Diselesaikan Sangat Cepat (&lt;10 menit) — Cek Foto Lebih Teliti
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <h1 className="font-head font-bold text-xl md:text-3xl leading-snug text-fg">
              {detail.title}
            </h1>
            <p className="font-sans text-sm text-fg-muted">
              {detail.categoryLabel} · {detail.department?.shortName || detail.department?.name || "Dinas terkait"} ·{" "}
              {detail.reporterAlias}
            </p>
            <p className="font-sans text-[13px] leading-[18px] text-fg-muted">
              {detail.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="secondary"
              density="dinas"
              leftIcon={<ThumbsUp className="size-4" />}
              loading={actionLoading === "support"}
              disabled={!detail.uiFlags.canSupport}
              disabledReason={
                !detail.uiFlags.canSupport
                  ? disabledReasons.support || "Dukungan prioritas tidak tersedia."
                  : undefined
              }
              onClick={handleSupport}
            >
              Dukung Prioritas · {detail.supportCount ?? 0}
            </Button>
            {!user && (
              <Link
                to="/login"
                state={{ from: `/tiket/${id}` }}
                className="inline-flex items-center justify-center rounded-xl border border-brand bg-surface px-3.5 min-h-9 text-[13px] font-semibold text-brand hover:bg-brand-soft"
              >
                Masuk untuk ikut menilai
              </Link>
            )}
          </div>
        </Card>

        <Card density="none" className="p-4 md:p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-head font-semibold text-base text-fg">
              Foto Sebelum &amp; Sesudah
            </h2>
            {detail.repairCapturedAt && (
              <span className="font-mono text-[11px] text-fg-muted">
                Diambil {detail.repairDistanceMeters ?? "?"} m dari titik · {formatWib(detail.repairCapturedAt)}
              </span>
            )}
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-surface-2">
            {showBeforeBlur ? (
              <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-600 to-slate-800 p-4 text-center">
                <span className="font-sans text-xs font-semibold text-slate-200">
                  Foto sebelum disamarkan (sedang ditinjau)
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={revealing}
                  onClick={handleRevealBefore}
                >
                  Tampilkan Gambar
                </Button>
              </div>
            ) : beforeSrc ? (
              <img
                src={beforeSrc}
                alt="Foto kondisi sebelum perbaikan"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center p-4">
                <span className="font-sans text-xs text-fg-muted">
                  Foto sebelum belum tersedia.
                </span>
              </div>
            )}

            {!showBeforeBlur && afterSrc && beforeSrc && (
              <img
                src={afterSrc}
                alt="Foto kondisi sesudah perbaikan"
                className="absolute inset-0 size-full object-cover"
                style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
              />
            )}

            {!showBeforeBlur && beforeSrc && (
              <span className="absolute left-2.5 top-2.5 rounded-full bg-slate-900/75 px-2.5 py-1 font-mono text-[10px] font-bold text-white">
                SEBELUM
              </span>
            )}
            {!showBeforeBlur && afterSrc && beforeSrc && (
              <span className="absolute right-2.5 top-2.5 rounded-full bg-brand/90 px-2.5 py-1 font-mono text-[10px] font-bold text-brand-fg">
                SESUDAH
              </span>
            )}
          </div>

          {!showBeforeBlur && afterSrc && beforeSrc && (
            <input
              type="range"
              min={0}
              max={100}
              value={slider}
              onChange={(event) => setSlider(Number(event.target.value))}
              aria-label="Geser perbandingan foto sebelum dan sesudah"
              className="w-full accent-brand"
            />
          )}

          {showBeforeBlur && afterSrc && (
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] font-semibold text-brand">
                Foto Sesudah Perbaikan (Tetap Dapat Diperiksa)
              </span>
              <img
                src={afterSrc}
                alt="Foto kondisi sesudah perbaikan"
                className="aspect-video w-full rounded-xl object-cover border border-line"
              />
            </div>
          )}

          {!afterSrc && (
            <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-fg-muted">
              {isPending
                ? "Foto sesudah sudah diunggah dinas dan sedang menunggu cek warga."
                : isDisputed
                  ? "Dinas sedang memperbaiki ulang. Foto sesudah akan tampil setelah perbaikan baru."
                  : isEscalated
                    ? "Menunggu Berita Acara dan foto live petugas."
                    : "Foto sesudah belum tersedia untuk laporan ini."}
            </div>
          )}

          {detail.beritaAcaraUrl && (
            <a
              href={detail.beritaAcaraUrl}
              target="_blank"
              rel="noreferrer"
              className="self-start text-xs font-semibold text-brand underline-offset-2 hover:underline"
            >
              Lihat Berita Acara Eskalasi
            </a>
          )}
        </Card>

        {isPending && (
          <Card density="none" className="p-4 md:p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-head font-semibold text-base text-fg">
                Kuorum Cek Warga
              </h2>
              <span className="font-mono text-xs font-bold text-brand tabular-nums">
                {quorum.currentWeight} / {quorum.targetWeight} poin ·{" "}
                {quorum.uniqueValidators}/{quorum.minValidators} warga
              </span>
            </div>

            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuenow={quorum.currentWeight}
              aria-valuemin={0}
              aria-valuemax={quorum.targetWeight}
            >
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (quorum.currentWeight / Math.max(0.1, quorum.targetWeight)) * 100
                  )}%`,
                }}
              />
            </div>

            <p className="font-sans text-xs text-fg-muted">
              {quorum.hasEarlySupporter
                ? "Kuorum 2.0 poin karena ada pendukung awal laporan."
                : quorum.targetWeight >= 3
                  ? "Kuorum diperketat ke 3.0 poin / 3 warga karena belum ada pendukung awal."
                  : "Kuorum 2.0 poin dari minimal 2 akun warga berbeda."}
            </p>

            {coolingHold && (
              <div className="rounded-xl border border-sky-200 bg-semantic-info-soft p-3 text-xs text-semantic-info">
                Suara warga sudah cukup — menunggu masa tayang publik hingga{" "}
                {formatWib(quorum.coolingEndsAt)} sebelum dikunci agar transparan.
              </div>
            )}

            {gpsDenied && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                Izin GPS mati. Ketuk ikon gembok di bilah alamat → Izinkan Lokasi → coba lagi.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-fg-muted">
                <MapPin className="mr-1 inline size-3" aria-hidden="true" />
                {gpsLabel(coords)}
              </span>
              <Button
                variant="secondary"
                density="dinas"
                loading={gpsLoading}
                leftIcon={<LocateFixed className="size-4" />}
                onClick={requestGps}
              >
                {coords ? "Perbarui GPS" : "Kunci Lokasi Saya"}
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="primary"
                size="md"
                loading={actionLoading === "confirm"}
                disabled={!canConfirm}
                disabledReason={
                  !canConfirm
                    ? reporterFreeConfirm
                      ? "Suaramu sudah tercatat pada putaran ini."
                      : disabledReasons.confirm ||
                        "Kunci GPS dalam radius 100 m dengan akurasi <= 50 m."
                    : undefined
                }
                leftIcon={<CheckCircle2 className="size-4" />}
                onClick={handleConfirm}
                className="flex-1"
              >
                {reporterFreeConfirm ? "Konfirmasi Tuntas (Pelapor)" : "Sudah Beres"}
              </Button>
              <Button
                variant="danger-outline"
                size="md"
                loading={actionLoading === "dispute"}
                disabled={!canDispute}
                disabledReason={
                  !canDispute
                    ? disabledReasons.dispute ||
                      "Kunci GPS dalam radius 100 m dengan akurasi <= 50 m."
                    : undefined
                }
                leftIcon={<ShieldAlert className="size-4" />}
                onClick={handleDispute}
                className="flex-1"
              >
                {evidencePhoto ? "Kirim Klaim Palsu" : "Klaim Palsu (Ambil Foto)"}
              </Button>
            </div>

            {evidencePhoto && (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-2.5">
                <img
                  src={evidencePhoto}
                  alt="Foto bukti klaim palsu"
                  className="aspect-video w-full rounded-lg object-cover"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success" size="sm">
                    Foto bukti siap
                  </Badge>
                  <Button variant="secondary" size="sm" onClick={() => setCameraOpen(true)}>
                    Ganti Foto
                  </Button>
                </div>
                <Textarea
                  label="Catatan Klaim Palsu (Opsional)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
            )}
          </Card>
        )}

        {isDisputed && (
          <Card density="none" className="p-4 border-purple-200 !bg-purple-50">
            <p className="font-sans text-sm text-purple-900">
              Laporan sedang dibantah warga. Dinas wajib merespons dalam 24 jam
              sejak {formatWib(detail.disputedAt)}.
            </p>
          </Card>
        )}

        {isEscalated && (
          <Card density="none" className="p-4 border-red-200 !bg-red-50">
            <p className="font-sans text-sm text-red-900">
              Eskalasi Pengawasan: tombol selesai dinas terkunci sampai Berita
              Acara dan foto live petugas diunggah.
            </p>
          </Card>
        )}

        {isTerminal && (
          <Card
            density="none"
            className={[
              "p-4",
              status === "REJECTED_SPAM"
                ? "border-red-200 !bg-red-50 text-red-900"
                : status === "OUT_OF_SCOPE"
                  ? "border-amber-200 !bg-amber-50 text-amber-900"
                  : "border-green-200 !bg-green-50 text-green-900",
            ].join(" ")}
          >
            <p className="font-sans text-sm">
              {detail.closedResolutionNote ||
                (status === "AUTO_CLOSED"
                  ? "Ditutup otomatis setelah 72 jam tanpa bantahan warga."
                  : status === "OUT_OF_SCOPE"
                    ? `Dirujuk ke ${detail.outOfScopeAgency || "instansi lain"}: ${detail.outOfScopeReason || ""}`
                    : status === "REJECTED_SPAM"
                      ? `Ditolak sebagai spam: ${detail.rejectedSpamReason || ""}`
                      : "Laporan sudah selesai dan terverifikasi.")}
            </p>
          </Card>
        )}

        {(isClosed || (ratings && ratings.count && ratings.count > 0)) && (
          <Card density="none" className="p-4 md:p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-head font-semibold text-base text-fg">
                Rating Kinerja Dinas
              </h2>
              <span className="font-mono text-xs text-fg-muted">
                {ratings?.average ? `${ratings.average.toFixed(1)} / 5` : "Belum ada rating"} (
                {ratings?.count || 0} ulasan)
              </span>
            </div>

            {ratings?.items?.length ? (
              <div className="flex flex-col gap-2">
                {ratings.items.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-xl bg-surface-2 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-amber-600">
                        {starRow(item.stars)}
                      </span>
                      <span className="font-mono text-[10px] text-fg-muted">
                        {item.citizenAlias}
                      </span>
                    </div>
                    <p className="font-sans text-xs text-fg">{item.comment}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {ratings?.canRate && (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                <p className="font-sans text-sm font-semibold text-fg">
                  Beri Rating Kinerja Dinas (1–5 Bintang)
                </p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${star} bintang`}
                      aria-pressed={ratingStars === star}
                      onClick={() => setRatingStars(star)}
                      className="rounded p-1 text-2xl leading-none text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {star <= ratingStars ? "★" : "☆"}
                    </button>
                  ))}
                </div>
                <Textarea
                  label="Alasan Singkat"
                  value={ratingComment}
                  onChange={(event) => setRatingComment(event.target.value)}
                  minChars={5}
                  rows={2}
                  maxLength={200}
                  placeholder="Contoh: Perbaikan rapi dan selesai lebih cepat dari tenggat."
                />
                <Button
                  variant="primary"
                  size="md"
                  loading={actionLoading === "rating"}
                  onClick={handleRate}
                  className="self-start"
                >
                  Kirim Rating
                </Button>
              </div>
            )}
            {!ratings?.canRate && isClosed && !user && (
              <p className="font-sans text-xs text-fg-muted">
                Masuk sebagai warga untuk memberi rating pada laporan yang sudah tuntas.
              </p>
            )}
          </Card>
        )}

        <Card density="none" className="p-4 md:p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-head font-semibold text-base text-fg">
              Segel Anti-Rekayasa
            </h2>
            <Button
              variant="secondary"
              size="sm"
              loading={auditLoading}
              leftIcon={<ShieldCheck className="size-4" />}
              onClick={handleVerifyAudit}
            >
              Verifikasi Rantai
            </Button>
          </div>
          <p className="font-sans text-xs text-fg-muted">
            Setiap perubahan status dikunci segel digital. Jika ada yang mengubah
            jam/status diam-diam di server, tombol di atas akan langsung mendeteksi
            pelanggaran.
          </p>
          {audit && (
            <div
              className={[
                "rounded-xl border p-3 text-sm",
                audit.verifiedChain
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-red-200 bg-red-50 text-red-900",
              ].join(" ")}
            >
              {audit.verifiedChain
                ? `Aman — seluruh ${audit.totalEntries} catatan riwayat utuh dan tersegel.`
                : `Peringatan — terdeteksi perubahan pada catatan ke-${(audit.tamperedAtIndex ?? 0) + 1}.`}
            </div>
          )}
        </Card>

        {detail.timeline && detail.timeline.length > 0 && (
          <Card density="none" className="p-4 md:p-5 flex flex-col gap-3">
            <h2 className="font-head font-semibold text-base text-fg">
              Riwayat Penanganan
            </h2>
            <div className="flex flex-col gap-2">
              {detail.timeline
                .slice()
                .reverse()
                .slice(0, 8)
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-line bg-surface-2 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-head text-xs font-semibold text-fg">
                        {entry.toStatusLabel || entry.action}
                      </span>
                      <span className="font-mono text-[10px] text-fg-muted">
                        {formatWib(entry.createdAt)}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="font-sans text-xs text-fg-muted">{entry.note}</p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-fg-muted">
                      {entry.actorDisplayLabel || "Sistem LaporPAK!"} ·{" "}
                      {(entry.currentHash || "").slice(0, 16)}…
                    </p>
                  </div>
                ))}
            </div>
          </Card>
        )}

        {actionError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {actionError}
          </div>
        )}

        {!gpsReady && isPending && (
          <Card density="none" className="p-3 border-amber-200 !bg-amber-50">
            <p className="font-sans text-xs text-amber-900">
              <Clock className="mr-1 inline size-3.5" aria-hidden="true" />
              Kunci GPS untuk tombol Sudah Beres / Klaim Palsu aktif. Pelapor pada
              jendela 48–72 jam dapat konfirmasi tanpa GPS.
            </p>
          </Card>
        )}
      </main>

      <LiveCameraCapture
        open={cameraOpen}
        publicLat={coords?.lat ?? detail.publicLat}
        publicLng={coords?.lng ?? detail.publicLng}
        categoryCode={detail.category}
        gpsAccuracy={coords?.accuracy ?? null}
        onClose={() => setCameraOpen(false)}
        onCapture={({ photoBase64, clientNsfwScore: nsfwScore }) => {
          setEvidencePhoto(photoBase64);
          setClientNsfwScore(Number(nsfwScore ?? 0));
          setCameraOpen(false);
        }}
      />
    </div>
  );
}

export default WargaTiketPage;
