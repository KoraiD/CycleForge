import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import type { PlanPayload } from "@/lib/types";
import { generateRouteCandidatesTask } from "./generate-routes";
import { scoreAndEnrichRoutesTask } from "./score-routes";

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
  ftpWatts: z.number().min(80).max(500).nullable().optional(),
});

/**
 * Full live plan pipeline for Next.js server actions.
 * Uses triggerAndWait internally (allowed inside a task); callers outside
 * Trigger should `.trigger()` this task and `runs.poll()` the handle.
 */
export const buildLivePlanTask = schemaTask({
  id: "build-live-plan",
  schema: z.object({
    wizard: wizardSchema,
  }),
  run: async ({ wizard }) => {
    logger.info("build-live-plan start", {
      sessionId: wizard.sessionId,
      durationMin: wizard.durationMin,
      startPreset: wizard.startPreset,
    });

    const generated = await generateRouteCandidatesTask.triggerAndWait({
      wizard,
    });
    if (!generated.ok) {
      throw new Error("generate-route-candidates failed");
    }

    const scored = await scoreAndEnrichRoutesTask.triggerAndWait({
      wizard,
      rawRoutes: generated.output.routes,
    });
    if (!scored.ok) {
      throw new Error("score-and-enrich-routes failed");
    }

    const plan = scored.output as PlanPayload;
    logger.info("build-live-plan done", {
      sessionId: wizard.sessionId,
      routes: plan.routes.length,
      sources: plan.routes.map((r) => r.source),
    });
    return plan;
  },
});
