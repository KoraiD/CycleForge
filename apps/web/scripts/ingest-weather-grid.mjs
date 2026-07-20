/**
 * One-shot Open-Meteo → ClickHouse weather grid ingest (Amsterdam metro).
 * Usage: node scripts/ingest-weather-grid.mjs
 */
import { createClient } from "@clickhouse/client";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(appRoot, ".env.local"));

const STEP = 0.05;
const BBOX = { minLat: 52.28, maxLat: 52.45, minLng: 4.72, maxLng: 5.05 };

const WMO = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  51: "Light drizzle",
  61: "Light rain",
  63: "Rain",
  80: "Showers",
  95: "Thunderstorm",
};

function tileCoord(v) {
  return Math.round(v / STEP) * STEP;
}

function buildTiles() {
  const tiles = [];
  const seen = new Set();
  for (let lat = BBOX.minLat; lat <= BBOX.maxLat + 1e-9; lat += STEP) {
    for (let lng = BBOX.minLng; lng <= BBOX.maxLng + 1e-9; lng += STEP) {
      const tLat = tileCoord(lat);
      const tLng = tileCoord(lng);
      const id = `${tLat.toFixed(2)}_${tLng.toFixed(2)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      tiles.push({ id, lat: tLat, lng: tLng });
    }
  }
  return tiles;
}

async function fetchTile(lat, lng) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "current",
    "temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const c = data.current;
  if (!c) return null;
  const code = c.weather_code ?? 0;
  const tLat = tileCoord(lat);
  const tLng = tileCoord(lng);
  let observed = c.time || new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(observed)) observed = `${observed}:00`;
  return {
    tile_id: `${tLat.toFixed(2)}_${tLng.toFixed(2)}`,
    tile_lat: tLat,
    tile_lng: tLng,
    observed_at: observed.replace("T", " ").replace("Z", ""),
    temp_c: c.temperature_2m ?? 12,
    wind_kmh: c.wind_speed_10m ?? 10,
    wind_dir_deg: c.wind_direction_10m ?? 0,
    precip_mm: c.precipitation ?? 0,
    weather_code: code,
    summary: WMO[code] || "Mixed",
    source: "open-meteo",
  };
}

const url = process.env.CLICKHOUSE_URL || process.env.CLICKHOUSE_HOST;
if (!url) {
  console.error("Set CLICKHOUSE_URL before ingesting weather.");
  process.exit(1);
}

const client = createClient({
  url,
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

const tiles = buildTiles();
console.log(`Fetching ${tiles.length} tiles…`);
const rows = [];
for (const tile of tiles) {
  const row = await fetchTile(tile.lat, tile.lng);
  if (row) rows.push(row);
  process.stdout.write(".");
}
console.log(`\nWriting ${rows.length} rows…`);
if (rows.length) {
  await client.insert({
    table: "weather_forecast_grid",
    values: rows,
    format: "JSONEachRow",
  });
}
await client.close();
console.log("Weather grid ingest complete.");
