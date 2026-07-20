import type { RouteCandidate } from "./types";

export type WindSegment = {
  fromKm: number;
  toKm: number;
  /** Cosine of heading vs wind; +1 = pure headwind, -1 = tailwind. */
  headwind: number;
  coordinates: GeoJSON.Position[];
};

function bearingDeg(
  a: [number, number],
  b: [number, number],
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(a[1]);
  const φ2 = toRad(b[1]);
  const Δλ = toRad(b[0] - a[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Split the selected route into headwind / cross / tail bands for map tinting. */
export function buildWindSegments(
  route: RouteCandidate,
  windDirDeg: number,
): WindSegment[] {
  const coords = route.geometry.coordinates as [number, number][];
  if (coords.length < 2) return [];

  const segments: WindSegment[] = [];
  let fromKm = 0;
  let bucketStart = 0;
  let bucketHead = 0;
  let bucketCount = 0;
  let bucketCoords: GeoJSON.Position[] = [coords[0]];

  const flush = (toIdx: number, toKm: number) => {
    if (bucketCoords.length < 2 || toKm - fromKm < 0.15) {
      fromKm = toKm;
      bucketStart = toIdx;
      bucketCoords = [coords[toIdx]];
      bucketHead = 0;
      bucketCount = 0;
      return;
    }
    segments.push({
      fromKm,
      toKm,
      headwind: bucketCount ? bucketHead / bucketCount : 0,
      coordinates: bucketCoords,
    });
    fromKm = toKm;
    bucketStart = toIdx;
    bucketCoords = [coords[toIdx]];
    bucketHead = 0;
    bucketCount = 0;
    void bucketStart;
  };

  let cumKm = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const dKm = haversineKm(a, b);
    cumKm += dKm;
    const travel = bearingDeg(a, b);
    // Wind "from" direction: rider faces headwind when travel ≈ windDir.
    const diff = ((travel - windDirDeg + 540) % 360) - 180;
    const headwind = Math.cos((diff * Math.PI) / 180);
    const prevClass = bucketCount
      ? bucketHead / bucketCount > 0.35
        ? "h"
        : bucketHead / bucketCount < -0.35
          ? "t"
          : "c"
      : null;
    const nextClass = headwind > 0.35 ? "h" : headwind < -0.35 ? "t" : "c";
    if (prevClass && prevClass !== nextClass) {
      flush(i - 1, cumKm - dKm);
    }
    bucketHead += headwind;
    bucketCount += 1;
    bucketCoords.push(b);
  }
  flush(coords.length - 1, cumKm);
  return segments.slice(0, 40);
}

export function windSegmentColor(headwind: number): string {
  if (headwind > 0.35) return "#c45c26";
  if (headwind < -0.35) return "#2f5d8c";
  return "#8a9088";
}
