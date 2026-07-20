import { generateObject } from "ai";
import { z } from "zod";

import { aiConfigured, getChatModel } from "./ai-model";
import type { RawRoute } from "./fallback-routes";
import { withTimeout } from "./fetch-timeout";
import { placeAwareRouteLabels, shortPlaceName } from "./route-labels";
import type { WizardState } from "./types";

const namesSchema = z.object({
  names: z.array(z.string().min(3).max(48)).length(3),
});

const AI_NAME_TIMEOUT_MS = 4000;

/**
 * Ask the configured AI for three local route titles.
 * Falls back to place-aware deterministic labels (never Amsterdam defaults off-preset).
 * Hard-timeout so a hung model cannot stall plan generation / the Next server.
 */
export async function nameRouteCandidates(
  wizard: WizardState,
  routes: RawRoute[],
): Promise<string[]> {
  const fallback = placeAwareRouteLabels(wizard);
  if (routes.length < 3) {
    return routes.map((_, i) => fallback[i] ?? `Route ${i + 1}`);
  }
  if (!aiConfigured()) return [...fallback];

  const place = shortPlaceName(wizard.startLabel);
  const naming = (async (): Promise<string[]> => {
    try {
      const model = getChatModel();
      const result = await generateObject({
        model,
        schema: namesSchema,
        prompt: [
          `Name three cycling training loop options near "${place}".`,
          `Start: ${wizard.startLabel ?? place} (${wizard.startLat.toFixed(4)}, ${wizard.startLng.toFixed(4)})`,
          `Duration ~${wizard.durationMin} min, intensity ${wizard.intensity}, terrain ${wizard.terrainBias}.`,
          "Route stats:",
          ...routes.slice(0, 3).map(
            (r, i) =>
              `${i + 1}. ${(r.distanceM / 1000).toFixed(1)} km, ${Math.round(r.elevGainM)} m climb, profile ${r.profile}`,
          ),
          "Return exactly 3 short, distinctive titles (no quotes).",
          "Use the local place name; do NOT use Amsterdam landmark names unless the start is in Amsterdam.",
          'Examples of good style: "Újbuda river tempo", "Gellért climb loop", "Margaret Island spin".',
        ].join("\n"),
      });
      const names = result.object.names.map((n) => n.trim()).filter(Boolean);
      if (names.length === 3) return names;
    } catch (err) {
      console.warn("AI route naming failed; using place-aware labels", err);
    }
    return [...fallback];
  })();

  return withTimeout(naming, AI_NAME_TIMEOUT_MS, [...fallback]);
}
