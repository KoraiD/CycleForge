import {
  buildElevProfile,
  elevGainLoss,
  lineDistanceM,
  syntheticLoop,
} from "./geometry";
import { targetDistanceM, targetElevGainM } from "./scoring";
import type { StartPreset, WizardState } from "./types";
import amstelGolden from "@/data/golden-routes/amstel.json";
import centraalGolden from "@/data/golden-routes/centraal.json";
import vondelparkGolden from "@/data/golden-routes/vondelpark.json";

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

type GoldenFile = {
  preset: string;
  routes: Array<{
    label: string;
    profile: string;
    geometry: GeoJSON.LineString;
  }>;
};

const GOLDEN_BY_PRESET: Partial<Record<StartPreset, GoldenFile>> = {
  centraal: centraalGolden as GoldenFile,
  vondelpark: vondelparkGolden as GoldenFile,
  amstel: amstelGolden as GoldenFile,
};

function finalize(
  label: string,
  profile: string,
  geometry: GeoJSON.LineString,
  busyPenalty: number,
  speedKmh: number,
): RawRoute {
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

function scaleGeometryElev(
  geometry: GeoJSON.LineString,
  factor: number,
): GeoJSON.LineString {
  if (factor === 1) return geometry;
  return {
    type: "LineString",
    coordinates: geometry.coordinates.map((c) =>
      c.length >= 3 ? [c[0], c[1], (c[2] ?? 0) * factor] : [...c],
    ),
  };
}

function buildGoldenRoutes(wizard: WizardState): RawRoute[] | null {
  const file =
    GOLDEN_BY_PRESET[wizard.startPreset] ?? GOLDEN_BY_PRESET.vondelpark;
  if (!file?.routes?.length) return null;

  const speed =
    wizard.intensity === "easy" ? 20 : wizard.intensity === "tempo" ? 27 : 24;
  const elevFactor =
    wizard.terrainBias === "flat" ? 0.55 : wizard.terrainBias === "hilly" ? 1.55 : 1;

  return file.routes.slice(0, 3).map((r, i) =>
    finalize(
      r.label,
      r.profile,
      scaleGeometryElev(r.geometry, elevFactor),
      wizard.avoidBusyRoads ? 0.1 + i * 0.02 : 0.25,
      speed,
    ),
  );
}

function buildSyntheticRoutes(wizard: WizardState): RawRoute[] {
  const targetKm = targetDistanceM(wizard) / 1000;
  const targetClimb = targetElevGainM(wizard);
  const speed =
    wizard.intensity === "easy" ? 20 : wizard.intensity === "tempo" ? 27 : 24;

  const radii = [
    Math.max((targetKm / (2 * Math.PI)) * 0.9, 2.5),
    Math.max((targetKm / (2 * Math.PI)) * 1.05, 3.2),
    Math.max((targetKm / (2 * Math.PI)) * 1.2, 4.0),
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

/** Cached ORS geometries when live ORS is unavailable; synthetic loops as last resort. */
export function buildFallbackRoutes(wizard: WizardState): RawRoute[] {
  return buildGoldenRoutes(wizard) ?? buildSyntheticRoutes(wizard);
}
