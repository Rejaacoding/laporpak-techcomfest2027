import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Info, RefreshCw, X } from "lucide-react";
import { Button, Card, CardContent } from "../ui/index.js";

interface LiveCameraViewfinderProps {
  open: boolean;
  gpsAccuracy: number | null;
  onClose: () => void;
  onCapture: (payload: {
    photoBase64: string;
    isLowQualityOverride: boolean;
  }) => void;
}

const MAX_DIM = 1280;

/**
 * WebRTC Live Viewfinder (docs/design.md §6.6)
 * - No file upload allowed; live camera only
 * - Corner guide frame, <=50m GPS chip, permanent privacy reminder
 * - Permission denied shows step-by-step recovery card + Coba Lagi
 */
export function LiveCameraViewfinder({
  open,
  gpsAccuracy,
  onClose,
  onCapture,
}: LiveCameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [blurAttempts, setBlurAttempts] = useState(0);
  const [calibrationWarning, setCalibrationWarning] = useState<string | null>(null);
  const [lowQualityOverride, setLowQualityOverride] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    setCalibrationWarning(null);
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(true);
    }
  }, [stopStream]);

  useEffect(() => {
    if (!open) {
      stopStream();
      setPreviewDataUrl(null);
      setCalibrationWarning(null);
      return;
    }
    if (!previewDataUrl) {
      startCamera();
    }
    return () => stopStream();
  }, [open, previewDataUrl, startCamera, stopStream]);

  if (!open) return null;

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    // Simple brightness calibration check (docs/design.md §6.6)
    const sample = ctx.getImageData(0, 0, Math.min(width, 160), Math.min(height, 120)).data;
    let totalLuma = 0;
    const pixelCount = sample.length / 4;
    for (let i = 0; i < sample.length; i += 4) {
      totalLuma += 0.299 * sample[i] + 0.587 * sample[i + 1] + 0.114 * sample[i + 2];
    }
    const avgLuma = pixelCount > 0 ? totalLuma / pixelCount : 128;

    let warning: string | null = null;
    if (avgLuma < 28) {
      warning = "Terlalu gelap";
    } else if (avgLuma > 240) {
      warning = "Terlalu silau";
    }

    const nextAttempts = warning ? blurAttempts + 1 : blurAttempts;
    if (warning) {
      setBlurAttempts(nextAttempts);
      setCalibrationWarning(warning);
      setLowQualityOverride(nextAttempts >= 3);
    } else {
      setCalibrationWarning(null);
      setLowQualityOverride(false);
    }

    const webpUrl = canvas.toDataURL("image/webp", 0.82);
    stopStream();
    setPreviewDataUrl(webpUrl);
  };

  const gpsOk = gpsAccuracy !== null && gpsAccuracy <= 50;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between"
      role="dialog"
      aria-modal="true"
      aria-label="Kamera Langsung LaporPAK"
    >
      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between gap-3 p-4 bg-gradient-to-b from-black/70 to-transparent">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup kamera"
          className="inline-flex size-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
        >
          <X className="size-6" aria-hidden="true" />
        </button>

        <span
          className={[
            "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-mono font-medium",
            gpsOk
              ? "bg-green-600/90 text-white"
              : "bg-red-600/90 text-white",
          ].join(" ")}
        >
          {gpsAccuracy !== null
            ? `GPS ${Math.round(gpsAccuracy)} m ${gpsOk ? "(Akurat)" : "(Wajib <= 50 m)"}`
            : "GPS belum terkunci"}
        </span>
      </div>

      {/* Viewfinder / Preview / Permission Recovery */}
      {cameraError ? (
        <div className="px-4 my-auto">
          <Card className="max-w-md mx-auto">
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-6 shrink-0 text-amber-600" aria-hidden="true" />
                <div>
                  <h2 className="font-head font-semibold text-lg text-fg">
                    Izin Kamera Belum Aktif
                  </h2>
                  <p className="text-sm text-fg-muted mt-1">
                    Ikuti langkah berikut agar kamera langsung bisa dipakai:
                  </p>
                </div>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-fg">
                <li>Ketuk ikon gembok atau pengaturan di bilah alamat browser.</li>
                <li>Ubah izin <strong>Kamera</strong> menjadi <strong>Izinkan</strong>.</li>
                <li>Tekan tombol <strong>Coba Lagi</strong> di bawah ini.</li>
              </ol>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose} className="flex-1">
                  Tutup
                </Button>
                <Button variant="primary" onClick={startCamera} className="flex-1">
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Coba Lagi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : previewDataUrl ? (
        <div className="relative flex-1 flex items-center justify-center overflow-hidden px-4">
          <img
            src={previewDataUrl}
            alt="Pratinjau foto kerusakan"
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        </div>
      ) : (
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          {/* Corner guide frame */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-8 sm:inset-16 rounded-2xl border-2 border-white/80"
          />
        </div>
      )}

      {/* Bottom Controls */}
      {!cameraError && (
        <div className="relative z-10 p-4 pb-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-3">
          {calibrationWarning && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-600/90 px-3.5 py-1.5 text-xs font-semibold text-white">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <span>{calibrationWarning} — disarankan jepret ulang</span>
            </div>
          )}

          {lowQualityOverride && (
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-700/90 px-3.5 py-1.5 text-xs font-medium text-white">
              <Info className="size-4 shrink-0" aria-hidden="true" />
              <span>Foto kualitas rendah akan tetap dikirim</span>
            </div>
          )}

          <p className="text-xs text-white/90 bg-black/50 rounded-full px-3 py-1 text-center">
            Jangan potret wajah atau pelat nomor
          </p>

          {previewDataUrl ? (
            <div className="flex w-full max-w-sm gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setPreviewDataUrl(null);
                  setCalibrationWarning(null);
                }}
                className="flex-1"
              >
                Jepret Ulang
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  onCapture({
                    photoBase64: previewDataUrl,
                    isLowQualityOverride: lowQualityOverride,
                  })
                }
                className="flex-1"
              >
                Gunakan Foto
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSnap}
              aria-label="Jepret foto kerusakan"
              className="size-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 active:scale-95 transition duration-150 motion-reduce:transition-none flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
            >
              <Camera className="size-8 text-white" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
