import { schemaTask, logger } from "@trigger.dev/sdk";
import { z } from "zod";
import { fetchOrsVariant, mergeWithFallbacks } from "@/lib/ors";
import { ROUTE_VARIANTS } from "@/lib/route-variants";
import type { WizardState } from "@/lib/types";

const wizardSchema = z.object({
  sessionId: z.string(),
  goalsText: z.string(),
  durationMin: z.number(),
  intensity: z.enum(["easy", "endurance", "tempo", "hills"]),
  terrainBias: z.enum(["flat", "rolling", "hilly"]),
  startPreset: z.enum(["centraal", "vondelpark", "amstel", "custom"]),
  startLat: z.number(),
  startLng: z.number(),
  avoidBusyRoads: z.boolean(),
  confirmed: z.boolean(),
});

const variantSchema = z.object({
  label: z.string(),
  profile: z.string(),
  lengthFactor: z.number(),
  points: z.number(),
  seed: z.number(),
});

/** One ORS (or null) child — fan out 3 of these via batchTriggerAndWait. */
export const fetchOrsRoute = schemaTask({
  id: "fetch-ors-route",
  schema: z.object({
    wizard: wizardSchema,
    variant: variantSchema,
  }),
  run: async ({ wizard, variant }) => {
    logger.info("ORS child start", {
      sessionId: wizard.sessionId,
      label: variant.label,
      seed: variant.seed,
    });
    const route = await fetchOrsVariant(wizard as WizardState, variant);
    logger.info("ORS child done", {
      label: variant.label,
      source: route?.source ?? "miss",
      distanceM: route?.distanceM,
    });
    return { route };
  },
});

/**
 * Parent fan-out task: 3 durable `fetch-ors-route` children in parallel.
 * Visible as a run tree in the Trigger.dev dashboard.
 */
export const fetchOrsRouteBatch = schemaTask({
  id: "fetch-ors-route-batch",
  schema: z.object({
    wizard: wizardSchema,
  }),
  run: async ({ wizard }) => {
    logger.info("ORS batch fan-out", {
      sessionId: wizard.sessionId,
      children: ROUTE_VARIANTS.length,
    });

    const batch = await fetchOrsRoute.batchTriggerAndWait(
      ROUTE_VARIANTS.map((variant) => ({
        payload: { wizard, variant },
      })),
    );

    const partial = batch.runs.map((run) => {
      if (!run.ok) {
        logger.warn("ORS child failed", { error: run.error });
        return null;
      }
      return run.output.route;
    });

    const routes = mergeWithFallbacks(wizard as WizardState, partial);
    logger.info("ORS batch merged", {
      count: routes.length,
      sources: routes.map((r) => r.source),
    });
    return { routes };
  },
});
