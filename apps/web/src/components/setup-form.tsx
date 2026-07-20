"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AiProvider } from "@/lib/runtime-config";
import { BrandMark } from "./brand-mark";

type PublicConfig = {
  triggerConfigured: boolean;
  triggerProjectRef: string;
  clickhouseConfigured: boolean;
  clickhouseUrlHost: string;
  clickhouseUser: string;
  clickhouseDatabase: string;
  orsConfigured: boolean;
  aiProvider: AiProvider;
  aiModel: string;
  aiBaseUrl: string;
  aiConfigured: boolean;
  aiApiKeyMasked: string;
  triggerSecretMasked: string;
  clickhousePasswordSet: boolean;
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
          setTriggerProjectRef(data.config.triggerProjectRef || "");
          setClickhouseUser(data.config.clickhouseUser || "default");
          setClickhouseDatabase(data.config.clickhouseDatabase || "default");
          setAiProvider(data.config.aiProvider || "google");
          setAiModel(data.config.aiModel || "gemini-flash-latest");
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
          triggerSecretKey,
          triggerProjectRef,
          clickhouseUrl,
          clickhouseUser,
          clickhousePassword,
          clickhouseDatabase,
          orsApiKey,
          aiProvider,
          aiApiKey,
          aiModel,
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
        <label className="field">
          <span>
            Secret key{" "}
            {pub?.triggerSecretMasked
              ? `(saved ${pub.triggerSecretMasked})`
              : ""}
          </span>
          <input
            type="password"
            autoComplete="off"
            placeholder="tr_dev_…"
            value={triggerSecretKey}
            onChange={(e) => setTriggerSecretKey(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Project ref</span>
          <input
            value={triggerProjectRef}
            placeholder="proj_…"
            onChange={(e) => setTriggerProjectRef(e.target.value)}
          />
        </label>
      </section>

      <section className="setup-section">
        <h2>ClickHouse</h2>
        <label className="field">
          <span>
            URL{" "}
            {pub?.clickhouseUrlHost ? `(saved ${pub.clickhouseUrlHost})` : ""}
          </span>
          <input
            value={clickhouseUrl}
            placeholder="https://xxx.clickhouse.cloud:8443"
            onChange={(e) => setClickhouseUrl(e.target.value)}
          />
        </label>
        <label className="field">
          <span>User</span>
          <input
            value={clickhouseUser}
            onChange={(e) => setClickhouseUser(e.target.value)}
          />
        </label>
        <label className="field">
          <span>
            Password{" "}
            {pub?.clickhousePasswordSet ? "(saved · leave blank to keep)" : ""}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={clickhousePassword}
            onChange={(e) => setClickhousePassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Database</span>
          <input
            value={clickhouseDatabase}
            onChange={(e) => setClickhouseDatabase(e.target.value)}
          />
        </label>
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
        <label className="field">
          <span>
            API key{" "}
            {pub?.aiApiKeyMasked ? `(saved ${pub.aiApiKeyMasked})` : ""}
          </span>
          <input
            type="password"
            autoComplete="off"
            placeholder={
              aiProvider === "openai-compatible"
                ? "optional for local"
                : "paste key"
            }
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Model id</span>
          <input
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
          />
        </label>
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
        <label className="field">
          <span>
            API key{" "}
            {pub?.orsConfigured ? "(saved · leave blank to keep)" : ""}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={orsApiKey}
            onChange={(e) => setOrsApiKey(e.target.value)}
          />
        </label>
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
