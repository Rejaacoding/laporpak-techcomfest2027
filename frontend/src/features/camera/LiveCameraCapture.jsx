import React, { useEffect, useRef, useState } from 'react';
import {
  startLiveRearCamera,
  stopLiveCameraStream,
  captureCompressedPhotoFromVideo,
} from './webrtc-capture.js';
import { checkImageNsfwWithFailSafe } from './nsfw-guard.js';

const NIGHT_ELIGIBLE_RE =
  /DARURAT|JALAN_AMBLES|KABEL_MENJUNTAI|POHON_TUMBANG|PJU|LAMPU|SALURAN|DRAINASE|TERSUMBAT/i;

function isNightRelaxationActive(categoryCode = '') {
  const nowWib = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
  );
  const minutes = nowWib.getHours() * 60 + nowWib.getMinutes();
  const isNightTime = minutes >= 18 * 60 || minutes <= 5 * 60 + 30; // 18:00 - 05:30 WIB
  const isEligibleCategory = NIGHT_ELIGIBLE_RE.test(String(categoryCode || ''));
  return isNightTime && isEligibleCategory;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function LiveCameraCapture({
  open = true,
  onClose,
  gpsAccuracy,
  publicLat,
  publicLng,
  categoryCode = 'JALAN_BERLUBANG',
  onCapture,
  onCaptureSuccess = null,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [blurAttempts, setBlurAttempts] = useState(0);
  const [lastMetrics, setLastMetrics] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const nightRelaxed = isNightRelaxationActive(categoryCode);

  useEffect(() => {
    if (!open) {
      stopLiveCameraStream(streamRef.current);
      streamRef.current = null;
      setCameraReady(false);
      return;
    }

    let active = true;
    setErrorMsg('');
    setCameraError(false);
    setBlurAttempts(0);
    setLastMetrics(null);

    async function initCamera() {
      try {
        const { stream } = await startLiveRearCamera(videoRef.current);
        if (!active) {
          stopLiveCameraStream(stream);
          return;
        }
        streamRef.current = stream;
        setCameraReady(true);
      } catch (err) {
        if (!active) return;
        setCameraError(true);
        if (err?.message === 'VIRTUAL_CAMERA_BLOCKED') {
          setErrorMsg('Kamera virtual (OBS/ManyCam/Virtual) diblokir. Gunakan kamera fisik perangkat.');
        } else {
          setErrorMsg('Izin kamera mati atau gagal dibuka. Ketuk ikon gembok di bilah alamat, pilih Izinkan Kamera, lalu tekan Coba Lagi.');
        }
      }
    }
    initCamera();

    return () => {
      active = false;
      stopLiveCameraStream(streamRef.current);
      streamRef.current = null;
    };
  }, [open, retryTick]);

  if (!open) return null;

  async function handleCapture() {
    if (!cameraReady || isProcessing) return;
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const result = await captureCompressedPhotoFromVideo({
        videoElement: videoRef.current,
        publicLat: publicLat ?? -7.4478,
        publicLng: publicLng ?? 112.7183,
      });

      const { meanLuminance, laplacianVariance } = result.metrics;
      setLastMetrics(result.metrics);

      // Evaluasi cahaya BT.601 (PRD #25: Y >= 35 normal, Y >= 12 malam untuk 3 Darurat + PJU + Saluran)
      if (meanLuminance > 245) {
        setErrorMsg('Foto terlalu silau (overexposed). Arahkan ulang kamera.');
        return;
      }
      const minLuminance = nightRelaxed ? 12 : 35;
      if (meanLuminance < minLuminance) {
        setErrorMsg(
          nightRelaxed
            ? 'Foto terlalu gelap meski mode relaksasi malam aktif. Dekatkan sedikit ke sumber cahaya.'
            : 'Foto terlalu gelap. Nyalakan pencahayaan atau cari sudut lebih terang.'
        );
        return;
      }

      let isLowQualityOverride = false;
      if (laplacianVariance < 45) {
        const nextAttempt = blurAttempts + 1;
        setBlurAttempts(nextAttempt);
        if (nextAttempt < 3) {
          setErrorMsg(`Foto terdeteksi blur (percobaan ${nextAttempt}/3). Tahan tangan lebih stabil dan jepret ulang.`);
          return;
        }
        isLowQualityOverride = true;
      }

      // Cek NSFWJS (>= 0.85 blokir, 0.55-0.84 foto ulang, >4s fail-safe review)
      const img = new Image();
      const objUrl = URL.createObjectURL(result.blob);
      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = objUrl;
        });
        const nsfw = await checkImageNsfwWithFailSafe(img);

        if (nsfw.isNsfw) {
          setErrorMsg('Foto diblokir filter keamanan konten (>= 0.85). Mengunggah konten tidak pantas berisiko penalti skor -0.5 dan jeda 24 jam.');
          return;
        }
        if (nsfw.needsRetry) {
          setErrorMsg('Foto terdeteksi kurang jelas/ambigu oleh filter konten (0.55–0.84). Silakan jepret ulang dengan sudut lebih jelas.');
          return;
        }

        const photoBase64 = await blobToBase64(result.blob);

        if (onCapture) {
          onCapture({
            photoBase64,
            isLowQualityOverride,
            isNsfwPendingReview: nsfw.isNsfwPendingReview,
            clientNsfwScore: nsfw.explicitScore ?? 0,
          });
        }
        if (onCaptureSuccess) {
          onCaptureSuccess({
            blob: result.blob,
            photoBase64,
            sizeBytes: result.sizeBytes,
            width: result.width,
            height: result.height,
            metrics: result.metrics,
            watermarkText: result.watermarkText,
            isLowQualityOverride,
            isNsfwPendingReview: nsfw.isNsfwPendingReview,
            clientNsfwScore: nsfw.explicitScore ?? 0,
            categoryCode,
          });
        }
        if (onClose) onClose();
      } finally {
        URL.revokeObjectURL(objUrl);
      }
    } catch (err) {
      setErrorMsg(`Gagal mengambil foto: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl text-neutral-900">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Kamera Langsung Lapangan</h3>
            <p className="text-xs text-neutral-500">
              Live WebRTC · Anti Kamera Virtual & NSFW Guard
              {gpsAccuracy !== null && gpsAccuracy !== undefined ? ` · GPS ±${gpsAccuracy}m` : ''}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Tutup
            </button>
          )}
        </div>

        {nightRelaxed && (
          <div className="mb-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs text-indigo-800 border border-indigo-200">
            Mode Relaksasi Cahaya Malam aktif (18.00–05.30 WIB) untuk kategori ini.
          </div>
        )}

        <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200 space-y-2">
            <p>{errorMsg}</p>
            {cameraError && (
              <button
                type="button"
                onClick={() => setRetryTick((t) => t + 1)}
                className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-800"
              >
                Coba Lagi
              </button>
            )}
          </div>
        )}

        {lastMetrics && (
          <div className="mt-2 flex gap-3 text-xs text-neutral-600">
            <span>Luminance: <b>{lastMetrics.meanLuminance}</b></span>
            <span>Ketajaman: <b>{lastMetrics.laplacianVariance}</b></span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCapture}
            disabled={!cameraReady || isProcessing}
            className="flex-1 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {isProcessing ? 'Memproses & Memeriksa NSFW...' : 'Jepret Foto Lapangan'}
          </button>
        </div>
      </div>
    </div>
  );
}
