"use client";

import { useMemo } from "react";
import { roadMixForRoute, ROAD_TYPE_META, type RoadTypeKey } from "@/lib/road-types";
import type { RouteCandidate } from "@/lib/types";

export function useRoadMix(route: RouteCandidate | null) {
  return useMemo(() => (route ? roadMixForRoute(route) : null), [route]);
}

const ORDER: RoadTypeKey[] = ["cycleway", "paved", "urban", "gravel", "unpaved"];

export function RoadTypeStrip({
  route,
  accent,
}: {
  route: RouteCandidate;
  accent: string;
}) {
  const mix = useRoadMix(route);
  if (!mix || mix.totalKm <= 0) return null;

  const orderIndex = (t: RoadTypeKey) => ORDER.indexOf(t);
  const segments = [...mix.segments].sort((a, b) => a.fromKm - b.fromKm);

  return (
    <section className="roadmix" aria-label="Road types on route">
      <header className="roadmix__head">
        <p className="eyebrow">Road types</p>
        <span className="roadmix__source">
          {mix.source === "ors" ? "from OpenRouteService way types" : "estimated mix"}
        </span>
      </header>

      <div
        className="roadmix__bar"
        role="img"
        aria-label={mix.kmByType
          .map((t) => `${ROAD_TYPE_META[t.type].label} ${t.km} km`)
          .join(", ")}
        style={{ ["--road-accent" as string]: accent }}
      >
        {segments.map((seg, i) => {
          const meta = ROAD_TYPE_META[seg.type];
          const width = Math.max(((seg.toKm - seg.fromKm) / mix.totalKm) * 100, 0.6);
          return (
            <span
              key={`${seg.type}-${i}`}
              className={`roadmix__seg${meta.pattern ? ` roadmix__seg--${meta.pattern}` : ""}`}
              style={{ width: `${width}%`, backgroundColor: meta.color }}
              title={`${meta.label} · ${(seg.toKm - seg.fromKm).toFixed(1)} km (${Math.round(((seg.toKm - seg.fromKm) / mix.totalKm) * 100)}%)`}
            />
          );
        })}
      </div>

      <ul className="roadmix__legend">
        {mix.kmByType
          .slice()
          .sort((a, b) => orderIndex(a.type) - orderIndex(b.type))
          .map(({ type, km, pct }) => {
            const meta = ROAD_TYPE_META[type];
            return (
              <li key={type} className="roadmix__item">
                <span
                  className={`roadmix__swatch${meta.pattern ? ` roadmix__swatch--${meta.pattern}` : ""}`}
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="roadmix__label">{meta.label}</span>
                <span className="roadmix__value">
                  {km.toFixed(1)} km <em>· {pct}%</em>
                </span>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
