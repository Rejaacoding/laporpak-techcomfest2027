# Frontend App API Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all 7 visual pages in `frontend/src/app/` (and their shared layout/dinas/toast components) from static `mockTickets.ts` data to the live LaporPAK! Express/Prisma/PostGIS backend API via `frontend/src/lib/api.js`.

**Architecture:** Extract pure, unit-testable mapping and coordinate-projection utilities (`frontend/src/lib/ticketMappers.ts`) so the existing SVG geographic canvases, KPI cards, queue tabs, and rapor boards in `frontend/src/app/` keep their exact Figma-sliced visuals while rendering live backend payloads. Centralize the 8 Dinas mutation workflows (reason/agency forms, `LiveCameraCapture` + GPS + `issueCaptureNonce`, and `ESCALATED` Berita Acara upload) in one shared `DinasActionModal.tsx` component reused by both `/dinas` and `/dinas/peta`, and wire `/lapor` to real Geolocation, `checkTicketRadius`, `supportTicket`, `LiveCameraCapture`, `createTicket`, and `JuryPanel` events.

**Tech Stack:** React 18, TypeScript/JSX, Vite 6, React Router v6, Tailwind CSS v3, `lucide-react`, `nsfwjs` (lazy), WebRTC (`LiveCameraCapture.jsx`), native Node 24 test runner (`node --test`).

**Spec:** `docs/PRD.md` (v3.5) and `docs/flow.md` (v3.5).

## Global Constraints

- **Single API Client & Auth Headers:** All HTTP calls MUST go through `frontend/src/lib/api.js` (or include `X-Device-Fingerprint`, `Authorization: Bearer <accessToken>`, and `X-Jury-Token`/`X-Jury-Role` via `getJuryHeaders()`), passing `accessToken` from `useAuth()`.
- **No Raw Technical Leaks (`PRD.md` §5.C):** Never render raw HTTP status codes (`400`–`504`), `Prisma`, `SQL`, `UUID`, or stack traces to the UI; route all API errors through `humanizeError` (`frontend/src/lib/humanize.js`) or `useToast().showToast({ type: "error", error })`.
- **10 Statuses & 8 Categories SSOT (`PRD.md` Lampiran A & Bab 3):** Use only the canonical 8 category codes (`JALAN_AMBLES`, `KABEL_MENJUNTAI`, `POHON_TUMBANG`, `PJU_MATI`, `SAMPAH_LIAR`, `SALURAN_TERSUMBAT`, `REKLAME_LIAR`, `JALAN_BERLUBANG`) and 10 status codes (`OPEN`, `OUT_OF_SCOPE`, `REJECTED_SPAM`, `IN_PROGRESS`, `OVERDUE`, `PENDING_VALIDATION`, `DISPUTED`, `ESCALATED`, `CLOSED`, `AUTO_CLOSED`).
- **Field Photo Security (`PRD.md` §4.A.4 & §9 #9):** Never allow `<input type="file">` for citizen/officer field photos; field photos must come from `LiveCameraCapture` (WebRTC + BT.601 + Laplacian + `nsfwjs`) or `JuryPanel` simulated sample capture (`fetchSampleAsBase64`). The only allowed file picker (`application/pdf,image/jpeg,image/png`, `<= 5 MB`) is the Berita Acara document in `ESCALATED` (`resolve-escalated`).
- **GPS & Radius Limits (`src/shared/constants.js`):** Enforce `gpsAccuracyMeters <= 50` m before camera capture (`createTicket`) and Dinas field resolution (`<= 75 m`); bypass geofencing/impossible-travel on client only when `isJuryMode` is active (server enforces authoritatively).
- **Public Privacy (`PRD.md` §2.C):** Public endpoints (`/api/tickets`, `/api/rapor`) only expose `publicLat`/`publicLng` (4 decimals `~11 m`) and `aliasName`—never expose `userId`, `email`, or unrounded coordinates.
- **v3.5 Copy & Scope Boundaries:** Rename UI labels for `/rapor` to **"Catatan Kerja Dinas"** (`#37`, route `/rapor` and `GET /api/rapor` unchanged) with plain-language descriptions. Note that `/tiket/:id`, `ProfileDrawer`, and v3.5 hold-aba-aba backend items (`#33`–`#35`, `POST /api/tickets/:id/rate`) are not in `frontend/src/app/` or `src/routes/api.routes.js` yet and are outside this plan's scope.

## Review Focus

1. **Network failure & retry idempotency on `/lapor` (`POST /api/tickets`):** Failing `createTicket` (5xx/offline) must preserve `localStorage` draft (`laporpak_draft_v1`), keep the same `idempotencyKey`, and keep `photoBase64`/inputs intact for retry (pinned by unit tests on draft/payload helpers in Task 3).
2. **Dinas initial action window & 1x limits (`Oper Tiket` & `Tolak Spam`):** `OPEN` tickets past `min(24h, 50% slaInitialHours)` from `syncedAt` (`12h` Darurat, `24h` Menengah/Standar), or with `transferCount >= 1`, must have `transfer`/`reject-spam` disabled with explicit `disabledReason` (pinned by unit tests in Task 1).
3. **Map coordinate projection bounds:** Missing, extreme, or boundary `publicLat`/`publicLng` values must clamp safely to `[4, 96]` percent without `NaN` so pins never disappear off-canvas (pinned by unit tests in Task 1).
4. **Toast title & error sanitization:** Calling `showToast({ type, title, message })` must display both title and message without dropping `title`, and `showToast({ type: "error", error })` must sanitize HTTP codes via `humanizeError` (pinned by unit test on toast formatting helper in Task 1).
5. **Empty filter & zero-ticket rapor division safety:** `GET /api/rapor` with `totalTickets === 0` or `clusterPoints === []` must compute `0.0%` ratios and `[]` clusters without `NaN` or runtime crashes (pinned by unit tests in Task 1).

---

### File Structure

| File | Responsibility |
| :--- | :--- |
| `frontend/src/lib/humanize.js` | Modify: export pure `buildToastPayload({ type, title, message, error })` so toast formatting is testable in Node without JSX. |
| `frontend/src/components/ui/Toast.jsx` | Modify: consume `buildToastPayload` and render optional `title` above `message`. |
| `frontend/src/lib/ticketMappers.ts` | Create: pure mappers/formatters converting `GET /api/tickets`, `GET /api/dinas/tickets`, and `GET /api/rapor` payloads into view models, dynamic SLA strings, queue counts, coordinate `%` projections, and spatial heatmap clusters. |
| `frontend/tests/ticketMappers.test.mjs` | Create: `node --test` suite covering projection clamping, Dinas action gating (`12h`/`24h` window, `1x` transfer, `1x` appeal), queue counts, rapor zero-division safety, and toast payload formatting. |
| `frontend/tests/laporDraft.test.mjs` | Create: `node --test` suite covering `/lapor` draft persistence, stable `idempotencyKey` preservation across failures, and submit validation guards. |
| `frontend/src/lib/laporDraft.ts` | Create: pure draft load/save/clear and submit-validation helpers for `app/warga/lapor.tsx`. |
| `frontend/src/app/warga/page.tsx` | Modify: wire `/` to `listTickets`, `getTicketDetail` (top feed blur/NSFW metadata), `getTicketMediaSignedUrl`, `navigator.geolocation`, and `onJuryEvent('reset' | 'gps')`. |
| `frontend/src/app/warga/peta.tsx` | Modify: wire `/peta` to `listTickets`, real projected pins/clusters, GPS focus, and `onJuryEvent('reset' | 'gps')`. |
| `frontend/src/app/warga/lapor.tsx` | Modify: wire `/lapor` to `ADMIN_DINAS` redirect, Geolocation (`<= 50m`), `checkTicketRadius`, `supportTicket`, `LiveCameraCapture`, `issueCaptureNonce`, `createTicket`, `laporDraft`, and `onJuryEvent('gps' | 'capture')`. |
| `frontend/src/components/dinas/AlertBanners.tsx` | Modify: accept live `disputedTicket` and `escalatedTicket` props instead of hardcoded `DINAS_ALERTS`. |
| `frontend/src/components/dinas/TicketTable.tsx` | Modify: accept live `counts` prop for tab badges instead of hardcoded `TICKET_TABS`. |
| `frontend/src/components/dinas/DinasActionModal.tsx` | Create: shared modal handling all 8 Dinas actions (`process`, `transfer`, `out-of-scope`, `reject-spam`, `resolve`, `reprocess-disputed`, `counter-dispute`, `resolve-escalated`) with reason char counters, `LiveCameraCapture`, GPS, `issueCaptureNonce`, Berita Acara file reader (`<= 5 MB`), and `onJuryEvent`. |
| `frontend/src/components/dinas/index.ts` | Modify: export `DinasActionModal`. |
| `frontend/src/app/dinas/page.tsx` | Modify: wire `/dinas` to `listDinasTickets`, `getRapor` (sidebar/KPI score), live `AlertBanners`, `TicketTable`, `DinasActionModal`, and `onJuryEvent('reset')`. |
| `frontend/src/app/dinas/peta.tsx` | Modify: wire `/dinas/peta` to `listDinasTickets`, `getTicketDetail` (inspector photo, Signed URL, description), `getRapor`, `DinasActionModal`, and `onJuryEvent`. |
| `frontend/src/app/warga/rapor.tsx` | Modify: wire `/rapor` to `getRapor()`, v3.5 **"Catatan Kerja Dinas"** plain-language labels, dynamic clusters, and `onJuryEvent('reset')`. |
| `frontend/src/app/dinas/rapor.tsx` | Modify: wire `/dinas/rapor` to `getRapor({ category })`, v3.5 **"Catatan Kerja Dinas"** labels, region/category filtering, and `onJuryEvent('reset')`. |
| `frontend/src/components/layout/TopNavbar.tsx` & `BottomNavbar.tsx` | Modify: update `/rapor` nav label from `"Rapor Publik"` / `"Rapor"` to `"Catatan Kerja"` / `"Catatan Kerja Dinas"` per `#37`. |
| `frontend/src/App.jsx` | Modify: protect `/lapor` against `ADMIN_DINAS` (consistent with `flow.md` Flow 1). |

---

### Task 1: Toast Title Support, Pure API Mappers & Coordinate Projection

**Files:**
- Modify: `frontend/src/lib/humanize.js:150-168`
- Modify: `frontend/src/components/ui/Toast.jsx:58-124`
- Create: `frontend/src/lib/ticketMappers.ts`
- Test: `frontend/tests/ticketMappers.test.mjs`

**Interfaces:**
- Consumes: `CATEGORIES`, `TICKET_STATUSES`, `SLA_TIERS` from `frontend/src/constants/designTokens.js`; `humanizeError` from `frontend/src/lib/humanize.js`.
- Produces:
  - `buildToastPayload({ type, title, message, error }) -> { type: string, title?: string, message: string }` in `frontend/src/lib/humanize.js`
  - `TicketActionItem`, `DinasTicketViewRow`, `DinasMapPinView`, `WargaFeedTicketView`, `WargaMapPinView`, `RaporDinasCardView`, `RaporClusterView` types in `frontend/src/lib/ticketMappers.ts`
  - `projectCoordToMapPercent(lat: number, lng: number) -> { mapX: number, mapY: number }`
  - `inferRegionFromCoords(lat: number, lng: number) -> "Surabaya" | "Sidoarjo"`
  - `formatSlaRemaining(ticket: { status: string, slaDeadline: string, disputedAt?: string | null, validationStartedAt?: string | null }, nowMs?: number) -> { text: string, tone: "overdue" | "disputed" | "warning" | "normal" | "muted" }`
  - `buildDinasTicketActions(ticket: ApiDinasTicket, nowMs?: number) -> TicketActionItem[]`
  - `mapDinasTicketsToRows(apiTickets: ApiDinasTicket[], nowMs?: number) -> DinasTicketViewRow[]`
  - `computeDinasQueueCounts(tickets: Array<{ status: string }>) -> DinasQueueCounts`
  - `mapPublicTicketsToWargaFeed(apiTickets: ApiPublicTicket[], nowMs?: number) -> WargaFeedTicketView[]`
  - `mapPublicTicketsToWargaPins(apiTickets: ApiPublicTicket[], nowMs?: number) -> WargaMapPinView[]`
  - `mapRaporResponse(apiRapor: ApiRaporResponse, options?: { region?: string }) -> { kpiStats: KpiStatItem[], wargaKpiStats: KpiStatItem[], departments: RaporDinasCardView[], clusters: RaporClusterView[], pendingValidationCount: number }`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/ticketMappers.test.mjs` testing:
1. `projectCoordToMapPercent(-7.349, 112.728)` returns centered values in `(4, 96)`, and out-of-bounds/NaN inputs (`projectCoordToMapPercent(-99, 999)` and `projectCoordToMapPercent(NaN, NaN)`) clamp inside `[4, 96]` without `NaN`.
2. `buildDinasTicketActions` for an `OPEN` `JALAN_AMBLES` (`24h` SLA) ticket at `syncedAt` = `13h` ago disables `transfer` and `reject-spam` with `disabledReason`, while at `2h` ago enables both; and when `transferCount === 1` disables `transfer` even inside the window.
3. `computeDinasQueueCounts` counts `ALL`, `OVERDUE`, `DISPUTED`, `ESCALATED`, `PENDING_VALIDATION`, and `CLOSED` accurately from mixed status rows.
4. `mapRaporResponse` with `totalTickets: 0`, `outOfScopeRatio: 0`, `rejectedSpamRatio: 0`, and `clusterPoints: []` yields `"0.0%"`/clean numbers without `NaN` and `clusters: []`.
5. `buildToastPayload({ type: "error", title: "Gagal 500", error: new Error("500 Prisma error") })` returns sanitized `message` without `"500"` or `"Prisma"` and preserves `title`.

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  projectCoordToMapPercent,
  buildDinasTicketActions,
  computeDinasQueueCounts,
  mapRaporResponse,
} from "../src/lib/ticketMappers.ts";
import { buildToastPayload } from "../src/lib/humanize.js";

test("projectCoordToMapPercent clamps out-of-bounds and NaN safely", () => {
  const center = projectCoordToMapPercent(-7.349, 112.728);
  assert.ok(center.mapX > 20 && center.mapX < 80);
  assert.ok(center.mapY > 20 && center.mapY < 80);

  const extreme = projectCoordToMapPercent(-99, 999);
  assert.equal(extreme.mapX, 96);
  assert.equal(extreme.mapY, 96);

  const fallback = projectCoordToMapPercent(Number.NaN, Number.NaN);
  assert.equal(Number.isNaN(fallback.mapX), false);
  assert.equal(Number.isNaN(fallback.mapY), false);
});

test("buildDinasTicketActions enforces 12h Darurat window and 1x transfer", () => {
  const now = Date.parse("2026-11-27T12:00:00Z");
  const openRecent = {
    id: "t1",
    status: "OPEN",
    category: "JALAN_AMBLES",
    syncedAt: new Date(now - 2 * 3600 * 1000).toISOString(),
    transferCount: 0,
    appealUsed: false,
  };
  const actsRecent = buildDinasTicketActions(openRecent, now);
  assert.equal(actsRecent.find((a) => a.id === "transfer")?.disabled, false);
  assert.equal(actsRecent.find((a) => a.id === "reject-spam")?.disabled, false);

  const openExpired = { ...openRecent, syncedAt: new Date(now - 13 * 3600 * 1000).toISOString() };
  const actsExpired = buildDinasTicketActions(openExpired, now);
  assert.equal(actsExpired.find((a) => a.id === "transfer")?.disabled, true);
  assert.equal(actsExpired.find((a) => a.id === "reject-spam")?.disabled, true);
  assert.ok(actsExpired.find((a) => a.id === "transfer")?.disabledReason);

  const transferredOnce = { ...openRecent, transferCount: 1 };
  const actsTransferred = buildDinasTicketActions(transferredOnce, now);
  assert.equal(actsTransferred.find((a) => a.id === "transfer")?.disabled, true);
});

test("computeDinasQueueCounts aggregates queue filter counts", () => {
  const counts = computeDinasQueueCounts([
    { status: "OVERDUE" },
    { status: "OVERDUE" },
    { status: "DISPUTED" },
    { status: "ESCALATED" },
    { status: "PENDING_VALIDATION" },
    { status: "CLOSED" },
    { status: "OPEN" },
  ]);
  assert.deepEqual(counts, {
    ALL: 7,
    OVERDUE: 2,
    DISPUTED: 1,
    ESCALATED: 1,
    PENDING_VALIDATION: 1,
    CLOSED: 1,
  });
});

test("mapRaporResponse handles empty clusters and zero totals without NaN", () => {
  const mapped = mapRaporResponse({
    scoreExplanation: "Mulai 80",
    departments: [
      {
        id: "DPU",
        code: "DPU",
        name: "Dinas PU Bina Marga",
        shortName: "Dinas PU",
        integrityScore: 80,
        totalTickets: 0,
        totalResolved: 0,
        onTimeResolved: 0,
        slaOnTimeRatio: 1,
        overdueCount: 0,
        chronicOverdueCnt: 0,
        isChronicWarning: false,
        escalatedCount: 0,
        outOfScopeCount: 0,
        outOfScopeRatio: 0,
        outOfScopeWarning: false,
        rejectedSpamCount: 0,
        rejectedSpamRatio: 0,
        rejectedSpamWarning: false,
      },
    ],
    clusterPoints: [],
  });
  assert.equal(mapped.clusters.length, 0);
  assert.equal(mapped.departments[0].outOfScopePct, 0);
  assert.equal(mapped.departments[0].slaCompliance, "100.0%");
});

test("buildToastPayload preserves title and sanitizes technical error", () => {
  const payload = buildToastPayload({
    type: "error",
    title: "Gagal Menyimpan",
    error: new Error("500 Prisma P2002"),
  });
  assert.equal(payload.title, "Gagal Menyimpan");
  assert.equal(/500|prisma/i.test(payload.message), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/ticketMappers.test.mjs`
Expected: FAIL because `frontend/src/lib/ticketMappers.ts` does not exist and `buildToastPayload` is not exported.

- [ ] **Step 3: Implement `buildToastPayload` in `frontend/src/lib/humanize.js`, update `Toast.jsx`, and create `frontend/src/lib/ticketMappers.ts`**

1. In `frontend/src/lib/humanize.js`: export `buildToastPayload({ type = "info", title, message, error })` that sanitizes `error` / `error`-typed `message` via `humanizeError`, preserves optional `title` (sanitized via `humanizeError` if `type === "error"`), and returns `{ type, title, message }`.
2. In `frontend/src/components/ui/Toast.jsx`: import `buildToastPayload` from `../../lib/humanize.js`, use it inside `showToast`, and render `toast.title` as a bold header line (`text-sm font-head font-semibold`) above `toast.message` (`text-sm font-medium`).
2. Create `frontend/src/lib/ticketMappers.ts`:
   - Define Sidoarjo–Surabaya bounding box (`MIN_LAT = -7.585`, `MAX_LAT = -7.175`, `MIN_LNG = 112.49`, `MAX_LNG = 112.86`, matching `public/geo/sidoarjo-surabaya.json`) and clamp `projectCoordToMapPercent(lat, lng)` to `[4, 96]` (falling back to center `50, 50` on `NaN`).
   - Implement `inferRegionFromCoords(lat, lng)` (`lat <= -7.35 ? "Sidoarjo" : "Surabaya"`).
   - Implement `formatSlaRemaining` (formatting `Terlambat +HH:MM:SS`, `Jeda HH:MM:SS` for `DISPUTED` using `24h` from `disputedAt`, `Uji Publik Xj / 48j` for `PENDING_VALIDATION`, `Sisa HH:MM:SS` or `Xj Yj` for active, and terminal labels).
   - Implement `buildDinasTicketActions(ticket, nowMs)` enforcing `Math.min(24, slaHours * 0.5) * 3600_000` window from `syncedAt` for `transfer` and `reject-spam`, `transferCount >= 1`, and `appealUsed` for `counter-dispute`. Action IDs map 1-to-1 to backend endpoints: `"process"`, `"transfer"`, `"out-of-scope"`, `"reject-spam"`, `"resolve"`, `"reprocess-disputed"`, `"counter-dispute"`, `"resolve-escalated"`.
   - Implement `mapDinasTicketsToRows`, `computeDinasQueueCounts`, `mapPublicTicketsToWargaFeed`, `mapPublicTicketsToWargaPins`, and `mapRaporResponse` (clustering `clusterPoints` into grid cells by lat/lng bucket with `mapX`, `mapY`, `count`, `region`, `sizePx`). Keep `id` as the real DB ticket ID (`row.id`) and `displayCode` as `#${row.code}` so API calls use `id` while UI displays `displayCode`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/tests/ticketMappers.test.mjs`
Expected: PASS (5/5 tests pass).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/humanize.js frontend/src/components/ui/Toast.jsx frontend/src/lib/ticketMappers.ts frontend/tests/ticketMappers.test.mjs
git commit -m "feat(frontend): add pure API ticket/rapor mappers and toast title support"
```

---

### Task 2: Wire Citizen Home (`/`) and Map (`/peta`) to Live Public Ticket APIs

**Files:**
- Modify: `frontend/src/app/warga/page.tsx:1-318`
- Modify: `frontend/src/app/warga/peta.tsx:1-242`

**Interfaces:**
- Consumes: `listTickets`, `getTicketDetail`, `getTicketMediaSignedUrl`, `onJuryEvent` from `frontend/src/lib/api.js`; `mapPublicTicketsToWargaFeed`, `mapPublicTicketsToWargaPins`, `projectCoordToMapPercent` from `frontend/src/lib/ticketMappers.ts`; `useAuth` from `frontend/src/context/AuthContext.tsx`; `CATEGORIES`, `TICKET_STATUSES` from `frontend/src/constants/designTokens.js`; `TicketCardSkeleton`, `MapSkeleton`, `useToast` from `frontend/src/components/ui/index.js`.
- Produces: Live API-backed `WargaBerandaPage` (`/`) and `WargaPetaPage` (`/peta`) with zero `mockTickets.ts` imports.

- [ ] **Step 1: Wire `WargaBerandaPage` (`frontend/src/app/warga/page.tsx`)**
  - Remove imports from `../../data/mockTickets.ts`; build category chips dynamically from `["Semua", ...CATEGORIES.map((c) => c.label)]` (or mapping label -> `category` code).
  - Fetch `listTickets()` on mount and on `onJuryEvent("reset", ...)`; show `<MapSkeleton />` and `<TicketCardSkeleton />` while loading, and an inline retry banner (`Coba Lagi`) if initial fetch fails.
  - Derive the 3 hero counters (`Aktif`, `Uji Publik`, `Tuntas`) directly from live `tickets` counts (`!terminal`, `PENDING_VALIDATION`, `CLOSED || AUTO_CLOSED`).
  - Project live `tickets` onto the SVG map canvas using `mapPublicTicketsToWargaPins` + `TICKET_STATUSES[pin.status].Icon`, with clickable pins that navigate to `/tiket/${pin.id}` or highlight the corresponding card, plus GPS "Lokasi Saya" using `navigator.geolocation` (updating `userCoords` and sorting `visibleTickets` by Haversine distance when available; listening to `onJuryEvent("gps", ...)`).
  - Hydrate top 3 visible feed cards via `getTicketDetail(ticket.id, {}, accessToken)` so `beforePhotoUrl` / `isNsfwPendingReview` / `isLowQualityOverride` render real photos! Clicking **"Tampilkan Gambar"** on `isNsfwPendingReview` calls `getTicketMediaSignedUrl(ticket.id, "before", accessToken)` and renders the returned `signedUrl` (with `e.stopPropagation()`). Clicking a card navigates to `/tiket/${ticket.id}` (using real `ticket.id`, never stripping `#` from a mock code).
  - Wire `Header` and `BottomNavbar` `onProfileClick` cleanly (navigating to `/login` when unauthenticated; showing toast summary of `aliasName` & `trustScore` when logged in until `ProfileDrawer` is built).

- [ ] **Step 2: Wire `WargaPetaPage` (`frontend/src/app/warga/peta.tsx`)**
  - Remove imports from `../../data/mockTickets.ts`.
  - Fetch `listTickets()` on mount and on `onJuryEvent("reset", ...)`; show `<MapSkeleton />` while loading and a `"Muat Ulang"` recovery state on error.
  - Build category filter chips dynamically with live ticket counts from `tickets` (`Semua (${tickets.length})` + top categories from `CATEGORIES`).
  - Render real projected pins (`mapPublicTicketsToWargaPins`), real spatial clusters computed from pin buckets, and a pin-selected bottom preview sheet showing `#${selectedPin.code}`, `selectedPin.title`, `selectedPin.departmentLabel` / coordinates, live SLA text, and `selectedPin.supportCount`, navigating to `/tiket/${selectedPin.id}`.
  - Wire "Lokasi Saya" button to `navigator.geolocation` + `onJuryEvent("gps", ...)` with human-friendly permission-denied toast.

- [ ] **Step 3: Verify build and check for remaining mock imports**

Run: `node -e "const fs=require('fs'); for (const p of ['frontend/src/app/warga/page.tsx','frontend/src/app/warga/peta.tsx']) { const c=fs.readFileSync(p,'utf8'); if (c.includes('mockTickets')) throw new Error('Mock still imported in '+p); }" && npm --prefix frontend run build`
Expected: PASS (`vite build` succeeds with 0 errors and zero `mockTickets` imports in both files).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/warga/page.tsx frontend/src/app/warga/peta.tsx
git commit -m "feat(warga): wire home and public map pages to live tickets API"
```

---

### Task 3: Wire Citizen Report Creation (`/lapor`) to Geolocation, Radius Check, WebRTC Camera & Submit API

**Files:**
- Create: `frontend/src/lib/laporDraft.ts`
- Test: `frontend/tests/laporDraft.test.mjs`
- Modify: `frontend/src/app/warga/lapor.tsx:1-316`
- Modify: `frontend/src/App.jsx:147`

**Interfaces:**
- Consumes: `checkTicketRadius`, `supportTicket`, `issueCaptureNonce`, `createTicket`, `fetchSampleAsBase64`, `onJuryEvent` from `frontend/src/lib/api.js`; `useAuth` from `frontend/src/context/AuthContext.tsx`; `LiveCameraCapture` from `frontend/src/features/camera/LiveCameraCapture.jsx`; `CATEGORIES`, `SLA_TIERS` from `frontend/src/constants/designTokens.js`; `projectCoordToMapPercent` from `frontend/src/lib/ticketMappers.ts`; `Input`, `Textarea`, `Button`, `Badge`, `Card`, `useToast` from `frontend/src/components/ui/index.js`.
- Produces:
  - `loadLaporDraft(storage?) -> LaporDraftState`
  - `saveLaporDraft(draft: LaporDraftState, storage?) -> void`
  - `clearLaporDraft(storage?) -> void`
  - `validateLaporDraftForSubmit(draft: LaporDraftState) -> string | null`
  - Fully wired `WargaLaporPage` in `frontend/src/app/warga/lapor.tsx`.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/laporDraft.test.mjs` testing:
1. `loadLaporDraft` creates a default draft with non-empty `idempotencyKey`, and `saveLaporDraft` -> `loadLaporDraft` preserves `title`, `description`, `category`, `photoBase64`, and the exact `idempotencyKey` (so a failed network submit retains both form/photo and the retry key).
2. `validateLaporDraftForSubmit` rejects missing `photoBase64`, `title.trim().length < 5`, and `description.trim().length < 10` with clear Indonesian messages, and returns `null` when valid.

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/laporDraft.test.mjs`
Expected: FAIL because `frontend/src/lib/laporDraft.ts` does not exist.

- [ ] **Step 3: Implement `frontend/src/lib/laporDraft.ts` and wire `frontend/src/app/warga/lapor.tsx` + `frontend/src/App.jsx`**

1. Create `frontend/src/lib/laporDraft.ts` with `DRAFT_STORAGE_KEY = "laporpak_draft_v1"`, `createIdempotencyKey()`, `loadLaporDraft`, `saveLaporDraft`, `clearLaporDraft`, and `validateLaporDraftForSubmit`.
2. Update `frontend/src/app/warga/lapor.tsx` preserving its Figma visual structure (3-step stepper, mini geofence SVG map, nearby quota box, 8-category icon grid, live camera card, BottomNavbar) while wiring:
   - Role guard: if `user?.role === "ADMIN_DINAS"`, redirect via `<Navigate to="/dinas" replace />` (`App.jsx` also wraps `/lapor` cleanly or lets `WargaLaporPage` handle public draft + login prompt before camera/submit).
   - Geolocation: button **"Kunci Lokasi GPS Saat Ini" / "Perbarui Lokasi GPS"** using `navigator.geolocation`, showing step-by-step browser lock recovery card when denied and warning banner when `gpsAccuracyMeters > 50` m (`PRD.md` §5.A). Plot the pin on the mini geofence SVG using `projectCoordToMapPercent(draft.lat, draft.lng)`.
   - Pre-camera radius check: call `checkTicketRadius({ lat: draft.lat, lng: draft.lng, category: draft.category })` whenever coordinates or category change; render real `sameCategoryCount50m/sameCategoryLimit`, `globalCount30m/globalLimit`, `guidanceText`, and real `nearbyTickets` cards with working **"Dukung Prioritas"** button calling `supportTicket(t.id, accessToken)` (redirecting to `/login` with toast if `!user && !isJuryMode`).
   - Camera: clicking **"Buka Kamera Live TKP"** checks `!user && !isJuryMode` (navigates to `/login` preserving draft) and `radiusResult?.canOpenCamera && !gpsInaccurate`, then opens `<LiveCameraCapture open={cameraOpen} publicLat={draft.lat} publicLng={draft.lng} categoryCode={draft.category} gpsAccuracy={draft.gpsAccuracyMeters} onClose={...} onCapture={...} />`, rendering preview image + `isLowQualityOverride` badge when captured.
   - Jury events: subscribe to `onJuryEvent("gps", ...)` and `onJuryEvent("capture", ...)` (`fetchSampleAsBase64`) so PC jury tests without webcam work identically to `pages/LaporPage.tsx`.
   - Form fields & submit: add `<Input label="Judul Singkat Kerusakan" ... />` (`>= 5` chars) above `<Textarea label="Catatan Kerusakan" minChars={10} ... />`; on submit validate via `validateLaporDraftForSubmit`, call `issueCaptureNonce({ actionType: "CREATE_TICKET" }, accessToken)` -> `createTicket(..., { token: accessToken, idempotencyKey: draft.idempotencyKey })`, clear draft on 200/201, and display confirmation card with links to `/tiket/${createdId}` and **"Buat Laporan Lain"**. On error, preserve `draft` + `idempotencyKey` and show `humanizeError(err)` inline + retry label **"Kirim Ulang Laporan"**.

- [ ] **Step 4: Run test & Vite build to verify**

Run: `node --test frontend/tests/laporDraft.test.mjs && npm --prefix frontend run build`
Expected: PASS (all unit tests pass and `vite build` succeeds; zero `mockTickets` imports in `frontend/src/app/warga/lapor.tsx`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/laporDraft.ts frontend/tests/laporDraft.test.mjs frontend/src/app/warga/lapor.tsx frontend/src/App.jsx
git commit -m "feat(warga): wire /lapor to geolocation, radius quota, live camera, and ticket submission"
```

---

### Task 4: Shared `DinasActionModal` & Live `AlertBanners` / `TicketTable` Components

**Files:**
- Create: `frontend/src/components/dinas/DinasActionModal.tsx`
- Modify: `frontend/src/components/dinas/AlertBanners.tsx:1-96`
- Modify: `frontend/src/components/dinas/TicketTable.tsx:1-296`
- Modify: `frontend/src/components/dinas/index.ts`

**Interfaces:**
- Consumes: `executeDinasAction`, `issueCaptureNonce`, `fetchSampleAsBase64`, `onJuryEvent` from `frontend/src/lib/api.js`; `DEPARTMENTS`, `OUT_OF_SCOPE_AGENCIES` (mirroring `src/shared/constants.js` in `designTokens.js` or local typed constant); `LiveCameraCapture` from `frontend/src/features/camera/LiveCameraCapture.jsx`; `Modal`, `Button`, `Badge`, `Input`, `Textarea`, `useToast` from `frontend/src/components/ui/index.js`.
- Produces:
  - `DinasActionModal({ open, ticket, action, currentDepartmentId, accessToken, isJuryMode, onClose, onSuccess })` handling all 8 actions (`process`, `transfer`, `out-of-scope`, `reject-spam`, `resolve`, `reprocess-disputed`, `counter-dispute`, `resolve-escalated`)
  - Updated `AlertBanners({ disputedTicket, escalatedTicket, onProcessRework, onAppealEvidence, onUploadEscalation })` rendering real tickets (or returning `null` if neither exists)
  - Updated `TicketTable({ tickets, activeTab, counts, onTabChange, onAction, onResetFilters })` using dynamic `counts` instead of hardcoded `TICKET_TABS` counts.

- [ ] **Step 1: Update `AlertBanners.tsx` and `TicketTable.tsx` to remove hardcoded mock data**
  - In `AlertBanners.tsx`: remove `DINAS_ALERTS` import from `mockTickets.ts`. Accept `disputedTicket?: DinasTicketViewRow | null` and `escalatedTicket?: DinasTicketViewRow | null`. Compute 24h countdown text from `disputedTicket.disputedAt` (`max(0, 24h - elapsed)`). Render only the banner(s) that have a matching active ticket; if both are null, render `null`.
  - In `TicketTable.tsx`: remove `TICKET_TABS` import from `mockTickets.ts` and import `DinasTicketViewRow` & `TicketActionItem` from `../../lib/ticketMappers.ts`. Define tab metadata inside `TicketTable.tsx` and read badge counts from `counts?: Partial<DinasQueueCounts>` prop (`counts?.[tab.key] ?? 0`). Display `ticket.displayCode` (`#${ticket.code}`) in the status column and location/department summary cleanly.

- [ ] **Step 2: Create `DinasActionModal.tsx` and export from `components/dinas/index.ts`**
  - Implement per-action form bodies inside `<Modal>`:
    - `process` / `reprocess-disputed`: confirmation text + submit button (`executeDinasAction(ticket.id, action.id, {}, accessToken)`).
    - `transfer`: `<select>` of the 3 other Pemda departments (`DISHUB`, `DPU`, `DLH`, `SATPOLPP` excluding `currentDepartmentId`) + `<Textarea minChars={15} ... />`.
    - `out-of-scope`: `<select>` of `OUT_OF_SCOPE_AGENCIES` (`PLN`, `PDAM`, `BPJN_NASIONAL`, `BBWS`, `TELKOM_FIBER`, `LAINNYA`) + `<Textarea minChars={20} ... />`.
    - `reject-spam`: `<Textarea minChars={15} ... />` + checkbox *"Foto mengandung konten tidak senonoh (NSFW)"* (`isNsfwContent`).
    - `resolve` / `counter-dispute` / `resolve-escalated`:
      - Live GPS lock button (`navigator.geolocation`) + distance/accuracy indicator (`<= 50m` accuracy, `<= 75m` to ticket) + `onJuryEvent("gps", ...)` listener.
      - **"Buka Kamera Live Petugas (`<= 75 m`)"** button opening `<LiveCameraCapture />` (plus `onJuryEvent("capture", ...)` listener for Jury fallback camera!).
      - For `resolve-escalated` only: `<input type="file" accept="application/pdf,image/jpeg,image/png" />` validating file size `<= 5 MB` and converting to base64 (`beritaAcaraBase64`, `beritaAcaraFilename`) per `PRD.md` §9 #9.
      - Optional `<Textarea label="Catatan Petugas (Opsional)" />`.
      - On submit: call `issueCaptureNonce({ actionType, ticketId: ticket.id }, accessToken)` where `actionType` is `"RESOLVE_TICKET"` | `"APPEAL_TICKET"` | `"RESOLVE_ESCALATED"`, then `executeDinasAction(ticket.id, action.id, body, accessToken)`.
  - Disable submit button while loading, show `humanizeError(err)` inline on error, and call `onSuccess()` + `showToast({ type: "success", ... })` on completion.

- [ ] **Step 3: Verify Vite build and no mock imports in `components/dinas/`**

Run: `node -e "const fs=require('fs'); for (const p of ['frontend/src/components/dinas/AlertBanners.tsx','frontend/src/components/dinas/TicketTable.tsx','frontend/src/components/dinas/DinasActionModal.tsx']) { const c=fs.readFileSync(p,'utf8'); if (c.includes('mockTickets')) throw new Error('Mock still imported in '+p); }" && npm --prefix frontend run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dinas/AlertBanners.tsx frontend/src/components/dinas/TicketTable.tsx frontend/src/components/dinas/DinasActionModal.tsx frontend/src/components/dinas/index.ts
git commit -m "feat(dinas): add shared DinasActionModal and wire AlertBanners/TicketTable to live props"
```

---

### Task 5: Wire Dinas Workbench (`/dinas`) and Dinas Map (`/dinas/peta`) to Live APIs

**Files:**
- Modify: `frontend/src/app/dinas/page.tsx:1-234`
- Modify: `frontend/src/app/dinas/peta.tsx:1-658`

**Interfaces:**
- Consumes: `listDinasTickets`, `getTicketDetail`, `getTicketMediaSignedUrl`, `getRapor`, `onJuryEvent` from `frontend/src/lib/api.js`; `mapDinasTicketsToRows`, `computeDinasQueueCounts`, `projectCoordToMapPercent`, `buildDinasTicketActions` from `frontend/src/lib/ticketMappers.ts`; `DinasActionModal`, `AlertBanners`, `TicketTable`, `StatOverview` from `frontend/src/components/dinas/index.ts`; `useAuth` from `frontend/src/context/AuthContext.tsx`.
- Produces: Live API-backed `DinasDashboardPage` (`/dinas`) and `DinasPetaPage` (`/dinas/peta`) with zero `mockTickets.ts` imports.

- [ ] **Step 1: Wire `DinasDashboardPage` (`frontend/src/app/dinas/page.tsx`)**
  - Remove all imports from `../../data/mockTickets.ts`.
  - Fetch `listDinasTickets({}, accessToken)` and `getRapor()` in parallel whenever `accessToken`, `user?.departmentId`, or `onJuryEvent("reset", ...)` fires (showing `<Skeleton />` loading state and retry button on failure).
  - Compute `ticketRows = mapDinasTicketsToRows(apiTickets)` and `counts = computeDinasQueueCounts(apiTickets)`.
  - Compute live `kpiStats` (4 cards: Tiket Aktif count + Darurat/Menengah/Standar breakdown, Melewati Tenggat count, Dibantah & Eskalasi count, and real `integrityScore` from `getRapor()` matching `user?.departmentId`).
  - Pass real `disputedTicket` (first `DISPUTED` row) and `escalatedTicket` (first `ESCALATED` row) to `<AlertBanners />` and wire its 3 callbacks (`reprocess-disputed`, `counter-dispute`, `resolve-escalated`) directly to open `<DinasActionModal />`.
  - Pass `counts` to `<DinasSidebar />` and `<TicketTable />`, and pass `selectedAction` to `<DinasActionModal />` whose `onSuccess` re-fetches `listDinasTickets` + `getRapor`.

- [ ] **Step 2: Wire `DinasPetaPage` (`frontend/src/app/dinas/peta.tsx`)**
  - Remove all imports from `../../data/mockTickets.ts`.
  - Fetch `listDinasTickets({}, accessToken)` and `getRapor()` on mount and on `onJuryEvent("reset", ...)`; show `<MapSkeleton />` while loading.
  - Project every department ticket to `(mapX, mapY)` using `projectCoordToMapPercent(t.publicLat, t.publicLng)` and group category dropdown dynamically from `CATEGORIES` matching the department's tickets (plus `"Semua"`).
  - When a pin is clicked (`selectedPinId`), fetch `getTicketDetail(selectedPinId, {}, accessToken)` to hydrate the inspector panel with real `description`, `beforePhotoUrl` (with NSFW blur + `"Tampilkan Gambar"` calling `getTicketMediaSignedUrl`), `reporterAlias`, `publicLat`/`publicLng`, `supportCount`, and live `actions` from `buildDinasTicketActions`.
  - Clicking any inspector action button opens `<DinasActionModal />` and refreshes both the ticket list and selected detail on success.

- [ ] **Step 3: Verify build and check for remaining mock imports**

Run: `node -e "const fs=require('fs'); for (const p of ['frontend/src/app/dinas/page.tsx','frontend/src/app/dinas/peta.tsx']) { const c=fs.readFileSync(p,'utf8'); if (c.includes('mockTickets')) throw new Error('Mock still imported in '+p); }" && npm --prefix frontend run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dinas/page.tsx frontend/src/app/dinas/peta.tsx
git commit -m "feat(dinas): wire /dinas dashboard and /dinas/peta map to live API"
```

---

### Task 6: Wire "Catatan Kerja Dinas" (`/rapor` & `/dinas/rapor`) + Nav Labels to `GET /api/rapor`

**Files:**
- Modify: `frontend/src/app/warga/rapor.tsx:1-431`
- Modify: `frontend/src/app/dinas/rapor.tsx:1-661`
- Modify: `frontend/src/components/layout/TopNavbar.tsx:26-31`
- Modify: `frontend/src/components/layout/BottomNavbar.tsx:125-134`

**Interfaces:**
- Consumes: `getRapor`, `listDinasTickets`, `onJuryEvent` from `frontend/src/lib/api.js`; `mapRaporResponse`, `computeDinasQueueCounts` from `frontend/src/lib/ticketMappers.ts`; `CATEGORIES` from `frontend/src/constants/designTokens.js`; `useAuth` from `frontend/src/context/AuthContext.tsx`; `Skeleton`, `useToast` from `frontend/src/components/ui/index.js`.
- Produces: Live API-backed `WargaRaporPage` and `DinasRaporPage` using v3.5 **"Catatan Kerja Dinas"** plain-language labels (`#37`) and zero `mockTickets.ts` imports.

- [ ] **Step 1: Update nav labels in `TopNavbar.tsx` and `BottomNavbar.tsx` (`PRD.md` `#37`)**
  - In `TopNavbar.tsx`: change `{ to: "/rapor", label: "Rapor Publik" }` to `{ to: "/rapor", label: "Catatan Kerja" }`.
  - In `BottomNavbar.tsx`: change `"Rapor"` text label to `"Catatan"` (keeping `to="/rapor"` and `activeTab="rapor"`).

- [ ] **Step 2: Wire `WargaRaporPage` (`frontend/src/app/warga/rapor.tsx`)**
  - Remove imports from `../../data/mockTickets.ts`.
  - Fetch `getRapor()` on mount and on `onJuryEvent("reset", ...)`, transforming with `mapRaporResponse(data)`. Render `<Skeleton />` loading cards and an error retry button if fetch fails.
  - Update headings and badge wording to v3.5 plain-language **"Catatan Kerja Dinas"** (`Nilai Kerja Dinas (Awal 80)`, `Selesai Tepat Waktu`, `Terlambat Parah`, `Sering Lempar Laporan > 25%`, `Sering Tolak Laporan > 20%`).
  - Render dynamic cluster circles from `mapped.clusters` and live `pendingValidationCount` in the CTA card (`"${pendingValidationCount} Tiket Menunggu Cek Warga"`).

- [ ] **Step 3: Wire `DinasRaporPage` (`frontend/src/app/dinas/rapor.tsx`)**
  - Remove imports from `../../data/mockTickets.ts`.
  - Fetch `getRapor(selectedCategory === "ALL" ? {} : { category: selectedCategory })` whenever `selectedCategory` changes or `onJuryEvent("reset", ...)` fires, transforming with `mapRaporResponse(data, { region: selectedRegion })`.
  - Use real category options from `CATEGORIES` (`["ALL", ...CATEGORIES]`) and real `departments` for both the 4 score cards and the 6-column comparison matrix, updating labels to **"Catatan Kerja Dinas"** plain-language terminology (`Nilai Kerja`, `Selesai Tepat Waktu`, `Terlambat / Pengawasan`, `Terlambat Parah`, `Lempar Instansi Lain %`, `Tolak Laporan %`).
  - When `user?.role === "ADMIN_DINAS"` and `showSidebar` is true, also fetch `listDinasTickets({}, accessToken)` (computing `computeDinasQueueCounts`) and pass live `integrityScore` + `counts` to `<DinasSidebar />`.
  - Render dynamic heatmap halos + cluster pins from `mapped.clusters`, showing the Cak Pantau Pose Siaga empty-state card with **"Reset Filter Peta"** whenever `mapped.clusters.length === 0`.

- [ ] **Step 4: Verify build and check for remaining mock imports**

Run: `node -e "const fs=require('fs'); for (const p of ['frontend/src/app/warga/rapor.tsx','frontend/src/app/dinas/rapor.tsx']) { const c=fs.readFileSync(p,'utf8'); if (c.includes('mockTickets')) throw new Error('Mock still imported in '+p); }" && npm --prefix frontend run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/warga/rapor.tsx frontend/src/app/dinas/rapor.tsx frontend/src/components/layout/TopNavbar.tsx frontend/src/components/layout/BottomNavbar.tsx
git commit -m "feat(rapor): wire Catatan Kerja Dinas pages to live /api/rapor endpoint"
```

---

### Task 7: Full Verification (Unit Tests, Production Build & Backend Self-Check)

**Files:**
- Verify all modified files in `frontend/src/app/`, `frontend/src/components/`, `frontend/src/lib/`, `frontend/tests/`

- [ ] **Step 1: Verify zero `mockTickets` imports remain inside `frontend/src/app/` and `frontend/src/components/`**

Run: `node -e "const fs=require('fs'), path=require('path'); function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name); if(e.isDirectory()) walk(p); else if(/\\.(tsx?|jsx?)$/.test(p)){const c=fs.readFileSync(p,'utf8'); if(c.includes('mockTickets')) throw new Error('mockTickets still referenced in '+p);}}} walk('frontend/src/app'); walk('frontend/src/components'); console.log('OK: zero mockTickets references in app/ and components/');"`
Expected: `OK: zero mockTickets references in app/ and components/`.

- [ ] **Step 2: Run all frontend unit tests**

Run: `node --test frontend/tests/*.test.mjs`
Expected: PASS (all tests in `ticketMappers.test.mjs` and `laporDraft.test.mjs` pass).

- [ ] **Step 3: Run full monorepo production build (`npm run build`)**

Run: `npm run build`
Expected: PASS (`prisma generate`, `vite build`, and static asset copy to `frontend/dist/` exit 0).

- [ ] **Step 4: Run backend integration self-check (`npm run check`) if `.env` DB/Redis are reachable**

Run: `npm run check`
Expected: PASS (`ALL 16 END-TO-END BACKEND & SECURITY SUITES PASSED`). (If local environment lacks cloud DB/Redis network credentials, document the exact output/skip reason without claiming pass.)
