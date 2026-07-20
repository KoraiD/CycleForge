"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { buildPlan, mergeWizard } from "@/lib/plan-builder";
import { getWizard, setPlan, setWizard } from "@/lib/session-store";
import { DEFAULT_WIZARD, type PlanPayload, type WizardState } from "@/lib/types";

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
