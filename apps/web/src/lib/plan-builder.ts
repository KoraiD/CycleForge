import { randomUUID } from "crypto";
import {
  findSimilarRides,
  getHistoryContext,
  persistRoutes,
  upsertSession,
} from "./clickhouse";
import { attachCoachNote } from "./coach-note";
import { START_PRESETS } from "./constants";
import { generateRawRoutes } from "./ors";
import { scoreRoute } from "./scoring";
import { getSessionAthlete } from "./session-store";
import { buildTips, comparisonFromRoutes } from "./tips";
import { estimateTraining } from "./training";
import type { PlanPayload, RouteCandidate, WizardState } from "./types";
import { resolveWeather } from "./weather";

export async function buildPlan(wizard: WizardState): Promise<PlanPayload> {
  await upsertSession(wizard, wizard.goalsText);
  const weather = await resolveWeather(wizard.startLat, wizard.startLng);
  const athleteId = getSessionAthlete(wizard.sessionId);
  const historyContext = athleteId
    ? ((await getHistoryContext(athleteId)) ?? undefined)
    : undefined;
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

  return attachCoachNote({
    sessionId: wizard.sessionId,
    wizard,
    routes,
    selectedRouteId: routes[0]?.routeId ?? "",
    historyContext,
    comparison: comparisonFromRoutes(routes),
  });
}

export function mergeWizard(
  current: WizardState,
  patch: Partial<WizardState>,
): WizardState {
  const next = { ...current, ...patch, sessionId: current.sessionId };
  if (patch.startPreset && patch.startPreset !== "custom") {
    const p = START_PRESETS[patch.startPreset];
    next.startLat = p.lat;
    next.startLng = p.lng;
    next.startLabel = patch.startLabel ?? p.label;
  }
  if (next.startLabel === undefined || next.startLabel === "") {
    next.startLabel =
      next.startPreset !== "custom"
        ? START_PRESETS[next.startPreset].label
        : `Pin ${next.startLat.toFixed(4)}, ${next.startLng.toFixed(4)}`;
  }
  return next;
}
