/**
 * Fetch 3 ORS round-trips per start preset and write compact GeoJSON
 * under src/data/golden-routes/ for offline fallback.
 *
 * Usage: node scripts/capture-golden-routes.mjs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
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

const key = process.env.ORS_API_KEY;
if (!key) {
  console.error("ORS_API_KEY required");
  process.exit(1);
}

const presets = {
  centraal: { lat: 52.378, lng: 4.8985 },
  vondelpark: { lat: 52.3577, lng: 4.8686 },
  amstel: { lat: 52.3462, lng: 4.9179 },
};

const variants = [
  { label: "Steady canal loop", profile: "endurance-flat", length: 28000, points: 3, seed: 1 },
  { label: "Park & parkway", profile: "rolling-endurance", length: 32000, points: 4, seed: 7 },
  { label: "Waterland push", profile: "hilly-loop", length: 38000, points: 5, seed: 13 },
];

function downsample(coords, maxPoints = 48) {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const out = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    const c = coords[idx];
    // Keep lng, lat, optional elev — round for smaller files
    out.push(
      c.length >= 3
        ? [round(c[0], 5), round(c[1], 5), round(c[2], 1)]
        : [round(c[0], 5), round(c[1], 5)],
    );
  }
  return out;
}

function round(n, d) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

const outDir = resolve(appRoot, "src/data/golden-routes");
mkdirSync(outDir, { recursive: true });

for (const [preset, start] of Object.entries(presets)) {
  const routes = [];
  for (const v of variants) {
    const res = await fetch(
      "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson",
      {
        method: "POST",
        headers: {
          Authorization: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [[start.lng, start.lat]],
          elevation: true,
          options: {
            round_trip: {
              length: v.length,
              points: v.points,
              seed: v.seed,
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.error(preset, v.label, res.status, await res.text());
      process.exit(1);
    }
    const data = await res.json();
    const feature = data.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!coords?.length) {
      console.error("No geometry", preset, v.label);
      process.exit(1);
    }
    routes.push({
      label: v.label,
      profile: v.profile,
      geometry: {
        type: "LineString",
        coordinates: downsample(coords),
      },
    });
    console.log("OK", preset, v.label, coords.length, "→", downsample(coords).length);
  }
  const path = resolve(outDir, `${preset}.json`);
  writeFileSync(path, `${JSON.stringify({ preset, routes }, null, 2)}\n`);
  console.log("Wrote", path);
}

console.log("Golden routes captured.");
