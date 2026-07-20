import { describe, expect, it } from "vitest";
import { parseGpxRide } from "./parse-gpx";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Morning spin</name>
    <trkseg>
      <trkpt lat="52.3577" lon="4.8686">
        <ele>2.0</ele>
        <time>2026-07-10T08:00:00Z</time>
      </trkpt>
      <trkpt lat="52.3600" lon="4.8800">
        <ele>8.0</ele>
        <time>2026-07-10T08:20:00Z</time>
      </trkpt>
      <trkpt lat="52.3650" lon="4.8900">
        <ele>5.0</ele>
        <time>2026-07-10T08:40:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpxRide", () => {
  it("extracts distance, elev, duration, and label", () => {
    const ride = parseGpxRide(SAMPLE);
    expect(ride.label).toBe("Morning spin");
    expect(ride.distanceM).toBeGreaterThan(1000);
    expect(ride.elevGainM).toBeGreaterThanOrEqual(6);
    expect(ride.durationS).toBe(40 * 60);
    expect(ride.tssEst).toBeGreaterThan(0);
  });

  it("rejects empty tracks", () => {
    expect(() => parseGpxRide("<gpx></gpx>")).toThrow(/two track points/i);
  });
});
