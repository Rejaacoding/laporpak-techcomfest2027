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
