import type { Intensity, TerrainBias, WizardState } from "./types";

/** Short place token from a start label ("Újbuda-központ" → "Újbuda"). */
export function shortPlaceName(startLabel?: string): string {
  if (!startLabel) return "Local";
  const cleaned = startLabel
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/^Pin\s+/i, "")
    .trim();
  if (!cleaned || /^pick a start/i.test(cleaned)) return "Local";
  // Prefer the first meaningful segment before comma / en-dash clutter.
  const head = cleaned.split(",")[0]?.trim() ?? cleaned;
  const token = head.split(/[-–—]/)[0]?.trim() || head;
  if (token.length <= 28) return token;
  return `${token.slice(0, 26)}…`;
}

const STYLE_BY_SLOT: Array<{
  intensityBias: Intensity[];
  terrainBias: TerrainBias[];
  word: string;
}> = [
  {
    intensityBias: ["easy", "endurance"],
    terrainBias: ["flat", "rolling"],
    word: "easy spin",
  },
  {
    intensityBias: ["endurance", "tempo"],
    terrainBias: ["rolling", "hilly"],
    word: "tempo loop",
  },
  {
    intensityBias: ["tempo", "hills"],
    terrainBias: ["hilly", "rolling"],
    word: "climber",
  },
];

/** Place-aware candidate titles used when AI naming is unavailable. */
export function placeAwareRouteLabels(wizard: WizardState): [string, string, string] {
  const place = shortPlaceName(wizard.startLabel);
  const km = Math.max(8, Math.round((wizard.durationMin * 0.35) / 5) * 5);
  const words = STYLE_BY_SLOT.map((slot, i) => {
    const preferTerrain = slot.terrainBias.includes(wizard.terrainBias);
    const preferIntensity = slot.intensityBias.includes(wizard.intensity);
    let word = slot.word;
    if (wizard.terrainBias === "flat" && i === 0) word = "canal cruise";
    if (wizard.terrainBias === "hilly" && i === 2) word = "hill push";
    if (wizard.intensity === "easy" && i === 0) word = "recovery loop";
    if (wizard.intensity === "tempo" && preferIntensity) word = "tempo rip";
    if (!preferTerrain && i === 1) word = "rolling loop";
    return `${place} ${word} · ${km + i * 4} km`;
  });
  return [words[0], words[1], words[2]];
}
