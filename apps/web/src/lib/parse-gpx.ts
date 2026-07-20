import type { Intensity } from "./types";

export type ParsedGpxRide = {
  label: string;
  startedAt: Date;
  distanceM: number;
  durationS: number;
  elevGainM: number;
  tssEst: number;
  intensity: Intensity;
};

type TrackPoint = {
  lat: number;
  lon: number;
  elevM: number | null;
  time: Date | null;
};

function segmentM(a: TrackPoint, b: TrackPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function estimateIntensity(tss: number, hours: number): Intensity {
  const ifProxy = hours > 0 ? Math.sqrt(tss / (hours * 100)) : 0.65;
  if (ifProxy < 0.6) return "easy";
  if (ifProxy < 0.72) return "endurance";
  if (ifProxy < 0.82) return "tempo";
  return "hills";
}

function textContent(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const m = xml.match(re);
  return m?.[1]?.trim() || null;
}

function parseTrackPoints(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const trkptRe =
    /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi;
  let match: RegExpExecArray | null;
  while ((match = trkptRe.exec(xml)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const latM = attrs.match(/\blat=["']([^"']+)["']/i);
    const lonM = attrs.match(/\blon=["']([^"']+)["']/i);
    if (!latM || !lonM) continue;
    const lat = Number(latM[1]);
    const lon = Number(lonM[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const elevRaw = textContent(body, "ele");
    const timeRaw = textContent(body, "time");
    points.push({
      lat,
      lon,
      elevM: elevRaw != null && elevRaw !== "" ? Number(elevRaw) : null,
      time: timeRaw ? new Date(timeRaw) : null,
    });
  }
  return points;
}

/** Parse a GPX 1.1 track export (Strava / Garmin / TrainingPeaks style). */
export function parseGpxRide(
  xml: string,
  fallbackLabel = "Uploaded ride",
): ParsedGpxRide {
  const points = parseTrackPoints(xml);
  if (points.length < 2) {
    throw new Error("GPX needs at least two track points.");
  }

  let distanceM = 0;
  let elevGainM = 0;
  let prevElev: number | null =
    points[0].elevM != null && Number.isFinite(points[0].elevM)
      ? points[0].elevM
      : null;
  for (let i = 1; i < points.length; i++) {
    distanceM += segmentM(points[i - 1], points[i]);
    const elev = points[i].elevM;
    if (elev != null && Number.isFinite(elev)) {
      if (prevElev != null && elev > prevElev) {
        elevGainM += elev - prevElev;
      }
      prevElev = elev;
    }
  }

  const times = points
    .map((p) => p.time)
    .filter((t): t is Date => t instanceof Date && !Number.isNaN(t.getTime()));
  const startedAt = times[0] ?? new Date();
  const endedAt = times[times.length - 1] ?? null;
  let durationS =
    endedAt && times[0]
      ? Math.max(60, Math.round((endedAt.getTime() - times[0].getTime()) / 1000))
      : Math.round((distanceM / 1000 / 25) * 3600);
  durationS = Math.max(60, durationS);

  const hours = durationS / 3600;
  const climbPerKm = elevGainM / Math.max(distanceM / 1000, 1);
  const ifEst = Math.min(0.95, 0.62 + climbPerKm / 80);
  const tssEst = Math.round(hours * ifEst * ifEst * 100);

  const name =
    textContent(xml, "name") ||
    textContent(xml.slice(0, 2000), "name") ||
    fallbackLabel;

  return {
    label: name.slice(0, 80),
    startedAt,
    distanceM: Math.round(distanceM),
    durationS,
    elevGainM: Math.round(elevGainM),
    tssEst,
    intensity: estimateIntensity(tssEst, hours),
  };
}
