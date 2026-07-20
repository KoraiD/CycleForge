import type { Intensity, TerrainBias, WizardState } from "./types";

/** Extract wizard fields from free-text training goals. */
export function parseGoalPrompt(text: string): Partial<WizardState> {
  const patch: Partial<WizardState> = { goalsText: text };
  const lower = text.toLowerCase();

  const minutes =
    text.match(
      /(\d{1,3})\s*(?:min(?:ute)?s?|m\b)/i,
    ) ?? text.match(/(\d{1,3})\s*['′]?\s*(?:min)/i);
  if (minutes) {
    const n = Number(minutes[1]);
    if (Number.isFinite(n)) {
      patch.durationMin = Math.min(300, Math.max(30, Math.round(n)));
    }
  } else {
    const hours = text.match(/(\d+(?:[.,]\d+)?)\s*h(?:ours?)?\b/i);
    if (hours) {
      const n = Number(hours[1].replace(",", "."));
      if (Number.isFinite(n)) {
        patch.durationMin = Math.min(300, Math.max(30, Math.round(n * 60)));
      }
    }
  }

  if (/\b(recovery|easy|recovery\s*spin|very\s*easy)\b/i.test(lower)) {
    patch.intensity = "easy" satisfies Intensity;
  } else if (/\b(tempo|threshold|sweet\s*spot)\b/i.test(lower)) {
    patch.intensity = "tempo";
  } else if (/\b(hills?|climbs?|climbing|vo2)\b/i.test(lower)) {
    patch.intensity = "hills";
  } else if (/\b(endurance|steady|zone\s*2|z2)\b/i.test(lower)) {
    patch.intensity = "endurance";
  }

  if (/\b(flat|pancake|no\s*climb)\b/i.test(lower)) {
    patch.terrainBias = "flat" satisfies TerrainBias;
  } else if (/\b(hilly|hills|climbs?|climbing)\b/i.test(lower)) {
    patch.terrainBias = "hilly";
  } else if (/\b(rolling|undulating)\b/i.test(lower)) {
    patch.terrainBias = "rolling";
  }

  if (/\b(avoid\s+busy|quiet(er)?\s+roads?|prefer\s+quiet)\b/i.test(lower)) {
    patch.avoidBusyRoads = true;
  } else if (/\b(busy\s+roads?\s+ok|main\s+roads?\s+ok)\b/i.test(lower)) {
    patch.avoidBusyRoads = false;
  }

  return patch;
}
