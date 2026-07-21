"use client";

import { useMemo } from "react";

const W = 220;
const H = 110;
const PAD = 10;

export function RouteMiniMap({
  geometry,
  color,
  active = false,
}: {
  geometry: GeoJSON.LineString;
  color: string;
  active?: boolean;
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

    // Downsample so the polyline stays cheap in the DOM.
    const step = Math.max(1, Math.floor(coords.length / 120));
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

    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`)
      .join(" ");
    return {
      path: d,
      start: pts[0] ?? null,
      end: pts[pts.length - 1] ?? null,
    };
  }, [geometry]);

  if (!path) {
    return <span className="route-mini route-mini--empty" />;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="route-mini"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect
        x="1"
        y="1"
        width={W - 2}
        height={H - 2}
        rx="10"
        className="route-mini__bg"
      />
      <path d={path} className="route-mini__line" style={{ stroke: color }} />
      {active && start ? (
        <circle cx={start[0]} cy={start[1]} r="4.5" className="route-mini__dot route-mini__dot--start" style={{ fill: color }} />
      ) : null}
      {end ? (
        <circle cx={end[0]} cy={end[1]} r="3.2" className="route-mini__dot route-mini__dot--end" />
      ) : null}
    </svg>
  );
}
