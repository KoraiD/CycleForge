import { describe, expect, it, vi } from "vitest";
import { buildPlan, mergeWizard } from "./plan-builder";
import { makeWizard } from "./test-fixtures";

vi.mock("./weather", () => ({
  fetchWeather: vi.fn(async () => ({
    tempC: 15,
    windKmh: 14,
    windDirDeg: 180,
    precipMm: 0,
    summary: "Mainly clear",
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
    expect(next.startLat).toBeCloseTo(52.3791, 3);
    expect(next.startLng).toBeCloseTo(4.9003, 3);
  });

  it("builds a scored plan with three routes", async () => {
    const plan = await buildPlan(makeWizard());
    expect(plan.routes).toHaveLength(3);
    expect(plan.selectedRouteId).toBe(plan.routes[0].routeId);
    expect(plan.routes[0].training.tssEst).toBeGreaterThan(0);
    expect(plan.routes[0].tips.length).toBeGreaterThan(0);
    expect(plan.routes[0].score.total).toBeGreaterThan(0);
    expect(plan.comparison.maxDistanceKm).toBeGreaterThan(
      plan.comparison.minDistanceKm - 0.01,
    );
    // Sorted by score descending
    expect(plan.routes[0].score.total).toBeGreaterThanOrEqual(
      plan.routes[1].score.total,
    );
  });
});
