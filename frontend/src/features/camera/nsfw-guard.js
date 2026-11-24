const NSFW_TIMEOUT_MS = 4000;
let cachedModelPromise = null;

async function loadNsfwModel() {
  if (!cachedModelPromise) {
    cachedModelPromise = (async () => {
      // Lazy-load dinamis agar bundle awal tetap ringan (< 2s)
      const nsfwjs = await import('nsfwjs');
      return nsfwjs.load();
    })();
  }
  return cachedModelPromise;
}

export async function checkImageNsfwWithFailSafe(imageElementOrCanvas, timeoutMs = NSFW_TIMEOUT_MS) {
  let timerId;
  try {
    const predictions = await Promise.race([
      (async () => {
        const model = await loadNsfwModel();
        return model.classify(imageElementOrCanvas);
      })(),
      new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error('NSFW_TIMEOUT')), timeoutMs);
      }),
    ]);

    const scores = {};
    for (const p of predictions || []) {
      scores[p.className] = Number(p.probability.toFixed(4));
    }

    const pornScore = (scores.Porn || 0) + (scores.Hentai || 0);
    const sexyScore = scores.Sexy || 0;

    // Zona 1: Tolak langsung jika konten eksplisit tinggi
    if (pornScore >= 0.65) {
      return {
        status: 'BLOCKED',
        isNsfw: true,
        isNsfwPendingReview: false,
        timedOut: false,
        scores,
      };
    }

    // Zona 2: Abu-abu -> masuk review privat (Signed URL 60s)
    if (pornScore >= 0.35 || sexyScore >= 0.70) {
      return {
        status: 'PENDING_REVIEW',
        isNsfw: false,
        isNsfwPendingReview: true,
        timedOut: false,
        scores,
      };
    }

    return {
      status: 'SAFE',
      isNsfw: false,
      isNsfwPendingReview: false,
      timedOut: false,
      scores,
    };
  } catch (err) {
    // Fail-safe: jika model gagal muat atau > 4 detik, lolos ke private bucket untuk review
    return {
      status: 'PENDING_REVIEW',
      isNsfw: false,
      isNsfwPendingReview: true,
      timedOut: err?.message === 'NSFW_TIMEOUT',
      scores: null,
    };
  } finally {
    clearTimeout(timerId);
  }
}
