import test from "node:test";
import assert from "node:assert/strict";
import {
  loadLaporDraft,
  saveLaporDraft,
  clearLaporDraft,
  validateLaporDraftForSubmit,
} from "../src/lib/laporDraft.ts";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test("laporDraft preserves photoBase64 and idempotencyKey across retries", () => {
  const storage = createMemoryStorage();
  const initial = loadLaporDraft(storage);
  assert.ok(initial.idempotencyKey.length >= 8);

  const updated = {
    ...initial,
    title: "Jalan berlubang depan pasar",
    description: "Lubang sedalam 20 cm membahayakan pengendara motor",
    photoBase64: "data:image/jpeg;base64,AAAA",
  };
  saveLaporDraft(updated, storage);

  const reloaded = loadLaporDraft(storage);
  assert.equal(reloaded.idempotencyKey, initial.idempotencyKey);
  assert.equal(reloaded.photoBase64, "data:image/jpeg;base64,AAAA");
  assert.equal(reloaded.title, "Jalan berlubang depan pasar");

  clearLaporDraft(storage);
  const afterClear = loadLaporDraft(storage);
  assert.equal(afterClear.photoBase64, null);
});

test("validateLaporDraftForSubmit enforces photo, title >= 5, description >= 10", () => {
  const base = {
    category: "JALAN_BERLUBANG",
    lat: -7.2575,
    lng: 112.7521,
    gpsAccuracyMeters: 12,
    title: "Jalan",
    description: "1234567890",
    photoBase64: "data:image/webp;base64,AAAA",
    isLowQualityOverride: false,
    clientNsfwScore: 0,
    idempotencyKey: "idem-1",
  };
  assert.ok(validateLaporDraftForSubmit({ ...base, photoBase64: null }));
  assert.ok(validateLaporDraftForSubmit({ ...base, title: "abc" }));
  assert.ok(validateLaporDraftForSubmit({ ...base, description: "pendek" }));
  assert.equal(validateLaporDraftForSubmit(base), null);
});
