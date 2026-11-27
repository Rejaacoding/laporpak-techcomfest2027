import { useCallback, useEffect, useState } from "react";
import { Camera, CheckCircle2, LocateFixed, MapPin, Upload } from "lucide-react";
import { Button, Modal, Textarea, useToast } from "../ui/index.js";
import {
  executeDinasAction,
  fetchSampleAsBase64,
  issueCaptureNonce,
  onJuryEvent,
} from "../../services/api.js";
import { humanizeError } from "../../utils/humanize.js";
import { distanceMeters } from "../../utils/ticketMappers.ts";
import type {
  DinasActionId,
  DinasTicketViewRow,
  TicketActionItem,
} from "../../utils/ticketMappers.ts";
import LiveCameraCapture from "../../components/camera/LiveCameraCapture.jsx";

const DEPARTMENT_OPTIONS = [
  { id: "DISHUB", label: "Dinas Perhubungan (Dishub)" },
  { id: "DPU", label: "Dinas PU Bina Marga (DPU)" },
  { id: "DLH", label: "Dinas Lingkungan Hidup (DLH)" },
  { id: "SATPOLPP", label: "Satuan Polisi Pamong Praja (Satpol PP)" },
];

const OUT_OF_SCOPE_OPTIONS = [
  { code: "PLN", label: "PLN (Kelistrikan)" },
  { code: "PDAM", label: "PDAM (Air Bersih)" },
  { code: "BPJN_NASIONAL", label: "BPJN (Jalan Nasional)" },
  { code: "BBWS", label: "BBWS (Sungai & Tanggul)" },
  { code: "TELKOM_FIBER", label: "Telkom / Provider Fiber" },
  { code: "LAINNYA", label: "Instansi Lainnya" },
];

const PHOTO_ACTION_TYPES: Partial<Record<DinasActionId, string>> = {
  resolve: "RESOLVE_TICKET",
  "counter-dispute": "APPEAL_TICKET",
  "resolve-escalated": "RESOLVE_ESCALATED",
};

const MAX_BERITA_ACARA_BYTES = 5 * 1024 * 1024;

export interface DinasActionModalProps {
  open: boolean;
  ticket: DinasTicketViewRow | null;
  action: TicketActionItem | null;
  currentDepartmentId?: string | null;
  accessToken?: string | null;
  isJuryMode?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Shared modal for all 8 Dinas mutation workflows.
 * Only this component owns field-photo and Berita Acara file inputs.
 */
export function DinasActionModal({
  open,
  ticket,
  action,
  currentDepartmentId,
  accessToken,
  onClose,
  onSuccess,
}: DinasActionModalProps) {
  const { showToast } = useToast();

  const [reason, setReason] = useState("");
  const [targetDepartmentId, setTargetDepartmentId] = useState("");
  const [agency, setAgency] = useState("PLN");
  const [isNsfwContent, setIsNsfwContent] = useState(false);
  const [note, setNote] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [clientNsfwScore, setClientNsfwScore] = useState(0);
  const [beritaAcaraBase64, setBeritaAcaraBase64] = useState<string | null>(null);
  const [beritaAcaraFilename, setBeritaAcaraFilename] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const actionId = action?.id ?? null;
  const photoAction = actionId ? Boolean(PHOTO_ACTION_TYPES[actionId]) : false;

  useEffect(() => {
    if (!open) {
      setCameraOpen(false);
      return;
    }
    setReason("");
    setTargetDepartmentId(
      DEPARTMENT_OPTIONS.find((department) => department.id !== currentDepartmentId)?.id || ""
    );
    setAgency(OUT_OF_SCOPE_OPTIONS[0].code);
    setIsNsfwContent(false);
    setNote("");
    setLat(null);
    setLng(null);
    setGpsAccuracyMeters(null);
    setPhotoBase64(null);
    setClientNsfwScore(0);
    setBeritaAcaraBase64(null);
    setBeritaAcaraFilename("");
    setFormError("");
  }, [open, ticket?.id, actionId, currentDepartmentId]);

  const requestGps = useCallback(() => {
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
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setGpsAccuracyMeters(Math.round(position.coords.accuracy));
        setGpsLoading(false);
        showToast({
          type: "success",
          title: "Lokasi petugas terkunci",
          message: `Akurasi ${Math.round(position.coords.accuracy)} m.`,
        });
      },
      (err) => {
        setGpsLoading(false);
        showToast({
          type: "warning",
          title: "GPS belum terkunci",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Izinkan akses lokasi lewat ikon gembok di bilah alamat."
              : "Coba lagi di area terbuka dengan sinyal lebih baik.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [showToast]);

  useEffect(() => {
    if (!open) return undefined;
    const offGps = onJuryEvent(
      "gps",
      (coords: { lat?: number; lng?: number; accuracyMeters?: number }) => {
        const nextLat = Number(coords?.lat);
        const nextLng = Number(coords?.lng);
        if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
        setLat(nextLat);
        setLng(nextLng);
        setGpsAccuracyMeters(Number(coords?.accuracyMeters ?? 10));
        showToast({ type: "info", message: "GPS simulasi juri diterapkan." });
      }
    );
    const offCapture = onJuryEvent(
      "capture",
      async (detail: { samplePath?: string }) => {
        if (!detail?.samplePath) return;
        try {
          const photo = await fetchSampleAsBase64(detail.samplePath);
          setPhotoBase64(photo);
          setClientNsfwScore(0);
          setCameraOpen(false);
          showToast({ type: "success", message: "Foto sampel juri siap diunggah." });
        } catch (err) {
          showToast({ type: "error", error: err });
        }
      }
    );
    return () => {
      offGps();
      offCapture();
    };
  }, [open, showToast]);

  if (!ticket || !action) return null;

  const ticketLat = ticket.publicLat == null ? Number.NaN : Number(ticket.publicLat);
  const ticketLng = ticket.publicLng == null ? Number.NaN : Number(ticket.publicLng);
  const officerDistance =
    lat !== null &&
    lng !== null &&
    Number.isFinite(ticketLat) &&
    Number.isFinite(ticketLng)
      ? distanceMeters({ lat, lng }, { lat: ticketLat, lng: ticketLng })
      : null;
  const gpsAccurate =
    gpsAccuracyMeters !== null && gpsAccuracyMeters > 0 && gpsAccuracyMeters <= 50;
  const withinRadius = officerDistance !== null && officerDistance <= 75;
  const gpsReady = gpsAccurate && withinRadius;

  const transferTargets = DEPARTMENT_OPTIONS.filter(
    (department) => department.id !== currentDepartmentId
  );

  const handleBeritaAcaraFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFormError("");
    if (file.size > MAX_BERITA_ACARA_BYTES) {
      setFormError("Berkas Berita Acara maksimal 5 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setBeritaAcaraBase64(String(reader.result || ""));
      setBeritaAcaraFilename(file.name);
    };
    reader.onerror = () => setFormError("Gagal membaca berkas Berita Acara.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setFormError("");
    const body: Record<string, unknown> = {};

    if (action.id === "transfer") {
      if (!targetDepartmentId) {
        setFormError("Pilih instansi tujuan Oper Tiket.");
        return;
      }
      if (reason.trim().length < 15) {
        setFormError("Alasan Oper Tiket minimal 15 karakter.");
        return;
      }
      body.targetDepartmentId = targetDepartmentId;
      body.reason = reason.trim();
    } else if (action.id === "out-of-scope") {
      if (reason.trim().length < 20) {
        setFormError("Catatan rujukan minimal 20 karakter.");
        return;
      }
      body.agency = agency;
      body.reason = reason.trim();
    } else if (action.id === "reject-spam") {
      if (reason.trim().length < 15) {
        setFormError("Alasan penolakan minimal 15 karakter.");
        return;
      }
      body.reason = reason.trim();
      body.isNsfwContent = isNsfwContent;
    } else if (photoAction) {
      if (!photoBase64) {
        setFormError("Ambil foto live lapangan lewat kamera terlebih dahulu.");
        return;
      }
      if (!gpsAccurate) {
        setFormError("Akurasi GPS wajib 50 meter atau lebih baik.");
        return;
      }
      if (!withinRadius) {
        setFormError(
          officerDistance === null
            ? "Kunci lokasi GPS petugas untuk mengukur jarak ke titik laporan."
            : `Posisi petugas ${officerDistance} m dari titik laporan (wajib <= 75 m).`
        );
        return;
      }
      if (action.id === "resolve-escalated" && !beritaAcaraBase64) {
        setFormError("Unggah Berita Acara PDF/JPG/PNG maksimal 5 MB.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (photoAction) {
        const actionType = PHOTO_ACTION_TYPES[action.id];
        const nonce = await issueCaptureNonce(
          { actionType, ticketId: ticket.id },
          accessToken
        );
        const captureNonce = nonce?.captureNonce || nonce?.nonce;
        if (!captureNonce) {
          throw new Error("Kupon kamera tidak diterima. Silakan muat ulang lalu coba lagi.");
        }
        body.lat = lat;
        body.lng = lng;
        body.gpsAccuracyMeters = gpsAccuracyMeters;
        body.captureNonce = captureNonce;
        body.photoBase64 = photoBase64;
        body.clientNsfwScore = clientNsfwScore;
        if (note.trim()) body.note = note.trim();
        if (action.id === "resolve-escalated") {
          body.beritaAcaraBase64 = beritaAcaraBase64;
          body.beritaAcaraFilename = beritaAcaraFilename || "berita-acara.pdf";
        }
      }

      await executeDinasAction(ticket.id, action.id, body, accessToken);
      showToast({
        type: "success",
        title: `${action.label} berhasil`,
        message: `${ticket.displayCode} · ${ticket.categoryTitle} sudah diperbarui.`,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const message = humanizeError(err);
      setFormError(message);
      showToast({ type: "error", error: err });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`${action.label} — ${ticket.displayCode}`}
        description={`${ticket.categoryTitle} · ${ticket.location}`}
      >
        <div className="flex flex-col gap-4">
          <p className="font-sans text-sm text-fg-muted">
            Tindakan ini dicatat ke rantai audit kriptografi dan langsung
            memperbarui antrean dinas.
          </p>

          {(action.id === "process" || action.id === "reprocess-disputed") && (
            <div className="rounded-xl bg-surface-2 border border-line p-3 text-sm text-fg">
              {action.id === "process"
                ? "Status laporan akan berubah menjadi Sedang Ditangani."
                : "Laporan dikembalikan ke Sedang Ditangani dengan tambahan buffer SLA 24 jam."}
            </div>
          )}

          {action.id === "transfer" && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-sans font-semibold text-sm text-fg">
                  Instansi Tujuan
                </span>
                <select
                  value={targetDepartmentId}
                  onChange={(event) => setTargetDepartmentId(event.target.value)}
                  className="w-full min-h-11 rounded-xl border border-line bg-surface px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                >
                  {transferTargets.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.label}
                    </option>
                  ))}
                </select>
              </label>
              <Textarea
                label="Alasan Oper Tiket"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minChars={15}
                rows={3}
                placeholder="Jelaskan alasan tiket ini menjadi kewenangan instansi tujuan."
              />
            </div>
          )}

          {action.id === "out-of-scope" && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-sans font-semibold text-sm text-fg">
                  Instansi Berwenang
                </span>
                <select
                  value={agency}
                  onChange={(event) => setAgency(event.target.value)}
                  className="w-full min-h-11 rounded-xl border border-line bg-surface px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                >
                  {OUT_OF_SCOPE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <Textarea
                label="Catatan Rujukan"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minChars={20}
                rows={3}
                placeholder="Jelaskan batas kewenangan dan instansi yang tepat."
              />
            </div>
          )}

          {action.id === "reject-spam" && (
            <div className="flex flex-col gap-3">
              <Textarea
                label="Alasan Penolakan"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minChars={15}
                rows={3}
                placeholder="Jelaskan mengapa laporan tidak relevan atau merupakan spam."
              />
              <label className="inline-flex items-start gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={isNsfwContent}
                  onChange={(event) => setIsNsfwContent(event.target.checked)}
                  className="mt-0.5 size-4 accent-brand"
                />
                <span>Foto mengandung konten tidak senonoh (NSFW)</span>
              </label>
            </div>
          )}

          {photoAction && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-surface-2 border border-line p-3 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-sans font-semibold text-sm text-fg">
                    GPS Petugas Lapangan
                  </span>
                  <Button
                    variant="secondary"
                    density="dinas"
                    loading={gpsLoading}
                    leftIcon={<LocateFixed className="size-4" />}
                    onClick={requestGps}
                  >
                    {lat === null ? "Kunci GPS" : "Perbarui GPS"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-fg-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" aria-hidden="true" />
                    {lat !== null && lng !== null
                      ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                      : "Lokasi belum dikunci"}
                  </span>
                  <span>
                    Akurasi: {gpsAccuracyMeters === null ? "—" : `${gpsAccuracyMeters} m`}
                  </span>
                  <span>
                    Jarak: {officerDistance === null ? "—" : `${officerDistance} m`}
                  </span>
                </div>
                {gpsAccuracyMeters !== null && gpsAccuracyMeters > 50 && (
                  <p className="text-xs text-semantic-error">
                    Akurasi GPS wajib 50 m atau lebih baik.
                  </p>
                )}
                {officerDistance !== null && officerDistance > 75 && (
                  <p className="text-xs text-semantic-error">
                    Posisi petugas wajib berada dalam radius 75 m dari titik laporan.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {photoBase64 ? (
                  <div className="flex flex-col gap-2">
                    <img
                      src={photoBase64}
                      alt="Foto bukti lapangan petugas"
                      className="aspect-video w-full rounded-xl object-cover border border-line"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-semibold text-green-800">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Foto live siap diunggah
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Camera className="size-3.5" />}
                        onClick={() => setCameraOpen(true)}
                      >
                        Jepret Ulang
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Camera className="size-4" />}
                    onClick={() => setCameraOpen(true)}
                    className="w-full"
                  >
                    Buka Kamera Live Petugas (≤75 m)
                  </Button>
                )}
              </div>

              {action.id === "resolve-escalated" && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-3">
                  <label className="font-sans font-semibold text-sm text-fg">
                    Berita Acara (PDF/JPG/PNG, maks. 5 MB)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={handleBeritaAcaraFile}
                    className="block w-full text-xs text-fg file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:font-head file:text-xs file:font-semibold file:text-brand-fg hover:file:brightness-110"
                  />
                  {beritaAcaraBase64 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-800">
                      <Upload className="size-3.5" aria-hidden="true" />
                      {beritaAcaraFilename || "Berkas siap diunggah"}
                    </span>
                  )}
                </div>
              )}

              <Textarea
                label="Catatan Petugas (Opsional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={500}
                helperText="Catatan ini tampil pada riwayat audit laporan."
              />
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button variant="secondary" size="md" onClick={onClose}>
              Batal
            </Button>
            <Button
              variant={action.variant === "danger" ? "danger" : "primary"}
              size="md"
              loading={submitting}
              onClick={handleSubmit}
            >
              Konfirmasi {action.label}
            </Button>
          </div>
        </div>
      </Modal>

      <LiveCameraCapture
        open={cameraOpen}
        publicLat={lat ?? ticket.publicLat ?? undefined}
        publicLng={lng ?? ticket.publicLng ?? undefined}
        categoryCode={ticket.category}
        gpsAccuracy={gpsAccuracyMeters}
        onClose={() => setCameraOpen(false)}
        onCapture={({ photoBase64: capturedPhoto, clientNsfwScore: nsfwScore }) => {
          setPhotoBase64(capturedPhoto);
          setClientNsfwScore(Number(nsfwScore ?? 0));
          setCameraOpen(false);
        }}
      />
    </>
  );
}

export default DinasActionModal;
