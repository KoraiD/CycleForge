import type { WizardState } from "./types";

/** Payload shape shared by Trigger ORS / score tasks (no process-local session store). */
export type TaskWizard = {
  sessionId: string;
  goalsText: string;
  durationMin: number;
  intensity: WizardState["intensity"];
  terrainBias: WizardState["terrainBias"];
  startPreset: WizardState["startPreset"];
  startLat: number;
  startLng: number;
  startLabel?: string;
  avoidBusyRoads: boolean;
  confirmed: boolean;
  ftpWatts?: number | null;
};

export function toTaskWizard(wizard: WizardState): TaskWizard {
  return {
    sessionId: wizard.sessionId,
    goalsText: wizard.goalsText,
    durationMin: wizard.durationMin,
    intensity: wizard.intensity,
    terrainBias: wizard.terrainBias,
    startPreset: wizard.startPreset,
    startLat: wizard.startLat,
    startLng: wizard.startLng,
    startLabel: wizard.startLabel,
    avoidBusyRoads: wizard.avoidBusyRoads,
    confirmed: wizard.confirmed,
    ftpWatts: wizard.ftpWatts,
  };
}

export function fromTaskWizard(wizard: TaskWizard): WizardState {
  return {
    sessionId: wizard.sessionId,
    goalsText: wizard.goalsText,
    durationMin: wizard.durationMin,
    intensity: wizard.intensity,
    terrainBias: wizard.terrainBias,
    startPreset: wizard.startPreset,
    startLat: wizard.startLat,
    startLng: wizard.startLng,
    startLabel: wizard.startLabel ?? "",
    avoidBusyRoads: wizard.avoidBusyRoads,
    confirmed: wizard.confirmed,
    ftpWatts: wizard.ftpWatts ?? null,
  };
}
