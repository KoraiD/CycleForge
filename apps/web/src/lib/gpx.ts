import type { ElevPoint, RouteCandidate } from "./types";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function elevAtKm(profile: ElevPoint[], km: number): number | null {
  if (!profile.length) return null;
  if (km <= profile[0].km) return profile[0].elevM;
  const last = profile[profile.length - 1];
  if (km >= last.km) return last.elevM;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if (km <= b.km) {
      const t = (km - a.km) / Math.max(b.km - a.km, 1e-6);
      return a.elevM + t * (b.elevM - a.elevM);
    }
  }
  return last.elevM;
}

/** Haversine distance in km between two lon/lat points. */
function segmentKm(
  a: [number, number],
  b: [number, number],
): number {
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

export function routeToGpx(route: RouteCandidate): string {
  const coords = route.geometry.coordinates;
  const points: string[] = [];
  let cumKm = 0;

  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    if (i > 0) {
      const prev = coords[i - 1] as [number, number];
      cumKm += segmentKm(prev, [lon, lat]);
    }
    const elev = elevAtKm(route.elevProfile, cumKm);
    const eleTag =
      elev === null ? "" : `\n        <ele>${elev.toFixed(1)}</ele>`;
    points.push(
      `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${eleTag}
      </trkpt>`,
    );
  }

  const name = escapeXml(route.label);
  const desc = escapeXml(
    `${(route.distanceM / 1000).toFixed(1)} km · ${Math.round(route.elevGainM)} m gain · CycleForge`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CycleForge" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>${desc}</desc>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${points.join("\n")}
    </trkseg>
  </trk>
</gpx>
`;
}

export function gpxFilename(route: RouteCandidate): string {
  const slug = route.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `cycleforge-${slug || "route"}.gpx`;
}

/** Browser-only download helper. */
export function downloadRouteGpx(route: RouteCandidate): void {
  const xml = routeToGpx(route);
  const blob = new Blob([xml], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = gpxFilename(route);
  a.click();
  URL.revokeObjectURL(url);
}
