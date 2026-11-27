import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TICKET_STATUSES } from "../../constants/designTokens.js";

/**
 * Exact service area boundary polygon from public/geo/sidoarjo-surabaya.json
 * converted to Leaflet [lat, lng] tuples so the boundary renders immediately
 * without an extra network roundtrip.
 */
const SERVICE_AREA_LATLNGS: Array<[number, number]> = [
  [-7.205, 112.565],
  [-7.175, 112.665],
  [-7.19, 112.765],
  [-7.235, 112.835],
  [-7.335, 112.845],
  [-7.45, 112.86],
  [-7.565, 112.845],
  [-7.585, 112.755],
  [-7.575, 112.635],
  [-7.515, 112.53],
  [-7.445, 112.49],
  [-7.345, 112.515],
  [-7.265, 112.545],
  [-7.205, 112.565],
];

export const DEFAULT_MAP_CENTER: [number, number] = [-7.349, 112.728];
export const DEFAULT_MAP_ZOOM = 11;

export interface MapTicketPin {
  id: string;
  title: string;
  code?: string;
  displayCode?: string;
  status: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
}

export interface MapClusterPoint {
  id: string;
  label: string;
  count: number;
  lat: number;
  lng: number;
}

export interface MapFocusTarget {
  lat: number;
  lng: number;
  zoom?: number;
  seq: number;
}

export interface CivicLeafletMapProps {
  pins?: MapTicketPin[];
  clusters?: MapClusterPoint[];
  selectedPinId?: string | null;
  selectedClusterId?: string | null;
  onSelectPin?: (pinId: string) => void;
  onSelectCluster?: (clusterId: string) => void;
  userCoords?: { lat: number; lng: number } | null;
  /** Optional circle around userCoords (e.g. 50 m quota radius on /lapor) */
  userRadiusMeters?: number;
  focusTarget?: MapFocusTarget | null;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  showBoundary?: boolean;
  interactive?: boolean;
  className?: string;
  ariaLabel?: string;
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Interactive Leaflet street map for Surabaya and Sidoarjo.
 * Uses Carto Voyager tiles (with OSM fallback), real GeoJSON boundary polygon,
 * semantic 10-status pins, heat clusters, and user GPS marker.
 */
export function CivicLeafletMap({
  pins = [],
  clusters = [],
  selectedPinId = null,
  selectedClusterId = null,
  onSelectPin,
  onSelectCluster,
  userCoords = null,
  userRadiusMeters,
  focusTarget = null,
  defaultCenter = DEFAULT_MAP_CENTER,
  defaultZoom = DEFAULT_MAP_ZOOM,
  showBoundary = true,
  interactive = true,
  className = "h-full w-full",
  ariaLabel = "Peta interaktif wilayah Surabaya dan Sidoarjo",
}: CivicLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinLayerRef = useRef<L.LayerGroup | null>(null);
  const clusterLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectPinRef = useRef(onSelectPin);
  const onSelectClusterRef = useRef(onSelectCluster);
  const initialCenterRef = useRef(defaultCenter);
  const initialZoomRef = useRef(defaultZoom);
  const lastPinSigRef = useRef("");
  const lastClusterSigRef = useRef("");
  const lastFocusKeyRef = useRef<string | null>(null);

  onSelectPinRef.current = onSelectPin;
  onSelectClusterRef.current = onSelectCluster;

  // Initialize Leaflet map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return undefined;

    const map = L.map(el, {
      center: initialCenterRef.current,
      zoom: initialZoomRef.current,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      attributionControl: true,
    });

    if (interactive) {
      L.control.zoom({ position: "topright" }).addTo(map);
    }

    const primaryTiles = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }
    );

    let fallbackLoaded = false;
    primaryTiles.on("tileerror", () => {
      if (fallbackLoaded) return;
      fallbackLoaded = true;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
    });
    primaryTiles.addTo(map);

    if (showBoundary) {
      L.polygon(SERVICE_AREA_LATLNGS, {
        color: "#0F766E",
        weight: 2,
        opacity: 0.7,
        dashArray: "7 5",
        fillColor: "#0F766E",
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(map);
    }

    clusterLayerRef.current = L.layerGroup().addTo(map);
    pinLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    lastPinSigRef.current = "";
    lastClusterSigRef.current = "";

    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      pinLayerRef.current = null;
      clusterLayerRef.current = null;
      userLayerRef.current = null;
    };
  }, [interactive, showBoundary]);

  // Render ticket markers only when pin data or selection actually changes
  useEffect(() => {
    const layer = pinLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    const sig = `${selectedPinId || ""}|${pins
      .map((p) => `${p.id}:${p.status}:${p.lat}:${p.lng}:${p.title}`)
      .join(";")}`;
    if (sig === lastPinSigRef.current) return;
    lastPinSigRef.current = sig;

    layer.clearLayers();
    for (const pin of pins) {
      const lat = pin.lat == null ? Number.NaN : Number(pin.lat);
      const lng = pin.lng == null ? Number.NaN : Number(pin.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const meta = TICKET_STATUSES[pin.status] || TICKET_STATUSES.OPEN;
      const isSelected = pin.id === selectedPinId;
      const isUrgent = pin.status === "OVERDUE" || pin.status === "ESCALATED";
      const size = isSelected ? 26 : 18;
      const ringSize = isSelected ? 40 : isUrgent ? 30 : 0;

      const html = `
        <div class="civic-pin-wrap ${isSelected ? "is-selected" : ""}" style="width:${size}px;height:${size}px;">
          ${
            ringSize > 0
              ? `<span class="civic-pin-ring" style="width:${ringSize}px;height:${ringSize}px;border-color:${
                  isSelected ? "#0F766E" : meta.pinHex
                };background:${isSelected ? "rgba(15,118,110,0.18)" : "rgba(220,38,38,0.16)"};"></span>`
              : ""
          }
          <span class="civic-pin-dot" style="width:${size}px;height:${size}px;background:${
            meta.pinHex
          };border-color:${isSelected ? "#0F766E" : "#FFFFFF"};"></span>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: "civic-leaflet-divicon",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: isSelected ? 900 : isUrgent ? 450 : 100,
      });

      const codeText = pin.displayCode || (pin.code ? `#${pin.code}` : "");
      marker.bindTooltip(
        `<div class="civic-tip"><strong>${escapeHtml(pin.title)}</strong><span>${escapeHtml(
          `${meta.label}${codeText ? ` · ${codeText}` : ""}`
        )}</span></div>`,
        { direction: "top", offset: [0, -(size / 2 + 4)], opacity: 0.98 }
      );

      marker.on("click", () => {
        onSelectPinRef.current?.(pin.id);
        const targetZoom = Math.max(map.getZoom(), 14);
        if (prefersReducedMotion()) {
          map.setView([lat, lng], targetZoom, { animate: false });
        } else {
          map.flyTo([lat, lng], targetZoom, { duration: 0.45 });
        }
      });

      marker.addTo(layer);
    }
  }, [pins, selectedPinId]);

  // Render regional heat clusters only when cluster data or selection changes
  useEffect(() => {
    const layer = clusterLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    const sig = `${selectedClusterId || ""}|${clusters
      .map((c) => `${c.id}:${c.count}:${c.lat}:${c.lng}:${c.label}`)
      .join(";")}`;
    if (sig === lastClusterSigRef.current) return;
    lastClusterSigRef.current = sig;

    layer.clearLayers();
    for (const cluster of clusters) {
      if (!Number.isFinite(cluster.lat) || !Number.isFinite(cluster.lng)) continue;
      const isSelected = cluster.id === selectedClusterId;
      const heatColor =
        cluster.count >= 6 ? "#DC2626" : cluster.count >= 3 ? "#D97706" : "#0F766E";
      const radiusMeters = Math.min(2600, Math.max(850, 700 + cluster.count * 260));

      L.circle([cluster.lat, cluster.lng], {
        radius: radiusMeters,
        color: heatColor,
        weight: isSelected ? 2 : 1,
        opacity: isSelected ? 0.85 : 0.45,
        fillColor: heatColor,
        fillOpacity: isSelected ? 0.24 : 0.14,
        interactive: false,
      }).addTo(layer);

      const badgeSize = Math.min(44, Math.max(32, 26 + cluster.count * 2));
      const icon = L.divIcon({
        html: `<div class="civic-cluster-badge ${isSelected ? "is-selected" : ""}" style="width:${badgeSize}px;height:${badgeSize}px;background:${heatColor};">${cluster.count}</div>`,
        className: "civic-leaflet-divicon",
        iconSize: [badgeSize, badgeSize],
        iconAnchor: [badgeSize / 2, badgeSize / 2],
      });

      const marker = L.marker([cluster.lat, cluster.lng], {
        icon,
        zIndexOffset: isSelected ? 700 : 250,
      });

      marker.bindTooltip(
        `<div class="civic-tip"><strong>${escapeHtml(cluster.label)}</strong><span>${cluster.count} titik laporan</span></div>`,
        { direction: "top", offset: [0, -(badgeSize / 2 + 4)], opacity: 0.98 }
      );

      marker.on("click", () => {
        onSelectClusterRef.current?.(cluster.id);
        const targetZoom = Math.max(map.getZoom(), 13);
        if (prefersReducedMotion()) {
          map.setView([cluster.lat, cluster.lng], targetZoom, { animate: false });
        } else {
          map.flyTo([cluster.lat, cluster.lng], targetZoom, { duration: 0.45 });
        }
      });

      marker.addTo(layer);
    }
  }, [clusters, selectedClusterId]);

  const userLat = userCoords?.lat ?? null;
  const userLng = userCoords?.lng ?? null;

  // Render user GPS position + optional quota radius circle
  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    if (
      userLat === null ||
      userLng === null ||
      !Number.isFinite(userLat) ||
      !Number.isFinite(userLng)
    ) {
      return;
    }

    if (userRadiusMeters && userRadiusMeters > 0) {
      L.circle([userLat, userLng], {
        radius: userRadiusMeters,
        color: "#0F766E",
        weight: 1.5,
        dashArray: "4 4",
        fillColor: "#0F766E",
        fillOpacity: 0.14,
        interactive: false,
      }).addTo(layer);
    }

    const icon = L.divIcon({
      html: `<div class="civic-user-gps"><span class="civic-user-gps-halo"></span><span class="civic-user-gps-core"></span></div>`,
      className: "civic-leaflet-divicon",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    L.marker([userLat, userLng], {
      icon,
      zIndexOffset: 1000,
    })
      .bindTooltip("Posisi GPS aktif", { direction: "top", offset: [0, -12] })
      .addTo(layer);
  }, [userLat, userLng, userRadiusMeters]);

  const focusLat = focusTarget?.lat ?? null;
  const focusLng = focusTarget?.lng ?? null;
  const focusZoom = focusTarget?.zoom;
  const focusSeq = focusTarget?.seq ?? null;

  // Smoothly focus camera only when target coordinates or sequence actually change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || focusLat === null || focusLng === null || focusSeq === null) return;
    if (!Number.isFinite(focusLat) || !Number.isFinite(focusLng)) return;
    const key = `${focusSeq}:${focusLat.toFixed(5)}:${focusLng.toFixed(5)}:${focusZoom ?? ""}`;
    if (key === lastFocusKeyRef.current) return;
    lastFocusKeyRef.current = key;
    const zoom = focusZoom ?? Math.max(map.getZoom(), 14);
    if (prefersReducedMotion()) {
      map.setView([focusLat, focusLng], zoom, { animate: false });
    } else {
      map.flyTo([focusLat, focusLng], zoom, { duration: 0.55 });
    }
  }, [focusLat, focusLng, focusZoom, focusSeq]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={ariaLabel}
      className={`civic-leaflet-root ${className}`}
    />
  );
}

export default CivicLeafletMap;
