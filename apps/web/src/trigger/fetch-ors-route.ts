import { schemaTask, logger } from "@trigger.dev/sdk";
import { z } from "zod";
import { generateRawRoutes } from "@/lib/ors";
import type { WizardState } from "@/lib/types";

/**
 * Parallel fan-out entry used by generate-route-candidates.
 * Kept as its own task so the Trigger dashboard shows concurrent ORS work.
 */
export const fetchOrsRouteBatch = schemaTask({
  id: "fetch-ors-route-batch",
  schema: z.object({
    wizard: z.object({
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
    }),
  }),
  run: async ({ wizard }) => {
    logger.info("ORS batch start", { sessionId: wizard.sessionId });
    const routes = await generateRawRoutes(wizard as WizardState);
    return { routes };
  },
});
