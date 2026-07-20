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
  avoidBusyRoads: z.boolean(),
  confirmed: z.boolean(),
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

    // Durable child task: parallel ORS fan-out lives inside fetch-ors-route-batch
    const result = await fetchOrsRouteBatch.triggerAndWait({ wizard });
    if (!result.ok) {
      throw new Error("ORS batch task failed");
    }

    logger.info("Generated routes", {
      count: result.output.routes.length,
      sources: result.output.routes.map((r) => r.source),
    });
    return { routes: result.output.routes };
  },
});
