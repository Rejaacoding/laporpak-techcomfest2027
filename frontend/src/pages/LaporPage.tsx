import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  LocateFixed,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";
import { CATEGORIES, SLA_TIERS } from "../constants/designTokens.js";
import { humanizeError } from "../lib/humanize.js";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
  useToast,
} from "../components/ui/index.js";
import { LiveCameraViewfinder } from "../components/lapor/LiveCameraViewfinder.tsx";

const DRAFT_STORAGE_KEY = "laporpak_draft_v1";

interface NearbyTicket {
  id: string;
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
  nearbyTickets: NearbyTicket[];
}

interface DraftState {
  category: string;
  lat: number;
  lng: number;
  gpsAccuracyMeters: number | null;
  title: string;
  description: string;
  photoBase64: string | null;
  isLowQualityOverride: boolean;
  idempotencyKey: string;
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadDraft(): DraftState {
  const defaults: DraftState = {
    category: CATEGORIES[0].code,
    lat: -7.2575,
    lng: 112.7521,
    gpsAccuracyMeters: null,
    title: "",
    description: "",
    photoBase64: null,
    isLowQualityOverride: false,
    idempotencyKey: createIdempotencyKey(),
  };

  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      idempotencyKey: parsed.idempotencyKey || defaults.idempotencyKey,
    };
  } catch {
    return defaults;
  }
}

export default function LaporPage() {
  const { user, accessToken } = useAuth();
  const { showToast } = useToast();

  const [draft, setDraft] = useState<DraftState>(loadDraft);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [radiusLoading, setRadiusLoading] = useState(false);
  const [radiusResult, setRadiusResult] = useState<RadiusCheckResult | null>(null);
  const [supportingId, setSupportingId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  // Persist draft automatically so photo & text survive network/session issues
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage quota errors
    }
  }, [draft]);

  const checkRadius = useCallback(
    async (lat: number, lng: number, category: string) => {
      setRadiusLoading(true);
      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          category,
        });
        const res = await fetch(`/api/tickets/check-radius?${params.toString()}`);
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(humanizeError({ status: res.status, data: payload }));
        }
        setRadiusResult(payload?.data || null);
      } catch (err) {
        showToast({ type: "error", error: err });
      } finally {
        setRadiusLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    checkRadius(draft.lat, draft.lng, draft.category);
  }, [draft.lat, draft.lng, draft.category, checkRadius]);

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsDenied(true);
      return;
    }
    setGpsLoading(true);
    setGpsDenied(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((prev) => ({
          ...prev,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          gpsAccuracyMeters: Math.round(pos.coords.accuracy),
        }));
        setGpsLoading(false);
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

  // ADMIN_DINAS cannot access /lapor (US-011)
  if (user?.role === "ADMIN_DINAS") {
    return <Navigate to="/dinas" replace />;
  }

  const handleSupport = async (ticketId: string) => {
    setSupportingId(ticketId);
    try {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const res = await fetch(`/api/tickets/${ticketId}/support`, {
        method: "POST",
        headers,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(humanizeError({ status: res.status, data: payload }));
      }
      showToast({
        type: "success",
        message: "Dukungan prioritasmu berhasil dicatat.",
      });
      await checkRadius(draft.lat, draft.lng, draft.category);
    } catch (err) {
      showToast({ type: "error", error: err });
    } finally {
      setSupportingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!draft.photoBase64) {
      setSubmitError("Ambil foto kerusakan lewat kamera langsung terlebih dahulu.");
      return;
    }
    if (draft.title.trim().length < 5) {
      setSubmitError("Judul singkat minimal 5 karakter.");
      return;
    }
    if (draft.description.trim().length < 10) {
      setSubmitError("Catatan kerusakan minimal 10 karakter.");
      return;
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      // 1. Obtain action-bound capture nonce
      const nonceRes = await fetch("/api/capture-nonce", {
        method: "POST",
        headers,
        body: JSON.stringify({ actionType: "CREATE_TICKET" }),
      });
      const noncePayload = await nonceRes.json().catch(() => null);
      if (!nonceRes.ok) {
        throw { status: nonceRes.status, data: noncePayload };
      }
      const captureNonce = noncePayload?.data?.captureNonce || noncePayload?.data?.nonce;

      // 2. Submit ticket with stable Idempotency-Key
      const ticketRes = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          ...headers,
          "Idempotency-Key": draft.idempotencyKey,
        },
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim(),
          category: draft.category,
          lat: draft.lat,
          lng: draft.lng,
          gpsAccuracyMeters: draft.gpsAccuracyMeters ?? 25,
          captureNonce,
          photoBase64: draft.photoBase64,
          isLowQualityOverride: draft.isLowQualityOverride,
          clientNsfwScore: 0,
        }),
      });
      const ticketPayload = await ticketRes.json().catch(() => null);
      if (!ticketRes.ok) {
        throw { status: ticketRes.status, data: ticketPayload };
      }

      const newId = ticketPayload?.data?.id;
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setCreatedTicketId(newId || "tercatat");
      showToast({
        type: "success",
        message: "Laporan berhasil dikirim. Timer penanganan dinas mulai berjalan.",
      });
    } catch (err) {
      const msg = humanizeError(err);
      setSubmitError(msg);
      showToast({ type: "error", error: err });
    } finally {
      setSubmitting(false);
    }
  };

  const gpsInaccurate =
    draft.gpsAccuracyMeters !== null && draft.gpsAccuracyMeters > 50;
  const selectedCategory = CATEGORIES.find((c) => c.code === draft.category);
  const selectedTier = selectedCategory ? SLA_TIERS[selectedCategory.tier] : null;
  const canOpenCamera =
    Boolean(radiusResult?.canOpenCamera) && !gpsInaccurate && !radiusLoading;

  if (createdTicketId) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-bg text-fg py-10 px-4">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="text-center space-y-4 py-4">
              <CheckCircle2
                className="size-12 text-brand mx-auto"
                aria-hidden="true"
              />
              <h1 className="font-head font-bold text-2xl">
                Laporan Berhasil Terkirim
              </h1>
              <p className="text-sm text-fg-muted">
                Terima kasih sudah ikut menjaga fasilitas publik. Identitasmu
                tetap disamarkan dan dinas terkait sudah menerima penugasan.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {createdTicketId !== "tercatat" && (
                  <Link
                    to={`/tiket/${createdTicketId}`}
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand text-brand-fg min-h-12 px-5 font-semibold hover:brightness-110"
                  >
                    Lihat Status Tiket
                  </Link>
                )}
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setCreatedTicketId(null);
                    setDraft({
                      ...loadDraft(),
                      idempotencyKey: createIdempotencyKey(),
                    });
                  }}
                >
                  Buat Laporan Lain
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-bg text-fg py-8 px-4 md:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Lapor Tanpa Ribet · Surabaya & Sidoarjo
          </p>
          <h1 className="font-head font-bold text-2xl md:text-3xl">
            Laporkan Kerusakan Fasilitas
          </h1>
          <p className="text-sm text-fg-muted">
            Langsung lapor dari lokasi kejadian tanpa perlu daftar akun. Draf
            otomatis tersimpan aman di perangkatmu.
          </p>
        </header>

        {/* LANGKAH 1: Lokasi & Kategori */}
        <Card>
          <CardHeader>
            <CardTitle>1. Pilih Kategori & Titik Lokasi</CardTitle>
            {selectedTier && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${selectedTier.chipClass}`}
              >
                {selectedTier.label}
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="lapor-category"
                className="block text-sm font-medium mb-1"
              >
                Jenis Kerusakan
              </label>
              <select
                id="lapor-category"
                value={draft.category}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, category: e.target.value }))
                }
                className="w-full min-h-12 rounded-xl border border-line bg-surface px-4 text-base text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                variant="secondary"
                loading={gpsLoading}
                onClick={requestGps}
                className="w-full sm:w-auto"
              >
                <LocateFixed className="size-5" aria-hidden="true" />
                {draft.gpsAccuracyMeters !== null
                  ? "Perbarui Lokasi GPS"
                  : "Kunci Lokasi GPS Saat Ini"}
              </Button>

              <div className="flex items-center gap-2 text-xs font-mono text-fg-muted">
                <MapPin className="size-4 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
                  {draft.gpsAccuracyMeters !== null &&
                    ` · Akurasi ${draft.gpsAccuracyMeters} m`}
                </span>
              </div>
            </div>

            {/* Izin GPS ditolak */}
            {gpsDenied && (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 space-y-2"
              >
                <p className="font-semibold">
                  Izin lokasi (GPS) mati di browsermu
                </p>
                <p className="text-xs leading-relaxed">
                  Ketuk ikon gembok di bilah alamat → pilih{" "}
                  <strong>Izinkan Lokasi</strong> → lalu tekan tombol{" "}
                  <strong>Coba Lagi</strong>.
                </p>
                <Button variant="secondary" density="dinas" onClick={requestGps}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Coba Lagi
                </Button>
              </div>
            )}

            {/* Akurasi GPS > 50m */}
            {gpsInaccurate && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 flex items-start gap-2.5"
              >
                <AlertTriangle className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  Akurasi GPS masih {draft.gpsAccuracyMeters} m (wajib &lt;= 50
                  m). Menepi ke area terbuka lalu tekan{" "}
                  <strong>Perbarui Lokasi GPS</strong>.
                </p>
              </div>
            )}

            {/* Status Poligon & Kuota Pra-Kamera */}
            {radiusResult && (
              <div
                className={[
                  "rounded-xl border p-3.5 text-sm",
                  !radiusResult.insideServiceArea || radiusResult.isQuotaFull
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-brand/30 bg-brand-soft/40 text-fg",
                ].join(" ")}
              >
                <p className="font-medium">{radiusResult.guidanceText}</p>
              </div>
            )}

            {/* Daftar nearbyTickets + 1 klik Dukung Prioritas sebelum kamera dibuka */}
            {radiusResult && radiusResult.nearbyTickets.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  Laporan Aktif di Sekitar Titik (50 m)
                </p>
                <div className="space-y-2">
                  {radiusResult.nearbyTickets.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/60 p-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={t.status} size="sm" />
                          <span className="text-xs font-mono text-fg-muted">
                            {Math.round(t.distanceMeters)} m · {t.supportCount} dukungan
                          </span>
                        </div>
                        <p className="text-sm font-medium text-fg truncate">
                          {t.title}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        density="dinas"
                        loading={supportingId === t.id}
                        onClick={() => handleSupport(t.id)}
                        className="shrink-0"
                      >
                        <ThumbsUp className="size-4" aria-hidden="true" />
                        Dukung Prioritas
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* LANGKAH 2: Pra-Kamera & Kamera Live WebRTC */}
        <Card>
          <CardHeader>
            <CardTitle>2. Foto Langsung Kondisi Kerusakan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-surface-2 p-3.5 flex items-start gap-3 text-sm">
              <ShieldCheck
                className="size-5 shrink-0 text-brand mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-medium text-fg">
                  Wajib foto langsung di lokasi agar terbukti kejadian nyata &amp;
                  baru.
                </p>
                <p className="text-xs text-fg-muted">
                  Galeri dinonaktifkan untuk mencegah foto lama/rekayasa. Titik
                  koordinat disamarkan ±11 m di peta publik.
                </p>
              </div>
            </div>

            {draft.photoBase64 ? (
              <div className="space-y-3">
                <img
                  src={draft.photoBase64}
                  alt="Foto kerusakan yang diambil"
                  className="aspect-video w-full rounded-xl object-cover border border-line"
                />
                <Button
                  variant="secondary"
                  onClick={() => setCameraOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Camera className="size-5" aria-hidden="true" />
                  Jepret Ulang Foto
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                disabled={!canOpenCamera}
                disabledReason={
                  !radiusResult?.insideServiceArea
                    ? "Geser posisi ke dalam wilayah Surabaya & Sidoarjo terlebih dahulu."
                    : radiusResult?.isQuotaFull
                      ? "Kuota laporan aktif di titik ini penuh. Silakan Dukung Prioritas laporan di atas."
                      : gpsInaccurate
                        ? "Akurasi GPS harus <= 50 m sebelum membuka kamera."
                        : undefined
                }
                onClick={() => setCameraOpen(true)}
                className="w-full"
              >
                <Camera className="size-5" aria-hidden="true" />
                Buka Kamera Langsung
              </Button>
            )}
          </CardContent>
        </Card>

        {/* LANGKAH 3: Catatan & Kirim */}
        <Card>
          <CardHeader>
            <CardTitle>3. Catatan Singkat &amp; Kirim</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="lapor-title"
                  className="block text-sm font-medium mb-1"
                >
                  Judul Singkat Kerusakan
                </label>
                <input
                  id="lapor-title"
                  type="text"
                  required
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Contoh: Jalan berlubang dalam di depan pasar"
                  className="w-full min-h-12 rounded-xl border border-line bg-surface px-4 text-base text-fg placeholder:text-fg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>

              <div>
                <label
                  htmlFor="lapor-desc"
                  className="block text-sm font-medium mb-1"
                >
                  Keterangan Tambahan
                </label>
                <textarea
                  id="lapor-desc"
                  rows={3}
                  required
                  maxLength={1000}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Ceritakan patokan lokasi atau tingkat bahayanya..."
                  className="w-full rounded-xl border border-line bg-surface p-4 text-base text-fg placeholder:text-fg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
                <p className="mt-1 text-xs text-fg-muted">
                  Minimal 10 karakter ({draft.description.trim().length}/10).
                </p>
              </div>

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
                loading={submitting}
                className="w-full"
              >
                <Send className="size-5" aria-hidden="true" />
                {submitError ? "Kirim Ulang Laporan" : "Kirim Laporan"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <LiveCameraViewfinder
        open={cameraOpen}
        gpsAccuracy={draft.gpsAccuracyMeters}
        onClose={() => setCameraOpen(false)}
        onCapture={({ photoBase64, isLowQualityOverride }) => {
          setDraft((prev) => ({
            ...prev,
            photoBase64,
            isLowQualityOverride,
          }));
          setCameraOpen(false);
        }}
      />
    </main>
  );
}
