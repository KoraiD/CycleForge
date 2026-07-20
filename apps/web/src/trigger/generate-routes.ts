import { schemaTask, logger } from "@trigger.dev/sdk";
import { z } from "zod";
import { fetchOrsRouteBatch } from "./fetch-ors-route";

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

export const generateRouteCandidatesTask = schemaTask({
  id: "generate-route-candidates",
  schema: z.object({
    wizard: wizardSchema,
  }),
  run: async ({ wizard }) => {
    logger.info("Generating route candidates", {
      sessionId: wizard.sessionId,
      durationMin: wizard.durationMin,
      intensity: wizard.intensity,
    });

    // Durable fan-out: batch task runs 3 parallel `fetch-ors-route` children
    const result = await fetchOrsRouteBatch.triggerAndWait({ wizard });
    if (!result.ok) {
      throw new Error("ORS batch task failed");
    }

    logger.info("Generated routes", {
      count: result.output.routes.length,
      sources: result.output.routes.map((r) => r.source),
      sessionId: wizard.sessionId,
    });
    return { routes: result.output.routes };
  },
});
