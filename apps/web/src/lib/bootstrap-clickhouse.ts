import { createClient } from "@clickhouse/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { ensureRuntimeConfigLoaded, readRuntimeConfig } from "./runtime-config";

function splitStatements(sql: string): string[] {
  return sql
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
}

async function runSqlFile(
  client: ReturnType<typeof createClient>,
  absolutePath: string,
): Promise<number> {
  const sql = readFileSync(absolutePath, "utf8");
  const statements = splitStatements(sql);
  for (const statement of statements) {
    await client.command({ query: statement });
  }
  return statements.length;
}

/**
 * Apply schema + seed + demo athlete using the current BYOK / env ClickHouse config.
 * Safe to re-run (CREATE IF NOT EXISTS / seed inserts).
 */
export async function bootstrapClickHouse(): Promise<{
  ok: boolean;
  schemaStatements: number;
  seedStatements: number;
  athleteRides: number;
  error?: string;
}> {
  ensureRuntimeConfigLoaded();
  const config = readRuntimeConfig();
  const url =
    config.clickhouseUrl ||
    process.env.CLICKHOUSE_URL ||
    process.env.CLICKHOUSE_HOST;
  if (!url) {
    return {
      ok: false,
      schemaStatements: 0,
      seedStatements: 0,
      athleteRides: 0,
      error: "ClickHouse URL not configured",
    };
  }

  const client = createClient({
    url,
    username:
      config.clickhouseUser || process.env.CLICKHOUSE_USER || "default",
    password:
      config.clickhousePassword || process.env.CLICKHOUSE_PASSWORD || "",
    database:
      config.clickhouseDatabase ||
      process.env.CLICKHOUSE_DATABASE ||
      "default",
  });

  try {
    const appRoot = process.cwd();
    const repoCandidates = [
      join(appRoot, "../.."),
      join(appRoot, ".."),
      appRoot,
    ];
    const repoRoot =
      repoCandidates.find((root) =>
        existsSync(join(root, "clickhouse/schema.sql")),
      ) ?? repoCandidates[0];
    const schemaPath = join(repoRoot, "clickhouse/schema.sql");
    const seedPath = join(repoRoot, "clickhouse/seed.sql");
    if (!existsSync(schemaPath) || !existsSync(seedPath)) {
      return {
        ok: false,
        schemaStatements: 0,
        seedStatements: 0,
        athleteRides: 0,
        error: `Missing SQL files (looked under ${repoRoot}/clickhouse)`,
      };
    }

    const schemaStatements = await runSqlFile(client, schemaPath);
    const seedStatements = await runSqlFile(client, seedPath);

    const athletePath = join(appRoot, "src/data/demo-athlete.json");
    let athleteRides = 0;
    if (existsSync(athletePath)) {
      const athlete = JSON.parse(readFileSync(athletePath, "utf8")) as {
        athleteId: string;
        rides: Array<{
          rideId: string;
          daysAgo: number;
          label: string;
          distanceM: number;
          durationS: number;
          elevGainM: number;
          tssEst: number;
          intensity: string;
        }>;
      };
      const now = Date.now();
      const athleteRows = athlete.rides.map((ride) => {
        const started = new Date(now - ride.daysAgo * 86400000);
        started.setUTCHours(9, 0, 0, 0);
        return {
          athlete_id: athlete.athleteId,
          ride_id: ride.rideId,
          started_at: started
            .toISOString()
            .replace("T", " ")
            .replace("Z", ""),
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
      athleteRides = athleteRows.length;
    }

    return { ok: true, schemaStatements, seedStatements, athleteRides };
  } catch (err) {
    return {
      ok: false,
      schemaStatements: 0,
      seedStatements: 0,
      athleteRides: 0,
      error: err instanceof Error ? err.message : "Bootstrap failed",
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}
