import React, { useEffect, useRef, useState } from 'react';
import {
  startLiveRearCamera,
  stopLiveCameraStream,
  captureCompressedPhotoFromVideo,
} from './webrtc-capture.js';
import { checkImageNsfwWithFailSafe } from './nsfw-guard.js';

export default function LiveCameraCapture({
  publicLat,
  publicLng,
  categoryCode = 'JALAN_BERLUBANG',
  onCaptureSuccess,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [blurAttempts, setBlurAttempts] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [lastMetrics, setLastMetrics] = useState(null);

  useEffect(() => {
    let active = true;
    async function initCamera() {
      try {
        setErrorMsg('');
        const { stream } = await startLiveRearCamera(videoRef.current);
        if (!active) {
          stopLiveCameraStream(stream);
          return;
        }
        streamRef.current = stream;
        setCameraReady(true);
      } catch (err) {
        if (err?.message === 'VIRTUAL_CAMERA_BLOCKED') {
          setErrorMsg('Kamera virtual (OBS/ManyCam/Virtual) diblokir. Gunakan kamera fisik perangkat.');
        } else {
          setErrorMsg('Kamera gagal dibuka. Pastikan izin kamera aktif dan menggunakan HTTPS.');
        }
      }
    }
    initCamera();

    return () => {
      active = false;
      stopLiveCameraStream(streamRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

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

      // Evaluasi cepat kualitas piksel di sisi klien
      if (meanLuminance > 245) {
        setErrorMsg('Foto terlalu silau (overexposed). Arahkan ulang kamera.');
        return;
      }
      if (meanLuminance < 12) {
        setErrorMsg('Foto terlalu gelap. Nyalakan pencahayaan atau cari sudut lebih terang.');
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

      // Cek NSFWJS dengan fail-safe timeout 4 detik
      const img = new Image();
      const objUrl = URL.createObjectURL(result.blob);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objUrl;
      });

      const nsfw = await checkImageNsfwWithFailSafe(img);
      if (nsfw.isNsfw) {
        URL.revokeObjectURL(objUrl);
        setErrorMsg('Foto ditolak oleh filter keamanan konten.');
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(objUrl);

      if (onCaptureSuccess) {
        onCaptureSuccess({
          blob: result.blob,
          sizeBytes: result.sizeBytes,
          width: result.width,
          height: result.height,
          metrics: result.metrics,
          watermarkText: result.watermarkText,
          isLowQualityOverride,
          isNsfwPendingReview: nsfw.isNsfwPendingReview,
          categoryCode,
        });
      }
    } catch (err) {
      setErrorMsg(`Gagal mengambil foto: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">Kamera Langsung Lapangan</h3>
        <span className="text-xs text-neutral-500">Live WebRTC Only</span>
      </div>

      <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200">
          {errorMsg}
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
          className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {isProcessing ? 'Memproses & Memeriksa Foto...' : 'Jepret Foto Lapangan'}
        </button>
      </div>

      {previewUrl && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-neutral-700">Pratinjau Hasil (Watermark WIB):</p>
          <img src={previewUrl} alt="Pratinjau Foto Laporan" className="w-full rounded-lg border border-neutral-200" />
        </div>
      )}
    </div>
  );
}
