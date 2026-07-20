import { queryNearestWeather, upsertWeatherGridRows } from "./clickhouse";
import type { WeatherSnapshot } from "./types";
import { fetchOpenMeteoCurrent, rowToSnapshot } from "./weather-grid";

/**
 * Prefer ClickHouse weather_forecast_grid (pipeline), else live Open-Meteo.
 * Backfills the tile into CH after a live miss so subsequent plans hit SQL.
 */
export async function resolveWeather(
  lat: number,
  lng: number,
): Promise<WeatherSnapshot | null> {
  const fromCh = await queryNearestWeather(lat, lng);
  if (fromCh) return rowToSnapshot(fromCh);

  const live = await fetchOpenMeteoCurrent(lat, lng);
  if (!live) return null;

  void upsertWeatherGridRows([live]).catch(() => undefined);

  return {
    tempC: live.tempC,
    windKmh: live.windKmh,
    windDirDeg: live.windDirDeg,
    precipMm: live.precipMm,
    summary: live.summary,
    source: "open-meteo",
  };
}

/** Alias used by plan builders / older call sites. */
export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<WeatherSnapshot | null> {
  return resolveWeather(lat, lng);
}
