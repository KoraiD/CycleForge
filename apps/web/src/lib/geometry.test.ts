import { describe, expect, it } from "vitest";
import {
  buildElevProfile,
  elevGainLoss,
  lineDistanceM,
  nearestKmAlongLine,
  pointAtKm,
  syntheticLoop,
} from "./geometry";

describe("geometry", () => {
  it("computes line distance along a short segment", () => {
    const coords = [
      [4.9, 52.37, 0],
      [4.91, 52.37, 0],
    ];
    const meters = lineDistanceM(coords);
    expect(meters).toBeGreaterThan(500);
    expect(meters).toBeLessThan(900);
  });

  it("computes elevation gain and loss", () => {
    const coords = [
      [0, 0, 10],
      [0, 0, 25],
      [0, 0, 15],
      [0, 0, 40],
    ];
    const { gain, loss } = elevGainLoss(coords);
    expect(gain).toBe(40); // 15 + 25
    expect(loss).toBe(10);
  });

  it("builds a downsampled elevation profile", () => {
    const loop = syntheticLoop(4.8686, 52.3577, 3, 40, 2, 12);
    const profile = buildElevProfile(loop.coordinates);
    expect(profile[0]).toEqual({ km: 0, elevM: expect.any(Number) });
    expect(profile.length).toBeGreaterThan(5);
    expect(profile.at(-1)?.km).toBeGreaterThan(10);
  });

  it("projects a nearby point onto the line as km", () => {
    const coords = [
      [4.9, 52.37],
      [4.91, 52.37],
      [4.92, 52.37],
    ];
    const mid = nearestKmAlongLine(coords, 4.91, 52.37005);
    expect(mid).not.toBeNull();
    expect(mid!).toBeGreaterThan(0.3);
    expect(mid!).toBeLessThan(1.2);
    const pt = pointAtKm(coords, mid!);
    expect(pt?.[0]).toBeCloseTo(4.91, 2);
  });

  it("closes a synthetic loop near the start point", () => {
    const loop = syntheticLoop(4.9, 52.37, 2, 24);
    const first = loop.coordinates[0];
    const last = loop.coordinates.at(-1)!;
    expect(first[0]).toBeCloseTo(last[0], 5);
    expect(first[1]).toBeCloseTo(last[1], 5);
    expect(loop.type).toBe("LineString");
  });
});
