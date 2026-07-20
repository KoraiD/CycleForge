"use client";

import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import {
  useTriggerChatTransport,
  type InferChatUIMessage,
} from "@trigger.dev/sdk/chat/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createTrainingBlockAction,
  generateDemoPlan,
  getPlanAction,
  getSessionHistoryAction,
  loadDemoAthleteAction,
  mintChatAccessToken,
  persistPlanAction,
  selectRouteAction,
  startChatSession,
  updateWizardAction,
  uploadGpxHistoryAction,
} from "@/app/actions";
import type { TrainingBlockPlan } from "@/lib/training-block-plan";
import type { cycleforgeAgent } from "@/trigger/cycleforge-agent";
import { getOrCreateBrowserSessionId } from "@/lib/browser-session";
import { attachCoachNote } from "@/lib/coach-note";
import { START_PRESETS } from "@/lib/constants";
import {
  DEFAULT_WIZARD,
  type HistoryContext,
  type PlanPayload,
  type WizardState,
} from "@/lib/types";
import { BrandMark } from "./brand-mark";
import { PlanPanel, type PlanTweak } from "./plan-panel";
import { Wizard } from "./wizard";

type Msg = InferChatUIMessage<typeof cycleforgeAgent>;

function planRouteKey(plan: PlanPayload): string {
  return plan.routes.map((r) => r.routeId).join("|");
}

type ToolActivity = {
  name: string;
  state: string;
};

function extractFromMessages(messages: Msg[]): {
  plan: PlanPayload | null;
  wizard: WizardState | null;
  toolError: string | null;
  activities: ToolActivity[];
} {
  let plan: PlanPayload | null = null;
  let wizard: WizardState | null = null;
  let toolError: string | null = null;
  const activities: ToolActivity[] = [];

  for (const message of messages) {
    for (const part of message.parts) {
      if (!part.type.startsWith("tool-")) continue;
      const toolPart = part as {
        type: string;
        state?: string;
        output?: {
          ui?: string;
          plan?: PlanPayload;
          wizard?: WizardState;
          error?: string;
        };
      };
      const name = toolPart.type.replace("tool-", "");
      activities.push({ name, state: toolPart.state ?? "unknown" });

      if (toolPart.state && toolPart.state !== "output-available") continue;
      const output = toolPart.output;
      if (!output) continue;
      if (output.ui === "error" && output.error) {
        toolError = output.error;
      }
      if (output.plan) plan = output.plan;
      if (output.wizard) wizard = output.wizard;
    }
  }
  return { plan, wizard, toolError, activities };
}

const TOOL_LABELS: Record<string, string> = {
  upsert_wizard_state: "Updating goals",
  load_demo_athlete: "Loading athlete",
  generate_route_candidates: "Building routes",
  refine_plan: "Refining plan",
  select_route: "Selecting route",
  score_and_enrich_routes: "Scoring in ClickHouse",
};

function toolProgressChips(activities: ToolActivity[]): string[] {
  const seen = new Set<string>();
  const chips: string[] = [];
  for (const a of activities) {
    const label = TOOL_LABELS[a.name] ?? a.name.replaceAll("_", " ");
    if (seen.has(label)) continue;
    seen.add(label);
    chips.push(label);
  }
  return chips;
}

function generatingSteps(activities: ToolActivity[]): string[] {
  const names = new Set(activities.map((a) => a.name));
  const steps = ["Reading goals"];
  if (names.has("upsert_wizard_state")) steps.push("Updating wizard");
  if (names.has("load_demo_athlete")) steps.push("Loading athlete history");
  if (
    names.has("generate_route_candidates") ||
    names.has("refine_plan")
  ) {
    steps.push("Fetching routes (ORS fan-out)");
    steps.push("Scoring in ClickHouse");
  }
  if (names.has("select_route")) steps.push("Selecting route");
  return steps;
}

export function Chat() {
  const [sessionId] = useState(() => getOrCreateBrowserSessionId());
  const [input, setInput] = useState("");
  const [localWizard, setLocalWizard] = useState<WizardState>(() =>
    DEFAULT_WIZARD(sessionId),
  );
  const [wizardDirty, setWizardDirty] = useState(false);
  const [demoPlan, setDemoPlan] = useState<PlanPayload | null>(null);
  const [history, setHistory] = useState<HistoryContext | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [agentConfigured, setAgentConfigured] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectingRoute, setSelectingRoute] = useState(false);
  const [uploadingGpx, setUploadingGpx] = useState(false);
  const [trainingBlock, setTrainingBlock] = useState<TrainingBlockPlan | null>(
    null,
  );
  const [blockBusy, setBlockBusy] = useState(false);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  /** Route-id fingerprints already shown — avoids agent plans being shadowed by stale demoPlan. */
  const seenPlanKeys = useRef(new Set<string>());

  const adoptPlan = (plan: PlanPayload) => {
    seenPlanKeys.current.add(planRouteKey(plan));
    setDemoPlan(plan);
  };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health")
      .then((r) => r.json())
      .then(
        (health: {
          triggerConfigured?: boolean;
          googleConfigured?: boolean;
        }) => {
          if (!cancelled) {
            setAgentConfigured(
              Boolean(health.triggerConfigured && health.googleConfigured),
            );
          }
        },
      )
      .catch(() => {
        if (!cancelled) setAgentConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore plan/history after navigating back from /summary.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [storedPlan, storedHistory] = await Promise.all([
          getPlanAction(sessionId),
          getSessionHistoryAction(sessionId),
        ]);
        if (cancelled) return;
        if (storedPlan) {
          seenPlanKeys.current.add(planRouteKey(storedPlan));
          setDemoPlan(storedPlan);
          setLocalWizard(storedPlan.wizard);
          setWizardDirty(true);
        }
        if (storedHistory) setHistory(storedHistory);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const transport = useTriggerChatTransport<typeof cycleforgeAgent>({
    task: "cycleforge-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    clientData: { sessionId },
  });

  const { messages, sendMessage, status, error } = useChat<Msg>({
    transport,
  });

  const agentEnabled = agentConfigured && !error;
  const extracted = useMemo(() => extractFromMessages(messages), [messages]);

  // Adopt new agent tool plans (regenerate/refine) that would otherwise be
  // shadowed by a stale demoPlan from hydration or a previous local build.
  useEffect(() => {
    if (!extracted.plan) return;
    const key = planRouteKey(extracted.plan);
    if (seenPlanKeys.current.has(key)) return;
    seenPlanKeys.current.add(key);
    setDemoPlan(extracted.plan);
    setLocalWizard(extracted.plan.wizard);
    setWizardDirty(true);
    void persistPlanAction(extracted.plan);
  }, [extracted.plan]);

  const rawPlan = demoPlan ?? extracted.plan;
  const plan =
    rawPlan && history
      ? { ...rawPlan, historyContext: rawPlan.historyContext ?? history }
      : rawPlan;
  const wizard =
    !wizardDirty && extracted.wizard ? extracted.wizard : localWizard;

  const busy = status === "streaming" || status === "submitted" || pending;
  const displayError =
    localError ??
    extracted.toolError ??
    (error ? "Agent transport error — switched to local demo path." : null);

  const submitText = (text: string) => {
    if (!text.trim()) return;
    setLocalError(null);
    if (agentEnabled) {
      void sendMessage({ text });
    }
  };

  const onWizardChange = (patch: Partial<WizardState>) => {
    setWizardDirty(true);
    setLocalWizard((prev) => {
      const base = !wizardDirty && extracted.wizard ? extracted.wizard : prev;
      const next = { ...base, ...patch };
      if (patch.startPreset && patch.startPreset !== "custom") {
        const p = START_PRESETS[patch.startPreset];
        next.startLat = p.lat;
        next.startLng = p.lng;
        next.startLabel = patch.startLabel ?? p.label;
      }
      return next;
    });
    startTransition(async () => {
      await updateWizardAction(sessionId, patch);
    });
  };

  const onConfirmWizard = () => {
    setLocalError(null);
    startTransition(async () => {
      const confirmed = { ...wizard, confirmed: true };
      setLocalWizard(confirmed);
      setWizardDirty(true);
      // Always rebuild on the Next server so the map updates immediately.
      // Agent chat (if available) runs in parallel and must not block the UI.
      try {
        const built = await generateDemoPlan(sessionId, confirmed);
        adoptPlan(built);
        setLocalWizard(built.wizard);
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Could not generate routes.",
        );
        return;
      }
      if (agentEnabled) {
        const prompt = `Confirm wizard and generate routes. durationMin=${confirmed.durationMin}, intensity=${confirmed.intensity}, terrainBias=${confirmed.terrainBias}, startPreset=${confirmed.startPreset}, startLabel=${confirmed.startLabel}, startLat=${confirmed.startLat}, startLng=${confirmed.startLng}, avoidBusyRoads=${confirmed.avoidBusyRoads}, ftpWatts=${confirmed.ftpWatts}. Goals: ${confirmed.goalsText || "endurance ride"}`;
        void sendMessage({ text: prompt }).catch(() => {
          setAgentConfigured(false);
        });
      }
    });
  };

  const onSelectRoute = (routeId: string) => {
    const base = demoPlan ?? extracted.plan;
    if (base) {
      setDemoPlan(attachCoachNote({ ...base, selectedRouteId: routeId }));
    }
    setSelectingRoute(true);
    const clearTimer = window.setTimeout(() => setSelectingRoute(false), 900);
    startTransition(async () => {
      try {
        await selectRouteAction(sessionId, routeId);
      } finally {
        window.clearTimeout(clearTimer);
        setSelectingRoute(false);
      }
    });
    // Sync agent in the background — don't block the map on first switch.
    if (agentEnabled) {
      void sendMessage({ text: `Select route ${routeId}` }).catch(() => {
        setAgentConfigured(false);
      });
    }
  };

  const regenerateWithPatch = (
    patch: Partial<WizardState>,
    agentPrompt?: string,
  ) => {
    setLocalError(null);
    const nextWizard = { ...wizard, ...patch, confirmed: true };
    setLocalWizard(nextWizard);
    setWizardDirty(true);

    startTransition(async () => {
      // UI-owned regenerate: always rebuild locally first so new routes paint.
      // Previously agent-only path returned early and stale demoPlan hid tool output.
      try {
        const built = await generateDemoPlan(sessionId, nextWizard);
        adoptPlan(built);
        setLocalWizard(built.wizard);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Refine failed.");
        return;
      }
      if (agentEnabled && agentPrompt) {
        void sendMessage({ text: agentPrompt }).catch(() => {
          setAgentConfigured(false);
        });
      }
    });
  };

  const onRefine = (kind: "shorter" | "hillier" | "easier") => {
    const patch: Partial<WizardState> =
      kind === "shorter"
        ? { durationMin: Math.max(30, wizard.durationMin - 20) }
        : kind === "hillier"
          ? { terrainBias: "hilly", intensity: "hills" }
          : { intensity: "easy", terrainBias: "flat" };
    const prompt =
      kind === "shorter"
        ? "Make it shorter — about 20 minutes less."
        : kind === "hillier"
          ? "Make it hillier — more climbing."
          : "Make it easier — flatter and recovery pace.";
    regenerateWithPatch(patch, prompt);
  };

  const onApplyTweaks = (tweak: PlanTweak) => {
    const { preset: _preset, ...patch } = tweak;
    regenerateWithPatch(
      patch,
      `Regenerate with durationMin=${patch.durationMin ?? wizard.durationMin}, intensity=${patch.intensity ?? wizard.intensity}, terrainBias=${patch.terrainBias ?? wizard.terrainBias}, avoidBusyRoads=${patch.avoidBusyRoads ?? wizard.avoidBusyRoads}, ftpWatts=${patch.ftpWatts ?? wizard.ftpWatts}.`,
    );
  };

  const onCreateTrainingBlock = () => {
    setLocalError(null);
    setBlockBusy(true);
    startTransition(async () => {
      try {
        const block = await createTrainingBlockAction(sessionId);
        setTrainingBlock(block);
      } catch (err) {
        setLocalError(
          err instanceof Error
            ? err.message
            : "Could not save training block to ClickHouse.",
        );
      } finally {
        setBlockBusy(false);
      }
    });
  };

  const loadDemoAthlete = () => {
    setLocalError(null);
    startTransition(async () => {
      try {
        const result = await loadDemoAthleteAction(sessionId);
        setHistory(result.history);
        setLocalWizard(result.wizard);
        setWizardDirty(true);
        if (demoPlan) {
          adoptPlan(
            attachCoachNote({
              ...demoPlan,
              historyContext: result.history,
              wizard: result.wizard,
            }),
          );
        }
      } catch (err) {
        setLocalError(
          err instanceof Error
            ? err.message
            : "Could not load demo athlete history.",
        );
      }
    });
  };

  const onGpxSelected = (file: File | null) => {
    if (!file) return;
    setLocalError(null);
    setUploadingGpx(true);
    startTransition(async () => {
      try {
        const xml = await file.text();
        const result = await uploadGpxHistoryAction(
          sessionId,
          xml,
          file.name,
        );
        setHistory(result.history);
        if (demoPlan ?? extracted.plan) {
          const base = demoPlan ?? extracted.plan!;
          adoptPlan(
            attachCoachNote({
              ...base,
              historyContext: result.history,
            }),
          );
        }
      } catch (err) {
        setLocalError(
          err instanceof Error
            ? err.message
            : "Could not import that GPX file.",
        );
      } finally {
        setUploadingGpx(false);
        if (gpxInputRef.current) gpxInputRef.current.value = "";
      }
    });
  };

  const runQuickDemo = () => {
    const prompt =
      "I have 90 minutes tomorrow morning near Amsterdam — endurance ride, some hills if possible, avoid busy roads.";
    setInput("");
    setLocalError(null);
    setWizardDirty(true);
    setLocalWizard((w) => ({ ...w, goalsText: prompt }));
    startTransition(async () => {
      if (agentEnabled) {
        try {
          await sendMessage({ text: prompt });
          return;
        } catch (err) {
          console.warn("Agent demo send failed, falling back", err);
          setAgentConfigured(false);
        }
      }
      try {
        const built = await generateDemoPlan(sessionId, {
          goalsText: prompt,
          durationMin: 90,
          intensity: "endurance",
          terrainBias: "rolling",
          startPreset: "custom",
          startLat: 52.3577,
          startLng: 4.8686,
          startLabel: "Vondelpark",
          avoidBusyRoads: true,
          confirmed: true,
        });
        adoptPlan(built);
        setLocalWizard(built.wizard);
      } catch (err) {
        console.error("Demo plan generation failed", err);
        setLocalError(
          err instanceof Error
            ? err.message
            : "Demo plan generation failed. Check ORS / ClickHouse keys.",
        );
      }
    });
  };

  const showWizard = Boolean(
    extracted.wizard || localWizard.goalsText || demoPlan,
  );
  const steps = generatingSteps(extracted.activities);
  const progressChips = useMemo(
    () => toolProgressChips(extracted.activities),
    [extracted.activities],
  );

  return (
    <div className="shell">
      <aside className="chat-pane">
        <header className="chat-pane__header">
          <div className="chat-pane__brand-row">
            <BrandMark withWordmark size={32} />
            <Link href="/stack" className="ghost chat-stack-link">
              Stack
            </Link>
          </div>
          <p className="tagline">Visual training plans — not walls of text</p>
        </header>

        <div className="messages">
          {hydrated && messages.length === 0 && !demoPlan && (
            <div className="empty">
              <p>
                Tell me a training goal or trip idea. I&apos;ll open a wizard,
                then put routes on a map with elevation and training effect.
              </p>
              <div className="empty-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={runQuickDemo}
                  disabled={busy}
                >
                  Try the demo prompt
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={loadDemoAthlete}
                  disabled={busy || Boolean(history)}
                >
                  {history ? "Demo athlete loaded" : "Load demo athlete history"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy || uploadingGpx}
                  onClick={() => gpxInputRef.current?.click()}
                >
                  {uploadingGpx ? "Importing GPX…" : "Upload GPX history"}
                </button>
              </div>
              <p className="upload-note">
                Strava / Garmin / TrainingPeaks OAuth is out of scope — export
                GPX from those apps and upload it for ClickHouse coaching history.
              </p>
            </div>
          )}

          {history && (
            <p className="history-chip" title={history.summaryLine}>
              {history.source === "upload" ? "Your data" : "Athlete"} ·{" "}
              {history.hoursLast7d}h / TSS {history.tssLast7d} last 7d
              {history.lastHardLabel
                ? ` · hard ${history.lastHardDaysAgo}d ago`
                : ""}
            </p>
          )}

          {(showWizard || demoPlan || history) &&
          !(hydrated && messages.length === 0 && !demoPlan) ? (
            <div className="history-actions">
              {!history ? (
                <button
                  type="button"
                  className="ghost history-load"
                  onClick={loadDemoAthlete}
                  disabled={busy}
                >
                  Load demo athlete history
                </button>
              ) : null}
              <button
                type="button"
                className="ghost history-load"
                disabled={busy || uploadingGpx}
                onClick={() => gpxInputRef.current?.click()}
              >
                {uploadingGpx
                  ? "Importing GPX…"
                  : "Upload GPX (Strava/Garmin/TP)"}
              </button>
            </div>
          ) : null}
          <input
            ref={gpxInputRef}
            type="file"
            accept=".gpx,application/gpx+xml,text/xml"
            className="sr-only"
            onChange={(e) => onGpxSelected(e.target.files?.[0] ?? null)}
          />

          {(busy || selectingRoute) && (
            <div className="status-banner" role="status">
              <p>
                {selectingRoute
                  ? "Switching route — updating map and coach note…"
                  : "Working — routes and scores update when ready."}
              </p>
              {!selectingRoute && progressChips.length > 0 ? (
                <ul className="tool-progress" aria-label="Agent progress">
                  {progressChips.map((label, i) => (
                    <li
                      key={label}
                      className={i === progressChips.length - 1 ? "active" : "done"}
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              ) : null}
              {selectingRoute ? (
                <div className="route-select-progress route-select-progress--inline">
                  <span className="route-select-spinner" aria-hidden />
                </div>
              ) : null}
            </div>
          )}

          {messages.map((m) => {
            const textParts = m.parts.filter(
              (part) => part.type === "text" && part.text.trim(),
            );
            if (textParts.length === 0) return null;
            return (
              <div key={m.id} className={`bubble bubble--${m.role}`}>
                {textParts.map((part, i) =>
                  part.type === "text" ? <p key={i}>{part.text}</p> : null,
                )}
              </div>
            );
          })}

          {showWizard && (
            <Wizard
              wizard={wizard}
              onChange={onWizardChange}
              onConfirm={onConfirmWizard}
              busy={busy}
              collapsed={Boolean(plan)}
              hasPlan={Boolean(plan)}
            />
          )}

          {displayError && (
            <p className="error-banner" role="alert">
              {displayError}
            </p>
          )}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text) return;
            setWizardDirty(true);
            setLocalWizard((w) => ({ ...w, goalsText: text }));
            submitText(text);
            // Always rebuild locally so the visual pane updates; agent is additive.
            startTransition(async () => {
              try {
                const built = await generateDemoPlan(sessionId, {
                  goalsText: text,
                  confirmed: true,
                });
                adoptPlan(built);
                setLocalWizard(built.wizard);
              } catch (err) {
                setLocalError(
                  err instanceof Error
                    ? err.message
                    : "Could not build a local plan.",
                );
              }
            });
            setInput("");
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 90 min endurance near Vondelpark…"
            disabled={busy}
            aria-label="Training goal or refine request"
          />
          <button
            type="submit"
            className="primary"
            disabled={busy || !input.trim()}
          >
            {busy ? "…" : "Send"}
          </button>
        </form>

        {!agentEnabled && (
          <p className="mode-note">
            Running in local demo mode (Trigger/Google AI unavailable). Routes
            still generate via golden/fallback geometry + ClickHouse helpers.
          </p>
        )}
      </aside>

      <main className="visual-pane">
        {plan ? (
          <div
            className={busy ? "plan-refining" : undefined}
            aria-busy={busy}
          >
            <PlanPanel
              key={`${plan.sessionId}-${plan.routes.map((r) => r.routeId).join("-")}-${plan.historyContext?.athleteId ?? "none"}`}
              plan={plan}
              onSelectRoute={onSelectRoute}
              onRefine={onRefine}
              onApplyTweaks={onApplyTweaks}
              refining={busy && !selectingRoute}
              selectingRoute={selectingRoute}
              trainingBlock={trainingBlock}
              onCreateTrainingBlock={onCreateTrainingBlock}
              blockBusy={blockBusy}
            />
          </div>
        ) : busy ? (
          <div className="visual-generating" aria-live="polite">
            <BrandMark withWordmark size={36} />
            <h1>Generating routes…</h1>
            <p>Durable Trigger tasks are fanning out ORS and scoring.</p>
            <div className="gen-progress" aria-hidden>
              <span className="route-select-spinner" />
            </div>
            <ol className="gen-steps">
              {steps.map((step, i) => (
                <li key={step} className={i === steps.length - 1 ? "active" : ""}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : displayError ? (
          <div className="visual-empty visual-empty--error">
            <BrandMark withWordmark size={36} />
            <h1>Couldn&apos;t build the plan</h1>
            <p>{displayError}</p>
            <button type="button" className="ghost" onClick={runQuickDemo}>
              Retry demo prompt
            </button>
          </div>
        ) : (
          <div className="visual-empty">
            <BrandMark withWordmark size={40} />
            <h1>Your ride appears here</h1>
            <p>
              Map, elevation, and training effect stream in as the agent builds
              the plan.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
