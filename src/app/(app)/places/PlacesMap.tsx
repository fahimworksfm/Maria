"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type Pin = { id: string; name: string; lat: number; lng: number; visited: boolean };

// Free, key-less raster style using OpenStreetMap tiles.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export default function PlacesMap({ pins }: { pins: Pin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Init once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current || pins.length === 0) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [pins[0]!.lng, pins[0]!.lat],
      zoom: 11,
      attributionControl: { compact: true },
      cooperativeGestures: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [pins.length]);

  // Sync markers + fit bounds whenever pins change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (pins.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of pins) {
      const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setText(p.name);
      const marker = new maplibregl.Marker({ color: p.visited ? "#a99f93" : "#f97373" })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([p.lng, p.lat]);
    }
    if (pins.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 600 });
  }, [pins]);

  return <div ref={containerRef} className="rounded-xl2 overflow-hidden border border-line" style={{ height: 220 }} />;
}
