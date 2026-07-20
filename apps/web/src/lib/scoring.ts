import type { RouteScore, WeatherSnapshot, WizardState } from "./types";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Target distance from duration assuming ~22–28 km/h by intensity. */
export function targetDistanceM(wizard: WizardState): number {
  const speedKmh =
    wizard.intensity === "easy"
      ? 20
      : wizard.intensity === "endurance"
        ? 24
        : wizard.intensity === "tempo"
          ? 27
          : 23;
  return (wizard.durationMin / 60) * speedKmh * 1000;
}

export function targetElevGainM(wizard: WizardState): number {
  const base =
    wizard.terrainBias === "flat" ? 25 : wizard.terrainBias === "rolling" ? 70 : 140;
  const intensityBump =
    wizard.intensity === "hills" ? 40 : wizard.intensity === "tempo" ? 15 : 0;
  return base + intensityBump;
}

export function scoreRoute(input: {
  wizard: WizardState;
  distanceM: number;
  elevGainM: number;
  weather: WeatherSnapshot | null;
  busyPenalty: number;
}): RouteScore {
  const targetDist = targetDistanceM(input.wizard);
  const targetClimb = targetElevGainM(input.wizard);

  const distErr = Math.abs(input.distanceM - targetDist) / targetDist;
  const climbErr = Math.abs(input.elevGainM - targetClimb) / Math.max(targetClimb, 40);
  const goalFit = clamp01(1 - distErr * 0.7 - climbErr * 0.3);

  const safetyProxy = clamp01(
    (input.wizard.avoidBusyRoads ? 0.85 : 0.7) - input.busyPenalty * 0.25,
  );

  const scenicProxy = clamp01(
    0.55 +
      (input.elevGainM > 60 ? 0.15 : 0) +
      (input.wizard.terrainBias === "hilly" && input.elevGainM > 100 ? 0.15 : 0.05),
  );

  let weatherFit = 0.75;
  if (input.weather) {
    weatherFit = 0.9;
    if (input.weather.windKmh > 35) weatherFit -= 0.25;
    else if (input.weather.windKmh > 25) weatherFit -= 0.1;
    if (input.weather.precipMm > 1) weatherFit -= 0.2;
    else if (input.weather.precipMm > 0.2) weatherFit -= 0.08;
  }

  const total =
    goalFit * 0.45 +
    safetyProxy * 0.2 +
    scenicProxy * 0.15 +
    clamp01(weatherFit) * 0.2;

  return {
    goalFit: round2(goalFit),
    safetyProxy: round2(safetyProxy),
    scenicProxy: round2(scenicProxy),
    weatherFit: round2(clamp01(weatherFit)),
    total: round2(total),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
