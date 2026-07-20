import { randomUUID } from "crypto";
import { findSimilarRides, persistRoutes, upsertSession } from "./clickhouse";
import { generateRawRoutes } from "./ors";
import { scoreRoute } from "./scoring";
import { buildTips, comparisonFromRoutes } from "./tips";
import { estimateTraining } from "./training";
import type { PlanPayload, RouteCandidate, WizardState } from "./types";
import { fetchWeather } from "./weather";

export async function buildPlan(wizard: WizardState): Promise<PlanPayload> {
  await upsertSession(wizard, wizard.goalsText);
  const weather = await fetchWeather(wizard.startLat, wizard.startLng);
  const rawRoutes = await generateRawRoutes(wizard);

  const routes: RouteCandidate[] = [];
  for (const raw of rawRoutes) {
    const training = estimateTraining({
      distanceM: raw.distanceM,
      durationS: raw.durationS,
      elevGainM: raw.elevGainM,
      intensity: wizard.intensity,
      terrainBias: wizard.terrainBias,
    });
    const score = scoreRoute({
      wizard,
      distanceM: raw.distanceM,
      elevGainM: raw.elevGainM,
      weather,
      busyPenalty: raw.busyPenalty,
    });
    const tips = buildTips({
      wizard,
      distanceM: raw.distanceM,
      elevGainM: raw.elevGainM,
      weather,
      profile: raw.profile,
    });
    const similarRideLabels = await findSimilarRides({
      distanceM: raw.distanceM,
      elevGainM: raw.elevGainM,
      durationS: raw.durationS,
    });

    routes.push({
      routeId: randomUUID(),
      sessionId: wizard.sessionId,
      label: raw.label,
      profile: raw.profile,
      distanceM: raw.distanceM,
      durationS: raw.durationS,
      elevGainM: raw.elevGainM,
      elevLossM: raw.elevLossM,
      geometry: raw.geometry,
      elevProfile: raw.elevProfile,
      weather,
      tips,
      training,
      score,
      similarRideLabels,
      source: raw.source,
    });
  }

  routes.sort((a, b) => b.score.total - a.score.total);
  await persistRoutes(wizard.sessionId, routes);

  return {
    sessionId: wizard.sessionId,
    wizard,
    routes,
    selectedRouteId: routes[0]?.routeId ?? "",
    comparison: comparisonFromRoutes(routes),
  };
}

export function mergeWizard(
  current: WizardState,
  patch: Partial<WizardState>,
): WizardState {
  const next = { ...current, ...patch, sessionId: current.sessionId };
  if (patch.startPreset && patch.startPreset !== "custom") {
    const presets = {
      centraal: { lat: 52.3791, lng: 4.9003 },
      vondelpark: { lat: 52.3577, lng: 4.8686 },
      amstel: { lat: 52.3462, lng: 4.9179 },
    } as const;
    const p = presets[patch.startPreset];
    next.startLat = p.lat;
    next.startLng = p.lng;
  }
  return next;
}
