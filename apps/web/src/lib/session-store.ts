import { cachePlan, readCachedPlan } from "./plan-cache";
import { DEFAULT_WIZARD, type PlanPayload, type WizardState } from "./types";

const globalStore = globalThis as typeof globalThis & {
  __cycleforgeWizards?: Map<string, WizardState>;
  __cycleforgePlans?: Map<string, PlanPayload>;
};

const wizards =
  globalStore.__cycleforgeWizards ??
  (globalStore.__cycleforgeWizards = new Map<string, WizardState>());
const plans =
  globalStore.__cycleforgePlans ??
  (globalStore.__cycleforgePlans = new Map<string, PlanPayload>());

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
  return plans.get(sessionId) ?? readCachedPlan(sessionId) ?? undefined;
}

export function setPlan(plan: PlanPayload): void {
  plans.set(plan.sessionId, plan);
  cachePlan(plan);
}
