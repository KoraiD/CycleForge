import type { RouteCandidate } from "./types";

/**
 * Road-type mix for a route. ORS `extra_info=waytype` is requested in
 * `ors.ts`, but the demo fallback path synthesizes a deterministic mix from
 * route shape + wizard so the UI always has something meaningful to draw.
 */

export type RoadTypeKey =
  | "paved"
  | "cycleway"
  | "gravel"
  | "unpaved"
  | "urban";

export type RoadSegment = {
  type: RoadTypeKey;
  fromKm: number;
  toKm: number;
};

export type RoadTypeMix = {
  segments: RoadSegment[];
  kmByType: Array<{ type: RoadTypeKey; km: number; pct: number }>;
  totalKm: number;
  source: "ors" | "estimated";
};

export const ROAD_TYPE_META: Record<
  RoadTypeKey,
  { label: string; color: string; pattern?: "dash" | "dot" }
> = {
  paved: { label: "Paved", color: "#3f8f6b" },
  cycleway: { label: "Cycleway", color: "#2c7fb8" },
  urban: { label: "Urban", color: "#8a7a52", pattern: "dash" },
  gravel: { label: "Gravel", color: "#c45c26", pattern: "dash" },
  unpaved: { label: "Unpaved", color: "#9a5b3a", pattern: "dot" },
};

type OrsExtras = {
  extras?: {
    waytype?: {
      values?: Array<[number, number, number]>;
      summary?: Array<{ value: number; distance: number; amount: number }>;
    };
  };
};

const ORS_WAYTYPE_MAP: Record<number, RoadTypeKey> = {
  0: "unpaved", // Other
  1: "paved", // StateRoad
  2: "paved", // Road
  3: "urban", // Street
  4: "gravel", // Path
  5: "cycleway", // Track (closest bucket)
  6: "cycleway", // Cycleway
  7: "cycleway", // Footway (often shared)
  8: "gravel", // Steps (rare)
  9: "cycleway", // Ferry (kept simple)
};

/** Try to read ORS waytype extras off a route (they travel as extras on RawRoute→RouteCandidate when present). */
export function mixFromOrs(route: RouteCandidate): RoadTypeMix | null {
  const raw = route as unknown as OrsExtras;
  const extras = raw.extras?.waytype;
  if (!extras?.values?.length || !route.geometry.coordinates.length) return null;
  const totalKm = route.distanceM / 1000;
  if (totalKm <= 0) return null;

  const coords = route.geometry.coordinates;
  const n = coords.length;
  const kmAtIndex = (i: number) => (i / Math.max(n - 1, 1)) * totalKm;

  const acc = new Map<RoadTypeKey, number>();
  const segments: RoadSegment[] = [];
  for (const [from, to, value] of extras.values) {
    const type = ORS_WAYTYPE_MAP[value] ?? "paved";
    const fromKm = kmAtIndex(Math.max(0, from));
    const toKm = kmAtIndex(Math.min(n - 1, Math.max(to, from + 1)));
    if (toKm - fromKm <= 0.005) continue;
    segments.push({ type, fromKm, toKm });
    acc.set(type, (acc.get(type) ?? 0) + (toKm - fromKm));
  }
  if (!segments.length) return null;
  return finalize(segments, acc, totalKm, "ors");
}

/** Deterministic pseudo-random 0..1 from a string. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Heuristic mix for demo/fallback routes — mirrors how the planner talks about "quiet roads". */
export function estimateRoadMix(route: RouteCandidate): RoadTypeMix {
  const totalKm = route.distanceM / 1000;
  const rnd = hash01(route.routeId || route.label || "route");
  const avoidBusy = route.score.safetyProxy >= 0.72;
  const hilly = route.elevGainM > Math.max(140, totalKm * 18);

  // Base shares — cycleway-heavy Netherlands demo flavor.
  let cycleway = avoidBusy ? 0.44 : 0.3;
  let paved = avoidBusy ? 0.3 : 0.42;
  const urban = avoidBusy ? 0.12 : 0.2;
  let gravel = hilly ? 0.1 : 0.08;
  const unpaved = hilly ? 0.04 : 0.02;

  // Route-specific wobble so the three cards don't look identical.
  cycleway += (rnd - 0.5) * 0.08;
  paved += (0.5 - rnd) * 0.06;
  gravel += (rnd - 0.5) * 0.04;

  const raw: Array<[RoadTypeKey, number]> = [
    ["cycleway", cycleway],
    ["paved", paved],
    ["urban", urban],
    ["gravel", gravel],
    ["unpaved", unpaved],
  ];
  const sum = raw.reduce((s, [, v]) => s + Math.max(v, 0.01), 0);

  const acc = new Map<RoadTypeKey, number>();
  const segments: RoadSegment[] = [];
  let cursor = 0;
  // Interleave into 3–7 stretches so the map strip looks like real sections.
  const stretchCount = 3 + Math.floor(rnd * 4);
  const pool: Array<[RoadTypeKey, number]> = raw.map(([t, v]) => [t, (Math.max(v, 0.01) / sum) * totalKm]);
  for (let s = 0; s < stretchCount; s++) {
    const remaining = pool.filter(([, km]) => km > 0.01);
    if (!remaining.length) break;
    const [type, km] = remaining[s % remaining.length];
    const isLast = s === stretchCount - 1;
    const take = isLast
      ? totalKm - cursor
      : Math.min(km, Math.max(totalKm / stretchCount, km * (0.4 + rnd * 0.4)));
    if (take <= 0.01) continue;
    segments.push({ type, fromKm: cursor, toKm: cursor + take });
    acc.set(type, (acc.get(type) ?? 0) + take);
    const idx = pool.findIndex(([t]) => t === type);
    pool[idx][1] -= take;
    cursor += take;
  }
  if (cursor < totalKm - 0.01) {
    const type = "paved";
    segments.push({ type, fromKm: cursor, toKm: totalKm });
    acc.set(type, (acc.get(type) ?? 0) + (totalKm - cursor));
  }
  return finalize(segments, acc, totalKm, "estimated");
}

function finalize(
  segments: RoadSegment[],
  acc: Map<RoadTypeKey, number>,
  totalKm: number,
  source: "ors" | "estimated",
): RoadTypeMix {
  const kmByType = [...acc.entries()]
    .map(([type, km]) => ({
      type,
      km: Math.round(km * 10) / 10,
      pct: Math.round((km / totalKm) * 100),
    }))
    .sort((a, b) => b.km - a.km);
  return { segments, kmByType, totalKm: Math.round(totalKm * 10) / 10, source };
}

export function roadMixForRoute(route: RouteCandidate): RoadTypeMix {
  return mixFromOrs(route) ?? estimateRoadMix(route);
}

/** Split geometry into per-road-type polylines for the map layer. */
export function roadTypeGeometries(
  route: RouteCandidate,
  mix: RoadTypeMix,
): Array<{ type: RoadTypeKey; coordinates: number[][] }> {
  const coords = route.geometry.coordinates;
  if (coords.length < 2 || !mix.segments.length) return [];
  const totalKm = route.distanceM / 1000;
  const n = coords.length;
  const idxAtKm = (km: number) =>
    Math.min(n - 1, Math.max(0, Math.round((km / Math.max(totalKm, 0.001)) * (n - 1))));

  return mix.segments
    .map((seg) => {
      const a = idxAtKm(seg.fromKm);
      const b = Math.max(a + 1, idxAtKm(seg.toKm));
      const slice = coords.slice(a, b + 1);
      return slice.length >= 2 ? { type: seg.type, coordinates: slice } : null;
    })
    .filter((x): x is { type: RoadTypeKey; coordinates: number[][] } => x !== null);
}
