import { fetchWithTimeout } from "./fetch-timeout";
import type { LeaveWindowHint } from "./types";
import { WMO_SUMMARY } from "./weather-grid";

export type HourlyWeather = {
  time: string;
  tempC: number;
  precipMm: number;
  windKmh: number;
  weatherCode: number;
  summary: string;
  humidityPct?: number | null;
  uvIndex?: number | null;
  visibilityM?: number | null;
  aqi?: number | null;
  cloudCoverPct?: number | null;
  isDay?: boolean;
};

export type LeaveWindow = LeaveWindowHint;

export function scoreHour(h: HourlyWeather, rideHours: number): number {
  // Prefer dry, moderate wind, mild temps across the ride window start hour.
  const precipPen = Math.min(h.precipMm * 28, 40);
  const windPen = Math.max(0, h.windKmh - 18) * 1.4;
  const tempPen =
    h.tempC < 5 ? (5 - h.tempC) * 3 : h.tempC > 28 ? (h.tempC - 28) * 2.5 : 0;
  const codePen = h.weatherCode >= 61 ? 18 : h.weatherCode >= 51 ? 8 : 0;
  const durationBump = Math.min(rideHours, 3) * 0.5;
  return Math.max(0, 100 - precipPen - windPen - tempPen - codePen - durationBump);
}

export function verdictForScore(score: number): "go" | "caution" | "no-go" {
  if (score >= 72) return "go";
  if (score >= 48) return "caution";
  return "no-go";
}

function labelTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchAirQualityHourly(
  lat: number,
  lng: number,
): Promise<Map<number, number>> {
  // European AQI per ISO local hour — best-effort, never blocks weather fetch.
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("hourly", "european_aqi");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");
  try {
    const res = await fetchWithTimeout(url.toString(), {}, 8000);
    if (!res.ok) return new Map();
    const data = (await res.json()) as {
      hourly?: { time?: string[]; european_aqi?: Array<number | null> };
    };
    const map = new Map<number, number>();
    data.hourly?.time?.forEach((t, i) => {
      const v = data.hourly?.european_aqi?.[i];
      const ts = new Date(t).getTime();
      if (Number.isFinite(ts) && typeof v === "number") map.set(ts, v);
    });
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchOpenMeteoHourly(
  lat: number,
  lng: number,
  hours = 24,
): Promise<HourlyWeather[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation,wind_speed_10m,weather_code,relative_humidity_2m,uv_index,visibility,cloud_cover,is_day",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");

  let res: Response;
  let aqiByHour: Map<number, number>;
  try {
    [res, aqiByHour] = await Promise.all([
      fetchWithTimeout(url.toString(), {}, 8000),
      fetchAirQualityHourly(lat, lng),
    ]);
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const data = (await res.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      precipitation?: number[];
      wind_speed_10m?: number[];
      weather_code?: number[];
      relative_humidity_2m?: number[];
      uv_index?: number[];
      visibility?: number[];
      cloud_cover?: number[];
      is_day?: number[];
    };
  };
  const h = data.hourly;
  if (!h?.time?.length) return [];

  const now = Date.now() - 30 * 60 * 1000;
  const out: HourlyWeather[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const t = h.time[i];
    const ts = new Date(t).getTime();
    if (!Number.isFinite(ts) || ts < now) continue;
    const code = h.weather_code?.[i] ?? 0;
    const iso = t.length === 16 ? `${t}:00` : t;
    out.push({
      time: iso,
      tempC: h.temperature_2m?.[i] ?? 12,
      precipMm: h.precipitation?.[i] ?? 0,
      windKmh: h.wind_speed_10m?.[i] ?? 10,
      weatherCode: code,
      summary: WMO_SUMMARY[code] ?? "Mixed",
      humidityPct: h.relative_humidity_2m?.[i] ?? null,
      uvIndex: h.uv_index?.[i] ?? null,
      visibilityM: h.visibility?.[i] ?? null,
      aqi: aqiByHour.get(new Date(iso).getTime()) ?? aqiByHour.get(ts) ?? null,
      cloudCoverPct: h.cloud_cover?.[i] ?? null,
      isDay: (h.is_day?.[i] ?? 1) === 1,
    });
    if (out.length >= hours) break;
  }
  return out;
}

/** Pick the best departure hour from Open-Meteo hourly (and optional CH current bias). */
export function pickBestLeaveWindow(
  hours: HourlyWeather[],
  durationMin: number,
): LeaveWindow | null {
  if (!hours.length) return null;
  const rideHours = durationMin / 60;
  const ranked = hours
    .map((h) => ({
      hour: h,
      score: Math.round(scoreHour(h, rideHours)),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const alts = ranked.slice(1, 4).map((r) => ({
    startIso: r.hour.time,
    label: labelTime(r.hour.time),
    score: r.score,
  }));

  const reasonBits = [
    best.hour.summary,
    `${Math.round(best.hour.tempC)}°C`,
    `wind ${Math.round(best.hour.windKmh)} km/h`,
  ];
  if (best.hour.precipMm < 0.2) reasonBits.push("mostly dry");
  else reasonBits.push(`${best.hour.precipMm.toFixed(1)} mm precip`);

  const scoredHours = hours.map((h) => {
    const score = Math.round(scoreHour(h, rideHours));
    return {
      time: h.time,
      label: labelTime(h.time),
      score,
      verdict: verdictForScore(score),
      tempC: h.tempC,
      windKmh: h.windKmh,
      precipMm: h.precipMm,
      summary: h.summary,
      weatherCode: h.weatherCode,
      humidityPct: h.humidityPct,
      uvIndex: h.uvIndex,
      visibilityM: h.visibilityM,
      aqi: h.aqi,
      cloudCoverPct: h.cloudCoverPct,
      isDay: h.isDay,
    };
  });

  return {
    bestStartIso: best.hour.time,
    bestStartLabel: labelTime(best.hour.time),
    score: best.score,
    reason: reasonBits.join(" · "),
    alternatives: alts,
    hours: scoredHours,
  };
}

export async function resolveBestLeave(
  lat: number,
  lng: number,
  durationMin: number,
): Promise<LeaveWindow | null> {
  const hours = await fetchOpenMeteoHourly(lat, lng, 24);
  return pickBestLeaveWindow(hours, durationMin);
}
