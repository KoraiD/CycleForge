import { fetchWithTimeout } from "./fetch-timeout";
import type { WeatherSnapshot } from "./types";

/** ~5.5 km tiles — enough for metro-scale nearest-neighbor lookups. */
export const WEATHER_TILE_STEP = 0.05;

export type WeatherGridRow = {
  tileId: string;
  tileLat: number;
  tileLng: number;
  observedAt: string;
  tempC: number;
  windKmh: number;
  windDirDeg: number;
  precipMm: number;
  weatherCode: number;
  summary: string;
};

export const WMO_SUMMARY: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  61: "Light rain",
  63: "Rain",
  71: "Snow",
  80: "Showers",
  95: "Thunderstorm",
};

export function tileCoord(value: number, step = WEATHER_TILE_STEP): number {
  return Math.round(value / step) * step;
}

export function tileIdFor(lat: number, lng: number): string {
  const tLat = tileCoord(lat);
  const tLng = tileCoord(lng);
  return `${tLat.toFixed(2)}_${tLng.toFixed(2)}`;
}

/** Default demo ingest coverage: Amsterdam metro. */
export const AMS_WEATHER_BBOX = {
  minLat: 52.28,
  maxLat: 52.45,
  minLng: 4.72,
  maxLng: 5.05,
};

export function buildTileGrid(
  bbox: typeof AMS_WEATHER_BBOX,
  step = WEATHER_TILE_STEP,
): Array<{ lat: number; lng: number; tileId: string }> {
  const tiles: Array<{ lat: number; lng: number; tileId: string }> = [];
  for (let lat = bbox.minLat; lat <= bbox.maxLat + 1e-9; lat += step) {
    for (let lng = bbox.minLng; lng <= bbox.maxLng + 1e-9; lng += step) {
      const tLat = tileCoord(lat, step);
      const tLng = tileCoord(lng, step);
      tiles.push({
        lat: tLat,
        lng: tLng,
        tileId: `${tLat.toFixed(2)}_${tLng.toFixed(2)}`,
      });
    }
  }
  // de-dupe rounding collisions
  const seen = new Set<string>();
  return tiles.filter((t) => {
    if (seen.has(t.tileId)) return false;
    seen.add(t.tileId);
    return true;
  });
}

export function rowToSnapshot(row: WeatherGridRow): WeatherSnapshot {
  return {
    tempC: row.tempC,
    windKmh: row.windKmh,
    windDirDeg: row.windDirDeg,
    precipMm: row.precipMm,
    summary: row.summary,
    source: "clickhouse",
  };
}

export async function fetchOpenMeteoCurrent(
  lat: number,
  lng: number,
): Promise<WeatherGridRow | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set(
      "current",
      "temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code",
    );
    url.searchParams.set("wind_speed_unit", "kmh");

    const res = await fetchWithTimeout(url.toString(), {}, 8000);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: {
        time?: string;
        temperature_2m?: number;
        precipitation?: number;
        wind_speed_10m?: number;
        wind_direction_10m?: number;
        weather_code?: number;
      };
    };
    const c = data.current;
    if (!c) return null;
    const code = c.weather_code ?? 0;
    const tLat = tileCoord(lat);
    const tLng = tileCoord(lng);
    return {
      tileId: `${tLat.toFixed(2)}_${tLng.toFixed(2)}`,
      tileLat: tLat,
      tileLng: tLng,
      observedAt: normalizeObservedAt(c.time),
      tempC: c.temperature_2m ?? 12,
      windKmh: c.wind_speed_10m ?? 10,
      windDirDeg: c.wind_direction_10m ?? 0,
      precipMm: c.precipitation ?? 0,
      weatherCode: code,
      summary: WMO_SUMMARY[code] ?? "Mixed",
    };
  } catch {
    return null;
  }
}

/** Normalize Open-Meteo current.time (often `2026-07-20T12:00`) to ISO-ish UTC. */
export function normalizeObservedAt(raw?: string): string {
  if (!raw) return new Date().toISOString();
  if (raw.endsWith("Z")) return raw;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return `${raw}.000Z`;
  return new Date(raw).toISOString();
}
