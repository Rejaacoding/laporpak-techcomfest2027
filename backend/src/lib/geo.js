import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const geoPath = path.resolve(__dirname, "..", "..", "..", "public", "geo", "sidoarjo-surabaya.json");

let cachedRing = null;

function getServiceRing() {
  if (!cachedRing) {
    const raw = JSON.parse(fs.readFileSync(geoPath, "utf8"));
    cachedRing = raw.features[0].geometry.coordinates[0];
  }
  return cachedRing;
}

// Ray-casting point-in-polygon pada [lng, lat]
export function isInsideServiceArea(lat, lng) {
  const ring = getServiceRing();
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWibNightWindow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const totalMin = hh * 60 + mm;
  return totalMin >= 18 * 60 || totalMin <= 5 * 60 + 30;
}
