import { fetchWithTimeout } from "./fetch-timeout";

export type NearbyStart = {
  label: string;
  lat: number;
  lng: number;
  distanceKm: number;
};

function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function offsetPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  km: number,
): { lat: number; lng: number } {
  const R = 6371;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(km / R) +
      Math.cos(lat1) * Math.sin(km / R) * Math.cos(br),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(km / R) * Math.cos(lat1),
      Math.cos(km / R) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

async function nominatimJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "CycleForge/1.0 (open-source cycling planner; nearby starts)",
        },
        cache: "no-store",
      },
      8000,
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function reverseLabel(lat: number, lng: number): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "16");
  const data = await nominatimJson<{
    name?: string;
    display_name?: string;
    address?: {
      suburb?: string;
      neighbourhood?: string;
      city?: string;
      town?: string;
      village?: string;
      road?: string;
    };
  }>(url.toString());
  if (!data) return null;
  const a = data.address;
  const short =
    data.name ||
    a?.suburb ||
    a?.neighbourhood ||
    a?.road ||
    a?.city ||
    a?.town ||
    a?.village;
  if (short) return short;
  if (data.display_name) return data.display_name.split(",").slice(0, 2).join(",");
  return null;
}

async function searchNearby(
  lat: number,
  lng: number,
  query: string,
): Promise<NearbyStart[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("viewbox", `${lng - 0.12},${lat + 0.1},${lng + 0.12},${lat - 0.1}`);
  url.searchParams.set("bounded", "1");
  const rows = await nominatimJson<
    Array<{ display_name?: string; lat?: string; lon?: string; name?: string }>
  >(url.toString());
  if (!rows?.length) return [];
  return rows
    .map((r) => {
      const plat = Number(r.lat);
      const plng = Number(r.lon);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) return null;
      const label =
        r.name ||
        r.display_name?.split(",").slice(0, 2).join(",").trim() ||
        "Nearby place";
      return {
        label,
        lat: plat,
        lng: plng,
        distanceKm: Math.round(haversineKm(lat, lng, plat, plng) * 10) / 10,
      };
    })
    .filter((x): x is NearbyStart => x !== null)
    .filter((x) => x.distanceKm >= 0.4 && x.distanceKm <= 12);
}

/** Three ride-start suggestions near a pin (stations / parks / local labels). */
export async function suggestNearbyStarts(
  lat: number,
  lng: number,
): Promise<NearbyStart[]> {
  const queries = ["railway station", "park", "town square"];
  const found: NearbyStart[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    const hits = await searchNearby(lat, lng, q);
    for (const hit of hits) {
      const key = `${hit.label.toLowerCase()}-${hit.lat.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(hit);
      if (found.length >= 3) return found.slice(0, 3);
    }
    // Be polite to Nominatim.
    await new Promise((r) => setTimeout(r, 200));
  }

  if (found.length >= 3) return found.slice(0, 3);

  const bearings = [
    { deg: 20, km: 2.8, tag: "North loop start" },
    { deg: 140, km: 3.2, tag: "SE park start" },
    { deg: 250, km: 2.5, tag: "West canal start" },
  ];
  for (const b of bearings) {
    if (found.length >= 3) break;
    const p = offsetPoint(lat, lng, b.deg, b.km);
    const label = (await reverseLabel(p.lat, p.lng)) ?? b.tag;
    const key = `${label.toLowerCase()}-${p.lat.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      label,
      lat: p.lat,
      lng: p.lng,
      distanceKm: Math.round(haversineKm(lat, lng, p.lat, p.lng) * 10) / 10,
    });
    await new Promise((r) => setTimeout(r, 200));
  }

  return found.slice(0, 3);
}
