import { describe, expect, it } from "vitest";
import {
  estimateRoadMix,
  roadMixForRoute,
  roadTypeGeometries,
} from "./road-types";
import { syntheticLoop } from "./geometry";
import type { RouteCandidate } from "./types";

function makeRoute(overrides: Partial<RouteCandidate> = {}): RouteCandidate {
  const geometry = syntheticLoop(4.9, 52.37, 6);
  return {
    routeId: "test-route-1",
    sessionId: "s1",
    label: "Amstel Loop",
    profile: "rolling-endurance",
    distanceM: 42000,
    durationS: 6300,
    elevGainM: 180,
    elevLossM: 178,
    geometry,
    elevProfile: [],
    weather: null,
    tips: [],
    training: {
      tssEst: 72,
      ifEst: 0.78,
      stimulus: "endurance",
      zoneMix: { z1: 10, z2: 60, z3: 20, z4: 8, z5: 2 },
      recoveryHint: "Easy day tomorrow",
    },
    score: {
      goalFit: 0.8,
      safetyProxy: 0.8,
      scenicProxy: 0.7,
      weatherFit: 0.75,
      total: 0.77,
    },
    similarRideLabels: [],
    source: "fallback",
    ...overrides,
  };
}

describe("estimateRoadMix", () => {
  it("covers the full route distance with contiguous segments", () => {
    const route = makeRoute();
    const mix = estimateRoadMix(route);
    const totalKm = route.distanceM / 1000;

    expect(mix.totalKm).toBeCloseTo(totalKm, 1);
    const segSum = mix.segments.reduce((s, seg) => s + (seg.toKm - seg.fromKm), 0);
    expect(segSum).toBeCloseTo(totalKm, 0);

    for (const seg of mix.segments) {
      expect(seg.toKm).toBeGreaterThan(seg.fromKm);
      expect(seg.fromKm).toBeGreaterThanOrEqual(0);
      expect(seg.toKm).toBeLessThanOrEqual(totalKm + 0.01);
    }
  });

  it("reports km and percentage per type that add up", () => {
    const mix = estimateRoadMix(makeRoute());
    const kmSum = mix.kmByType.reduce((s, t) => s + t.km, 0);
    expect(kmSum).toBeGreaterThan(mix.totalKm * 0.9);
    const pctSum = mix.kmByType.reduce((s, t) => s + t.pct, 0);
    expect(pctSum).toBeGreaterThanOrEqual(95);
    expect(pctSum).toBeLessThanOrEqual(105);
  });

  it("is deterministic per route id", () => {
    const a = estimateRoadMix(makeRoute());
    const b = estimateRoadMix(makeRoute());
    expect(a.segments).toEqual(b.segments);
  });
});

describe("roadTypeGeometries", () => {
  it("splits geometry into drawable per-type polylines", () => {
    const route = makeRoute();
    const mix = roadMixForRoute(route);
    const parts = roadTypeGeometries(route, mix);
    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      expect(part.coordinates.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns empty array for degenerate geometry", () => {
    const route = makeRoute({
      geometry: { type: "LineString", coordinates: [[4.9, 52.37, 2]] },
    });
    const mix = roadMixForRoute(route);
    expect(roadTypeGeometries(route, mix)).toEqual([]);
  });
});
