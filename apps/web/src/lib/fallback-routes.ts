import { buildElevProfile, elevGainLoss, lineDistanceM, syntheticLoop } from "./geometry";
import { targetDistanceM, targetElevGainM } from "./scoring";
import type { WizardState } from "./types";

export type RawRoute = {
  label: string;
  profile: string;
  geometry: GeoJSON.LineString;
  distanceM: number;
  durationS: number;
  elevGainM: number;
  elevLossM: number;
  elevProfile: ReturnType<typeof buildElevProfile>;
  busyPenalty: number;
  source: "ors" | "fallback";
};

function finalize(label: string, profile: string, geometry: GeoJSON.LineString, busyPenalty: number, speedKmh: number): RawRoute {
  const coords = geometry.coordinates;
  const distanceM = lineDistanceM(coords);
  const { gain, loss } = elevGainLoss(coords);
  return {
    label,
    profile,
    geometry,
    distanceM,
    durationS: (distanceM / 1000 / speedKmh) * 3600,
    elevGainM: gain,
    elevLossM: loss,
    elevProfile: buildElevProfile(coords),
    busyPenalty,
    source: "fallback",
  };
}

/** Deterministic demo routes when ORS is unavailable. */
export function buildFallbackRoutes(wizard: WizardState): RawRoute[] {
  const targetKm = targetDistanceM(wizard) / 1000;
  const targetClimb = targetElevGainM(wizard);
  const speed =
    wizard.intensity === "easy" ? 20 : wizard.intensity === "tempo" ? 27 : 24;

  const radii = [
    Math.max(targetKm / (2 * Math.PI) * 0.9, 2.5),
    Math.max(targetKm / (2 * Math.PI) * 1.05, 3.2),
    Math.max(targetKm / (2 * Math.PI) * 1.2, 4.0),
  ];

  const climbAmps = [
    Math.max(targetClimb * 0.04, 4),
    Math.max(targetClimb * 0.07, 7),
    Math.max(targetClimb * 0.11, 11),
  ];

  const specs = [
    {
      label: "Amstel canal loop",
      profile: "endurance-flat",
      radius: radii[0],
      climbAmp: climbAmps[0],
      busy: wizard.avoidBusyRoads ? 0.1 : 0.25,
    },
    {
      label: "Vondelpark–Bosbaan",
      profile: "rolling-endurance",
      radius: radii[1],
      climbAmp: climbAmps[1],
      busy: 0.15,
    },
    {
      label: "Waterland rollers",
      profile: "hilly-loop",
      radius: radii[2],
      climbAmp: climbAmps[2] * (wizard.terrainBias === "hilly" ? 1.4 : 1),
      busy: 0.05,
    },
  ];

  return specs.map((s) =>
    finalize(
      s.label,
      s.profile,
      syntheticLoop(wizard.startLng, wizard.startLat, s.radius, 56, 1.5, s.climbAmp),
      s.busy,
      speed,
    ),
  );
}
