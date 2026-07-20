import { describe, expect, it } from "vitest";
import type { RouteCandidate } from "./types";
import { buildWindSegments, windSegmentColor } from "./wind-segments";

function northSouthRoute(): RouteCandidate {
  // Roughly southbound along a meridian near Amsterdam.
  const coordinates: [number, number][] = [];
  for (let i = 0; i < 20; i++) {
    coordinates.push([4.9, 52.4 - i * 0.01]);
  }
  return {
    routeId: "wind-1",
    sessionId: "s",
    label: "NS",
    profile: "cycling-regular",
    distanceM: 20_000,
    durationS: 3000,
    elevGainM: 40,
    elevLossM: 40,
    geometry: { type: "LineString", coordinates },
    elevProfile: [],
    weather: null,
    tips: [],
    training: {
      tssEst: 40,
      ifEst: 0.7,
      stimulus: "endurance",
      zoneMix: { z1: 0.2, z2: 0.6, z3: 0.2, z4: 0, z5: 0 },
      recoveryHint: "",
    },
    score: {
      goalFit: 0.8,
      safetyProxy: 0.8,
      scenicProxy: 0.5,
      weatherFit: 0.8,
      total: 0.75,
    },
    similarRideLabels: [],
    source: "fallback",
  };
}

describe("buildWindSegments", () => {
  it("returns empty for tiny geometry", () => {
    const route = northSouthRoute();
    route.geometry.coordinates = [[4.9, 52.4]];
    expect(buildWindSegments(route, 180)).toEqual([]);
  });

  it("splits a long route into tintable segments", () => {
    const segments = buildWindSegments(northSouthRoute(), 0);
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      expect(seg.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(seg.toKm).toBeGreaterThanOrEqual(seg.fromKm);
      expect(seg.headwind).toBeGreaterThanOrEqual(-1);
      expect(seg.headwind).toBeLessThanOrEqual(1);
    }
  });

  it("maps headwind classes to distinct colors", () => {
    expect(windSegmentColor(0.9)).not.toBe(windSegmentColor(-0.9));
    expect(windSegmentColor(0)).toMatch(/^#/);
  });
});
