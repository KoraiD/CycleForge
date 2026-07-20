import { describe, expect, it } from "vitest";
import { buildFallbackRoutes } from "./fallback-routes";
import { makeWizard } from "./test-fixtures";

describe("buildFallbackRoutes", () => {
  it("returns three distinct loop candidates for Amsterdam presets", () => {
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

  it("anchors custom starts to the chosen coordinates (not Amsterdam golden)", () => {
    const routes = buildFallbackRoutes(
      makeWizard({
        startPreset: "custom",
        startLat: 47.4742,
        startLng: 19.0402,
        startLabel: "Újbuda-központ",
      }),
    );
    expect(routes).toHaveLength(3);
    for (const route of routes) {
      const lats = route.geometry.coordinates.map((c) => c[1] ?? 0);
      const lngs = route.geometry.coordinates.map((c) => c[0] ?? 0);
      const meanLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const meanLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
      expect(meanLat).toBeCloseTo(47.4742, 1);
      expect(meanLng).toBeCloseTo(19.0402, 1);
      // Must not be the Amsterdam golden corpus (~52.3N, 4.9E).
      expect(meanLat).toBeLessThan(50);
      expect(route.label).toMatch(/Újbuda/i);
      expect(route.label.toLowerCase()).not.toContain("waterland");
    }
  });

  it("increases climb amplitude for hilly bias", () => {
    const flat = buildFallbackRoutes(
      makeWizard({
        startPreset: "custom",
        startLat: 47.47,
        startLng: 19.04,
        startLabel: "Budapest",
        terrainBias: "flat",
        intensity: "easy",
      }),
    );
    const hilly = buildFallbackRoutes(
      makeWizard({
        startPreset: "custom",
        startLat: 47.47,
        startLng: 19.04,
        startLabel: "Budapest",
        terrainBias: "hilly",
        intensity: "hills",
      }),
    );
    const maxFlat = Math.max(...flat.map((r) => r.elevGainM));
    const maxHilly = Math.max(...hilly.map((r) => r.elevGainM));
    expect(maxHilly).toBeGreaterThan(maxFlat);
  });
});
