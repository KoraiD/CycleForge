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
  });
});
