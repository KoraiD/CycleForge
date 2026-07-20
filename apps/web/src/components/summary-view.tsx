"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildCoachNote } from "@/lib/coach-note";
import { ROUTE_COLORS } from "@/lib/constants";
import { downloadRouteGpx } from "@/lib/gpx";
import type { PlanPayload } from "@/lib/types";
import { BrandMark } from "./brand-mark";
import { CommuteVerdict } from "./commute-verdict";
import { ElevationChart } from "./elevation-chart";
import { HistoryChart } from "./history-chart";
import { RouteMap } from "./route-map";
import { RouteRadar } from "./route-radar";
import { ScoreChart } from "./score-chart";
import { ScoreExplainDrawer } from "./score-explain";
import { TrainingBlock } from "./training-block";
import { TssCalendar } from "./tss-calendar";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
}

export function SummaryView({
  plan,
  initialRouteId,
}: {
  plan: PlanPayload;
  initialRouteId?: string;
}) {
  const [selectedId, setSelectedId] = useState(
    initialRouteId && plan.routes.some((r) => r.routeId === initialRouteId)
      ? initialRouteId
      : plan.selectedRouteId,
  );
  const [copied, setCopied] = useState(false);
  const [hoverKm, setHoverKm] = useState<number | null>(null);
  const [previewRouteId, setPreviewRouteId] = useState<string | null>(null);

  const selected = useMemo(() => {
    return (
      plan.routes.find((r) => r.routeId === selectedId) ?? plan.routes[0] ?? null
    );
  }, [plan.routes, selectedId]);

  const coachNote = useMemo(() => {
    if (!selected) return plan.coachNote ?? "";
    if (selected.routeId === plan.selectedRouteId && plan.coachNote) {
      return plan.coachNote;
    }
    return buildCoachNote({
      wizard: plan.wizard,
      route: selected,
      history: plan.historyContext,
    });
  }, [
    plan.coachNote,
    plan.historyContext,
    plan.selectedRouteId,
    plan.wizard,
    selected,
  ]);

  if (!selected) {
    return (
      <div className="summary-missing">
        <BrandMark withWordmark size={36} />
        <h1>No route on this plan</h1>
        <Link href="/" className="primary">
          Back to planner
        </Link>
      </div>
    );
  }

  const selectedIndex = Math.max(
    0,
    plan.routes.findIndex((r) => r.routeId === selected.routeId),
  );
  const accent = ROUTE_COLORS[selectedIndex % ROUTE_COLORS.length];

  const copyLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("route", selected.routeId);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="summary-page">
      <header className="summary-top no-print">
        <div className="summary-top__brand">
          <Link href="/" className="ghost summary-back">
            ← Back to planner
          </Link>
          <Link href="/" className="summary-brand">
            <BrandMark withWordmark size={32} />
          </Link>
        </div>
        <div className="summary-top__actions">
          <Link href="/stack" className="ghost">
            Stack
          </Link>
          <button type="button" className="ghost" onClick={() => void copyLink()}>
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => downloadRouteGpx(selected)}
          >
            Download GPX
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => window.print()}
          >
            Print / PDF
          </button>
        </div>
      </header>

      <main className="summary-sheet">
        <div className="summary-sheet__brand print-only">
          <BrandMark withWordmark size={28} />
        </div>

        <p className="eyebrow">Ride summary</p>
        <h1 className="summary-title">{selected.label}</h1>
        <p className="summary-lede">
          {plan.wizard.durationMin} min · {plan.wizard.intensity} ·{" "}
          {plan.wizard.terrainBias}
          {plan.wizard.startLabel ? ` · from ${plan.wizard.startLabel}` : ""}
        </p>

        <div className="kpi-strip summary-kpis">
          <div>
            <span>Distance</span>
            <strong>{(selected.distanceM / 1000).toFixed(1)} km</strong>
          </div>
          <div>
            <span>Time</span>
            <strong>{formatDuration(selected.durationS)}</strong>
          </div>
          <div>
            <span>Elev gain</span>
            <strong>{Math.round(selected.elevGainM)} m</strong>
          </div>
          <div>
            <span>Est. TSS</span>
            <strong>{selected.training.tssEst}</strong>
          </div>
          <div>
            <span>Goal fit</span>
            <strong>{Math.round(selected.score.total * 100)}</strong>
          </div>
        </div>

        <section className="summary-map-block">
          <RouteMap
            routes={plan.routes}
            selectedRouteId={selected.routeId}
            onSelect={(id) => {
              setSelectedId(id);
              setHoverKm(null);
              setPreviewRouteId(null);
            }}
            hoverKm={hoverKm}
            onHoverKm={setHoverKm}
            previewRouteId={previewRouteId}
            onPreviewRoute={setPreviewRouteId}
          />
        </section>

        {plan.historyContext ? (
          <p className="history-banner" title={plan.historyContext.summaryLine}>
            <span className="eyebrow">Athlete history</span>
            {plan.historyContext.summaryLine}
          </p>
        ) : null}

        {coachNote ? (
          <article className="coach-note" aria-label="Coaching suggestion">
            <p className="eyebrow">Coach note</p>
            {coachNote.split("\n\n").map((para, i) => (
              <p key={`coach-${i}`}>{para}</p>
            ))}
          </article>
        ) : null}

        {plan.leaveWindow ? <CommuteVerdict leave={plan.leaveWindow} /> : null}

        <RouteRadar
          routes={plan.routes}
          selectedRouteId={selected.routeId}
          onSelect={(id) => {
            setSelectedId(id);
            setHoverKm(null);
            setPreviewRouteId(null);
          }}
        />

        <ScoreExplainDrawer route={selected} wizard={plan.wizard} />

        <div className="plan-grid">
          <div>
            <h2>Elevation</h2>
            <ElevationChart
              profile={selected.elevProfile}
              accent={accent}
              hoverKm={hoverKm}
              onHoverKm={setHoverKm}
              effortSegments={selected.effortSegments}
            />
          </div>
          <div>
            <h2>Training effect</h2>
            <TrainingBlock training={selected.training} />
          </div>
        </div>

        <div className="plan-grid">
          <div>
            <h2>Score breakdown</h2>
            <ScoreChart score={selected.score} />
          </div>
          <div>
            <h2>
              {plan.historyContext ? "Athlete load" : "Candidate span"}
            </h2>
            {plan.historyContext ? (
              <>
                <HistoryChart history={plan.historyContext} />
                <TssCalendar history={plan.historyContext} />
              </>
            ) : (
              <div className="comparison-graphic">
                <p>
                  Distance {plan.comparison.minDistanceKm.toFixed(1)}–
                  {plan.comparison.maxDistanceKm.toFixed(1)} km
                </p>
                <div
                  className="comparison-bar"
                  title="Relative distance band"
                >
                  <span
                    style={{
                      width: `${Math.min(
                        100,
                        (selected.distanceM /
                          1000 /
                          Math.max(plan.comparison.maxDistanceKm, 1)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
                <p>
                  Climb {Math.round(plan.comparison.minClimbM)}–
                  {Math.round(plan.comparison.maxClimbM)} m
                </p>
                <div
                  className="comparison-bar comparison-bar--climb"
                  title="Relative climb band"
                >
                  <span
                    style={{
                      width: `${Math.min(
                        100,
                        (selected.elevGainM /
                          Math.max(plan.comparison.maxClimbM, 1)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="plan-meta">
          {selected.weather ? (
            <p className="weather weather--prominent">
              <span className="eyebrow">Weather on route</span>
              {selected.weather.summary} · {Math.round(selected.weather.tempC)}
              °C · wind {Math.round(selected.weather.windKmh)} km/h
              {selected.weather.precipMm >= 0.5
                ? ` · precip ${selected.weather.precipMm.toFixed(1)} mm`
                : ""}
              {selected.weather.source === "clickhouse"
                ? " · via ClickHouse weather grid"
                : selected.weather.source === "open-meteo"
                  ? " · live Open-Meteo"
                  : ""}
            </p>
          ) : (
            <p className="weather weather--missing">
              No weather snapshot yet — run weather ingest or regenerate routes.
            </p>
          )}
          <p className="comparison">
            Candidates span {plan.comparison.minDistanceKm.toFixed(1)}–
            {plan.comparison.maxDistanceKm.toFixed(1)} km and{" "}
            {Math.round(plan.comparison.minClimbM)}–
            {Math.round(plan.comparison.maxClimbM)} m climb
          </p>
          {selected.similarRideLabels.length > 0 && (
            <p className="similar">
              Similar past rides: {selected.similarRideLabels.join(" · ")}
            </p>
          )}
        </div>

        {selected.tips.length > 0 && (
          <section>
            <h2>Tips</h2>
            <ul className="tips">
              {selected.tips.map((tip, i) => (
                <li key={`tip-${i}`}>{tip}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className="summary-footer">
          <p>
            CycleForge session{" "}
            <code className="summary-session">{plan.sessionId.slice(0, 8)}</code>
            {" · "}
            route source {selected.source}
          </p>
          <p className="no-print">
            <Link href="/">← Back to planner</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
