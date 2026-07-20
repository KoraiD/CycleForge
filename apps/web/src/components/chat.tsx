"use client";

import { useChat } from "@ai-sdk/react";
import {
  useTriggerChatTransport,
  type InferChatUIMessage,
} from "@trigger.dev/sdk/chat/react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  generateDemoPlan,
  mintChatAccessToken,
  selectRouteAction,
  startChatSession,
  updateWizardAction,
} from "@/app/actions";
import type { cycleforgeAgent } from "@/trigger/cycleforge-agent";
import { attachCoachNote } from "@/lib/coach-note";
import { START_PRESETS } from "@/lib/constants";
import { DEFAULT_WIZARD, type PlanPayload, type WizardState } from "@/lib/types";
import { BrandMark } from "./brand-mark";
import { PlanPanel, type PlanTweak } from "./plan-panel";
import { Wizard } from "./wizard";

type Msg = InferChatUIMessage<typeof cycleforgeAgent>;

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

function generatingSteps(activities: ToolActivity[]): string[] {
  const names = new Set(activities.map((a) => a.name));
  const steps = ["Reading goals"];
  if (names.has("upsert_wizard_state")) steps.push("Updating wizard");
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
  const [sessionId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [localWizard, setLocalWizard] = useState<WizardState>(() =>
    DEFAULT_WIZARD(sessionId),
  );
  const [wizardDirty, setWizardDirty] = useState(false);
  const [demoPlan, setDemoPlan] = useState<PlanPayload | null>(null);
  const [agentConfigured, setAgentConfigured] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
  const plan = demoPlan ?? extracted.plan;
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
      if (agentEnabled) {
        const prompt = `Confirm wizard and generate routes. durationMin=${confirmed.durationMin}, intensity=${confirmed.intensity}, terrainBias=${confirmed.terrainBias}, startPreset=${confirmed.startPreset}, startLabel=${confirmed.startLabel}, startLat=${confirmed.startLat}, startLng=${confirmed.startLng}, avoidBusyRoads=${confirmed.avoidBusyRoads}. Goals: ${confirmed.goalsText || "endurance ride"}`;
        try {
          await sendMessage({ text: prompt });
          return;
        } catch {
          setAgentConfigured(false);
        }
      }
      try {
        const built = await generateDemoPlan(sessionId, confirmed);
        setDemoPlan(built);
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Could not generate routes.",
        );
      }
    });
  };

  const onSelectRoute = (routeId: string) => {
    if (demoPlan) {
      setDemoPlan(attachCoachNote({ ...demoPlan, selectedRouteId: routeId }));
    }
    startTransition(async () => {
      await selectRouteAction(sessionId, routeId);
    });
    if (agentEnabled) {
      void sendMessage({ text: `Select route ${routeId}` });
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
      if (agentEnabled && agentPrompt) {
        try {
          await sendMessage({ text: agentPrompt });
          return;
        } catch {
          setAgentConfigured(false);
        }
      }
      try {
        const built = await generateDemoPlan(sessionId, nextWizard);
        setDemoPlan(built);
        setLocalWizard(built.wizard);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Refine failed.");
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
      `Regenerate with durationMin=${patch.durationMin ?? wizard.durationMin}, intensity=${patch.intensity ?? wizard.intensity}, terrainBias=${patch.terrainBias ?? wizard.terrainBias}, avoidBusyRoads=${patch.avoidBusyRoads ?? wizard.avoidBusyRoads}.`,
    );
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
          startPreset: "vondelpark",
          avoidBusyRoads: true,
          confirmed: true,
        });
        setDemoPlan(built);
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

  return (
    <div className="shell">
      <aside className="chat-pane">
        <header className="chat-pane__header">
          <BrandMark withWordmark size={32} />
          <p className="tagline">Visual training plans — not walls of text</p>
        </header>

        <div className="messages">
          {messages.length === 0 && !demoPlan && (
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
              </div>
            </div>
          )}

          {busy && (
            <p className="status-banner" role="status">
              Working — routes and scores update when ready.
            </p>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`bubble bubble--${m.role}`}>
              {m.parts.map((part, i) => {
                if (part.type === "text" && part.text.trim()) {
                  return <p key={i}>{part.text}</p>;
                }
                if (part.type.startsWith("tool-")) {
                  const name = part.type.replace("tool-", "");
                  return (
                    <p key={i} className="tool-note">
                      {name.replaceAll("_", " ")}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          ))}

          {showWizard && (
            <Wizard
              wizard={wizard}
              onChange={onWizardChange}
              onConfirm={onConfirmWizard}
              busy={busy}
              collapsed={Boolean(plan)}
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
            if (!agentEnabled) {
              startTransition(async () => {
                try {
                  const built = await generateDemoPlan(sessionId, {
                    goalsText: text,
                    confirmed: true,
                  });
                  setDemoPlan(built);
                  setLocalWizard(built.wizard);
                } catch (err) {
                  setLocalError(
                    err instanceof Error
                      ? err.message
                      : "Could not build a local plan.",
                  );
                }
              });
            }
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
              key={`${plan.sessionId}-${plan.routes.map((r) => r.routeId).join("-")}`}
              plan={plan}
              onSelectRoute={onSelectRoute}
              onRefine={onRefine}
              onApplyTweaks={onApplyTweaks}
              refining={busy}
            />
          </div>
        ) : busy ? (
          <div className="visual-generating" aria-live="polite">
            <BrandMark withWordmark size={36} />
            <h1>Generating routes…</h1>
            <p>Durable Trigger tasks are fanning out ORS and scoring.</p>
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
