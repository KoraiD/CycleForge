import { describe, expect, it } from "vitest";
import { pickBestLeaveWindow, type HourlyWeather } from "./best-leave";

describe("pickBestLeaveWindow", () => {
  it("prefers dry low-wind hours", () => {
    const hours: HourlyWeather[] = [
      {
        time: "2026-07-21T08:00:00",
        tempC: 16,
        precipMm: 2.5,
        windKmh: 30,
        weatherCode: 61,
        summary: "Rain",
      },
      {
        time: "2026-07-21T11:00:00",
        tempC: 18,
        precipMm: 0,
        windKmh: 12,
        weatherCode: 1,
        summary: "Mainly clear",
      },
      {
        time: "2026-07-21T15:00:00",
        tempC: 22,
        precipMm: 0.1,
        windKmh: 20,
        weatherCode: 2,
        summary: "Partly cloudy",
      },
    ];
    const win = pickBestLeaveWindow(hours, 90);
    expect(win?.bestStartIso).toContain("11:00");
    expect(win?.score).toBeGreaterThan(70);
    expect(win?.hours).toHaveLength(3);
    expect(win?.hours?.every((h) => ["go", "caution", "no-go"].includes(h.verdict))).toBe(
      true,
    );
    const bestHour = win?.hours?.find((h) => h.time === win.bestStartIso);
    expect(bestHour?.verdict).toBe("go");
  });

  it("carries extended hourly metrics through to scored hours", () => {
    const hours: HourlyWeather[] = [
      {
        time: "2026-07-21T09:00:00",
        tempC: 17,
        precipMm: 0,
        windKmh: 10,
        weatherCode: 1,
        summary: "Mainly clear",
        humidityPct: 62,
        uvIndex: 3.4,
        visibilityM: 18000,
        aqi: 28,
        cloudCoverPct: 20,
        isDay: true,
      },
    ];
    const win = pickBestLeaveWindow(hours, 60);
    const hour = win?.hours?.[0];
    expect(hour?.humidityPct).toBe(62);
    expect(hour?.uvIndex).toBeCloseTo(3.4);
    expect(hour?.visibilityM).toBe(18000);
    expect(hour?.aqi).toBe(28);
    expect(hour?.cloudCoverPct).toBe(20);
    expect(hour?.isDay).toBe(true);
  });

  it("returns null for empty hourly series", () => {
    expect(pickBestLeaveWindow([], 60)).toBeNull();
  });
});
