"use client";

import {
  IconBrowser,
  IconChart,
  IconCloud,
  IconDatabase,
  IconLightning,
  IconRoute,
} from "./icon";

const AGENT_TASKS = ["agent", "fan-out", "score", "weather cron"];

const CH_TABLES = [
  "sessions",
  "routes",
  "scores",
  "weather grid",
  "history",
  "blocks",
];

function Arrow({ label }: { label: string }) {
  return (
    <div className="stack-edge" aria-label={label} title={label}>
      <span className="stack-edge__line" aria-hidden />
      <span className="stack-edge__chevron" aria-hidden>▸</span>
    </div>
  );
}

export function StackDiagram({
  triggerConfigured,
  clickhouseLive,
}: {
  triggerConfigured: boolean;
  clickhouseLive: boolean;
}) {
  return (
    <div className="stack-diagram" role="img" aria-label="CycleForge architecture: browser planner and chat UI talk to a Next.js server with AI tools, which fans out to Trigger.dev durable tasks and reads/writes ClickHouse tables; OpenRouteService and Open-Meteo provide geometry and weather.">
      <div className="stack-node">
        <span className="stack-node__icon"><IconBrowser size={20} /></span>
        <strong>Planner UI</strong>
        <small>React 19 · MapLibre map · Recharts visuals</small>
      </div>

      <Arrow label="Chat, wizard and demo flow call the Next.js server" />

      <div className="stack-node">
        <span className="stack-node__icon"><IconChart size={20} /></span>
        <strong>Next.js 16</strong>
        <small>Server actions · AI SDK tools · plan builder</small>
      </div>

      <Arrow label="Durable tasks and analytics SQL" />

      <div className="stack-node-group">
        <div className={`stack-node stack-node--trigger${triggerConfigured ? "" : " stack-node--off"}`}>
          <span className="stack-node__icon"><IconLightning size={20} /></span>
          <strong>Trigger.dev</strong>
          <small>{triggerConfigured ? "configured" : "offline — demo mode"}</small>
          <div className="stack-node__pills">
            {AGENT_TASKS.map((t) => (
              <span key={t} className="stack-node__pill">{t}</span>
            ))}
          </div>
        </div>
        <div className={`stack-node stack-node--ch${clickhouseLive ? "" : " stack-node--off"}`}>
          <span className="stack-node__icon"><IconDatabase size={20} /></span>
          <strong>ClickHouse</strong>
          <small>{clickhouseLive ? "live data" : "memory fallback"}</small>
          <div className="stack-node__pills">
            {CH_TABLES.map((t) => (
              <span key={t} className="stack-node__pill stack-node__pill--ch">{t}</span>
            ))}
          </div>
        </div>
      </div>

      <Arrow label="External data (best-effort, always with fallback)" />

      <div className="stack-node-group stack-node-group--ext">
        <div className="stack-node stack-node--ext">
          <span className="stack-node__icon"><IconRoute size={20} /></span>
          <strong>OpenRouteService</strong>
          <small>3 route candidates + elevation</small>
        </div>
        <div className="stack-node stack-node--ext">
          <span className="stack-node__icon"><IconCloud size={20} /></span>
          <strong>Open-Meteo</strong>
          <small>Current + hourly weather & air quality</small>
        </div>
      </div>
    </div>
  );
}
