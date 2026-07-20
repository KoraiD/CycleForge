import { DEFAULT_WIZARD, type PlanPayload, type WizardState } from "./types";

const wizards = new Map<string, WizardState>();
const plans = new Map<string, PlanPayload>();

export function getWizard(sessionId: string): WizardState {
  const existing = wizards.get(sessionId);
  if (existing) return existing;
  const created = DEFAULT_WIZARD(sessionId);
  wizards.set(sessionId, created);
  return created;
}

export function setWizard(wizard: WizardState): void {
  wizards.set(wizard.sessionId, wizard);
}

export function getPlan(sessionId: string): PlanPayload | undefined {
  return plans.get(sessionId);
}

export function setPlan(plan: PlanPayload): void {
  plans.set(plan.sessionId, plan);
}
