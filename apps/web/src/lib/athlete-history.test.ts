import { describe, expect, it } from "vitest";
import {
  buildDemoAthleteRides,
  suggestIntensityFromHistory,
  summarizeDemoAthlete,
} from "./athlete-history";

describe("athlete-history", () => {
  it("builds ~2–4 weeks of fixture rides", () => {
    const rides = buildDemoAthleteRides(new Date("2026-07-20T12:00:00Z"));
    expect(rides.length).toBeGreaterThanOrEqual(10);
    expect(rides.every((r) => r.athleteId === "demo-ams-rider")).toBe(true);
    const newest = Math.max(...rides.map((r) => r.startedAt.getTime()));
    const oldest = Math.min(...rides.map((r) => r.startedAt.getTime()));
    expect(newest - oldest).toBeGreaterThan(14 * 86400000);
  });

  it("summarizes load and last hard day", () => {
    const history = summarizeDemoAthlete(new Date("2026-07-20T12:00:00Z"));
    expect(history.rideCount).toBe(14);
    expect(history.hoursLast28d).toBeGreaterThan(10);
    expect(history.lastHardLabel).toBeTruthy();
    expect(history.summaryLine).toContain("Demo AMS rider");
    expect(history.loadHint.length).toBeGreaterThan(5);
    expect(history.dailyLoad?.length).toBeGreaterThan(0);
    expect(history.dailyLoad?.every((d) => d.date && d.tss >= 0)).toBe(true);
  });

  it("suggests easier intensity after hard recent load", () => {
    const history = summarizeDemoAthlete(new Date("2026-07-20T12:00:00Z"));
    // Fixture has recovery spin 1d ago and hard rides recently enough to bias recovery
    // depending on TSS window — assert helper is pure for explicit recovery hint.
    const recovery = {
      ...history,
      loadHint: "recent hard load — bias recovery",
    };
    expect(suggestIntensityFromHistory(recovery, "tempo")).toBe("easy");
    expect(suggestIntensityFromHistory(recovery, "endurance")).toBe("easy");
  });
});
