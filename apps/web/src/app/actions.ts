"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { DEMO_ATHLETE_ID, suggestIntensityFromHistory } from "@/lib/athlete-history";
import {
  ensureDemoAthleteSeeded,
  getHistoryContext,
  getMemoryPlan,
} from "@/lib/clickhouse";
import { attachCoachNote } from "@/lib/coach-note";
import { buildPlan, mergeWizard } from "@/lib/plan-builder";
import {
  getPlan,
  getSessionAthlete,
  getWizard,
  setPlan,
  setSessionAthlete,
  setWizard,
} from "@/lib/session-store";
import {
  DEFAULT_WIZARD,
  type HistoryContext,
  type PlanPayload,
  type WizardState,
} from "@/lib/types";

const startChatSessionRaw = chat.createStartSessionAction("cycleforge-agent");

function assertTriggerConfigured() {
  if (!process.env.TRIGGER_SECRET_KEY) {
    throw new Error("TRIGGER_SECRET_KEY is not configured");
  }
}

export async function startChatSession(
  ...args: Parameters<typeof startChatSessionRaw>
) {
  assertTriggerConfigured();
  return startChatSessionRaw(...args);
}

export async function mintChatAccessToken(chatId: string) {
  assertTriggerConfigured();
  return auth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  });
}

/** Local/demo path when Trigger/Google AI are not configured. */
export async function generateDemoPlan(
  sessionId: string,
  patch: Partial<WizardState> = {},
): Promise<PlanPayload> {
  const base = getWizard(sessionId) ?? DEFAULT_WIZARD(sessionId);
  const wizard = mergeWizard(base, { ...patch, confirmed: true });
  setWizard(wizard);
  const plan = await buildPlan(wizard);
  setPlan(plan);
  return plan;
}

export async function updateWizardAction(
  sessionId: string,
  patch: Partial<WizardState>,
): Promise<WizardState> {
  const current = getWizard(sessionId);
  const next = mergeWizard(current, patch);
  setWizard(next);
  return next;
}

/** Load a plan for the summary page (store/cache, then CH/memory routes). */
export async function getPlanAction(
  sessionId: string,
): Promise<PlanPayload | null> {
  const fromStore = getPlan(sessionId);
  if (fromStore) return fromStore;
  return getMemoryPlan(sessionId);
}

/** Persist selection so `/summary/[sessionId]` reflects the chosen route. */
export async function selectRouteAction(
  sessionId: string,
  routeId: string,
): Promise<PlanPayload | null> {
  const plan = getPlan(sessionId) ?? (await getMemoryPlan(sessionId));
  if (!plan) return null;
  if (!plan.routes.some((r) => r.routeId === routeId)) return plan;
  const next = attachCoachNote({ ...plan, selectedRouteId: routeId });
  setPlan(next);
  return next;
}

/**
 * G2: load fixture demo athlete into ClickHouse (or memory), bind to session.
 * Soft-nudges intensity only when recent load suggests recovery.
 */
export async function loadDemoAthleteAction(sessionId: string): Promise<{
  history: HistoryContext;
  wizard: WizardState;
}> {
  const history = await ensureDemoAthleteSeeded();
  setSessionAthlete(sessionId, DEMO_ATHLETE_ID);

  const current = getWizard(sessionId);
  const suggested = suggestIntensityFromHistory(history, current.intensity);
  const wizard = suggested
    ? mergeWizard(current, { intensity: suggested })
    : current;
  if (suggested) setWizard(wizard);

  const plan = getPlan(sessionId);
  if (plan) {
    setPlan(attachCoachNote({ ...plan, historyContext: history, wizard }));
  }

  return { history, wizard };
}

export async function getSessionHistoryAction(
  sessionId: string,
): Promise<HistoryContext | null> {
  const athleteId = getSessionAthlete(sessionId);
  if (!athleteId) return null;
  return getHistoryContext(athleteId);
}
