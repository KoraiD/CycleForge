import type { WeatherSnapshot } from "./types";

const WMO: Record<number, string> = {
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

export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<WeatherSnapshot | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set(
      "current",
      "temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code",
    );
    url.searchParams.set("wind_speed_unit", "kmh");

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: {
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
    return {
      tempC: c.temperature_2m ?? 12,
      windKmh: c.wind_speed_10m ?? 10,
      windDirDeg: c.wind_direction_10m ?? 0,
      precipMm: c.precipitation ?? 0,
      summary: WMO[code] ?? "Mixed",
    };
  } catch {
    return null;
  }
}
