import { describe, expect, it } from "vitest";
import {
  buildTileGrid,
  AMS_WEATHER_BBOX,
  tileCoord,
  tileIdFor,
} from "./weather-grid";

describe("weather-grid", () => {
  it("rounds coordinates to tile step", () => {
    expect(tileCoord(52.3577)).toBeCloseTo(52.35, 2);
    expect(tileIdFor(52.3577, 4.8686)).toBe("52.35_4.85");
  });

  it("builds a non-empty Amsterdam tile grid", () => {
    const tiles = buildTileGrid(AMS_WEATHER_BBOX);
    expect(tiles.length).toBeGreaterThan(10);
    expect(new Set(tiles.map((t) => t.tileId)).size).toBe(tiles.length);
  });
});
