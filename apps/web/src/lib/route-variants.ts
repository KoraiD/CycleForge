import { targetDistanceM } from "./scoring";
import type { WizardState } from "./types";

export type RouteVariant = {
  label: string;
  profile: string;
  lengthFactor: number;
  points: number;
  seed: number;
};

/** Placeholder labels — real titles are place-aware / AI-named at generation time. */
export const ROUTE_VARIANTS: RouteVariant[] = [
  {
    label: "Candidate A",
    profile: "endurance-flat",
    lengthFactor: 0.92,
    points: 3,
    seed: 1,
  },
  {
    label: "Candidate B",
    profile: "rolling-endurance",
    lengthFactor: 1.0,
    points: 4,
    seed: 7,
  },
  {
    label: "Candidate C",
    profile: "hilly-loop",
    lengthFactor: 1.12,
    points: 5,
    seed: 13,
  },
];

export function variantLengthM(wizard: WizardState, variant: RouteVariant): number {
  return targetDistanceM(wizard) * variant.lengthFactor;
}
