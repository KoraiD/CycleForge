import { describe, expect, it, vi } from "vitest";
import { buildPlan, mergeWizard } from "./plan-builder";
import { makeWizard } from "./test-fixtures";

vi.mock("./weather", () => ({
  resolveWeather: vi.fn(async () => ({
    tempC: 15,
    windKmh: 14,
    windDirDeg: 180,
    precipMm: 0,
    summary: "Mainly clear",
    source: "clickhouse" as const,
  })),
  fetchWeather: vi.fn(async () => ({
    tempC: 15,
    windKmh: 14,
    windDirDeg: 180,
    precipMm: 0,
    summary: "Mainly clear",
    source: "clickhouse" as const,
  })),
}));

vi.mock("./ors", async () => {
  const { buildFallbackRoutes } = await import("./fallback-routes");
  return {
    generateRawRoutes: vi.fn(async (wizard: ReturnType<typeof makeWizard>) =>
      buildFallbackRoutes(wizard),
    ),
  };
});

describe("plan-builder", () => {
  it("merges start presets into lat/lng", () => {
    const next = mergeWizard(makeWizard({ startPreset: "vondelpark" }), {
      startPreset: "centraal",
    });
    expect(next.startPreset).toBe("centraal");
    expect(next.startLat).toBeCloseTo(52.378, 3);
    expect(next.startLng).toBeCloseTo(4.8985, 3);
    expect(next.startLabel).toBe("Amsterdam Centraal");
  });

  it("builds a scored plan with three routes", async () => {
    const plan = await buildPlan(makeWizard());
    expect(plan.routes).toHaveLength(3);
    expect(plan.selectedRouteId).toBe(plan.routes[0].routeId);
    expect(plan.routes[0].training.tssEst).toBeGreaterThan(0);
    expect(plan.routes[0].tips.length).toBeGreaterThan(0);
    expect(plan.routes[0].score.total).toBeGreaterThan(0);
    expect(plan.coachNote.length).toBeGreaterThan(40);
    expect(plan.coachNote).toContain(plan.routes[0].label);
    expect(plan.comparison.maxDistanceKm).toBeGreaterThan(
      plan.comparison.minDistanceKm - 0.01,
    );
    // Sorted by score descending
    expect(plan.routes[0].score.total).toBeGreaterThanOrEqual(
      plan.routes[1].score.total,
    );
  });
});
