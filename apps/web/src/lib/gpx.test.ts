import { describe, expect, it } from "vitest";
import { gpxFilename, routeToGpx } from "./gpx";
import type { RouteCandidate } from "./types";

const route: RouteCandidate = {
  routeId: "r1",
  sessionId: "s1",
  label: "Park & parkway",
  profile: "endurance",
  distanceM: 1000,
  durationS: 200,
  elevGainM: 12,
  elevLossM: 12,
  geometry: {
    type: "LineString",
    coordinates: [
      [4.8686, 52.3577],
      [4.87, 52.36],
      [4.875, 52.362],
    ],
  },
  elevProfile: [
    { km: 0, elevM: 1 },
    { km: 0.5, elevM: 4 },
    { km: 1, elevM: 2 },
  ],
  weather: null,
  tips: [],
  training: {
    tssEst: 10,
    ifEst: 0.6,
    stimulus: "recovery",
    zoneMix: { z1: 1, z2: 0, z3: 0, z4: 0, z5: 0 },
    recoveryHint: "Rest",
  },
  score: {
    goalFit: 1,
    safetyProxy: 1,
    scenicProxy: 1,
    weatherFit: 1,
    total: 1,
  },
  similarRideLabels: [],
  source: "fallback",
};

describe("gpx", () => {
  it("emits a valid-looking GPX track with elevation", () => {
    const xml = routeToGpx(route);
    expect(xml).toContain('version="1.1"');
    expect(xml).toContain("<trkpt lat=");
    expect(xml).toContain("<ele>");
    expect(xml).toContain("Park &amp; parkway");
    expect((xml.match(/<trkpt /g) ?? []).length).toBe(3);
  });

  it("builds a safe filename", () => {
    expect(gpxFilename(route)).toBe("cycleforge-park-parkway.gpx");
  });
});
