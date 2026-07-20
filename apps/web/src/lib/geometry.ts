import type { ElevPoint } from "./types";

function haversineM(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function lineDistanceM(coords: number[][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    total += haversineM(lng1, lat1, lng2, lat2);
  }
  return total;
}

/** Project a lon/lat onto the polyline; return distance along line in km. */
export function nearestKmAlongLine(
  coords: number[][],
  lng: number,
  lat: number,
): number | null {
  if (coords.length < 2) return null;
  let bestDist = Infinity;
  let bestAlongM = 0;
  let alongM = 0;

  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const segM = haversineM(lng1, lat1, lng2, lat2);
    if (segM < 1e-3) continue;

    // Local equirectangular projection for segment clamp.
    const x = (lng - lng1) * Math.cos((lat1 * Math.PI) / 180);
    const y = lat - lat1;
    const dx = (lng2 - lng1) * Math.cos((lat1 * Math.PI) / 180);
    const dy = lat2 - lat1;
    const t = Math.max(0, Math.min(1, (x * dx + y * dy) / (dx * dx + dy * dy)));
    const projLng = lng1 + t * (lng2 - lng1);
    const projLat = lat1 + t * (lat2 - lat1);
    const d = haversineM(lng, lat, projLng, projLat);
    if (d < bestDist) {
      bestDist = d;
      bestAlongM = alongM + t * segM;
    }
    alongM += segM;
  }

  if (bestDist > 400) return null;
  return Math.round((bestAlongM / 1000) * 100) / 100;
}

/** Lon/lat at a distance along the line (km). */
export function pointAtKm(
  coords: number[][],
  km: number,
): [number, number] | null {
  if (!coords.length) return null;
  if (km <= 0) return [coords[0][0], coords[0][1]];
  const targetM = km * 1000;
  let alongM = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const segM = haversineM(lng1, lat1, lng2, lat2);
    if (alongM + segM >= targetM) {
      const t = segM < 1e-3 ? 0 : (targetM - alongM) / segM;
      return [lng1 + t * (lng2 - lng1), lat1 + t * (lat2 - lat1)];
    }
    alongM += segM;
  }
  const last = coords[coords.length - 1];
  return [last[0], last[1]];
}

export function elevGainLoss(coords: number[][]): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1][2] ?? 0;
    const next = coords[i][2] ?? 0;
    const d = next - prev;
    if (d > 0) gain += d;
    else loss += -d;
  }
  return { gain, loss };
}

export function buildElevProfile(coords: number[][]): ElevPoint[] {
  if (coords.length === 0) return [];
  const points: ElevPoint[] = [];
  let dist = 0;
  points.push({ km: 0, elevM: coords[0][2] ?? 0 });
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    dist += haversineM(lng1, lat1, lng2, lat2);
    // downsample ~ every 200m
    if (i === coords.length - 1 || dist - points[points.length - 1].km * 1000 >= 200) {
      points.push({ km: Math.round((dist / 1000) * 100) / 100, elevM: coords[i][2] ?? 0 });
    }
  }
  return points;
}

/** Build a simple loop around a start point (fallback geometry). */
export function syntheticLoop(
  startLng: number,
  startLat: number,
  radiusKm: number,
  points = 48,
  baseElev = 2,
  climbAmp = 8,
): GeoJSON.LineString {
  const coords: number[][] = [];
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    const wobble = 1 + 0.12 * Math.sin(3 * t);
    const dLat = (radiusKm * wobble * Math.cos(t)) / 111;
    const dLng =
      (radiusKm * wobble * Math.sin(t)) / (111 * Math.cos((startLat * Math.PI) / 180));
    const elev = baseElev + climbAmp * (0.5 + 0.5 * Math.sin(2 * t));
    coords.push([startLng + dLng, startLat + dLat, elev]);
  }
  return { type: "LineString", coordinates: coords };
}
