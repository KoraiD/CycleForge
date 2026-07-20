import { schemaTask, logger } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  findSimilarRides,
  persistRoutes,
  scoreRoutesSql,
  upsertSession,
} from "@/lib/clickhouse";
import { scoreRoute } from "@/lib/scoring";
import { buildTips, comparisonFromRoutes } from "@/lib/tips";
import { estimateTraining } from "@/lib/training";
import { resolveWeather } from "@/lib/weather";
import type { RouteCandidate, WizardState } from "@/lib/types";
import { randomUUID } from "crypto";

const wizardSchema = z.object({
  sessionId: z.string(),
  goalsText: z.string(),
  durationMin: z.number(),
  intensity: z.enum(["easy", "endurance", "tempo", "hills"]),
  terrainBias: z.enum(["flat", "rolling", "hilly"]),
  startPreset: z.enum(["centraal", "vondelpark", "amstel", "custom"]),
  startLat: z.number(),
  startLng: z.number(),
  startLabel: z.string().optional(),
  avoidBusyRoads: z.boolean(),
  confirmed: z.boolean(),
});

const rawRouteSchema = z.object({
  label: z.string(),
  profile: z.string(),
  geometry: z.object({
    type: z.literal("LineString"),
    coordinates: z.array(z.array(z.number())),
  }),
  distanceM: z.number(),
  durationS: z.number(),
  elevGainM: z.number(),
  elevLossM: z.number(),
  elevProfile: z.array(z.object({ km: z.number(), elevM: z.number() })),
  busyPenalty: z.number(),
  source: z.enum(["ors", "fallback"]),
});

export const scoreAndEnrichRoutesTask = schemaTask({
  id: "score-and-enrich-routes",
  schema: z.object({
    wizard: wizardSchema,
    rawRoutes: z.array(rawRouteSchema),
  }),
  run: async ({ wizard, rawRoutes }) => {
    const w = {
      ...wizard,
      startLabel: wizard.startLabel ?? "",
    } as WizardState;
    await upsertSession(w, w.goalsText);
    const weather = await resolveWeather(w.startLat, w.startLng);

    const routes: RouteCandidate[] = [];
    for (const raw of rawRoutes) {
      const training = estimateTraining({
        distanceM: raw.distanceM,
        durationS: raw.durationS,
        elevGainM: raw.elevGainM,
        intensity: w.intensity,
        terrainBias: w.terrainBias,
      });
      const score = scoreRoute({
        wizard: w,
        distanceM: raw.distanceM,
        elevGainM: raw.elevGainM,
        weather,
        busyPenalty: raw.busyPenalty,
      });
      const tips = buildTips({
        wizard: w,
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
        sessionId: w.sessionId,
        label: raw.label,
        profile: raw.profile,
        distanceM: raw.distanceM,
        durationS: raw.durationS,
        elevGainM: raw.elevGainM,
        elevLossM: raw.elevLossM,
        geometry: raw.geometry as GeoJSON.LineString,
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
    await persistRoutes(w.sessionId, routes);
    const ranked = await scoreRoutesSql(w.sessionId);
    logger.info("Scored routes in ClickHouse", { ranked });

    return {
      sessionId: w.sessionId,
      wizard: w,
      routes,
      selectedRouteId: routes[0]?.routeId ?? "",
      comparison: comparisonFromRoutes(routes),
      sqlRanking: ranked,
    };
  },
});
