"use client";

import { useMemo } from "react";

const W = 720;
const H = 300;
const PAD = 16;

/**
 * Static, print-friendly route drawing. The interactive map is a WebGL canvas
 * that does not rasterize into PDF, so the summary swaps in this SVG for
 * `@media print`. Same projection math as RouteMiniMap but at summary size.
 */
export function RoutePrintMap({
  geometry,
  color,
}: {
  geometry: GeoJSON.LineString;
  color: string;
}) {
  const { path, start, end } = useMemo(() => {
    const coords = geometry.coordinates;
    if (!coords || coords.length < 2) {
      return { path: "", start: null, end: null } as const;
    }
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const spanLng = Math.max(maxLng - minLng, 1e-6);
    const spanLat = Math.max(maxLat - minLat, 1e-6);
    const innerW = W - PAD * 2;
    const innerH = H - PAD * 2;
    const scale = Math.min(innerW / spanLng, innerH / spanLat);
    const offX = PAD + (innerW - spanLng * scale) / 2;
    const offY = PAD + (innerH - spanLat * scale) / 2;

    const step = Math.max(1, Math.floor(coords.length / 400));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < coords.length; i += step) {
      const x = offX + (coords[i][0] - minLng) * scale;
      const y = H - (offY + (coords[i][1] - minLat) * scale);
      pts.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
    const last = coords[coords.length - 1];
    pts.push([
      Math.round((offX + (last[0] - minLng) * scale) * 10) / 10,
      Math.round((H - (offY + (last[1] - minLat) * scale)) * 10) / 10,
    ]);

    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");
    return { path: d, start: pts[0] ?? null, end: pts[pts.length - 1] ?? null };
  }, [geometry]);

  if (!path) return null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="route-print-map"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Route outline"
    >
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="12" className="route-print-map__bg" />
      <path d={path} className="route-print-map__line" style={{ stroke: color }} />
      {start ? (
        <g>
          <circle cx={start[0]} cy={start[1]} r="7" className="route-print-map__dot route-print-map__dot--start" />
          <text x={start[0]} y={start[1] + 3.5} textAnchor="middle" className="route-print-map__marker">S</text>
        </g>
      ) : null}
      {end ? (
        <g>
          <circle cx={end[0]} cy={end[1]} r="6" className="route-print-map__dot route-print-map__dot--end" />
          <text x={end[0]} y={end[1] + 3} textAnchor="middle" className="route-print-map__marker route-print-map__marker--end">F</text>
        </g>
      ) : null}
    </svg>
  );
}
