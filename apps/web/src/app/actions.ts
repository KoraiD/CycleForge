"use server";

import { auth, runs } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { randomUUID } from "node:crypto";
import {
  DEMO_ATHLETE_ID,
  suggestIntensityFromHistory,
  type RiderHistoryRide,
} from "@/lib/athlete-history";
import {
  ensureDemoAthleteSeeded,
  getHistoryContext,
  getMemoryPlan,
  upsertRiderHistoryRides,
  upsertTrainingBlock,
} from "@/lib/clickhouse";
import { attachCoachNote } from "@/lib/coach-note";
import { withTimeoutOrThrow } from "@/lib/fetch-timeout";
import { parseGpxRide } from "@/lib/parse-gpx";
import { parseGoalPrompt } from "@/lib/parse-goal";
import { buildPlan, mergeWizard } from "@/lib/plan-builder";
import { ensureRuntimeConfigLoaded } from "@/lib/runtime-config";
import {
  clearSession,
  getPlan,
  getSessionAthlete,
  getWizard,
  setPlan,
  setSessionAthlete,
  setWizard,
} from "@/lib/session-store";
import { toTaskWizard } from "@/lib/task-wizard";
import {
  buildTrainingBlockPlan,
  type TrainingBlockPlan,
} from "@/lib/training-block-plan";
import {
  DEFAULT_WIZARD,
  type HistoryContext,
  type PlanPayload,
  type WizardState,
} from "@/lib/types";
import { buildLivePlanTask } from "@/trigger/build-live-plan";

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

/**
 * How long to wait for the Trigger live-plan run before falling back to the
 * in-process ORS path. Must stay under the client's PLAN_BUILD_CLIENT_MS (60s)
 * so the local fallback still completes inside that window.
 */
const TRIGGER_POLL_MS = 40_000;

/**
 * Build a live plan: prefer Trigger ORS fan-out + score tasks (the real pipeline).
 * Falls back to in-process ORS only when Trigger is unavailable or fails.
 */
export async function generateDemoPlan(
  sessionId: string,
  patch: Partial<WizardState> = {},
): Promise<PlanPayload> {
  ensureRuntimeConfigLoaded();
  const base = getWizard(sessionId) ?? DEFAULT_WIZARD(sessionId);
  const fromText =
    typeof patch.goalsText === "string" && patch.goalsText.trim()
      ? parseGoalPrompt(patch.goalsText)
      : {};
  // Explicit patch fields win over text parsing.
  const wizard = mergeWizard(base, {
    ...fromText,
    ...patch,
    confirmed: true,
  });
  setWizard(wizard);

  if (process.env.TRIGGER_SECRET_KEY) {
    try {
      // triggerAndWait is illegal outside a task.run(); trigger + poll instead.
      const handle = await buildLivePlanTask.trigger({
        wizard: toTaskWizard(wizard),
      });
      // Cap the poll: with no local Trigger worker the run never completes and
      // would block for minutes (until the cloud cancels it) — long past the
      // client's 60s timeout. Bail to the in-process fallback well before that.
      const run = await withTimeoutOrThrow(
        runs.poll(handle, { pollIntervalMs: 900 }),
        TRIGGER_POLL_MS,
        `build-live-plan did not finish within ${TRIGGER_POLL_MS / 1000}s`,
      );
      if (!run.isSuccess || !run.output) {
        throw new Error(
          `build-live-plan ended with status ${run.status ?? "unknown"}`,
        );
      }
      const plan = run.output as PlanPayload;
      setPlan(plan);
      return plan;
    } catch (err) {
      console.warn(
        "Trigger live plan failed; falling back to in-process ORS",
        err,
      );
    }
  }

  const plan = await buildPlan(wizard);
  setPlan(plan);
  return plan;
}

/** Wipe plan/wizard/athlete for this browser session (demo reset). */
export async function resetSessionAction(sessionId: string): Promise<void> {
  clearSession(sessionId);
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

/** Persist a plan payload from the client (e.g. agent tool output) into the Next store. */
export async function persistPlanAction(plan: PlanPayload): Promise<void> {
  setWizard(plan.wizard);
  setPlan(plan);
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

/**
 * Import a GPX export (Strava / Garmin / TrainingPeaks) into rider_history_rides.
 * Full OAuth connectors are out of scope for the hackathon; GPX is the portable path.
 */
export async function uploadGpxHistoryAction(
  sessionId: string,
  gpxXml: string,
  fileName?: string,
): Promise<{ history: HistoryContext; rideLabel: string }> {
  const parsed = parseGpxRide(
    gpxXml,
    fileName?.replace(/\.gpx$/i, "") || "Uploaded ride",
  );
  const athleteId = `upload-${sessionId.slice(0, 12)}`;
  const ride: RiderHistoryRide = {
    athleteId,
    rideId: `gpx-${randomUUID().slice(0, 12)}`,
    startedAt: parsed.startedAt,
    label: parsed.label,
    distanceM: parsed.distanceM,
    durationS: parsed.durationS,
    elevGainM: parsed.elevGainM,
    tssEst: parsed.tssEst,
    intensity: parsed.intensity,
    source: "upload",
  };

  await upsertRiderHistoryRides([ride], { merge: true });
  setSessionAthlete(sessionId, athleteId);

  const history = await getHistoryContext(athleteId, "Your GPX uploads");
  if (!history) {
    throw new Error("Upload saved but history could not be summarized.");
  }

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

  return { history, rideLabel: ride.label };
}

/** Build a 4-day microcycle and persist to ClickHouse training_blocks. */
export async function createTrainingBlockAction(
  sessionId: string,
): Promise<TrainingBlockPlan> {
  const wizard = getWizard(sessionId) ?? DEFAULT_WIZARD(sessionId);
  const athleteId =
    getSessionAthlete(sessionId) ?? `session-${sessionId.slice(0, 12)}`;
  const history = await getHistoryContext(athleteId);
  const block = buildTrainingBlockPlan({
    sessionId,
    athleteId,
    wizard,
    history,
    blockId: randomUUID(),
  });

  await upsertTrainingBlock({
    blockId: block.blockId,
    sessionId: block.sessionId,
    athleteId: block.athleteId,
    label: block.label,
    notes: block.notes,
    totalTargetTss: block.totalTargetTss,
    daysJson: JSON.stringify(block.days),
  });

  return block;
}
