"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AiProvider } from "@/lib/runtime-config";
import { BrandMark } from "./brand-mark";

type PublicConfig = {
  triggerConfigured: boolean;
  triggerSecretKey: string;
  triggerProjectRef: string;
  clickhouseConfigured: boolean;
  clickhouseUrl: string;
  clickhouseUser: string;
  clickhousePasswordSet: boolean;
  clickhouseDatabase: string;
  orsConfigured: boolean;
  orsApiKey: string;
  aiProvider: AiProvider;
  aiModel: string;
  aiApiKey: string;
  aiBaseUrl: string;
  aiConfigured: boolean;
  updatedAt: string | null;
};

const PROVIDERS: Array<{ id: AiProvider; label: string; hint: string }> = [
  { id: "google", label: "Google AI Studio", hint: "Gemini API key" },
  { id: "openai", label: "OpenAI", hint: "platform.openai.com key" },
  { id: "anthropic", label: "Anthropic", hint: "Claude API key" },
  {
    id: "openai-compatible",
    label: "Local (Ollama / LM Studio)",
    hint: "OpenAI-compatible base URL",
  },
];

/**
 * Unified setup field: label is plain text; the value lives in the input.
 * A saved value shows masked (first3…last3) until Reveal toggles it. The reveal
 * button always sits beside the input and is disabled (grayed) when there is
 * nothing saved to reveal. Typing replaces the saved value on save.
 */
function SetupField({
  label,
  value,
  onChange,
  savedValue,
  placeholder,
  secret = false,
  autoComplete = "off",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Currently-saved value ("" when unset). Shown masked; revealed on demand. */
  savedValue: string;
  placeholder?: string;
  /** Render bullets when masked (true secrets). Non-secrets show masked text. */
  secret?: boolean;
  autoComplete?: string;
}) {
  const [shown, setShown] = useState(false);
  const editing = value !== "";
  const hasSaved = savedValue !== "";

  // What the input displays when the user hasn't typed a replacement.
  const display = editing
    ? value
    : hasSaved
      ? shown
        ? savedValue
        : secret
          ? "•".repeat(Math.min(savedValue.length, 24))
          : maskForDisplay(savedValue)
      : "";

  return (
    <label className="field">
      <span>{label}</span>
      <span className="secret-field">
        <input
          type={secret && !shown ? "password" : "text"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={display}
          readOnly={!editing && hasSaved}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="secret-field__toggle"
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          aria-label={shown ? `Hide ${label}` : `Reveal ${label}`}
          title={shown ? `Hide ${label}` : `Reveal ${label}`}
          disabled={!hasSaved && !editing}
        >
          {shown ? "Hide" : "Reveal"}
        </button>
      </span>
    </label>
  );
}

function maskForDisplay(value: string): string {
  if (value.length < 10) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

export function SetupForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pub, setPub] = useState<PublicConfig | null>(null);

  const [triggerSecretKey, setTriggerSecretKey] = useState("");
  const [triggerProjectRef, setTriggerProjectRef] = useState("");
  const [clickhouseUrl, setClickhouseUrl] = useState("");
  const [clickhouseUser, setClickhouseUser] = useState("default");
  const [clickhousePassword, setClickhousePassword] = useState("");
  const [clickhouseDatabase, setClickhouseDatabase] = useState("default");
  const [orsApiKey, setOrsApiKey] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>("google");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("gemini-flash-latest");
  const [aiBaseUrl, setAiBaseUrl] = useState("http://127.0.0.1:1234/v1");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/setup")
      .then((r) => r.json())
      .then(
        (data: {
          config: PublicConfig;
          defaults: { models: Record<string, string> };
        }) => {
          if (cancelled) return;
          setPub(data.config);
          // Non-secret selects initialise from saved values; text fields stay
          // blank and show the saved value masked until the user types a change.
          setAiProvider(data.config.aiProvider || "google");
          setAiBaseUrl(data.config.aiBaseUrl || "http://127.0.0.1:1234/v1");
          setLoading(false);
        },
      )
      .catch(() => {
        if (!cancelled) {
          setError("Could not load setup.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onProvider = (p: AiProvider) => {
    setAiProvider(p);
    if (p === "google") setAiModel("gemini-flash-latest");
    if (p === "openai") setAiModel("gpt-4o-mini");
    if (p === "anthropic") setAiModel("claude-sonnet-4-0");
    if (p === "openai-compatible") setAiModel("local-model");
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Blank fields mean "keep the saved value" (the API treats undefined
          // as unchanged); only send what the user actually typed.
          triggerSecretKey: triggerSecretKey || undefined,
          triggerProjectRef: triggerProjectRef || undefined,
          clickhouseUrl: clickhouseUrl || undefined,
          clickhouseUser: clickhouseUser || undefined,
          clickhousePassword: clickhousePassword || undefined,
          clickhouseDatabase: clickhouseDatabase || undefined,
          orsApiKey: orsApiKey || undefined,
          aiProvider,
          aiApiKey: aiApiKey || undefined,
          aiModel: aiModel || undefined,
          aiBaseUrl,
          bootstrap: true,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        config?: PublicConfig;
        error?: string;
        clickhousePing?: { ok: boolean; error?: string } | null;
        bootstrap?: { ok: boolean; error?: string } | null;
      };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setPub(data.config ?? null);
      setTriggerSecretKey("");
      setClickhousePassword("");
      setOrsApiKey("");
      setAiApiKey("");
      setMessage(data.message || "Saved.");
      if (data.clickhousePing && !data.clickhousePing.ok) {
        setError(
          `ClickHouse: ${data.clickhousePing.error ?? "connection failed"}`,
        );
      } else if (data.bootstrap && !data.bootstrap.ok) {
        setError(`Bootstrap: ${data.bootstrap.error ?? "failed"}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="setup-sheet">
        <BrandMark withWordmark size={32} />
        <p>Loading setup…</p>
      </main>
    );
  }

  return (
    <main className="setup-sheet">
      <BrandMark withWordmark size={32} />
      <h1>Local setup</h1>
      <p className="muted">
        Bring your own Trigger.dev, ClickHouse, and AI credentials (Google AI
        Studio, OpenAI, Anthropic, or a local OpenAI-compatible server like
        Ollama / LM Studio). Secrets stay on this machine in{" "}
        <code>.data/runtime-config.json</code> and are synced to{" "}
        <code>.env.local</code> (gitignored). Saving applies env vars and, when
        ClickHouse is reachable, runs schema + seed automatically.
      </p>

      {pub ? (
        <p className="history-chip">
          Status · Trigger {pub.triggerConfigured ? "ok" : "missing"} · CH{" "}
          {pub.clickhouseConfigured ? "ok" : "missing"} · AI{" "}
          {pub.aiConfigured ? pub.aiProvider : "missing"}
        </p>
      ) : null}

      <section className="setup-section">
        <h2>Trigger.dev</h2>
        <SetupField
          label="Secret key"
          value={triggerSecretKey}
          onChange={setTriggerSecretKey}
          savedValue={pub?.triggerSecretKey ?? ""}
          placeholder="tr_dev_…"
          secret
        />
        <SetupField
          label="Project ref"
          value={triggerProjectRef}
          onChange={setTriggerProjectRef}
          savedValue={pub?.triggerProjectRef ?? ""}
          placeholder="proj_…"
        />
      </section>

      <section className="setup-section">
        <h2>ClickHouse</h2>
        <SetupField
          label="URL"
          value={clickhouseUrl}
          onChange={setClickhouseUrl}
          savedValue={pub?.clickhouseUrl ?? ""}
          placeholder="https://xxx.clickhouse.cloud:8443"
        />
        <SetupField
          label="User"
          value={clickhouseUser}
          onChange={setClickhouseUser}
          savedValue={pub?.clickhouseUser ?? ""}
        />
        <label className="field">
          <span>
            Password{" "}
            {pub?.clickhousePasswordSet ? "(saved · type to replace)" : ""}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={clickhousePassword}
            onChange={(e) => setClickhousePassword(e.target.value)}
          />
        </label>
        <SetupField
          label="Database"
          value={clickhouseDatabase}
          onChange={setClickhouseDatabase}
          savedValue={pub?.clickhouseDatabase ?? ""}
        />
      </section>

      <section className="setup-section">
        <h2>AI provider</h2>
        <div className="chip-row">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={aiProvider === p.id ? "chip active" : "chip"}
              onClick={() => onProvider(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <SetupField
          label="API key"
          value={aiApiKey}
          onChange={setAiApiKey}
          savedValue={pub?.aiApiKey ?? ""}
          placeholder={
            aiProvider === "openai-compatible"
              ? "optional for local"
              : "paste key"
          }
          secret
        />
        <SetupField
          label="Model id"
          value={aiModel}
          onChange={setAiModel}
          savedValue={pub?.aiModel ?? ""}
        />
        {aiProvider === "openai-compatible" ? (
          <label className="field">
            <span>Base URL (LM Studio / Ollama)</span>
            <input
              value={aiBaseUrl}
              placeholder="http://127.0.0.1:1234/v1"
              onChange={(e) => setAiBaseUrl(e.target.value)}
            />
          </label>
        ) : null}
      </section>

      <section className="setup-section">
        <h2>OpenRouteService (optional)</h2>
        <SetupField
          label="API key"
          value={orsApiKey}
          onChange={setOrsApiKey}
          savedValue={pub?.orsApiKey ?? ""}
          placeholder="paste key"
          secret
        />
      </section>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="status-banner">{message}</p> : null}

      <div className="setup-actions">
        <button
          type="button"
          className="primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save & apply"}
        </button>
        <Link href="/" className="ghost">
          Back to planner
        </Link>
        <Link href="/stack" className="ghost">
          Stack
        </Link>
      </div>

      <p className="upload-note">
        After save: restart <code>npm run dev</code> and{" "}
        <code>npm run dev:trigger</code>. Optional:{" "}
        <code>npm run ingest:weather</code> to refresh the weather grid.
      </p>
    </main>
  );
}
