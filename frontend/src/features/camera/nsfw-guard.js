const NSFW_TIMEOUT_MS = 4000;
let cachedModelPromise = null;

async function loadNsfwModel() {
  if (!cachedModelPromise) {
    cachedModelPromise = (async () => {
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

    const rawExplicit = Math.max(
      scores.Porn || 0,
      scores.Hentai || 0,
      (scores.Porn || 0) + (scores.Hentai || 0)
    );
    const explicitScore = Math.min(1, Number(rawExplicit.toFixed(4)));

    // >= 0.85 : Blokir langsung
    if (explicitScore >= 0.85) {
      return {
        status: 'BLOCKED',
        isNsfw: true,
        needsRetry: false,
        isNsfwPendingReview: false,
        timedOut: false,
        explicitScore,
        scores,
      };
    }

    // 0.55 - 0.84 : Minta foto ulang
    if (explicitScore >= 0.55) {
      return {
        status: 'RETRY',
        isNsfw: false,
        needsRetry: true,
        isNsfwPendingReview: false,
        timedOut: false,
        explicitScore,
        scores,
      };
    }

    return {
      status: 'SAFE',
      isNsfw: false,
      needsRetry: false,
      isNsfwPendingReview: false,
      timedOut: false,
      explicitScore,
      scores,
    };
  } catch (err) {
    // Fail-safe > 4 detik / gagal muat model -> lolos ke private bucket untuk review
    return {
      status: 'PENDING_REVIEW',
      isNsfw: false,
      needsRetry: false,
      isNsfwPendingReview: true,
      timedOut: err?.message === 'NSFW_TIMEOUT',
      explicitScore: 0,
      scores: null,
    };
  } finally {
    clearTimeout(timerId);
  }
}
