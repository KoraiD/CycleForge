import { createClient, type ClickHouseClient } from "@clickhouse/client";
import type {
  PlanPayload,
  RouteCandidate,
  WizardState,
} from "./types";

let client: ClickHouseClient | null = null;

function getClient(): ClickHouseClient | null {
  const url = process.env.CLICKHOUSE_HOST || process.env.CLICKHOUSE_URL;
  const username = process.env.CLICKHOUSE_USER || "default";
  const password = process.env.CLICKHOUSE_PASSWORD || "";
  if (!url) return null;
  if (!client) {
    client = createClient({
      url,
      username,
      password,
      database: process.env.CLICKHOUSE_DATABASE || "default",
    });
  }
  return client;
}

export function clickhouseConfigured(): boolean {
  return Boolean(process.env.CLICKHOUSE_HOST || process.env.CLICKHOUSE_URL);
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
  return {
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
  };
}
