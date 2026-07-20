import type { Intensity, TerrainBias, TrainingEffect, ZoneMix } from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeZones(z: ZoneMix): ZoneMix {
  const sum = z.z1 + z.z2 + z.z3 + z.z4 + z.z5 || 1;
  return {
    z1: Math.round((z.z1 / sum) * 100),
    z2: Math.round((z.z2 / sum) * 100),
    z3: Math.round((z.z3 / sum) * 100),
    z4: Math.round((z.z4 / sum) * 100),
    z5: Math.round((z.z5 / sum) * 100),
  };
}

export function estimateTraining(input: {
  distanceM: number;
  durationS: number;
  elevGainM: number;
  intensity: Intensity;
  terrainBias: TerrainBias;
}): TrainingEffect {
  const hours = Math.max(input.durationS / 3600, 0.25);
  const distanceKm = input.distanceM / 1000;
  const climbPerKm = input.elevGainM / Math.max(distanceKm, 1);

  const intensityFactor: Record<Intensity, number> = {
    easy: 0.55,
    endurance: 0.68,
    tempo: 0.8,
    hills: 0.78,
  };

  const terrainBump =
    input.terrainBias === "hilly" ? 0.06 : input.terrainBias === "rolling" ? 0.03 : 0;
  const climbBump = clamp(climbPerKm / 40, 0, 0.12);
  const ifEst = clamp(intensityFactor[input.intensity] + terrainBump + climbBump, 0.45, 0.95);
  const tssEst = Math.round(hours * ifEst * ifEst * 100);

  let zoneMix: ZoneMix;
  switch (input.intensity) {
    case "easy":
      zoneMix = { z1: 45, z2: 40, z3: 12, z4: 3, z5: 0 };
      break;
    case "endurance":
      zoneMix = { z1: 20, z2: 55, z3: 20, z4: 5, z5: 0 };
      break;
    case "tempo":
      zoneMix = { z1: 10, z2: 25, z3: 45, z4: 18, z5: 2 };
      break;
    case "hills":
      zoneMix = { z1: 15, z2: 30, z3: 30, z4: 20, z5: 5 };
      break;
    default: {
      const _exhaustive: never = input.intensity;
      throw new Error(`Unhandled intensity: ${_exhaustive}`);
    }
  }

  if (climbPerKm > 12) {
    zoneMix = {
      ...zoneMix,
      z3: zoneMix.z3 + 5,
      z4: zoneMix.z4 + 5,
      z1: Math.max(zoneMix.z1 - 5, 0),
      z2: Math.max(zoneMix.z2 - 5, 0),
    };
  }

  let stimulus: TrainingEffect["stimulus"] = "endurance";
  if (input.intensity === "easy") stimulus = "recovery";
  else if (input.intensity === "tempo") stimulus = "tempo";
  else if (input.intensity === "hills" || climbPerKm > 15) stimulus = "climb";
  else if (ifEst >= 0.85) stimulus = "vo2";

  const recoveryHint =
    tssEst >= 120
      ? "Hard stimulus — plan easy spinning tomorrow."
      : tssEst >= 80
        ? "Solid training load — light legs or rest day next."
        : "Manageable load — good for stacking another endurance day.";

  return {
    tssEst,
    ifEst: Math.round(ifEst * 100) / 100,
    stimulus,
    zoneMix: normalizeZones(zoneMix),
    recoveryHint,
  };
}
