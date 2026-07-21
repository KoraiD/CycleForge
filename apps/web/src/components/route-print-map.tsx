"use client";

import { useMemo } from "react";

const W = 720;
const H = 300;
const PAD = 16;
const TILE = 256;
// OSM raster tiles (Slippy Map). Free, no key, prints as real roads.
const TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

const lng2x = (lng: number, z: number) =>
  ((lng + 180) / 360) * Math.pow(2, z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};

/**
 * Static, print-friendly route map. The interactive map is a WebGL canvas that
 * does not rasterize into PDF, so the summary swaps in this SVG for
 * `@media print`. It renders real OpenStreetMap raster tiles as the basemap
 * (so roads are visible) with the route drawn on top.
 */
export function RoutePrintMap({
  geometry,
  color,
}: {
  geometry: GeoJSON.LineString;
  color: string;
}) {
  const model = useMemo(() => {
    const coords = geometry.coordinates;
    if (!coords || coords.length < 2) return null;

    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Pick the highest zoom whose tile span still covers the bbox at our size.
    let z = 15;
    for (; z > 10; z--) {
      const wPx = (lng2x(maxLng, z) - lng2x(minLng, z)) * TILE;
      const hPx = (lat2y(minLat, z) - lat2y(maxLat, z)) * TILE;
      if (wPx <= W - PAD * 2 && hPx <= H - PAD * 2) break;
    }

    const x0 = lng2x(minLng, z) * TILE;
    const x1 = lng2x(maxLng, z) * TILE;
    const y0 = lat2y(maxLat, z) * TILE; // top (smaller y)
    const y1 = lat2y(minLat, z) * TILE; // bottom
    const spanX = Math.max(x1 - x0, 1e-6);
    const spanY = Math.max(y1 - y0, 1e-6);
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
    const offX = PAD + (W - PAD * 2 - spanX * scale) / 2;
    const offY = PAD + (H - PAD * 2 - spanY * scale) / 2;

    const toPx = (lng: number, lat: number): [number, number] => [
      offX + (lng2x(lng, z) * TILE - x0) * scale,
      offY + (lat2y(lat, z) * TILE - y0) * scale,
    ];

    // Tiles covering the visible window.
    const viewMinX = (0 - offX) / scale + x0;
    const viewMaxX = (W - offX) / scale + x0;
    const viewMinY = (0 - offY) / scale + y0;
    const viewMaxY = (H - offY) / scale + y0;
    const maxIndex = Math.pow(2, z) - 1;
    const tx0 = Math.max(0, Math.floor(viewMinX / TILE));
    const tx1 = Math.min(maxIndex, Math.floor(viewMaxX / TILE));
    const ty0 = Math.max(0, Math.floor(viewMinY / TILE));
    const ty1 = Math.min(maxIndex, Math.floor(viewMaxY / TILE));
    const tiles: Array<{ key: string; href: string; x: number; y: number; size: number }> = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        tiles.push({
          key: `${z}/${tx}/${ty}`,
          href: TILE_URL(z, tx, ty),
          x: offX + (tx * TILE - x0) * scale,
          y: offY + (ty * TILE - y0) * scale,
          size: TILE * scale,
        });
      }
    }

    // Route path.
    const step = Math.max(1, Math.floor(coords.length / 400));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < coords.length; i += step) {
      const p = toPx(coords[i][0], coords[i][1]);
      pts.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
    }
    const lastP = toPx(coords[coords.length - 1][0], coords[coords.length - 1][1]);
    pts.push([Math.round(lastP[0] * 10) / 10, Math.round(lastP[1] * 10) / 10]);
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");

    return { tiles, path, start: pts[0] ?? null, end: pts[pts.length - 1] ?? null };
  }, [geometry]);

  if (!model) return null;
  const { tiles, path, start, end } = model;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="route-print-map"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Route map"
    >
      <defs>
        <clipPath id="printMapClip">
          <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="12" />
        </clipPath>
      </defs>
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="12" className="route-print-map__bg" />
      <g clipPath="url(#printMapClip)">
        {tiles.map((t) => (
          <image
            key={t.key}
            href={t.href}
            x={t.x}
            y={t.y}
            width={t.size}
            height={t.size}
            preserveAspectRatio="none"
          />
        ))}
        {/* subtle veil so the route line pops over the basemap */}
        <rect x="0" y="0" width={W} height={H} fill="#ffffff" opacity="0.12" />
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
      </g>
      <text x={W - 6} y={H - 6} textAnchor="end" className="route-print-map__attrib">
        © OpenStreetMap contributors
      </text>
    </svg>
  );
}
