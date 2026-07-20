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
  startChatSession,
  updateWizardAction,
} from "@/app/actions";
import type { cycleforgeAgent } from "@/trigger/cycleforge-agent";
import { DEFAULT_WIZARD, type PlanPayload, type WizardState } from "@/lib/types";
import { PlanPanel } from "./plan-panel";
import { Wizard } from "./wizard";

type Msg = InferChatUIMessage<typeof cycleforgeAgent>;

function extractFromMessages(messages: Msg[]): {
  plan: PlanPayload | null;
  wizard: WizardState | null;
} {
  let plan: PlanPayload | null = null;
  let wizard: WizardState | null = null;

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
        };
      };
      if (toolPart.state && toolPart.state !== "output-available") continue;
      const output = toolPart.output;
      if (!output) continue;
      if (output.plan) plan = output.plan;
      if (output.wizard) wizard = output.wizard;
    }
  }
  return { plan, wizard };
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
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health")
      .then((r) => r.json())
      .then((health: { triggerConfigured?: boolean; openaiConfigured?: boolean }) => {
        if (!cancelled) {
          setAgentConfigured(
            Boolean(health.triggerConfigured && health.openaiConfigured),
          );
        }
      })
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

  const submitText = (text: string) => {
    if (!text.trim()) return;
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
        const presets = {
          centraal: { lat: 52.3791, lng: 4.9003 },
          vondelpark: { lat: 52.3577, lng: 4.8686 },
          amstel: { lat: 52.3462, lng: 4.9179 },
        } as const;
        const p = presets[patch.startPreset];
        next.startLat = p.lat;
        next.startLng = p.lng;
      }
      return next;
    });
    startTransition(async () => {
      await updateWizardAction(sessionId, patch);
    });
  };

  const onConfirmWizard = () => {
    startTransition(async () => {
      const confirmed = { ...wizard, confirmed: true };
      setLocalWizard(confirmed);
      setWizardDirty(true);
      if (agentEnabled) {
        const prompt = `Confirm wizard and generate routes. durationMin=${confirmed.durationMin}, intensity=${confirmed.intensity}, terrainBias=${confirmed.terrainBias}, startPreset=${confirmed.startPreset}, avoidBusyRoads=${confirmed.avoidBusyRoads}. Goals: ${confirmed.goalsText || "endurance ride near Amsterdam"}`;
        try {
          await sendMessage({ text: prompt });
          return;
        } catch {
          setAgentConfigured(false);
        }
      }
      const built = await generateDemoPlan(sessionId, confirmed);
      setDemoPlan(built);
    });
  };

  const onSelectRoute = (routeId: string) => {
    if (demoPlan) {
      setDemoPlan({ ...demoPlan, selectedRouteId: routeId });
    }
    if (agentEnabled) {
      void sendMessage({ text: `Select route ${routeId}` });
    }
  };

  const runQuickDemo = () => {
    const prompt =
      "I have 90 minutes tomorrow morning near Amsterdam — endurance ride, some hills if possible, avoid busy roads.";
    setInput("");
    setWizardDirty(true);
    setLocalWizard((w) => ({ ...w, goalsText: prompt }));
    startTransition(async () => {
      if (agentEnabled) {
        try {
          await sendMessage({ text: prompt });
          return;
        } catch {
          setAgentConfigured(false);
        }
      }
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
    });
  };

  const showWizard = Boolean(
    extracted.wizard || localWizard.goalsText || demoPlan,
  );

  return (
    <div className="shell">
      <aside className="chat-pane">
        <header className="chat-pane__header">
          <p className="brand">CycleForge</p>
          <p className="tagline">Visual training plans — not walls of text</p>
        </header>

        <div className="messages">
          {messages.length === 0 && !demoPlan && (
            <div className="empty">
              <p>
                Tell me a training goal or trip idea. I&apos;ll open a wizard,
                then put routes on a map with elevation and training effect.
              </p>
              <button type="button" className="ghost" onClick={runQuickDemo}>
                Try the demo prompt
              </button>
            </div>
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
            />
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
                const built = await generateDemoPlan(sessionId, {
                  goalsText: text,
                  confirmed: true,
                });
                setDemoPlan(built);
                setLocalWizard(built.wizard);
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
          />
          <button type="submit" className="primary" disabled={busy}>
            Send
          </button>
        </form>

        {!agentEnabled && (
          <p className="mode-note">
            Running in local demo mode (Trigger/OpenAI unavailable). Routes still
            generate via fallback + ClickHouse helpers.
          </p>
        )}
      </aside>

      <main className="visual-pane">
        {plan ? (
          <PlanPanel plan={plan} onSelectRoute={onSelectRoute} />
        ) : (
          <div className="visual-empty">
            <p className="brand">CycleForge</p>
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
