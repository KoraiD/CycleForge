"use client";

import { useState } from "react";
import type { StackStats } from "@/lib/clickhouse";
import { StackCharts } from "./stack-charts";
import { StackDiagram } from "./stack-diagram";

function fmt(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export function StackView({ stats: initial }: { stats: StackStats }) {
  const [stats, setStats] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/stack", { cache: "no-store" });
      if (res.ok) setStats((await res.json()) as StackStats);
    } finally {
      setRefreshing(false);
    }
  };

  const cards = [
    { label: "Plan sessions", value: stats.counts.planSessions, table: "plan_sessions" },
    { label: "Live routes", value: stats.counts.routesLive, table: "routes" },
    { label: "Seed routes", value: stats.counts.routesSeed, table: "routes.is_seed" },
    { label: "Route scores", value: stats.counts.routeScores, table: "route_scores" },
    { label: "Weather tiles", value: stats.counts.weatherTiles, table: "weather_forecast_grid" },
    { label: "History rides", value: stats.counts.riderHistoryRides, table: "rider_history_rides" },
    { label: "Training blocks", value: stats.counts.trainingBlocks, table: "training_blocks" },
  ];

  const chLive =
    stats.clickhouseConfigured &&
    (stats.counts.planSessions != null ||
      stats.counts.routesSeed != null ||
      stats.counts.weatherTiles != null);

  return (
    <main className="stack-sheet">
      <p className="eyebrow">Under the hood</p>
      <h1 className="stack-title">Trigger.dev × ClickHouse</h1>
      <p className="stack-lede">
        Durable Trigger tasks fan out ORS and weather ingest; ClickHouse stores
        sessions, scores, weather tiles, athlete history, and multi-day blocks
        for coaching queries. Counts below are live when Cloud is configured.
      </p>

      <div className="stack-status">
        <span
          className={
            stats.triggerConfigured ? "stack-pill on" : "stack-pill off"
          }
        >
          Trigger {stats.triggerConfigured ? "configured" : "offline"}
        </span>
        <span className={chLive ? "stack-pill on" : "stack-pill off"}>
          ClickHouse {chLive ? "live data" : stats.clickhouseConfigured ? "configured" : "memory fallback"}
        </span>
        {stats.dashboardUrl ? (
          <a
            className="stack-pill on"
            href={stats.dashboardUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Trigger dashboard
          </a>
        ) : null}
        <button
          type="button"
          className="ghost"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? "Refreshing…" : "Refresh live data"}
        </button>
      </div>

      {stats.error ? (
        <p className="error-banner" role="alert">
          {stats.error}
        </p>
      ) : null}
      {stats.queryErrors.length > 0 ? (
        <details className="stack-errors">
          <summary>Query notes ({stats.queryErrors.length})</summary>
          <ul>
            {stats.queryErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <section>
        <h2>Architecture at a glance</h2>
        <StackDiagram
          triggerConfigured={stats.triggerConfigured}
          clickhouseLive={chLive}
        />
      </section>

      <section>
        <h2>Live charts</h2>
        <StackCharts stats={stats} />
      </section>

      <section>
        <h2>ClickHouse live table counts</h2>
        <div className="stack-kpis">
          {cards.map((c) => (
            <div key={c.label} className="stack-kpi">
              <span>{c.label}</span>
              <strong>{fmt(c.value)}</strong>
              <code className="stack-kpi__table">{c.table}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="stack-grid">
        <div>
          <h2>Trigger tasks & cron</h2>
          <ul className="stack-tasks">
            {stats.tasks.map((t) => (
              <li key={t.id}>
                <code>{t.id}</code>
                <span>{t.role}</span>
                {t.cron ? (
                  <span className="stack-badge">cron {t.cron}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Recent Trigger runs</h2>
          {stats.recentRuns.length === 0 ? (
            <p className="muted">
              No runs listed yet — generate a plan or wait for the hourly
              heartbeat / weather cron, then refresh.
            </p>
          ) : (
            <ul className="stack-list">
              {stats.recentRuns.map((r) => (
                <li key={r.id}>
                  <a href={r.url} target="_blank" rel="noreferrer">
                    <code>{r.taskIdentifier}</code>
                  </a>
                  <span className="stack-badge">{r.status}</span>
                  <span>{r.createdAt ? new Date(r.createdAt).toLocaleString() : r.id.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="stack-grid">
        <div>
          <h2>How data flows</h2>
          <ol className="stack-flow">
            <li>
              <strong>Agent</strong> (`cycleforge-agent`) reads goals and calls
              tools.
            </li>
            <li>
              <strong>Generate</strong> fans out ORS via{" "}
              <code>fetch-ors-route-batch</code>.
            </li>
            <li>
              <strong>Score</strong> writes <code>routes</code> +{" "}
              <code>route_scores</code>, joins nearest{" "}
              <code>weather_forecast_grid</code> tile.
            </li>
            <li>
              <strong>Coach / blocks</strong> read{" "}
              <code>rider_history_rides</code> and write{" "}
              <code>training_blocks</code>.
            </li>
          </ol>
        </div>
        <div>
          <h2>Training blocks in CH</h2>
          {stats.samples.trainingBlocks.length === 0 ? (
            <p className="muted">
              Build a 4-day block from the plan panel to populate{" "}
              <code>training_blocks</code>.
            </p>
          ) : (
            <ul className="stack-list">
              {stats.samples.trainingBlocks.map((b) => (
                <li key={b.blockId}>
                  <strong>{b.label}</strong>
                  <span>
                    TSS {Math.round(b.totalTss)} · {b.athleteId}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="stack-grid">
        <div>
          <h2>Recent sessions</h2>
          {stats.samples.recentSessions.length === 0 ? (
            <p className="muted">No sessions yet — generate a plan first.</p>
          ) : (
            <ul className="stack-list">
              {stats.samples.recentSessions.map((s, i) => (
                <li key={`${s.sessionId}-${s.status}-${i}`}>
                  <code>{s.sessionId}</code>
                  <span className="stack-badge">{s.status}</span>
                  <span>{s.goals || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2>Top scored routes</h2>
          {stats.samples.topScores.length === 0 ? (
            <p className="muted">Scores appear after a plan is generated.</p>
          ) : (
            <ul className="stack-list">
              {stats.samples.topScores.map((r) => (
                <li key={r.routeId}>
                  <strong>{r.label || r.routeId.slice(0, 8)}</strong>
                  <span>fit {Math.round(r.total * 100)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2>Latest summary links</h2>
        {stats.samples.summaryUrls.length === 0 ? (
          <p className="muted">
            No plans yet — generate a plan and its shareable summary URL will
            appear here.
          </p>
        ) : (
          <ul className="stack-list stack-summaries">
            {stats.samples.summaryUrls.map((s, i) => (
              <li key={`${s.sessionId}-${i}`}>
                <a
                  href={`/summary/${s.sessionId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="stack-summaries__link"
                >
                  /summary/{s.sessionId.slice(0, 8)}…
                </a>
                <span className="stack-badge">{s.status}</span>
                {s.createdAt ? <span>{s.createdAt}</span> : null}
                <span className="stack-summaries__goals">{s.goals || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack-grid">
        <div>
          <h2>Weather grid sample</h2>
          {stats.samples.weatherSample.length === 0 ? (
            <p className="muted">
              Run <code>npm run ingest:weather</code> or wait for{" "}
              <code>ingest-weather-grid-schedule</code>.
            </p>
          ) : (
            <ul className="stack-list">
              {stats.samples.weatherSample.map((w) => (
                <li key={w.tileId}>
                  <strong>
                    {w.summary} · {w.tileId}
                  </strong>
                  <span>
                    {Math.round(w.tempC)}°C · {Math.round(w.windKmh)} km/h
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2>Athlete history in CH</h2>
          {stats.samples.athleteLoads.length === 0 ? (
            <p className="muted">
              Load the demo athlete or upload a GPX to populate history.
            </p>
          ) : (
            <ul className="stack-list">
              {stats.samples.athleteLoads.map((a) => (
                <li key={a.athleteId}>
                  <code>{a.athleteId}</code>
                  <span>
                    {a.rides} rides · {a.km} km
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
