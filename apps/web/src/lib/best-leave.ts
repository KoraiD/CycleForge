import { WMO_SUMMARY } from "./weather-grid";

export type HourlyWeather = {
  time: string;
  tempC: number;
  precipMm: number;
  windKmh: number;
  weatherCode: number;
  summary: string;
};

export type LeaveWindow = {
  bestStartIso: string;
  bestStartLabel: string;
  score: number;
  reason: string;
  alternatives: Array<{
    startIso: string;
    label: string;
    score: number;
  }>;
  hours: HourlyWeather[];
};

function scoreHour(h: HourlyWeather, rideHours: number): number {
  // Prefer dry, moderate wind, mild temps across the ride window start hour.
  const precipPen = Math.min(h.precipMm * 28, 40);
  const windPen = Math.max(0, h.windKmh - 18) * 1.4;
  const tempPen =
    h.tempC < 5 ? (5 - h.tempC) * 3 : h.tempC > 28 ? (h.tempC - 28) * 2.5 : 0;
  const codePen = h.weatherCode >= 61 ? 18 : h.weatherCode >= 51 ? 8 : 0;
  const durationBump = Math.min(rideHours, 3) * 0.5;
  return Math.max(0, 100 - precipPen - windPen - tempPen - codePen - durationBump);
}

function labelTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    "temperature_2m,precipitation,wind_speed_10m,weather_code",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = (await res.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      precipitation?: number[];
      wind_speed_10m?: number[];
      weather_code?: number[];
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
    out.push({
      time: t.length === 16 ? `${t}:00` : t,
      tempC: h.temperature_2m?.[i] ?? 12,
      precipMm: h.precipitation?.[i] ?? 0,
      windKmh: h.wind_speed_10m?.[i] ?? 10,
      weatherCode: code,
      summary: WMO_SUMMARY[code] ?? "Mixed",
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

  return {
    bestStartIso: best.hour.time,
    bestStartLabel: labelTime(best.hour.time),
    score: best.score,
    reason: reasonBits.join(" · "),
    alternatives: alts,
    hours,
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
