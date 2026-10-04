"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { greatCircleArc, greatCircleMidpoint, type LngLat } from "@/lib/globe";

export type GlobePoint = { name: string; lat: number; lng: number };

// Globe projection over the same keyless OpenStreetMap raster tiles the Places
// map already uses — no new dependency, no new tile host, no API key.
const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    // The planet needs a body of its own: raster tiles can be slow or blocked,
    // and without this the globe is an invisible sphere with a line floating
    // across it. Deep slate reads as ocean under the tone filter.
    { id: "sphere", type: "background", paint: { "background-color": "#16212e" } },
    { id: "osm", type: "raster", source: "osm" },
  ],
};

const ARC_SOURCE = "tether-arc";
const FALLBACK_ACCENT = "rgb(249 115 115)";

// Themes store accents as space-separated RGB channels, so the couple's chosen
// accent can colour the arc without hardcoding any one theme.
function accentColor(el: HTMLElement): string {
  const raw = getComputedStyle(el).getPropertyValue("--accent").trim();
  return raw ? `rgb(${raw})` : FALLBACK_ACCENT;
}

function dotMarker(color: string): HTMLElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: "11px",
    height: "11px",
    borderRadius: "999px",
    background: color,
    // Dark ring keeps the dot readable over land or ocean; the halo reads as a glow.
    boxShadow: `0 0 0 2px rgba(11,11,16,.85), 0 0 14px ${color}`,
  });
  return el;
}

export default function TogetherGlobe({ me, partner }: { me: GlobePoint; partner: GlobePoint }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const a: LngLat = [me.lng, me.lat];
  const b: LngLat = [partner.lng, partner.lat];
  // Re-create only when the coordinates actually change (someone edits their
  // city), which is far rarer than a re-render.
  const key = `${a[0]},${a[1]},${b[0]},${b[1]}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const accent = accentColor(container);
    const mid = greatCircleMidpoint(a, b);
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const map = new maplibregl.Map({
      container,
      style: STYLE,
      center: mid,
      // Opens on the whole planet, then settles onto the two of you.
      zoom: 0,
      bearing: 0,
      minZoom: -1,
      maxZoom: 6,
      attributionControl: { compact: true },
      // One finger scrolls the page instead of grabbing the globe, matching PlacesMap.
      cooperativeGestures: true,
    });

    let cancelled = false;

    map.on("load", () => {
      if (cancelled) return;

      const arc = greatCircleArc(a, b);
      if (arc.length > 0) {
        map.addSource(ARC_SOURCE, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: arc } },
        });
        // Two passes: a soft wide halo under a crisp core line.
        map.addLayer({
          id: "tether-arc-glow",
          type: "line",
          source: ARC_SOURCE,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": accent, "line-width": 7, "line-opacity": 0.22, "line-blur": 4 },
        });
        map.addLayer({
          id: "tether-arc-core",
          type: "line",
          source: ARC_SOURCE,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": accent, "line-width": 1.8, "line-opacity": 0.95 },
        });
      }

      new maplibregl.Marker({ element: dotMarker(accent) })
        .setLngLat(a)
        .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setText(me.name))
        .addTo(map);
      new maplibregl.Marker({ element: dotMarker(accent) })
        .setLngLat(b)
        .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setText(partner.name))
        .addTo(map);

      // fitBounds handles every separation — near-antipodal through same-city —
      // and accounts for the container's shape, which a fixed zoom cannot.
      const bounds = new maplibregl.LngLatBounds(a, a).extend(b);
      map.fitBounds(bounds, { padding: 56, duration: calm ? 0 : 2200 });
    });

    // No render loop of our own: the globe settles once and then sits still, so
    // it costs nothing to leave this page open on a phone.
    return () => {
      cancelled = true;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, me.name, partner.name]);

  return (
    <div
      ref={containerRef}
      className="globe-tone rounded-xl2 overflow-hidden border border-line aspect-[6/5] max-h-[380px]"
      aria-label={`A globe showing ${me.name} and ${partner.name}, with the distance between you drawn as an arc`}
      role="img"
    />
  );
}
