import { describe, expect, it } from "vitest";
import { buildEffortSegments, estimateTraining } from "./training";
import type { ElevPoint } from "./types";

describe("estimateTraining", () => {
  it("marks easy rides as recovery with lower TSS", () => {
    const easy = estimateTraining({
      distanceM: 20_000,
      durationS: 3600,
      elevGainM: 20,
      intensity: "easy",
      terrainBias: "flat",
    });
    expect(easy.stimulus).toBe("recovery");
    expect(easy.tssEst).toBeLessThan(70);
    expect(easy.zoneMix.z1 + easy.zoneMix.z2).toBeGreaterThan(70);
  });

  it("marks tempo rides with higher IF and tempo stimulus", () => {
    const tempo = estimateTraining({
      distanceM: 40_000,
      durationS: 5400,
      elevGainM: 80,
      intensity: "tempo",
      terrainBias: "rolling",
    });
    expect(tempo.stimulus).toBe("tempo");
    expect(tempo.ifEst).toBeGreaterThan(0.7);
    expect(tempo.tssEst).toBeGreaterThan(80);
  });

  it("uses climb stimulus for hilly intensity", () => {
    const hills = estimateTraining({
      distanceM: 50_000,
      durationS: 7200,
      elevGainM: 220,
      intensity: "hills",
      terrainBias: "hilly",
    });
    expect(hills.stimulus).toBe("climb");
    expect(hills.recoveryHint.toLowerCase()).toMatch(/hard|solid|easy/);
  });

  it("keeps zone mix summing near 100", () => {
    const result = estimateTraining({
      distanceM: 35_000,
      durationS: 5000,
      elevGainM: 60,
      intensity: "endurance",
      terrainBias: "rolling",
    });
    const sum =
      result.zoneMix.z1 +
      result.zoneMix.z2 +
      result.zoneMix.z3 +
      result.zoneMix.z4 +
      result.zoneMix.z5;
    expect(sum).toBeGreaterThanOrEqual(98);
    expect(sum).toBeLessThanOrEqual(102);
  });

  it("uses FTP to estimate normalized power", () => {
    const result = estimateTraining({
      distanceM: 40_000,
      durationS: 5400,
      elevGainM: 80,
      intensity: "endurance",
      terrainBias: "rolling",
      ftpWatts: 250,
    });
    expect(result.ftpWatts).toBe(250);
    expect(result.npEst).toBeGreaterThan(150);
    expect(result.npEst).toBeLessThan(250);
  });
});

describe("buildEffortSegments", () => {
  it("covers the full profile length (no early truncation)", () => {
    const profile: ElevPoint[] = [];
    for (let i = 0; i <= 80; i++) {
      // Alternating mild climbs/descents so many zone changes would exceed the old 12-cap.
      const elevM = 50 + (i % 3 === 0 ? 30 : i % 3 === 1 ? 10 : 0);
      profile.push({ km: i, elevM });
    }
    const segments = buildEffortSegments(profile);
    expect(segments.length).toBeGreaterThan(12);
    expect(segments[0].fromKm).toBe(0);
    expect(segments[segments.length - 1].toKm).toBe(80);
    // Continuous coverage — each segment meets the next.
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].fromKm).toBeCloseTo(segments[i - 1].toKm, 5);
    }
  });
});
