import type { RouteCandidate, WizardState } from "./types";
import { targetDistanceM, targetElevGainM } from "./scoring";

export type ScoreExplain = {
  total: number;
  weights: Array<{ key: string; label: string; value: number; weight: number; points: number }>;
  narrative: string[];
  sqlHint: string;
};

/** Build a human + SQL-flavored explanation of the ClickHouse-aligned score. */
export function explainRouteScore(
  route: RouteCandidate,
  wizard: WizardState,
): ScoreExplain {
  const s = route.score;
  const weights = [
    {
      key: "goal_fit",
      label: "Goal fit",
      value: s.goalFit,
      weight: 0.45,
      points: Math.round(s.goalFit * 45),
    },
    {
      key: "safety_proxy",
      label: "Quiet roads",
      value: s.safetyProxy,
      weight: 0.2,
      points: Math.round(s.safetyProxy * 20),
    },
    {
      key: "scenic_proxy",
      label: "Scenic / climb",
      value: s.scenicProxy,
      weight: 0.15,
      points: Math.round(s.scenicProxy * 15),
    },
    {
      key: "weather_fit",
      label: "Weather fit",
      value: s.weatherFit,
      weight: 0.2,
      points: Math.round(s.weatherFit * 20),
    },
  ];

  const targetKm = targetDistanceM(wizard) / 1000;
  const targetClimb = targetElevGainM(wizard);
  const narrative = [
    `Targets ~${targetKm.toFixed(0)} km and ~${Math.round(targetClimb)} m for a ${wizard.durationMin}-min ${wizard.intensity} ride.`,
    `This candidate is ${(route.distanceM / 1000).toFixed(1)} km / ${Math.round(route.elevGainM)} m (source: ${route.source}).`,
  ];
  if (route.weather) {
    narrative.push(
      `Weather fit uses ${route.weather.summary}, ${Math.round(route.weather.tempC)}°C, wind ${Math.round(route.weather.windKmh)} km/h` +
        (route.weather.source === "clickhouse"
          ? " from ClickHouse weather_forecast_grid."
          : " from live Open-Meteo."),
    );
  }
  if (route.similarRideLabels.length) {
    narrative.push(
      `Nearest corpus rides: ${route.similarRideLabels.slice(0, 3).join(" · ")}.`,
    );
  }

  const sqlHint = `SELECT route_id, total_sql, goal_fit, safety_proxy, scenic_proxy, weather_fit
FROM route_scores_ranked
WHERE session_id = '${route.sessionId}'
ORDER BY total_sql DESC;`;

  return {
    total: Math.round(s.total * 100),
    weights,
    narrative,
    sqlHint,
  };
}
