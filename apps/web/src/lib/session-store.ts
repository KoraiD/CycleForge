import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { cachePlan, readCachedPlan } from "./plan-cache";
import { DEFAULT_WIZARD, type PlanPayload, type WizardState } from "./types";

const globalStore = globalThis as typeof globalThis & {
  __cycleforgeWizards?: Map<string, WizardState>;
  __cycleforgePlans?: Map<string, PlanPayload>;
  __cycleforgeAthletes?: Map<string, string>;
};

const wizards =
  globalStore.__cycleforgeWizards ??
  (globalStore.__cycleforgeWizards = new Map<string, WizardState>());
const plans =
  globalStore.__cycleforgePlans ??
  (globalStore.__cycleforgePlans = new Map<string, PlanPayload>());
const athletes =
  globalStore.__cycleforgeAthletes ??
  (globalStore.__cycleforgeAthletes = new Map<string, string>());

const ATHLETE_DIR = join(process.cwd(), ".data", "athletes");

function cacheAthleteBinding(sessionId: string, athleteId: string): void {
  try {
    if (!existsSync(ATHLETE_DIR)) mkdirSync(ATHLETE_DIR, { recursive: true });
    writeFileSync(join(ATHLETE_DIR, `${sessionId}.txt`), athleteId, "utf8");
  } catch (err) {
    console.warn("cacheAthleteBinding failed", err);
  }
}

function readCachedAthlete(sessionId: string): string | undefined {
  const path = join(ATHLETE_DIR, `${sessionId}.txt`);
  if (!existsSync(path)) return undefined;
  try {
    const id = readFileSync(path, "utf8").trim();
    return id || undefined;
  } catch {
    return undefined;
  }
}

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

export function setSessionAthlete(sessionId: string, athleteId: string): void {
  athletes.set(sessionId, athleteId);
  cacheAthleteBinding(sessionId, athleteId);
}

export function getSessionAthlete(sessionId: string): string | undefined {
  return athletes.get(sessionId) ?? readCachedAthlete(sessionId);
}
