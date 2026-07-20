import { describe, expect, it } from "vitest";
import { buildFallbackRoutes } from "./fallback-routes";
import { makeWizard } from "./test-fixtures";

describe("buildFallbackRoutes", () => {
  it("returns three distinct loop candidates", () => {
    const routes = buildFallbackRoutes(makeWizard());
    expect(routes).toHaveLength(3);
    expect(new Set(routes.map((r) => r.label)).size).toBe(3);
    for (const route of routes) {
      expect(route.source).toBe("fallback");
      expect(route.geometry.coordinates.length).toBeGreaterThan(10);
      expect(route.distanceM).toBeGreaterThan(10_000);
      expect(route.elevProfile.length).toBeGreaterThan(3);
    }
  });

  it("increases climb amplitude for hilly bias", () => {
    const flat = buildFallbackRoutes(
      makeWizard({ terrainBias: "flat", intensity: "easy" }),
    );
    const hilly = buildFallbackRoutes(
      makeWizard({ terrainBias: "hilly", intensity: "hills" }),
    );
    const maxFlat = Math.max(...flat.map((r) => r.elevGainM));
    const maxHilly = Math.max(...hilly.map((r) => r.elevGainM));
    expect(maxHilly).toBeGreaterThan(maxFlat);
  });
});
