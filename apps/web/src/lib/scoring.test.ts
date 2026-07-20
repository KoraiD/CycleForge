import { describe, expect, it } from "vitest";
import { scoreRoute, targetDistanceM, targetElevGainM } from "./scoring";
import { makeWizard } from "./test-fixtures";

describe("scoring", () => {
  it("targets ~36 km for a 90 min endurance ride", () => {
    const wizard = makeWizard({ durationMin: 90, intensity: "endurance" });
    expect(targetDistanceM(wizard)).toBe(36_000);
  });

  it("raises climb target for hilly / hills intensity", () => {
    const flat = targetElevGainM(makeWizard({ terrainBias: "flat", intensity: "easy" }));
    const hilly = targetElevGainM(
      makeWizard({ terrainBias: "hilly", intensity: "hills" }),
    );
    expect(hilly).toBeGreaterThan(flat);
  });

  it("scores an on-target route highly", () => {
    const wizard = makeWizard();
    const score = scoreRoute({
      wizard,
      distanceM: targetDistanceM(wizard),
      elevGainM: targetElevGainM(wizard),
      weather: {
        tempC: 16,
        windKmh: 12,
        windDirDeg: 200,
        precipMm: 0,
        summary: "Clear",
      },
      busyPenalty: 0.1,
    });
    expect(score.total).toBeGreaterThan(0.75);
    expect(score.goalFit).toBeGreaterThan(0.9);
    expect(score.weatherFit).toBeGreaterThan(0.8);
  });

  it("penalizes severe wind and rain", () => {
    const wizard = makeWizard();
    const calm = scoreRoute({
      wizard,
      distanceM: 36_000,
      elevGainM: 70,
      weather: {
        tempC: 15,
        windKmh: 8,
        windDirDeg: 90,
        precipMm: 0,
        summary: "Clear",
      },
      busyPenalty: 0.1,
    });
    const storm = scoreRoute({
      wizard,
      distanceM: 36_000,
      elevGainM: 70,
      weather: {
        tempC: 12,
        windKmh: 40,
        windDirDeg: 270,
        precipMm: 2,
        summary: "Rain",
      },
      busyPenalty: 0.1,
    });
    expect(storm.weatherFit).toBeLessThan(calm.weatherFit);
    expect(storm.total).toBeLessThan(calm.total);
  });
});
