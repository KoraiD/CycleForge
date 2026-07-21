"use client";

import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import {
  useTriggerChatTransport,
  type InferChatUIMessage,
} from "@trigger.dev/sdk/chat/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  createTrainingBlockAction,
  generateDemoPlan,
  getPlanAction,
  getSessionHistoryAction,
  loadDemoAthleteAction,
  mintChatAccessToken,
  persistPlanAction,
  resetSessionAction,
  selectRouteAction,
  startChatSession,
  updateWizardAction,
  uploadGpxHistoryAction,
} from "@/app/actions";
import type { TrainingBlockPlan } from "@/lib/training-block-plan";
import type { cycleforgeAgent } from "@/trigger/cycleforge-agent";
import {
  clearBrowserSessionId,
  getOrCreateBrowserSessionId,
} from "@/lib/browser-session";
import { attachCoachNote } from "@/lib/coach-note";
import { START_PRESETS } from "@/lib/constants";
import { withTimeoutOrThrow } from "@/lib/fetch-timeout";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import {
  getServerPaneWidth,
  readPaneWidth,
  subscribePaneWidth,
  writePaneWidth,
} from "@/lib/pane-width";
import { parseGoalPrompt } from "@/lib/parse-goal";
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

const LOCAL_GEN_STEPS = [
  "Reading your goal…",
  "Fetching route candidates…",
  "Weather + scoring…",
  "Building the visual plan…",
];

/** Hard ceiling so a hung server action cannot leave the UI spinning forever. */
const PLAN_BUILD_CLIENT_MS = 60_000;
/** Don't let a stuck agent stream block the Trigger ORS fallback forever. */
const AGENT_STREAM_CLIENT_MS = 55_000;

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
  const [localStep, setLocalStep] = useState(0);
  const [buildingPlan, setBuildingPlan] = useState(false);
  const [resetting, setResetting] = useState(false);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const buildingRef = useRef(false);
  /** Plan keys present when the current generation started — used to detect a fresh agent plan. */
  const pendingKeysBeforeRef = useRef<Set<string> | null>(null);
  const [, startTransition] = useTransition();
  /** Route-id fingerprints already shown — avoids agent plans being shadowed by stale demoPlan. */
  const seenPlanKeys = useRef(new Set<string>());
  const [morphFrom, setMorphFrom] = useState<GeoJSON.LineString | null>(null);
  const prevPlanRef = useRef<PlanPayload | null>(null);
  // useSyncExternalStore: server snapshot is always 400; client reads localStorage
  // after hydration — no SSR/client attribute mismatch.
  const paneWidth = useSyncExternalStore(
    subscribePaneWidth,
    readPaneWidth,
    getServerPaneWidth,
  );
  const [dragPaneWidth, setDragPaneWidth] = useState<number | null>(null);
  const dragPaneWidthRef = useRef<number | null>(null);
  const displayPaneWidth = dragPaneWidth ?? paneWidth;
  const resizingRef = useRef(false);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizingRef.current = true;
      const startX = event.clientX;
      const startWidth = displayPaneWidth;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!resizingRef.current) return;
        const next = Math.min(720, Math.max(280, startWidth + ev.clientX - startX));
        dragPaneWidthRef.current = next;
        setDragPaneWidth(next);
      };
      const onUp = (ev: PointerEvent) => {
        resizingRef.current = false;
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const finalWidth = dragPaneWidthRef.current;
        dragPaneWidthRef.current = null;
        setDragPaneWidth(null);
        // Persist outside the setState updater — writing inside it re-enters Chat
        // via useSyncExternalStore while React is still applying the drag state.
        if (finalWidth !== null) writePaneWidth(finalWidth);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [displayPaneWidth],
  );

  const adoptPlan = (next: PlanPayload) => {
    const prev = prevPlanRef.current;
    if (prev && planRouteKey(prev) !== planRouteKey(next)) {
      const prevSelected =
        prev.routes.find((r) => r.routeId === prev.selectedRouteId) ??
        prev.routes[0];
      if (prevSelected?.geometry) setMorphFrom(prevSelected.geometry);
    }
    prevPlanRef.current = next;
    seenPlanKeys.current.add(planRouteKey(next));
    setDemoPlan(next);
  };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health")
      .then((r) => r.json())
      .then(
        (health: {
          triggerConfigured?: boolean;
          aiConfigured?: boolean;
          googleConfigured?: boolean;
        }) => {
          if (!cancelled) {
            const aiOk = Boolean(
              health.aiConfigured ?? health.googleConfigured,
            );
            setAgentConfigured(Boolean(health.triggerConfigured && aiOk));
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
          prevPlanRef.current = storedPlan;
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

  /**
   * Only true while we are actively rebuilding routes — NOT React's useTransition
   * pending (wizard saves / history loads were hiding a ready plan behind this step).
   */
  const localBusy = buildingPlan;
  const agentBusy = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (!buildingPlan) {
      const clear = window.setTimeout(() => setLocalStep(0), 0);
      return () => window.clearTimeout(clear);
    }
    const start = window.setTimeout(() => setLocalStep(0), 0);
    const id = window.setInterval(() => {
      setLocalStep((s) => Math.min(s + 1, LOCAL_GEN_STEPS.length - 1));
    }, 1400);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [buildingPlan]);

  // Adopt new agent tool plans (regenerate/refine) that would otherwise be
  // shadowed by a stale demoPlan from hydration or a previous local build.
  useEffect(() => {
    if (!extracted.plan) return;
    const key = planRouteKey(extracted.plan);
    if (seenPlanKeys.current.has(key)) return;
    adoptPlan(extracted.plan);
    setLocalWizard(extracted.plan.wizard);
    setWizardDirty(true);
    void persistPlanAction(extracted.plan);
  }, [extracted.plan]);

  // End the spinner as soon as a new agent plan lands.
  useEffect(() => {
    const before = pendingKeysBeforeRef.current;
    if (!buildingPlan || !before || !extracted.plan) return;
    const key = planRouteKey(extracted.plan);
    if (before.has(key)) return;
    pendingKeysBeforeRef.current = null;
    buildingRef.current = false;
    setBuildingPlan(false);
  }, [extracted.plan, buildingPlan]);

  const rawPlan = demoPlan ?? extracted.plan;
  const plan =
    rawPlan && history
      ? { ...rawPlan, historyContext: rawPlan.historyContext ?? history }
      : rawPlan;
  const wizard =
    !wizardDirty && extracted.wizard ? extracted.wizard : localWizard;

  const busy = localBusy || selectingRoute;
  /** Any async render/work in flight — drives the persistent in-app indicator. */
  const rendering = localBusy || selectingRoute || agentBusy;
  const agentTransportError = error
    ? friendlyErrorMessage(
        error,
        "Agent transport error — using Trigger ORS pipeline instead.",
      )
    : null;
  const displayError =
    localError ?? extracted.toolError ?? agentTransportError;

  const wizardSyncPrompt = (text: string, w: WizardState) =>
    `${text}

[Client wizard — pass these exact values into upsert_wizard_state and generate_route_candidates]
durationMin=${w.durationMin}
intensity=${w.intensity}
terrainBias=${w.terrainBias}
startPreset=${w.startPreset}
startLabel=${w.startLabel}
startLat=${w.startLat}
startLng=${w.startLng}
avoidBusyRoads=${w.avoidBusyRoads}
ftpWatts=${w.ftpWatts}
confirmed=true
Call upsert_wizard_state with these fields, then generate_route_candidates with confirmWizard=true and the same wizard fields. Do not skip generation.`;

  /** Agent-first when configured; Trigger ORS fan-out if the agent yields no plan. */
  const runPlanGeneration = async (
    patch: Partial<WizardState>,
    userText: string,
  ) => {
    if (buildingRef.current) return;
    buildingRef.current = true;
    setLocalError(null);
    setBuildingPlan(true);
    setLocalStep(0);

    const nextWizard: WizardState = {
      ...wizard,
      ...patch,
      sessionId,
      confirmed: true,
      goalsText: patch.goalsText ?? wizard.goalsText,
    };
    if (patch.startPreset && patch.startPreset !== "custom") {
      const p = START_PRESETS[patch.startPreset];
      nextWizard.startLat = p.lat;
      nextWizard.startLng = p.lng;
      nextWizard.startLabel = patch.startLabel ?? p.label;
    }
    setLocalWizard(nextWizard);
    setWizardDirty(true);

    const keysBefore = new Set(seenPlanKeys.current);
    pendingKeysBeforeRef.current = keysBefore;

    const hasNewPlan = () =>
      [...seenPlanKeys.current].some((k) => !keysBefore.has(k));

    try {
      await updateWizardAction(sessionId, {
        ...patch,
        confirmed: true,
        goalsText: nextWizard.goalsText,
        startLat: nextWizard.startLat,
        startLng: nextWizard.startLng,
        startLabel: nextWizard.startLabel,
        startPreset: nextWizard.startPreset,
      });

      if (agentEnabled) {
        try {
          await Promise.race([
            sendMessage({
              text: wizardSyncPrompt(userText, nextWizard),
            }),
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, AGENT_STREAM_CLIENT_MS);
            }),
          ]);
        } catch {
          setAgentConfigured(false);
        }
        await new Promise((r) => window.setTimeout(r, 80));
        if (hasNewPlan()) return;
      }

      const built = await withTimeoutOrThrow(
        generateDemoPlan(sessionId, {
          ...nextWizard,
          confirmed: true,
        }),
        PLAN_BUILD_CLIENT_MS,
        "Plan generation timed out. Try Reset demo, or check Setup credentials.",
      );
      if (!hasNewPlan()) {
        adoptPlan(built);
        setLocalWizard(built.wizard);
      }
    } catch (err) {
      setLocalError(friendlyErrorMessage(err, "Could not generate routes."));
    } finally {
      pendingKeysBeforeRef.current = null;
      buildingRef.current = false;
      setBuildingPlan(false);
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
    void runPlanGeneration(
      { ...wizard, confirmed: true },
      `Confirm wizard and generate live ORS routes. Goals: ${wizard.goalsText || "endurance ride"}`,
    );
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
    if (agentEnabled) {
      void sendMessage({ text: `Select route ${routeId}` }).catch(() => {
        setAgentConfigured(false);
      });
    }
  };

  const regenerateWithPatch = (
    patch: Partial<WizardState>,
    agentPrompt: string,
  ) => {
    void runPlanGeneration(
      { ...wizard, ...patch, confirmed: true },
      agentPrompt,
    );
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
    const parsed = parseGoalPrompt(prompt);
    const patch: Partial<WizardState> = {
      ...parsed,
      goalsText: prompt,
      startPreset: "custom",
      startLat: 52.3577,
      startLng: 4.8686,
      startLabel: "Vondelpark",
      avoidBusyRoads: true,
      confirmed: true,
    };
    void runPlanGeneration(patch, prompt);
  };

  const showWizard = Boolean(
    extracted.wizard || localWizard.goalsText || demoPlan,
  );
  const progressChips = useMemo(
    () => toolProgressChips(extracted.activities),
    [extracted.activities],
  );
  const liveSteps =
    progressChips.length > 0
      ? progressChips
      : LOCAL_GEN_STEPS.slice(0, Math.max(1, localStep + 1));

  /** Trigger/useChat can emit duplicate message ids during stream retries. */
  const chatBubbles = useMemo(() => {
    const byId = new Map<string, { id: string; role: Msg["role"]; text: string }>();
    for (const m of messages) {
      const text = m.parts
        .filter((part) => part.type === "text" && part.text.trim())
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n")
        .trim();
      if (!text) continue;
      // Keep the latest payload for a given id.
      byId.set(m.id, { id: m.id, role: m.role, text });
    }
    return [...byId.values()];
  }, [messages]);

  const resetDemo = () => {
    if (
      !window.confirm(
        "Reset demo? This clears the current plan, wizard, and athlete binding for this tab.",
      )
    ) {
      return;
    }
    setResetting(true);
    startTransition(async () => {
      try {
        await resetSessionAction(sessionId);
      } catch {
        /* still reload to a clean client */
      }
      clearBrowserSessionId();
      window.location.href = "/";
    });
  };

  return (
    <div
      className="shell"
      style={{ ["--chat-pane-width" as string]: `${displayPaneWidth}px` }}
    >
      <aside className="chat-pane">
        <header className="chat-pane__header">
          <div className="chat-pane__brand-block">
            <BrandMark withWordmark size={32} />
            <p className="tagline">Visual training plans — not walls of text</p>
          </div>
          <nav className="chat-nav" aria-label="App">
            {rendering ? (
              <span
                className="render-indicator"
                role="status"
                aria-live="polite"
                title="CycleForge is rendering your plan"
              >
                <span className="render-indicator__spinner" aria-hidden />
                <span className="render-indicator__label">Rendering…</span>
              </span>
            ) : null}
            <button
              type="button"
              className="ghost chat-nav__btn"
              disabled={resetting}
              onClick={resetDemo}
            >
              {resetting ? "Resetting…" : "Reset demo"}
            </button>
            <Link href="/setup" className="ghost chat-nav__btn">
              Setup
            </Link>
            <Link href="/stack" className="ghost chat-nav__btn">
              Stack
            </Link>
          </nav>
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

          {localBusy || selectingRoute ? (
            <div className="status-banner" role="status" aria-live="polite">
              <p>
                {selectingRoute
                  ? "Switching route — updating map and coach note…"
                  : `${LOCAL_GEN_STEPS[localStep] ?? "Working…"} Hang tight.`}
              </p>
              {localBusy ? (
                <ul className="tool-progress" aria-label="Generation progress">
                  {liveSteps.map((label, i) => (
                    <li
                      key={`${label}-${i}`}
                      className={i === liveSteps.length - 1 ? "active" : "done"}
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="route-select-progress route-select-progress--inline">
                <span className="route-select-spinner" aria-hidden />
              </div>
            </div>
          ) : null}
          {agentBusy && localBusy ? (
            <p className="mode-note agent-bg-note" role="status">
              Trigger agent running — ORS fan-out and ClickHouse scoring…
            </p>
          ) : null}

          {chatBubbles.map((m) => (
            <div key={m.id} className={`bubble bubble--${m.role}`}>
              {m.text.split("\n").map((line, i) => (
                <p key={`${m.id}-line-${i}`}>{line}</p>
              ))}
            </div>
          ))}

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
            const parsed = parseGoalPrompt(text);
            setInput("");
            void runPlanGeneration(
              { ...parsed, goalsText: text, confirmed: true },
              text,
            );
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
            Agent chat offline — Trigger or AI credentials missing.{" "}
            <Link href="/setup">Open Setup</Link> to enable the full agent.
            Plans still run through the Trigger ORS pipeline when Trigger is
            configured.
          </p>
        )}
      </aside>

      <div
        className="pane-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat panel"
        aria-valuenow={displayPaneWidth}
        aria-valuemin={280}
        aria-valuemax={720}
        onPointerDown={onResizePointerDown}
      />

      <main className="visual-pane">
        {plan && !localBusy ? (
          <div aria-busy={selectingRoute}>
            <PlanPanel
              key={`${plan.sessionId}-${plan.routes.map((r) => r.routeId).join("-")}-${plan.historyContext?.athleteId ?? "none"}`}
              plan={plan}
              onSelectRoute={onSelectRoute}
              onApplyTweaks={onApplyTweaks}
              refining={false}
              selectingRoute={selectingRoute}
              trainingBlock={trainingBlock}
              onCreateTrainingBlock={onCreateTrainingBlock}
              blockBusy={blockBusy}
              morphFrom={morphFrom}
            />
          </div>
        ) : localBusy ? (
          <div className="visual-generating" aria-live="polite">
            <BrandMark withWordmark size={36} />
            <h1>Working on your plan…</h1>
            <p className="gen-current">{LOCAL_GEN_STEPS[localStep]}</p>
            <div className="gen-progress" aria-hidden>
              <span className="route-select-spinner" />
            </div>
            <ol className="gen-steps">
              {LOCAL_GEN_STEPS.map((step, i) => (
                <li
                  key={step}
                  className={
                    i === localStep ? "active" : i < localStep ? "done" : ""
                  }
                >
                  {step}
                </li>
              ))}
            </ol>
            {plan ? (
              <p className="muted gen-note">
                Updating from your latest goal — previous map returns when ready.
              </p>
            ) : null}
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
