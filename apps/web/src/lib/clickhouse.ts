import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { runs } from "@trigger.dev/sdk";
import {
  buildDemoAthleteRides,
  DEMO_ATHLETE_ID,
  summarizeAthleteHistory,
  summarizeDemoAthlete,
  type RiderHistoryRide,
} from "./athlete-history";
import { attachCoachNote } from "./coach-note";
import { ensureRuntimeConfigLoaded } from "./runtime-config";
import type {
  HistoryContext,
  Intensity,
  PlanPayload,
  RouteCandidate,
  WizardState,
} from "./types";
import type { WeatherGridRow } from "./weather-grid";

let client: ClickHouseClient | null = null;
let clientKey = "";

function getClient(): ClickHouseClient | null {
  ensureRuntimeConfigLoaded();
  const url = process.env.CLICKHOUSE_HOST || process.env.CLICKHOUSE_URL;
  const username = process.env.CLICKHOUSE_USER || "default";
  const password = process.env.CLICKHOUSE_PASSWORD || "";
  const database = process.env.CLICKHOUSE_DATABASE || "default";
  if (!url) {
    if (client) {
      void client.close().catch(() => undefined);
      client = null;
      clientKey = "";
    }
    return null;
  }
  const key = `${url}|${username}|${password}|${database}`;
  if (client && clientKey !== key) {
    void client.close().catch(() => undefined);
    client = null;
    clientKey = "";
  }
  if (!client) {
    client = createClient({
      url,
      username,
      password,
      database,
      // Prevent hung CH sockets from stalling local plan builds forever.
      request_timeout: 8_000,
    });
    clientKey = key;
  }
  return client;
}

export function clickhouseConfigured(): boolean {
  ensureRuntimeConfigLoaded();
  return Boolean(process.env.CLICKHOUSE_HOST || process.env.CLICKHOUSE_URL);
}

export async function pingClickHouse(): Promise<{ ok: boolean; error?: string }> {
  const ch = getClient();
  if (!ch) return { ok: false, error: "ClickHouse URL not configured" };
  try {
    await ch.query({ query: "SELECT 1", format: "JSONEachRow" });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "ClickHouse ping failed",
    };
  }
}

/** In-memory stand-in when ClickHouse env is missing (local UI work). */
const memorySessions = new Map<string, WizardState>();
const memoryRoutes = new Map<string, RouteCandidate[]>();
const seedRides: Array<{
  label: string;
  distanceM: number;
  elevGainM: number;
  durationS: number;
}> = [
  { label: "Amstel dawn 40k", distanceM: 40200, elevGainM: 48, durationS: 5400 },
  { label: "Bosbaan tempo", distanceM: 35500, elevGainM: 62, durationS: 4500 },
  { label: "Waterland Sunday", distanceM: 62000, elevGainM: 180, durationS: 9000 },
  { label: "Vondel easy spin", distanceM: 22000, elevGainM: 28, durationS: 3600 },
  { label: "North sea wind", distanceM: 51000, elevGainM: 95, durationS: 7200 },
  { label: "Ouderkerk loop", distanceM: 44500, elevGainM: 70, durationS: 6000 },
  { label: "IJ tunnel out-n-back", distanceM: 28000, elevGainM: 35, durationS: 3900 },
  { label: "Hilversum rollers", distanceM: 70000, elevGainM: 420, durationS: 10800 },
];

export async function upsertSession(wizard: WizardState, goalsText: string): Promise<void> {
  memorySessions.set(wizard.sessionId, { ...wizard, goalsText });
  const ch = getClient();
  if (!ch) return;
  try {
    await ch.insert({
      table: "plan_sessions",
      values: [
        {
          session_id: wizard.sessionId,
          goals_text: goalsText,
          wizard_json: JSON.stringify(wizard),
          status: wizard.confirmed ? "confirmed" : "draft",
        },
      ],
      format: "JSONEachRow",
    });
  } catch (err) {
    console.warn("ClickHouse upsertSession failed; using memory", err);
  }
}

export async function persistRoutes(
  sessionId: string,
  routes: RouteCandidate[],
): Promise<void> {
  memoryRoutes.set(sessionId, routes);
  const ch = getClient();
  if (!ch) return;

  try {
    await ch.insert({
      table: "routes",
      values: routes.map((r) => ({
        route_id: r.routeId,
        session_id: sessionId,
        label: r.label,
        profile: r.profile,
        distance_m: r.distanceM,
        duration_s: r.durationS,
        elev_gain_m: r.elevGainM,
        elev_loss_m: r.elevLossM,
        geometry_geojson: JSON.stringify(r.geometry),
        elev_km: r.elevProfile.map((p) => p.km),
        elev_m: r.elevProfile.map((p) => p.elevM),
        ors_extras_json: "{}",
        weather_json: JSON.stringify(r.weather ?? {}),
        tips: r.tips,
        training_json: JSON.stringify(r.training),
        is_seed: 0,
      })),
      format: "JSONEachRow",
    });

    await ch.insert({
      table: "route_scores",
      values: routes.map((r) => ({
        route_id: r.routeId,
        session_id: sessionId,
        goal_fit: r.score.goalFit,
        safety_proxy: r.score.safetyProxy,
        scenic_proxy: r.score.scenicProxy,
        weather_fit: r.score.weatherFit,
        total: r.score.total,
      })),
      format: "JSONEachRow",
    });
  } catch (err) {
    console.warn("ClickHouse persistRoutes failed; using memory", err);
  }
}

export async function scoreRoutesSql(
  sessionId: string,
): Promise<Array<{ route_id: string; total: number; goal_fit: number }>> {
  const ch = getClient();
  if (!ch) {
    const routes = memoryRoutes.get(sessionId) ?? [];
    return routes
      .map((r) => ({
        route_id: r.routeId,
        total: r.score.total,
        goal_fit: r.score.goalFit,
      }))
      .sort((a, b) => b.total - a.total);
  }

  try {
    const result = await ch.query({
      query: `
        SELECT route_id, total_sql AS total, goal_fit
        FROM route_scores_ranked
        WHERE session_id = {sessionId:String}
        ORDER BY total_sql DESC
      `,
      query_params: { sessionId },
      format: "JSONEachRow",
    });
    return (await result.json()) as Array<{
      route_id: string;
      total: number;
      goal_fit: number;
    }>;
  } catch (err) {
    console.warn("ClickHouse scoreRoutesSql failed; using memory", err);
    const routes = memoryRoutes.get(sessionId) ?? [];
    return routes
      .map((r) => ({
        route_id: r.routeId,
        total: r.score.total,
        goal_fit: r.score.goalFit,
      }))
      .sort((a, b) => b.total - a.total);
  }
}

export async function findSimilarRides(input: {
  distanceM: number;
  elevGainM: number;
  durationS: number;
}): Promise<string[]> {
  const ch = getClient();
  if (!ch) {
    return seedRides
      .map((r) => ({
        ...r,
        score:
          Math.abs(r.distanceM - input.distanceM) / 1000 +
          Math.abs(r.elevGainM - input.elevGainM) / 10 +
          Math.abs(r.durationS - input.durationS) / 600,
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((r) => r.label);
  }

  try {
    const result = await ch.query({
      query: `
        SELECT label,
          abs(distance_m - {distanceM:Float64}) / 1000
          + abs(elev_gain_m - {elevGainM:Float64}) / 10
          + abs(duration_s - {durationS:Float64}) / 600 AS dist
        FROM routes
        WHERE is_seed = 1
        ORDER BY dist ASC
        LIMIT 3
      `,
      query_params: {
        distanceM: input.distanceM,
        elevGainM: input.elevGainM,
        durationS: input.durationS,
      },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<{ label: string }>;
    return rows.map((r) => r.label);
  } catch (err) {
    console.warn("ClickHouse findSimilarRides failed; using seed constants", err);
    return seedRides
      .map((r) => ({
        ...r,
        score:
          Math.abs(r.distanceM - input.distanceM) / 1000 +
          Math.abs(r.elevGainM - input.elevGainM) / 10 +
          Math.abs(r.durationS - input.durationS) / 600,
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((r) => r.label);
  }
}

export async function getMemoryPlan(sessionId: string): Promise<PlanPayload | null> {
  const wizard = memorySessions.get(sessionId);
  const routes = memoryRoutes.get(sessionId);
  if (!wizard || !routes?.length) return null;
  const climbs = routes.map((r) => r.elevGainM);
  const distances = routes.map((r) => r.distanceM / 1000);
  return attachCoachNote({
    sessionId,
    wizard,
    routes,
    selectedRouteId: routes[0].routeId,
    comparison: {
      minClimbM: Math.min(...climbs),
      maxClimbM: Math.max(...climbs),
      minDistanceKm: Math.min(...distances),
      maxDistanceKm: Math.max(...distances),
    },
  });
}

const memoryWeather = new Map<string, WeatherGridRow>();
const memoryAthleteRides = new Map<string, RiderHistoryRide[]>();

function formatChDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "");
}

export async function upsertRiderHistoryRides(
  rides: RiderHistoryRide[],
  opts?: { merge?: boolean },
): Promise<void> {
  if (!rides.length) return;
  const merge = opts?.merge ?? false;
  const byAthlete = new Map<string, RiderHistoryRide[]>();
  for (const ride of rides) {
    const list = byAthlete.get(ride.athleteId) ?? [];
    list.push(ride);
    byAthlete.set(ride.athleteId, list);
  }
  for (const [athleteId, list] of byAthlete) {
    if (merge) {
      const prev = memoryAthleteRides.get(athleteId) ?? [];
      const byId = new Map(prev.map((r) => [r.rideId, r]));
      for (const ride of list) byId.set(ride.rideId, ride);
      memoryAthleteRides.set(athleteId, [...byId.values()]);
    } else {
      memoryAthleteRides.set(athleteId, list);
    }
  }

  const ch = getClient();
  if (!ch) return;

  try {
    await ch.insert({
      table: "rider_history_rides",
      values: rides.map((r) => ({
        athlete_id: r.athleteId,
        ride_id: r.rideId,
        started_at: formatChDateTime(r.startedAt),
        label: r.label,
        distance_m: r.distanceM,
        duration_s: r.durationS,
        elev_gain_m: r.elevGainM,
        tss_est: r.tssEst,
        intensity: r.intensity,
        source: r.source,
      })),
      format: "JSONEachRow",
    });
  } catch (err) {
    console.warn("ClickHouse upsertRiderHistoryRides failed", err);
  }
}

export async function ensureDemoAthleteSeeded(): Promise<HistoryContext> {
  const rides = buildDemoAthleteRides();
  await upsertRiderHistoryRides(rides);
  return summarizeDemoAthlete();
}

export async function queryRiderHistory(
  athleteId: string,
): Promise<RiderHistoryRide[]> {
  const ch = getClient();
  if (!ch) {
    return memoryAthleteRides.get(athleteId) ?? [];
  }

  try {
    const result = await ch.query({
      query: `
        SELECT
          athlete_id AS athleteId,
          ride_id AS rideId,
          toString(started_at) AS startedAt,
          label,
          distance_m AS distanceM,
          duration_s AS durationS,
          elev_gain_m AS elevGainM,
          tss_est AS tssEst,
          intensity,
          source
        FROM rider_history_rides
        WHERE athlete_id = {athleteId:String}
        ORDER BY started_at DESC
      `,
      query_params: { athleteId },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<{
      athleteId: string;
      rideId: string;
      startedAt: string;
      label: string;
      distanceM: number;
      durationS: number;
      elevGainM: number;
      tssEst: number;
      intensity: Intensity;
      source: "fixture" | "upload";
    }>;
    return rows.map((r) => ({
      ...r,
      startedAt: new Date(r.startedAt.includes("T") ? r.startedAt : `${r.startedAt}Z`),
    }));
  } catch (err) {
    console.warn("ClickHouse queryRiderHistory failed", err);
    return memoryAthleteRides.get(athleteId) ?? [];
  }
}

export async function getHistoryContext(
  athleteId: string,
  athleteLabel?: string,
): Promise<HistoryContext | null> {
  if (athleteId === DEMO_ATHLETE_ID) {
    const rides = await queryRiderHistory(athleteId);
    if (rides.length > 0) {
      return summarizeAthleteHistory(rides, {
        athleteId: DEMO_ATHLETE_ID,
        athleteLabel: "Demo AMS rider",
        source: "fixture",
      });
    }
    return summarizeDemoAthlete();
  }

  const rides = await queryRiderHistory(athleteId);
  if (!rides.length) return null;
  const label =
    athleteLabel ??
    (athleteId.startsWith("upload-") ? "Your GPX uploads" : athleteId);
  return summarizeAthleteHistory(rides, {
    athleteId,
    athleteLabel: label,
    source: rides[0]?.source ?? "upload",
  });
}

export type StackRunRow = {
  id: string;
  taskIdentifier: string;
  status: string;
  createdAt: string;
  url: string;
};

export type StackStats = {
  clickhouseConfigured: boolean;
  triggerConfigured: boolean;
  projectRef: string | null;
  dashboardUrl: string | null;
  counts: {
    planSessions: number | null;
    routesLive: number | null;
    routesSeed: number | null;
    routeScores: number | null;
    weatherTiles: number | null;
    riderHistoryRides: number | null;
    trainingBlocks: number | null;
  };
  samples: {
    recentSessions: Array<{ sessionId: string; status: string; goals: string }>;
    /** Last N generated plan sessions → shareable summary URLs. */
    summaryUrls: Array<{
      sessionId: string;
      createdAt: string;
      goals: string;
      status: string;
    }>;
    topScores: Array<{ routeId: string; label: string; total: number }>;
    weatherSample: Array<{
      tileId: string;
      summary: string;
      tempC: number;
      windKmh: number;
    }>;
    athleteLoads: Array<{
      athleteId: string;
      rides: number;
      km: number;
    }>;
    trainingBlocks: Array<{
      blockId: string;
      label: string;
      totalTss: number;
      athleteId: string;
    }>;
  };
  tasks: Array<{ id: string; role: string; cron?: string }>;
  recentRuns: StackRunRow[];
  queryErrors: string[];
  error?: string;
};

const memoryTrainingBlocks: Array<{
  blockId: string;
  sessionId: string;
  athleteId: string;
  label: string;
  notes: string;
  totalTargetTss: number;
  daysJson: string;
}> = [];

export async function upsertTrainingBlock(block: {
  blockId: string;
  sessionId: string;
  athleteId: string;
  label: string;
  notes: string;
  totalTargetTss: number;
  daysJson: string;
}): Promise<void> {
  memoryTrainingBlocks.unshift(block);
  if (memoryTrainingBlocks.length > 40) memoryTrainingBlocks.pop();

  const ch = getClient();
  if (!ch) return;
  try {
    await ch.insert({
      table: "training_blocks",
      values: [
        {
          block_id: block.blockId,
          session_id: block.sessionId,
          athlete_id: block.athleteId,
          label: block.label,
          notes: block.notes,
          total_target_tss: block.totalTargetTss,
          days_json: block.daysJson,
        },
      ],
      format: "JSONEachRow",
    });
  } catch (err) {
    console.warn("ClickHouse upsertTrainingBlock failed", err);
  }
}

export async function queryStackStats(): Promise<StackStats> {
  const projectRef = process.env.TRIGGER_PROJECT_REF ?? null;
  const dashboardUrl = projectRef
    ? `https://cloud.trigger.dev/projects/v3/${projectRef}`
    : null;

  const tasks = [
    { id: "cycleforge-agent", role: "Chat agent orchestration + tool calls" },
    { id: "generate-route-candidates", role: "Fan-out ORS / fallback geometry" },
    { id: "fetch-ors-route", role: "Single ORS directions fetch" },
    { id: "fetch-ors-route-batch", role: "Batched ORS fan-out" },
    { id: "score-and-enrich-routes", role: "ClickHouse scoring + weather + tips" },
    { id: "ingest-weather-grid", role: "Open-Meteo → weather_forecast_grid" },
    {
      id: "ingest-weather-grid-schedule",
      role: "Scheduled weather grid refresh",
      cron: "0 */6 * * *",
    },
    {
      id: "stack-heartbeat-schedule",
      role: "Hourly stack demo heartbeat (cron)",
      cron: "15 * * * *",
    },
  ];

  const empty: StackStats = {
    clickhouseConfigured: clickhouseConfigured(),
    triggerConfigured: Boolean(process.env.TRIGGER_SECRET_KEY),
    projectRef,
    dashboardUrl,
    counts: {
      planSessions: null,
      routesLive: null,
      routesSeed: null,
      routeScores: null,
      weatherTiles: null,
      riderHistoryRides: null,
      trainingBlocks: null,
    },
    samples: {
      recentSessions: [],
      summaryUrls: [],
      topScores: [],
      weatherSample: [],
      athleteLoads: [],
      trainingBlocks: [],
    },
    tasks,
    recentRuns: [],
    queryErrors: [],
  };

  // Trigger run history (best-effort).
  if (empty.triggerConfigured) {
    try {
      const page = await runs.list({ limit: 12 });
      const list = Array.isArray(page)
        ? page
        : ((page as { data?: unknown[] }).data ?? []);
      empty.recentRuns = list.slice(0, 12).map((raw) => {
        const r = raw as {
          id?: string;
          taskIdentifier?: string;
          status?: string;
          createdAt?: string | Date;
        };
        const id = r.id ?? "unknown";
        return {
          id,
          taskIdentifier: r.taskIdentifier ?? "task",
          status: String(r.status ?? "unknown"),
          createdAt:
            typeof r.createdAt === "string"
              ? r.createdAt
              : r.createdAt instanceof Date
                ? r.createdAt.toISOString()
                : "",
          url: dashboardUrl
            ? `${dashboardUrl}/runs/${id}`
            : `https://cloud.trigger.dev/runs/${id}`,
        };
      });
    } catch (err) {
      empty.queryErrors.push(
        `Trigger runs: ${err instanceof Error ? err.message : "list failed"}`,
      );
    }
  }

  const ch = getClient();
  if (!ch) {
    empty.counts.planSessions = memorySessions.size;
    empty.counts.routesLive = [...memoryRoutes.values()].reduce(
      (n, r) => n + r.length,
      0,
    );
    empty.counts.routesSeed = seedRides.length;
    empty.counts.routeScores = empty.counts.routesLive;
    empty.counts.weatherTiles = memoryWeather.size;
    empty.counts.riderHistoryRides = [...memoryAthleteRides.values()].reduce(
      (n, r) => n + r.length,
      0,
    );
    empty.counts.trainingBlocks = memoryTrainingBlocks.length;
    empty.samples.recentSessions = [...memorySessions.values()]
      .slice(-5)
      .reverse()
      .map((w) => ({
        sessionId: w.sessionId.slice(0, 8),
        status: w.confirmed ? "confirmed" : "draft",
        goals: w.goalsText.slice(0, 80) || "(wizard only)",
      }));
    empty.samples.summaryUrls = [...memorySessions.values()]
      .slice(-20)
      .reverse()
      .map((w) => ({
        sessionId: w.sessionId,
        createdAt: "",
        goals: w.goalsText.slice(0, 60) || "(wizard only)",
        status: w.confirmed ? "confirmed" : "draft",
      }));
    empty.samples.athleteLoads = [...memoryAthleteRides.entries()].map(
      ([athleteId, rides]) => ({
        athleteId,
        rides: rides.length,
        km:
          Math.round(
            (rides.reduce((s, r) => s + r.distanceM, 0) / 1000) * 10,
          ) / 10,
      }),
    );
    empty.samples.weatherSample = [...memoryWeather.values()]
      .slice(0, 4)
      .map((w) => ({
        tileId: w.tileId,
        summary: w.summary,
        tempC: w.tempC,
        windKmh: w.windKmh,
      }));
    empty.samples.trainingBlocks = memoryTrainingBlocks.slice(0, 5).map((b) => ({
      blockId: b.blockId.slice(0, 8),
      label: b.label,
      totalTss: b.totalTargetTss,
      athleteId: b.athleteId,
    }));
    empty.queryErrors.push(
      "ClickHouse env missing in this process — showing in-memory fallback.",
    );
    return empty;
  }

  const soft = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      empty.queryErrors.push(
        `${label}: ${err instanceof Error ? err.message : "failed"}`,
      );
      return fallback;
    }
  };

  const countQ = (query: string) =>
    soft(query.slice(0, 40), async () => {
      const result = await ch.query({ query, format: "JSONEachRow" });
      const rows = (await result.json()) as Array<{ n: string | number }>;
      return Number(rows[0]?.n ?? 0);
    }, null);

  empty.counts.planSessions = await countQ(
    "SELECT count() AS n FROM plan_sessions",
  );
  empty.counts.routesLive = await countQ(
    "SELECT count() AS n FROM routes WHERE is_seed = 0",
  );
  empty.counts.routesSeed = await countQ(
    "SELECT count() AS n FROM routes WHERE is_seed = 1",
  );
  empty.counts.routeScores = await countQ(
    "SELECT count() AS n FROM route_scores",
  );
  empty.counts.weatherTiles = await countQ(
    "SELECT count() AS n FROM weather_forecast_grid",
  );
  empty.counts.riderHistoryRides = await countQ(
    "SELECT count() AS n FROM rider_history_rides FINAL",
  );
  empty.counts.trainingBlocks = await countQ(
    "SELECT count() AS n FROM training_blocks FINAL",
  );

  empty.samples.recentSessions = await soft(
    "recentSessions",
    async () => {
      const sessions = await ch.query({
        query: `
          SELECT
            substring(session_id, 1, 8) AS sessionId,
            status,
            substring(goals_text, 1, 80) AS goals
          FROM plan_sessions
          ORDER BY created_at DESC
          LIMIT 8
        `,
        format: "JSONEachRow",
      });
      return (await sessions.json()) as StackStats["samples"]["recentSessions"];
    },
    [],
  );

  empty.samples.summaryUrls = await soft(
    "summaryUrls",
    async () => {
      const rows = await ch.query({
        query: `
          SELECT
            session_id AS sessionId,
            formatDateTime(created_at, '%Y-%m-%d %H:%i') AS createdAt,
            substring(goals_text, 1, 60) AS goals,
            status
          FROM plan_sessions
          ORDER BY created_at DESC
          LIMIT 20
        `,
        format: "JSONEachRow",
      });
      return (await rows.json()) as StackStats["samples"]["summaryUrls"];
    },
    [],
  );

  empty.samples.topScores = await soft(
    "topScores",
    async () => {
      const scores = await ch.query({
        query: `
          SELECT
            route_id AS routeId,
            label,
            total
          FROM (
            SELECT
              rs.route_id,
              any(r.label) AS label,
              max(rs.total) AS total
            FROM route_scores AS rs
            LEFT JOIN routes AS r ON r.route_id = rs.route_id
            GROUP BY rs.route_id
          )
          ORDER BY total DESC
          LIMIT 5
        `,
        format: "JSONEachRow",
      });
      return (
        (await scores.json()) as Array<{
          routeId: string;
          label: string;
          total: number;
        }>
      ).map((r) => ({
        ...r,
        total: Math.round(Number(r.total) * 100) / 100,
      }));
    },
    [],
  );

  empty.samples.weatherSample = await soft(
    "weatherSample",
    async () => {
      const weather = await ch.query({
        query: `
          SELECT
            tile_id AS tileId,
            summary,
            temp_c AS tempC,
            wind_kmh AS windKmh
          FROM weather_forecast_grid
          ORDER BY ingested_at DESC
          LIMIT 6
        `,
        format: "JSONEachRow",
      });
      return (await weather.json()) as StackStats["samples"]["weatherSample"];
    },
    [],
  );

  empty.samples.athleteLoads = await soft(
    "athleteLoads",
    async () => {
      const athletes = await ch.query({
        query: `
          SELECT
            athlete_id AS athleteId,
            count() AS rides,
            round(sum(distance_m) / 1000, 1) AS km
          FROM rider_history_rides FINAL
          GROUP BY athlete_id
          ORDER BY rides DESC
          LIMIT 6
        `,
        format: "JSONEachRow",
      });
      return (
        (await athletes.json()) as Array<{
          athleteId: string;
          rides: string | number;
          km: string | number;
        }>
      ).map((r) => ({
        athleteId: r.athleteId,
        rides: Number(r.rides),
        km: Number(r.km),
      }));
    },
    [],
  );

  empty.samples.trainingBlocks = await soft(
    "trainingBlocks",
    async () => {
      const blocks = await ch.query({
        query: `
          SELECT
            substring(block_id, 1, 8) AS blockId,
            label,
            total_target_tss AS totalTss,
            athlete_id AS athleteId
          FROM training_blocks FINAL
          ORDER BY created_at DESC
          LIMIT 5
        `,
        format: "JSONEachRow",
      });
      return (
        (await blocks.json()) as Array<{
          blockId: string;
          label: string;
          totalTss: number;
          athleteId: string;
        }>
      ).map((b) => ({
        ...b,
        totalTss: Number(b.totalTss),
      }));
    },
    memoryTrainingBlocks.slice(0, 5).map((b) => ({
      blockId: b.blockId.slice(0, 8),
      label: b.label,
      totalTss: b.totalTargetTss,
      athleteId: b.athleteId,
    })),
  );

  if (
    empty.counts.planSessions === null &&
    empty.counts.routesSeed === null &&
    empty.queryErrors.length > 0
  ) {
    empty.error = empty.queryErrors[0];
  }

  return empty;
}

export async function upsertWeatherGridRows(
  rows: WeatherGridRow[],
): Promise<void> {
  if (!rows.length) return;
  for (const row of rows) {
    memoryWeather.set(row.tileId, row);
  }

  const ch = getClient();
  if (!ch) return;

  try {
    await ch.insert({
      table: "weather_forecast_grid",
      values: rows.map((r) => ({
        tile_id: r.tileId,
        tile_lat: r.tileLat,
        tile_lng: r.tileLng,
        observed_at: r.observedAt.replace("T", " ").replace("Z", ""),
        temp_c: r.tempC,
        wind_kmh: r.windKmh,
        wind_dir_deg: r.windDirDeg,
        precip_mm: r.precipMm,
        weather_code: r.weatherCode,
        summary: r.summary,
        source: "open-meteo",
      })),
      format: "JSONEachRow",
    });
  } catch (err) {
    console.warn("ClickHouse upsertWeatherGridRows failed", err);
  }
}

/** Nearest tile within ~0.15° (~15 km); prefers freshest observed_at. */
export async function queryNearestWeather(
  lat: number,
  lng: number,
): Promise<WeatherGridRow | null> {
  const ch = getClient();
  if (!ch) {
    let best: WeatherGridRow | null = null;
    let bestDist = Infinity;
    for (const row of memoryWeather.values()) {
      const dist = Math.abs(row.tileLat - lat) + Math.abs(row.tileLng - lng);
      if (dist < bestDist) {
        bestDist = dist;
        best = row;
      }
    }
    return bestDist <= 0.15 ? best : null;
  }

  try {
    const result = await ch.query({
      query: `
        SELECT
          tile_id AS tileId,
          tile_lat AS tileLat,
          tile_lng AS tileLng,
          toString(observed_at) AS observedAt,
          temp_c AS tempC,
          wind_kmh AS windKmh,
          wind_dir_deg AS windDirDeg,
          precip_mm AS precipMm,
          weather_code AS weatherCode,
          summary
        FROM weather_forecast_grid
        WHERE abs(tile_lat - {lat:Float64}) <= 0.15
          AND abs(tile_lng - {lng:Float64}) <= 0.15
        ORDER BY
          (abs(tile_lat - {lat:Float64}) + abs(tile_lng - {lng:Float64})) ASC,
          observed_at DESC
        LIMIT 1
      `,
      query_params: { lat, lng },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as WeatherGridRow[];
    return rows[0] ?? null;
  } catch (err) {
    console.warn("ClickHouse queryNearestWeather failed", err);
    return null;
  }
}
