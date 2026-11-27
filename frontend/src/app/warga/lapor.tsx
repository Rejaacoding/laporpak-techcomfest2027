import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Construction,
  Lightbulb,
  LocateFixed,
  MapPin,
  Megaphone,
  RefreshCw,
  Send,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Trees,
  Waves,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  Input,
  Textarea,
  useToast,
} from "../../components/ui/index.js";
import {
  checkTicketRadius,
  createTicket,
  fetchSampleAsBase64,
  issueCaptureNonce,
  onJuryEvent,
  supportTicket,
} from "../../lib/api.js";
import { humanizeError } from "../../lib/humanize.js";
import {
  clearLaporDraft,
  createIdempotencyKey,
  loadLaporDraft,
  saveLaporDraft,
  validateLaporDraftForSubmit,
} from "../../lib/laporDraft.ts";
import {
  inferRegionFromCoords,
  projectCoordToMapPercent,
} from "../../lib/ticketMappers.ts";
import { CATEGORIES, SLA_TIERS } from "../../constants/designTokens.js";
import LiveCameraCapture from "../../features/camera/LiveCameraCapture.jsx";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  JALAN_AMBLES: AlertTriangle,
  KABEL_MENJUNTAI: Zap,
  POHON_TUMBANG: Trees,
  PJU_MATI: Lightbulb,
  SAMPAH_LIAR: Trash2,
  SALURAN_TERSUMBAT: Waves,
  REKLAME_LIAR: Megaphone,
  JALAN_BERLUBANG: Construction,
};

const STEPS = [
  "1. Titik & Kategori",
  "2. Foto Live TKP",
  "3. Kirim",
] as const;

interface RadiusNearbyTicket {
  id: string;
  code?: string;
  title: string;
  status: string;
  distanceMeters: number;
  supportCount: number;
}

interface RadiusCheckResult {
  insideServiceArea: boolean;
  sameCategoryCount50m: number;
  sameCategoryLimit: number;
  globalCount30m: number;
  globalLimit: number;
  isQuotaFull: boolean;
  canOpenCamera: boolean;
  guidanceText: string;
  nearbyTickets: RadiusNearbyTicket[];
}

/**
 * Buat Laporan (/lapor) — live GPS, radius quota, WebRTC camera and submit API.
 */
export function WargaLaporPage() {
  const navigate = useNavigate();
  const { user, accessToken, isJuryMode } = useAuth();
  const { showToast } = useToast();

  const [draft, setDraft] = useState(loadLaporDraft);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [radiusLoading, setRadiusLoading] = useState(false);
  const [radiusResult, setRadiusResult] = useState<RadiusCheckResult | null>(null);
  const [supportingId, setSupportingId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  useEffect(() => {
    saveLaporDraft(draft);
  }, [draft]);

  const checkRadius = useCallback(async () => {
    setRadiusLoading(true);
    try {
      const result = await checkTicketRadius({
        lat: draft.lat,
        lng: draft.lng,
        category: draft.category,
      });
      setRadiusResult(result);
    } catch (err) {
      setRadiusResult(null);
      showToast({ type: "error", error: err });
    } finally {
      setRadiusLoading(false);
    }
  }, [draft.lat, draft.lng, draft.category, showToast]);

  useEffect(() => {
    checkRadius();
  }, [checkRadius]);

  useEffect(() => {
    const offGps = onJuryEvent(
      "gps",
      (coords: { lat?: number; lng?: number; accuracyMeters?: number }) => {
        const lat = Number(coords?.lat);
        const lng = Number(coords?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setGpsDenied(false);
        setDraft((prev) => ({
          ...prev,
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          gpsAccuracyMeters: Number(coords?.accuracyMeters ?? 10),
        }));
        showToast({ type: "info", message: "Koordinat GPS simulasi juri diterapkan." });
      }
    );

    const offCapture = onJuryEvent(
      "capture",
      async (detail: { samplePath?: string; lat?: number; lng?: number }) => {
        if (!detail?.samplePath) return;
        try {
          const photoBase64 = await fetchSampleAsBase64(detail.samplePath);
          setDraft((prev) => ({
            ...prev,
            photoBase64,
            isLowQualityOverride: false,
            ...(Number.isFinite(Number(detail.lat)) && Number.isFinite(Number(detail.lng))
              ? {
                  lat: Number(Number(detail.lat).toFixed(6)),
                  lng: Number(Number(detail.lng).toFixed(6)),
                  gpsAccuracyMeters: 10,
                }
              : {}),
          }));
          showToast({ type: "success", message: "Foto sampel simulasi juri siap dikirim." });
        } catch (err) {
          showToast({ type: "error", error: err });
        }
      }
    );

    return () => {
      offGps();
      offCapture();
    };
  }, [showToast]);

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsDenied(true);
      showToast({
        type: "warning",
        title: "GPS tidak tersedia",
        message: "Perangkat ini belum mendukung pembacaan lokasi.",
      });
      return;
    }
    setGpsLoading(true);
    setGpsDenied(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((prev) => ({
          ...prev,
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          gpsAccuracyMeters: Math.round(position.coords.accuracy),
        }));
        setGpsLoading(false);
        showToast({
          type: "success",
          title: "Lokasi terkunci",
          message: `Akurasi ${Math.round(position.coords.accuracy)} m. Pin peta mengikuti posisimu.`,
        });
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsDenied(true);
        } else {
          showToast({
            type: "warning",
            message:
              "Posisi GPS belum terkunci. Menepi ke area terbuka lalu tekan Perbarui Lokasi.",
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [showToast]);

  if (user?.role === "ADMIN_DINAS") {
    return <Navigate to="/dinas" replace />;
  }

  const gpsInaccurate =
    draft.gpsAccuracyMeters !== null && draft.gpsAccuracyMeters > 50;
  const selectedCategory = CATEGORIES.find(
    (category: { code: string }) => category.code === draft.category
  );
  const selectedTier = selectedCategory
    ? SLA_TIERS[selectedCategory.tier as keyof typeof SLA_TIERS]
    : null;
  const activeStep = draft.photoBase64
    ? 2
    : draft.gpsAccuracyMeters !== null
      ? 1
      : 0;
  const mapPin = projectCoordToMapPercent(draft.lat, draft.lng);
  const region = inferRegionFromCoords(draft.lat, draft.lng);
  const canAttemptCamera = Boolean(user) || isJuryMode;

  let cameraBlockedReason = "";
  if (draft.gpsAccuracyMeters === null) {
    cameraBlockedReason = "Kunci lokasi GPS terlebih dahulu sebelum membuka kamera.";
  } else if (gpsInaccurate) {
    cameraBlockedReason = "Akurasi GPS harus 50 meter atau lebih baik.";
  } else if (radiusLoading) {
    cameraBlockedReason = "Sedang memeriksa kuota laporan di sekitar titik ini.";
  } else if (!radiusResult) {
    cameraBlockedReason = "Pemeriksaan radius belum selesai. Coba muat ulang.";
  } else if (!radiusResult.insideServiceArea) {
    cameraBlockedReason =
      "Lokasi berada di luar wilayah layanan Surabaya & Sidoarjo.";
  } else if (radiusResult.isQuotaFull) {
    cameraBlockedReason =
      "Kuota laporan aktif di titik ini penuh. Dukung Prioritas laporan sekitar.";
  } else if (!radiusResult.canOpenCamera) {
    cameraBlockedReason = "Kamera belum dapat dibuka pada titik ini.";
  }

  const handleOpenCamera = () => {
    if (!user && !isJuryMode) {
      showToast({
        type: "info",
        title: "Masuk dulu, draf tetap aman",
        message: "Kami simpan isianmu di perangkat dan lanjutkan setelah masuk.",
      });
      navigate("/login", { state: { from: "/lapor" } });
      return;
    }
    if (cameraBlockedReason) {
      showToast({
        type: "warning",
        title: "Kamera belum bisa dibuka",
        message: cameraBlockedReason,
      });
      return;
    }
    setCameraOpen(true);
  };

  const handleSupport = async (nearby: RadiusNearbyTicket) => {
    if (!user && !isJuryMode) {
      showToast({
        type: "info",
        title: "Masuk dulu untuk mendukung",
        message: "Draf laporanmu tetap tersimpan di perangkat.",
      });
      navigate("/login", { state: { from: "/lapor" } });
      return;
    }
    setSupportingId(nearby.id);
    try {
      await supportTicket(nearby.id, accessToken);
      showToast({
        type: "success",
        title: "Dukungan tercatat",
        message: "Dukungan membantu mempercepat batas SLA dinas.",
      });
      await checkRadius();
    } catch (err) {
      showToast({ type: "error", error: err });
    } finally {
      setSupportingId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError("");

    const validationError = validateLaporDraftForSubmit(draft);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    if (!user && !isJuryMode) {
      showToast({
        type: "info",
        title: "Masuk dulu untuk mengirim",
        message: "Seluruh isian dan foto tetap tersimpan di perangkatmu.",
      });
      navigate("/login", { state: { from: "/lapor" } });
      return;
    }

    setSubmitting(true);
    try {
      const nonce = await issueCaptureNonce(
        { actionType: "CREATE_TICKET" },
        accessToken
      );
      const captureNonce = nonce?.captureNonce || nonce?.nonce;
      if (!captureNonce) {
        throw new Error("Kupon foto tidak diterima. Silakan ambil foto ulang.");
      }

      const created = await createTicket(
        {
          title: draft.title.trim(),
          description: draft.description.trim(),
          category: draft.category,
          lat: draft.lat,
          lng: draft.lng,
          gpsAccuracyMeters: draft.gpsAccuracyMeters,
          captureNonce,
          photoBase64: draft.photoBase64,
          isLowQualityOverride: draft.isLowQualityOverride,
          clientNsfwScore: draft.clientNsfwScore ?? 0,
        },
        {
          token: accessToken,
          idempotencyKey: draft.idempotencyKey,
        }
      );

      clearLaporDraft();
      setCreatedTicketId(created?.id || "tercatat");
      setDraft({
        ...loadLaporDraft(),
        idempotencyKey: createIdempotencyKey(),
      });
      showToast({
        type: "success",
        title: "Laporan terkirim",
        message: "Timer penanganan dinas mulai berjalan.",
      });
    } catch (err) {
      const message = humanizeError(err);
      setSubmitError(message);
      showToast({ type: "error", error: err });
    } finally {
      setSubmitting(false);
    }
  };

  if (createdTicketId) {
    return (
      <div className="min-h-screen bg-bg text-fg flex flex-col pb-24 md:pb-10">
        <div className="hidden md:block">
          <TopNavbar />
        </div>
        <div className="md:hidden">
          <Header />
        </div>
        <main className="max-w-lg w-full mx-auto px-4 py-10">
          <Card density="none" className="p-6 text-center flex flex-col items-center gap-4">
            <CheckCircle2 className="size-12 text-brand" aria-hidden="true" />
            <h1 className="font-head font-bold text-2xl text-fg">
              Laporan Berhasil Terkirim
            </h1>
            <p className="font-sans text-sm text-fg-muted">
              Identitasmu tetap disamarkan. Dinas terkait sudah menerima
              penugasan dan timer SLA mulai berjalan.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
              {createdTicketId !== "tercatat" && (
                <Link
                  to={`/tiket/${createdTicketId}`}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand text-brand-fg min-h-12 px-5 font-head font-semibold hover:brightness-110"
                >
                  Lihat Status Tiket
                </Link>
              )}
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => setCreatedTicketId(null)}
              >
                Buat Laporan Lain
              </Button>
            </div>
          </Card>
        </main>
        <BottomNavbar activeTab="lapor" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col pb-24 md:pb-10">
      <div className="hidden md:block">
        <TopNavbar />
      </div>
      <div className="md:hidden">
        <Header />
      </div>

      <div className="bg-surface-2 border-b border-line px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-1.5 overflow-x-auto">
          {STEPS.map((step, index) => {
            const active = activeStep === index;
            return (
              <span
                key={step}
                className={[
                  "rounded-full px-2.5 py-1 font-head text-[11px] whitespace-nowrap",
                  active
                    ? "bg-brand text-brand-fg font-semibold"
                    : "bg-surface/75 text-fg-muted font-medium",
                ].join(" ")}
              >
                {step}
              </span>
            );
          })}
        </div>
      </div>

      <main className="max-w-3xl w-full mx-auto px-4 md:px-6 py-5 md:py-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <Card density="none" className="p-3.5 md:p-4 flex flex-col gap-3">
            <div className="relative h-[180px] md:h-[220px] w-full rounded-xl border border-line bg-[#E2ECE9] overflow-hidden">
              <svg
                viewBox="0 0 320 180"
                preserveAspectRatio="none"
                className="absolute inset-0 size-full pointer-events-none"
                aria-hidden="true"
              >
                <line x1="-10" y1="98" x2="330" y2="82" stroke="#FFFFFF" strokeWidth="10" />
                <line x1="165" y1="-10" x2="152" y2="190" stroke="#FFFFFF" strokeWidth="8" />
                <polygon
                  points="95,18 225,18 288,90 225,162 95,162 28,90"
                  fill="rgba(15, 118, 110, 0.08)"
                  stroke="#0F766E"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                />
                <circle
                  cx="162"
                  cy="88"
                  r="32"
                  fill="rgba(15, 118, 110, 0.16)"
                  stroke="rgba(15, 118, 110, 0.6)"
                  strokeWidth="1.5"
                />
              </svg>

              <span
                style={{ left: `${mapPin.mapX}%`, top: `${mapPin.mapY}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 size-[30px] rounded-full bg-brand border-[2.5px] border-surface text-brand-fg flex items-center justify-center shadow-md"
                aria-hidden="true"
              >
                <MapPin className="size-[15px]" />
              </span>

              <div className="absolute top-2.5 left-2.5">
                <Badge
                  variant={gpsInaccurate ? "error" : draft.gpsAccuracyMeters === null ? "warning" : "success"}
                  size="sm"
                  icon={null}
                >
                  <span className="font-mono font-bold text-[10px]">
                    {draft.gpsAccuracyMeters === null
                      ? "GPS belum dikunci"
                      : `Akurasi ${draft.gpsAccuracyMeters} m (${gpsInaccurate ? "Perbaiki" : "Aman"})`}
                  </span>
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-fg min-w-0">
                <MapPin className="size-4 text-brand shrink-0" aria-hidden="true" />
                <span className="font-sans font-semibold text-[13px] leading-[18px] truncate">
                  {region} · {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                </span>
              </div>
              <Button
                variant="secondary"
                density="dinas"
                loading={gpsLoading}
                leftIcon={<LocateFixed className="size-4" />}
                onClick={requestGps}
              >
                {draft.gpsAccuracyMeters === null
                  ? "Kunci Lokasi GPS"
                  : "Perbarui Lokasi GPS"}
              </Button>
            </div>

            {gpsDenied && (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2"
              >
                <p className="font-semibold">Izin lokasi (GPS) mati di browsermu</p>
                <p className="text-xs leading-relaxed">
                  Ketuk ikon gembok di bilah alamat → pilih{" "}
                  <strong>Izinkan Lokasi</strong> → lalu tekan tombol Coba Lagi.
                </p>
                <Button variant="secondary" density="dinas" onClick={requestGps}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Coba Lagi
                </Button>
              </div>
            )}

            {gpsInaccurate && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2"
              >
                <AlertTriangle className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  Akurasi GPS masih {draft.gpsAccuracyMeters} m (wajib &lt;= 50
                  m). Menepi ke area terbuka lalu tekan Perbarui Lokasi.
                </p>
              </div>
            )}

            <div className="rounded-xl bg-surface-2 border border-line p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans font-semibold text-xs text-fg">
                  Kuota titik radius 50 m
                </span>
                <span className="rounded-full bg-surface px-2 py-0.5 font-mono font-bold text-[10px] text-brand">
                  {radiusLoading
                    ? "Memeriksa..."
                    : radiusResult
                      ? `${radiusResult.sameCategoryCount50m}/${radiusResult.sameCategoryLimit} laporan sama`
                      : "Belum tersedia"}
                </span>
              </div>

              {radiusResult && (
                <p className="font-sans text-[11px] leading-4 text-fg-muted">
                  {radiusResult.guidanceText} · Radius 30 m:{" "}
                  {radiusResult.globalCount30m}/{radiusResult.globalLimit}
                </p>
              )}

              {radiusResult?.nearbyTickets?.length ? (
                <div className="flex flex-col gap-1.5">
                  {radiusResult.nearbyTickets.slice(0, 3).map((nearby) => (
                    <div
                      key={nearby.id}
                      className="rounded-[10px] bg-surface border border-line p-2.5 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-head font-semibold text-xs text-fg truncate">
                          {nearby.title}
                        </span>
                        <span className="font-sans text-[11px] text-fg-muted">
                          {Math.round(nearby.distanceMeters)} m ·{" "}
                          {nearby.supportCount} dukungan
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={supportingId === nearby.id}
                        onClick={() => handleSupport(nearby)}
                      >
                        <ThumbsUp className="size-3.5" aria-hidden="true" />
                        Dukung
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-sans text-[11px] text-fg-muted">
                  Belum ada laporan aktif dalam radius titik ini.
                </p>
              )}
            </div>
          </Card>

          <section aria-label="Pilih kategori masalah" className="flex flex-col gap-2.5">
            <h2 className="font-head font-semibold text-[15px] leading-5 text-fg">
              Pilih Kategori Masalah (Wajib)
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CATEGORIES.map((category: { code: string; label: string; tier?: string }) => {
                const active = draft.category === category.code;
                const Icon = CATEGORY_ICONS[category.code] || AlertTriangle;
                return (
                  <button
                    key={category.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, category: category.code }))
                    }
                    className={[
                      "min-h-12 px-2.5 py-2 rounded-xl text-left flex flex-col justify-center gap-1 cursor-pointer",
                      "transition duration-150 ease-out motion-reduce:transition-none",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                      active
                        ? "bg-brand-soft border-2 border-brand text-brand"
                        : "bg-surface border border-line text-fg hover:bg-surface-2",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon
                        className={[
                          "size-4 shrink-0",
                          active ? "text-brand" : "text-fg-muted",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                      <span className="font-sans font-semibold text-[13px] leading-[17px]">
                        {category.label}
                      </span>
                    </span>
                    {category.tier && (
                      <span className="self-start">
                        <Badge status={category.tier} size="sm" icon={null} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <Card density="none" className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-head font-semibold text-[15px] leading-5 text-fg">
                2. Foto Langsung di Lokasi (Wajib)
              </h2>
              {selectedTier && (
                <Badge variant="neutral" size="sm" icon={null}>
                  {selectedTier.label}
                </Badge>
              )}
            </div>

            <div className="rounded-xl bg-surface-2 px-3 py-2.5 flex items-start gap-2">
              <ShieldCheck className="size-4 text-brand mt-0.5 shrink-0" aria-hidden="true" />
              <p className="font-sans text-xs leading-[17px] text-fg">
                Wajib foto langsung di lokasi agar terbukti kejadian nyata hari
                ini (bukan foto lama/internet). Menepi dulu di tempat aman.
              </p>
            </div>

            {draft.photoBase64 ? (
              <div className="flex flex-col gap-2.5">
                <img
                  src={draft.photoBase64}
                  alt="Foto kerusakan yang diambil"
                  className="aspect-video w-full rounded-xl object-cover border border-line"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success" size="sm" icon={<CheckCircle2 className="size-3" />}>
                    Foto live siap dikirim
                  </Badge>
                  {draft.isLowQualityOverride && (
                    <Badge variant="warning" size="sm">
                      Kualitas foto rendah — tetap dikirim
                    </Badge>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Camera className="size-4" />}
                  onClick={handleOpenCamera}
                  className="self-start"
                >
                  Jepret Ulang Foto
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="lg"
                leftIcon={<Camera className="size-5" />}
                onClick={handleOpenCamera}
                disabled={Boolean(cameraBlockedReason) && canAttemptCamera}
                disabledReason={
                  canAttemptCamera ? cameraBlockedReason || undefined : undefined
                }
                className="w-full"
              >
                Buka Kamera Live TKP
              </Button>
            )}

            <Input
              label="Judul Singkat Kerusakan"
              value={draft.title}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              maxLength={120}
              placeholder="Contoh: Jalan berlubang dalam di depan pasar"
              helperText="Minimal 5 karakter agar petugas mudah menemukan laporan."
            />

            <Textarea
              label="Catatan Kerusakan"
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
              minChars={10}
              rows={3}
              maxLength={1000}
              placeholder="Ceritakan patokan lokasi atau tingkat bahayanya..."
            />
          </Card>

          {submitError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {submitError}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            leftIcon={<Send className="size-4" />}
            className="w-full"
          >
            {submitError ? "Kirim Ulang Laporan" : "Kirim Laporan"}
          </Button>
        </form>
      </main>

      <BottomNavbar activeTab="lapor" />

      <LiveCameraCapture
        open={cameraOpen}
        publicLat={draft.lat}
        publicLng={draft.lng}
        categoryCode={draft.category}
        gpsAccuracy={draft.gpsAccuracyMeters}
        onClose={() => setCameraOpen(false)}
        onCapture={({ photoBase64, isLowQualityOverride, clientNsfwScore }) => {
          setDraft((prev) => ({
            ...prev,
            photoBase64,
            isLowQualityOverride: Boolean(isLowQualityOverride),
            clientNsfwScore: Number(clientNsfwScore ?? 0),
          }));
          setCameraOpen(false);
        }}
      />
    </div>
  );
}

export default WargaLaporPage;
