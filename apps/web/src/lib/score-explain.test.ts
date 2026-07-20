import { describe, expect, it } from "vitest";
import { explainRouteScore } from "./score-explain";
import { makeWizard } from "./test-fixtures";
import type { RouteCandidate } from "./types";

function makeRoute(overrides: Partial<RouteCandidate> = {}): RouteCandidate {
  return {
    routeId: "r1",
    sessionId: "sess-explain",
    label: "Test loop",
    profile: "cycling-regular",
    distanceM: 36_000,
    durationS: 5400,
    elevGainM: 80,
    elevLossM: 80,
    geometry: {
      type: "LineString",
      coordinates: [
        [4.87, 52.36],
        [4.88, 52.37],
        [4.89, 52.36],
      ],
    },
    elevProfile: [],
    weather: {
      tempC: 16,
      windKmh: 14,
      windDirDeg: 220,
      precipMm: 0,
      summary: "Clear",
      source: "clickhouse",
    },
    tips: [],
    training: {
      tssEst: 55,
      ifEst: 0.75,
      stimulus: "endurance",
      zoneMix: { z1: 0.1, z2: 0.5, z3: 0.2, z4: 0.1, z5: 0 },
      recoveryHint: "Easy spin tomorrow.",
    },
    score: {
      goalFit: 0.9,
      safetyProxy: 0.8,
      scenicProxy: 0.7,
      weatherFit: 0.85,
      total: 0.84,
    },
    similarRideLabels: ["Amstel dawn 40k"],
    source: "fallback",
    ...overrides,
  };
}

describe("explainRouteScore", () => {
  it("returns weighted breakdown and SQL hint for ranking view", () => {
    const route = makeRoute();
    const explain = explainRouteScore(route, makeWizard());
    expect(explain.weights).toHaveLength(4);
    expect(explain.weights.map((w) => w.key)).toEqual([
      "goal_fit",
      "safety_proxy",
      "scenic_proxy",
      "weather_fit",
    ]);
    expect(explain.total).toBe(84);
    expect(explain.sqlHint).toContain("route_scores_ranked");
    expect(explain.sqlHint).toContain("sess-explain");
    expect(explain.narrative.some((n) => n.includes("ClickHouse"))).toBe(true);
  });
});
