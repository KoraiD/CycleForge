import { createClient } from "@clickhouse/client";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const root = resolve(__dirname, "../../..");

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
loadEnvFile(resolve(appRoot, ".env"));

// Prefer BYOK runtime config written by the Setup UI.
try {
  const cfgPath = resolve(appRoot, ".data/runtime-config.json");
  if (existsSync(cfgPath)) {
    const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    if (cfg.clickhouseUrl) process.env.CLICKHOUSE_URL = cfg.clickhouseUrl;
    if (cfg.clickhouseUser) process.env.CLICKHOUSE_USER = cfg.clickhouseUser;
    if (cfg.clickhousePassword !== undefined) {
      process.env.CLICKHOUSE_PASSWORD = cfg.clickhousePassword;
    }
    if (cfg.clickhouseDatabase) {
      process.env.CLICKHOUSE_DATABASE = cfg.clickhouseDatabase;
    }
  }
} catch {
  /* ignore */
}

const url = process.env.CLICKHOUSE_URL || process.env.CLICKHOUSE_HOST;
if (!url) {
  console.error("Set CLICKHOUSE_URL (and user/password) before seeding.");
  process.exit(1);
}

const client = createClient({
  url,
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

async function runFile(relativePath) {
  const sql = readFileSync(resolve(root, relativePath), "utf8");
  const statements = sql
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await client.command({ query: statement });
    console.log("OK:", statement.slice(0, 60).replace(/\s+/g, " "), "…");
  }
}

await runFile("clickhouse/schema.sql");
await runFile("clickhouse/seed.sql");

// Demo athlete fixture → rider_history_rides (relative dates from "now")
const athletePath = resolve(appRoot, "src/data/demo-athlete.json");
const athlete = JSON.parse(readFileSync(athletePath, "utf8"));
const now = Date.now();
const athleteRows = athlete.rides.map((ride) => {
  const started = new Date(now - ride.daysAgo * 86400000);
  started.setUTCHours(9, 0, 0, 0);
  return {
    athlete_id: athlete.athleteId,
    ride_id: ride.rideId,
    started_at: started.toISOString().replace("T", " ").replace("Z", ""),
    label: ride.label,
    distance_m: ride.distanceM,
    duration_s: ride.durationS,
    elev_gain_m: ride.elevGainM,
    tss_est: ride.tssEst,
    intensity: ride.intensity,
    source: "fixture",
  };
});
await client.insert({
  table: "rider_history_rides",
  values: athleteRows,
  format: "JSONEachRow",
});
console.log(
  `OK: seeded ${athleteRows.length} rider_history_rides for ${athlete.athleteId}`,
);

console.log("ClickHouse schema + seed applied.");
await client.close();
