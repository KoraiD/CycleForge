import type { RouteCandidate, WeatherSnapshot, WizardState } from "./types";

export function buildTips(input: {
  wizard: WizardState;
  distanceM: number;
  elevGainM: number;
  weather: WeatherSnapshot | null;
  profile: string;
}): string[] {
  const tips: string[] = [];
  const km = input.distanceM / 1000;
  const climb = input.elevGainM;

  if (input.wizard.avoidBusyRoads) {
    tips.push("Biased toward quieter cycle paths where the router allows.");
  }

  if (climb < 40) {
    tips.push("Low elevation — great for steady endurance cadence work.");
  } else if (climb > 120) {
    tips.push("Notable climbing for the region — keep gearing easy on the rises.");
  }

  if (km > 45) {
    tips.push("Bring a bottle and a small snack — this is a longer Amsterdam loop.");
  }

  if (input.weather) {
    if (input.weather.windKmh >= 25) {
      tips.push(
        `Wind ~${Math.round(input.weather.windKmh)} km/h — expect a tougher return leg into the breeze.`,
      );
    }
    if (input.weather.precipMm >= 0.5) {
      tips.push("Wet roads possible — watch metal bridges and painted lines.");
    }
    if (input.weather.tempC <= 8) {
      tips.push("Cool start — arm warmers help until you warm up.");
    } else if (input.weather.tempC >= 24) {
      tips.push("Warm conditions — start hydrated and ease the first 10 minutes.");
    }
  }

  if (input.profile.includes("hilly") || input.wizard.intensity === "hills") {
    tips.push("Use the short rises as openers: seated, smooth, no sprinting.");
  }

  if (input.wizard.intensity === "tempo") {
    tips.push("Hold tempo on open stretches; soft-pedal through busy junctions.");
  }

  return tips.slice(0, 5);
}

export function comparisonFromRoutes(routes: RouteCandidate[]) {
  const climbs = routes.map((r) => r.elevGainM);
  const distances = routes.map((r) => r.distanceM / 1000);
  return {
    minClimbM: Math.min(...climbs),
    maxClimbM: Math.max(...climbs),
    minDistanceKm: Math.min(...distances),
    maxDistanceKm: Math.max(...distances),
  };
}
