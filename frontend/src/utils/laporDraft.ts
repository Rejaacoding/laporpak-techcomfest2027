import { CATEGORIES } from "../constants/designTokens.js";

export const DRAFT_STORAGE_KEY = "laporpak_draft_v1";

export interface LaporDraftState {
  category: string;
  lat: number;
  lng: number;
  gpsAccuracyMeters: number | null;
  title: string;
  description: string;
  photoBase64: string | null;
  isLowQualityOverride: boolean;
  clientNsfwScore: number;
  idempotencyKey: string;
}

interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultDraft(): LaporDraftState {
  return {
    category: CATEGORIES[0].code,
    lat: -7.2575,
    lng: 112.7521,
    gpsAccuracyMeters: null,
    title: "",
    description: "",
    photoBase64: null,
    isLowQualityOverride: false,
    clientNsfwScore: 0,
    idempotencyKey: createIdempotencyKey(),
  };
}

function resolveStorage(storage?: DraftStorage | null): DraftStorage | null {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage as DraftStorage;
  return null;
}

export function loadLaporDraft(storage?: DraftStorage | null): LaporDraftState {
  const defaults = defaultDraft();
  const target = resolveStorage(storage);
  if (!target) return defaults;
  try {
    const raw = target.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      idempotencyKey: parsed?.idempotencyKey || defaults.idempotencyKey,
    };
  } catch {
    return defaults;
  }
}

export function saveLaporDraft(
  draft: LaporDraftState,
  storage?: DraftStorage | null
): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage quota / private mode: the in-memory draft still protects the form.
  }
}

export function clearLaporDraft(storage?: DraftStorage | null): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage errors so a failed clear never blocks a successful submit.
  }
}

export function validateLaporDraftForSubmit(draft: LaporDraftState): string | null {
  if (!draft.photoBase64) {
    return "Ambil foto kerusakan lewat kamera langsung terlebih dahulu.";
  }
  if (draft.title.trim().length < 5) {
    return "Judul singkat minimal 5 karakter.";
  }
  if (draft.description.trim().length < 10) {
    return "Catatan kerusakan minimal 10 karakter.";
  }
  if (draft.gpsAccuracyMeters === null) {
    return "Kunci lokasi GPS terlebih dahulu sebelum mengirim laporan.";
  }
  if (draft.gpsAccuracyMeters > 50) {
    return "Akurasi GPS wajib 50 meter atau lebih baik. Perbarui lokasi di area terbuka.";
  }
  return null;
}
