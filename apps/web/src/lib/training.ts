import type {
  EffortSegment,
  ElevPoint,
  Intensity,
  TerrainBias,
  TrainingEffect,
  ZoneMix,
} from "./types";

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

/** Classic Coggan IF targets by session intent (fraction of FTP). */
const INTENSITY_IF: Record<Intensity, number> = {
  easy: 0.55,
  endurance: 0.68,
  tempo: 0.82,
  hills: 0.78,
};

export function estimateTraining(input: {
  distanceM: number;
  durationS: number;
  elevGainM: number;
  intensity: Intensity;
  terrainBias: TerrainBias;
  ftpWatts?: number | null;
}): TrainingEffect {
  const hours = Math.max(input.durationS / 3600, 0.25);
  const distanceKm = input.distanceM / 1000;
  const climbPerKm = input.elevGainM / Math.max(distanceKm, 1);

  const terrainBump =
    input.terrainBias === "hilly" ? 0.06 : input.terrainBias === "rolling" ? 0.03 : 0;
  const climbBump = clamp(climbPerKm / 40, 0, 0.12);
  let ifEst = clamp(
    INTENSITY_IF[input.intensity] + terrainBump + climbBump,
    0.45,
    0.95,
  );

  let npEst: number | null = null;
  const ftp = input.ftpWatts;
  if (ftp && ftp > 80) {
    npEst = Math.round(ftp * ifEst);
    ifEst = clamp(npEst / ftp, 0.45, 0.95);
  }

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
    ftpWatts: ftp && ftp > 80 ? ftp : null,
    npEst,
  };
}

function zoneFromGrade(grade: number): {
  zone: EffortSegment["zone"];
  label: string;
} {
  if (grade >= 4.5) return { zone: 5, label: "Hard climb" };
  if (grade >= 2.5) return { zone: 4, label: "Climb" };
  if (grade >= 1) return { zone: 3, label: "Rollers" };
  if (grade <= -2) return { zone: 1, label: "Descent" };
  return { zone: 2, label: "Steady" };
}

/** Derive climb-effort overlays covering the full elevation profile. */
export function buildEffortSegments(profile: ElevPoint[]): EffortSegment[] {
  if (profile.length < 2) return [];

  const raw: EffortSegment[] = [];
  let fromKm = profile[0].km;
  let { zone, label } = zoneFromGrade(0);

  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    const dKm = Math.max(b.km - a.km, 0.001);
    const grade = ((b.elevM - a.elevM) / (dKm * 1000)) * 100;
    const next = zoneFromGrade(grade);

    if (next.zone !== zone) {
      if (a.km > fromKm + 1e-6) {
        raw.push({ fromKm, toKm: a.km, zone, label });
      }
      fromKm = a.km;
      zone = next.zone;
      label = next.label;
    }

    if (i === profile.length - 1 && b.km > fromKm + 1e-6) {
      raw.push({ fromKm, toKm: b.km, zone, label });
    }
  }

  // Merge adjacent same-zone slices (grade flicker → one band).
  const merged: EffortSegment[] = [];
  for (const seg of raw) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.zone === seg.zone &&
      Math.abs(prev.toKm - seg.fromKm) < 0.05
    ) {
      prev.toKm = seg.toKm;
    } else {
      merged.push({ ...seg });
    }
  }

  // Fill any holes so the overlay always spans the whole chart.
  const startKm = profile[0].km;
  const endKm = profile[profile.length - 1].km;
  if (!merged.length) {
    return [{ fromKm: startKm, toKm: endKm, zone: 2, label: "Steady" }];
  }

  const filled: EffortSegment[] = [];
  let cursor = startKm;
  for (const seg of merged) {
    if (seg.fromKm > cursor + 0.05) {
      filled.push({
        fromKm: cursor,
        toKm: seg.fromKm,
        zone: 2,
        label: "Steady",
      });
    }
    filled.push({
      ...seg,
      fromKm: Math.max(seg.fromKm, cursor),
    });
    cursor = Math.max(cursor, seg.toKm);
  }
  if (cursor < endKm - 0.05) {
    filled.push({
      fromKm: cursor,
      toKm: endKm,
      zone: 2,
      label: "Steady",
    });
  }

  return filled;
}
