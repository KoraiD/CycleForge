import { DEFAULT_WIZARD, type WizardState } from "./types";

export function makeWizard(overrides: Partial<WizardState> = {}): WizardState {
  return {
    ...DEFAULT_WIZARD("test-session"),
    goalsText: "90 min endurance near Amsterdam",
    durationMin: 90,
    intensity: "endurance",
    terrainBias: "rolling",
    startPreset: "vondelpark",
    avoidBusyRoads: true,
    confirmed: true,
    ...overrides,
  };
}
