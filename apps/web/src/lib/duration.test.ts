import { describe, expect, it } from "vitest";
import { kmToMinutes, minutesToKm, speedKmhFor } from "./duration";

describe("duration helpers", () => {
  it("maps intensity to speed", () => {
    expect(speedKmhFor("easy")).toBe(20);
    expect(speedKmhFor("endurance")).toBe(24);
    expect(speedKmhFor("tempo")).toBe(27);
    expect(speedKmhFor("hills")).toBe(23);
  });

  it("converts minutes to km and back (round trip)", () => {
    const km = minutesToKm(90, "endurance"); // 1.5h * 24 = 36 km
    expect(km).toBeCloseTo(36, 1);
    expect(kmToMinutes(36, "endurance")).toBe(90);
  });

  it("converts km to minutes using intensity speed", () => {
    expect(kmToMinutes(27, "tempo")).toBe(60); // 27 km @ 27 km/h = 60 min
    expect(kmToMinutes(20, "easy")).toBe(60);
  });
});
