import { describe, expect, it } from "vitest";
import { comparisonFromRoutes, buildTips } from "./tips";
import { makeWizard } from "./test-fixtures";
import type { RouteCandidate } from "./types";

function stubRoute(overrides: Partial<RouteCandidate>): RouteCandidate {
  return {
    routeId: "r1",
    sessionId: "s1",
    label: "Test",
    profile: "endurance-flat",
    distanceM: 40_000,
    durationS: 5400,
    elevGainM: 50,
    elevLossM: 50,
    geometry: { type: "LineString", coordinates: [] },
    elevProfile: [],
    weather: null,
    tips: [],
    training: {
      tssEst: 80,
      ifEst: 0.7,
      stimulus: "endurance",
      zoneMix: { z1: 20, z2: 50, z3: 20, z4: 10, z5: 0 },
      recoveryHint: "ok",
    },
    score: {
      goalFit: 0.8,
      safetyProxy: 0.8,
      scenicProxy: 0.6,
      weatherFit: 0.8,
      total: 0.78,
    },
    similarRideLabels: [],
    source: "fallback",
    ...overrides,
  };
}

describe("tips", () => {
  it("mentions quieter roads when requested", () => {
    const tips = buildTips({
      wizard: makeWizard({ avoidBusyRoads: true }),
      distanceM: 30_000,
      elevGainM: 30,
      weather: null,
      profile: "endurance-flat",
    });
    expect(tips.some((t) => t.toLowerCase().includes("quieter"))).toBe(true);
  });

  it("adds wind tip for strong breeze", () => {
    const tips = buildTips({
      wizard: makeWizard(),
      distanceM: 40_000,
      elevGainM: 40,
      weather: {
        tempC: 14,
        windKmh: 30,
        windDirDeg: 250,
        precipMm: 0,
        summary: "Windy",
      },
      profile: "rolling-endurance",
    });
    expect(tips.some((t) => t.toLowerCase().includes("wind"))).toBe(true);
  });

  it("caps tip count at 5", () => {
    const tips = buildTips({
      wizard: makeWizard({
        avoidBusyRoads: true,
        intensity: "tempo",
        terrainBias: "hilly",
      }),
      distanceM: 55_000,
      elevGainM: 150,
      weather: {
        tempC: 6,
        windKmh: 28,
        windDirDeg: 10,
        precipMm: 1,
        summary: "Cold rain",
      },
      profile: "hilly-loop",
    });
    expect(tips.length).toBeLessThanOrEqual(5);
  });

  it("builds comparison bounds across candidates", () => {
    const comparison = comparisonFromRoutes([
      stubRoute({ distanceM: 30_000, elevGainM: 40 }),
      stubRoute({ distanceM: 50_000, elevGainM: 120 }),
    ]);
    expect(comparison.minDistanceKm).toBe(30);
    expect(comparison.maxDistanceKm).toBe(50);
    expect(comparison.minClimbM).toBe(40);
    expect(comparison.maxClimbM).toBe(120);
  });
});
