import { describe, expect, it } from "vitest";
import { estimateTraining } from "./training";

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
