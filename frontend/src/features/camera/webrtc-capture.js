const VIRTUAL_CAMERA_KEYWORDS = [
  "obs",
  "virtual",
  "manycam",
  "snap camera",
  "droidcam",
  "xsplit",
  "camtwist",
  "splitcam",
  "youcam",
  "iriun",
];

export function isVirtualCameraLabel(label = "") {
  const normalized = String(label).toLowerCase();
  return VIRTUAL_CAMERA_KEYWORDS.some((kw) => normalized.includes(kw));
}

export async function startLiveRearCamera(videoElement) {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("WEBRTC_NOT_SUPPORTED");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  const videoTrack = stream.getVideoTracks()[0];
  const label = videoTrack?.label || "";

  if (isVirtualCameraLabel(label)) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("VIRTUAL_CAMERA_BLOCKED");
  }

  if (videoElement) {
    videoElement.srcObject = stream;
    await videoElement.play();
  }

  return {
    stream,
    trackLabel: label || "rear-camera",
  };
}

export function stopLiveCameraStream(stream) {
  if (!stream || !stream.getTracks) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function formatWibTimestamp(timestampMs = Date.now()) {
  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(timestampMs)) + " WIB"
  );
}

export function estimateCanvasMetrics(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  const totalPixels = width * height;
  let sumY = 0;
  const gray = new Float32Array(totalPixels);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sumY += y;
    gray[p] = y;
  }

  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap =
        -4 * gray[idx] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx - width] +
        gray[idx + width];
      lapSum += lap;
      lapSqSum += lap * lap;
      count++;
    }
  }

  const meanLap = lapSum / Math.max(1, count);
  const laplacianVariance = Math.max(
    0,
    lapSqSum / Math.max(1, count) - meanLap * meanLap
  );

  return {
    meanLuminance: Number((sumY / Math.max(1, totalPixels)).toFixed(2)),
    laplacianVariance: Number(laplacianVariance.toFixed(2)),
  };
}

export async function captureCompressedPhotoFromVideo({
  videoElement,
  publicLat,
  publicLng,
  maxBytes = 450 * 1024,
  maxDimension = 1280,
}) {
  if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
    throw new Error("VIDEO_STREAM_NOT_READY");
  }

  const srcW = videoElement.videoWidth;
  const srcH = videoElement.videoHeight;
  const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Menggambar ulang ke canvas menghilangkan metadata EXIF asli & menghasilkan buffer baru
  ctx.drawImage(videoElement, 0, 0, targetW, targetH);

  const metrics = estimateCanvasMetrics(canvas);

  // Tempel watermark WIB + koordinat publik di bagian bawah
  const watermarkText = `${formatWibTimestamp()} | ${Number(publicLat).toFixed(5)}, ${Number(publicLng).toFixed(5)}`;
  const barHeight = Math.max(24, Math.round(targetH * 0.045));
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, targetH - barHeight, targetW, barHeight);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `${Math.max(12, Math.round(barHeight * 0.52))}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(watermarkText, 12, targetH - barHeight / 2);

  let quality = 0.85;
  let blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  while (blob && blob.size > maxBytes && quality > 0.35) {
    quality = Number((quality - 0.1).toFixed(2));
    blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
  }

  return {
    blob,
    sizeBytes: blob ? blob.size : 0,
    width: targetW,
    height: targetH,
    qualityUsed: quality,
    metrics,
    watermarkText,
  };
}
