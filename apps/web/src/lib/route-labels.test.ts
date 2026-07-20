import { describe, expect, it } from "vitest";
import { placeAwareRouteLabels, shortPlaceName } from "./route-labels";
import { makeWizard } from "./test-fixtures";

describe("route-labels", () => {
  it("shortens start labels to a place token", () => {
    expect(shortPlaceName("Újbuda-központ (2.2 km away)")).toBe("Újbuda");
    expect(shortPlaceName("Budapest-Déli")).toBe("Budapest");
    expect(shortPlaceName("Pin 52.3600, 4.8900")).toBe("52.3600");
    expect(shortPlaceName("Pick a start on the map")).toBe("Local");
  });

  it("builds three distinct place-aware titles", () => {
    const labels = placeAwareRouteLabels(
      makeWizard({
        startPreset: "custom",
        startLabel: "Újbuda-központ",
        intensity: "tempo",
        terrainBias: "rolling",
        durationMin: 90,
      }),
    );
    expect(labels).toHaveLength(3);
    expect(new Set(labels).size).toBe(3);
    for (const label of labels) {
      expect(label).toContain("Újbuda");
      expect(label.toLowerCase()).not.toContain("waterland");
      expect(label.toLowerCase()).not.toContain("vondelpark");
    }
  });
});
