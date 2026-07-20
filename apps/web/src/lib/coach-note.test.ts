import { describe, expect, it } from "vitest";
import { summarizeDemoAthlete } from "./athlete-history";
import { attachCoachNote, buildCoachNote } from "./coach-note";
import { makeWizard } from "./test-fixtures";
import type { RouteCandidate } from "./types";

function makeRoute(overrides: Partial<RouteCandidate> = {}): RouteCandidate {
  return {
    routeId: "r1",
    sessionId: "s1",
    label: "Park & parkway",
    profile: "endurance",
    distanceM: 35000,
    durationS: 5400,
    elevGainM: 180,
    elevLossM: 180,
    geometry: {
      type: "LineString",
      coordinates: [
        [4.86, 52.35],
        [4.9, 52.38],
      ],
    },
    elevProfile: [
      { km: 0, elevM: 0 },
      { km: 35, elevM: 5 },
    ],
    weather: {
      tempC: 18,
      windKmh: 28,
      windDirDeg: 220,
      precipMm: 0,
      summary: "Breezy",
      source: "clickhouse",
    },
    tips: ["Tip"],
    training: {
      tssEst: 120,
      ifEst: 0.75,
      stimulus: "endurance",
      zoneMix: { z1: 0.2, z2: 0.55, z3: 0.2, z4: 0.05, z5: 0 },
      recoveryHint: "Easy spin tomorrow.",
    },
    score: {
      goalFit: 0.9,
      safetyProxy: 0.8,
      scenicProxy: 0.7,
      weatherFit: 0.6,
      total: 0.84,
    },
    similarRideLabels: ["Waterland Sunday"],
    source: "ors",
    ...overrides,
  };
}

describe("coach-note", () => {
  it("builds a short multi-paragraph note from route + weather", () => {
    const note = buildCoachNote({
      wizard: makeWizard({ intensity: "endurance", avoidBusyRoads: true }),
      route: makeRoute(),
    });
    expect(note).toContain("Park & parkway");
    expect(note).toContain("Wind");
    expect(note).toContain("Waterland Sunday");
    expect(note.split("\n\n").length).toBeGreaterThanOrEqual(2);
    expect(note.length).toBeLessThan(900);
  });

  it("includes athlete history aggregates when provided", () => {
    const history = summarizeDemoAthlete(new Date("2026-07-20T12:00:00Z"));
    const note = buildCoachNote({
      wizard: makeWizard({ intensity: "endurance" }),
      route: makeRoute(),
      history,
    });
    expect(note).toContain("History:");
    expect(note).toMatch(/TSS \d+/);
  });

  it("attaches coachNote for the selected route", () => {
    const wizard = makeWizard();
    const a = makeRoute({ routeId: "a", label: "A" });
    const b = makeRoute({
      routeId: "b",
      label: "B",
      weather: { ...makeRoute().weather!, windKmh: 5 },
    });
    const plan = attachCoachNote({
      wizard,
      routes: [a, b],
      selectedRouteId: "b",
    });
    expect(plan.coachNote).toContain("B");
    expect(plan.coachNote).not.toMatch(/Wind ~28/);
  });
});
