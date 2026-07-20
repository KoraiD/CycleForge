"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildCoachNote } from "@/lib/coach-note";
import { ROUTE_COLORS } from "@/lib/constants";
import { downloadRouteGpx } from "@/lib/gpx";
import type {
  Intensity,
  PlanPayload,
  TerrainBias,
  WizardState,
} from "@/lib/types";
import { ElevationChart } from "./elevation-chart";
import { RouteMap } from "./route-map";
import { TrainingBlock } from "./training-block";

const INTENSITIES: Intensity[] = ["easy", "endurance", "tempo", "hills"];
const TERRAINS: TerrainBias[] = ["flat", "rolling", "hilly"];

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
}

export type PlanTweak = Partial<
  Pick<WizardState, "durationMin" | "intensity" | "terrainBias" | "avoidBusyRoads">
> & { preset?: "shorter" | "hillier" | "easier" };

export function PlanPanel({
  plan,
  onSelectRoute,
  onRefine,
  onApplyTweaks,
  refining,
}: {
  plan: PlanPayload;
  onSelectRoute?: (routeId: string) => void;
  onRefine?: (kind: "shorter" | "hillier" | "easier") => void;
  onApplyTweaks?: (tweak: PlanTweak) => void;
  refining?: boolean;
}) {
  // Drafts reset when Chat remounts this panel after regenerate (key change).
  const [selectedId, setSelectedId] = useState(plan.selectedRouteId);
  const [draftDuration, setDraftDuration] = useState(plan.wizard.durationMin);
  const [draftIntensity, setDraftIntensity] = useState(plan.wizard.intensity);
  const [draftTerrain, setDraftTerrain] = useState(plan.wizard.terrainBias);
  const [draftQuiet, setDraftQuiet] = useState(plan.wizard.avoidBusyRoads);
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

  if (!selected) return null;

  const selectedIndex = Math.max(
    0,
    plan.routes.findIndex((r) => r.routeId === selected.routeId),
  );
  const accent = ROUTE_COLORS[selectedIndex % ROUTE_COLORS.length];

  const tweaksDirty =
    draftDuration !== plan.wizard.durationMin ||
    draftIntensity !== plan.wizard.intensity ||
    draftTerrain !== plan.wizard.terrainBias ||
    draftQuiet !== plan.wizard.avoidBusyRoads;

  const handleSelect = (routeId: string) => {
    setSelectedId(routeId);
    setHoverKm(null);
    setPreviewRouteId(null);
    onSelectRoute?.(routeId);
  };

  const applyTweaks = () => {
    onApplyTweaks?.({
      durationMin: draftDuration,
      intensity: draftIntensity,
      terrainBias: draftTerrain,
      avoidBusyRoads: draftQuiet,
    });
  };

  return (
    <section className="plan-panel animate-in" aria-busy={refining}>
      <header className="plan-panel__header">
        <div>
          <p className="eyebrow">Visual plan</p>
          <h2>{selected.label}</h2>
          {plan.wizard.startLabel ? (
            <p className="start-meta">From {plan.wizard.startLabel}</p>
          ) : null}
        </div>
        <div className="plan-panel__actions">
          <Link
            href={`/summary/${plan.sessionId}?route=${encodeURIComponent(selected.routeId)}`}
            className="ghost gpx-export"
            aria-disabled={refining}
            onClick={(e) => {
              if (refining) e.preventDefault();
            }}
          >
            Open summary
          </Link>
          <button
            type="button"
            className="ghost gpx-export"
            disabled={refining}
            onClick={() => downloadRouteGpx(selected)}
          >
            Download GPX
          </button>
          <div className="score-pill" title="Goal fit score">
            Fit {Math.round(selected.score.total * 100)}
          </div>
        </div>
      </header>

      {plan.historyContext ? (
        <p className="history-banner" title={plan.historyContext.summaryLine}>
          <span className="eyebrow">Athlete history</span>
          {plan.historyContext.athleteLabel}: {plan.historyContext.rideCount}{" "}
          rides · {plan.historyContext.hoursLast7d}h / TSS{" "}
          {plan.historyContext.tssLast7d} last 7d
          {plan.historyContext.lastHardLabel
            ? ` · last hard “${plan.historyContext.lastHardLabel}” ${plan.historyContext.lastHardDaysAgo}d ago`
            : ""}
          {" · "}
          {plan.historyContext.loadHint}
        </p>
      ) : null}

      {coachNote ? (
        <article className="coach-note" aria-label="Coaching suggestion">
          <p className="eyebrow">Coach note</p>
          {coachNote.split("\n\n").map((para) => (
            <p key={para.slice(0, 48)}>{para}</p>
          ))}
        </article>
      ) : null}

      {refining && (
        <p className="status-banner" role="status">
          Updating routes with your tweaks…
        </p>
      )}

      <div className="tweak-panel">
        <div className="tweak-panel__head">
          <p className="eyebrow">Tune this result</p>
          {onRefine && (
            <div className="refine-chips" aria-label="Quick refine">
              <button
                type="button"
                className="chip"
                disabled={refining}
                onClick={() => onRefine("shorter")}
              >
                Shorter
              </button>
              <button
                type="button"
                className="chip"
                disabled={refining}
                onClick={() => onRefine("hillier")}
              >
                Hillier
              </button>
              <button
                type="button"
                className="chip"
                disabled={refining}
                onClick={() => onRefine("easier")}
              >
                Easier
              </button>
            </div>
          )}
        </div>

        <label className="field">
          <span>Duration (min)</span>
          <input
            type="range"
            min={45}
            max={210}
            step={15}
            value={draftDuration}
            disabled={refining}
            onChange={(e) => setDraftDuration(Number(e.target.value))}
          />
          <strong>{draftDuration} min</strong>
        </label>

        <div className="chip-row">
          <span className="chip-label">Intensity</span>
          {INTENSITIES.map((value) => (
            <button
              key={value}
              type="button"
              disabled={refining}
              className={draftIntensity === value ? "chip active" : "chip"}
              onClick={() => setDraftIntensity(value)}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="chip-row">
          <span className="chip-label">Terrain</span>
          {TERRAINS.map((value) => (
            <button
              key={value}
              type="button"
              disabled={refining}
              className={draftTerrain === value ? "chip active" : "chip"}
              onClick={() => setDraftTerrain(value)}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={draftQuiet}
            disabled={refining}
            onChange={(e) => setDraftQuiet(e.target.checked)}
          />
          Prefer quieter roads
        </label>

        <button
          type="button"
          className="primary tweak-apply"
          disabled={refining || !tweaksDirty || !onApplyTweaks}
          onClick={applyTweaks}
        >
          {refining ? "Regenerating…" : "Apply & regenerate"}
        </button>
      </div>

      <RouteMap
        routes={plan.routes}
        selectedRouteId={selected.routeId}
        onSelect={handleSelect}
        hoverKm={hoverKm}
        onHoverKm={setHoverKm}
        previewRouteId={previewRouteId}
        onPreviewRoute={setPreviewRouteId}
      />

      <div className="route-cards" role="list">
        {plan.routes.map((route, index) => {
          const active = route.routeId === selected.routeId;
          const preview = route.routeId === previewRouteId;
          return (
            <button
              key={route.routeId}
              type="button"
              role="listitem"
              className={
                active
                  ? "route-card active"
                  : preview
                    ? "route-card preview"
                    : "route-card"
              }
              disabled={refining}
              onClick={() => handleSelect(route.routeId)}
              onMouseEnter={() =>
                setPreviewRouteId(
                  route.routeId === selected.routeId ? null : route.routeId,
                )
              }
              onMouseLeave={() => setPreviewRouteId(null)}
              style={{
                ["--route-accent" as string]:
                  ROUTE_COLORS[index % ROUTE_COLORS.length],
              }}
            >
              <span className="route-card__title">{route.label}</span>
              <span className="route-card__meta">
                {(route.distanceM / 1000).toFixed(1)} km ·{" "}
                {Math.round(route.elevGainM)} m · TSS {route.training.tssEst}
              </span>
              <span className="route-card__fit">
                {Math.round(route.score.total * 100)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="kpi-strip">
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
      </div>

      <div className="plan-grid">
        <div>
          <h3>Elevation</h3>
          <ElevationChart
            profile={selected.elevProfile}
            accent={accent}
            hoverKm={hoverKm}
            onHoverKm={setHoverKm}
          />
        </div>
        <div>
          <h3>Training effect</h3>
          <TrainingBlock training={selected.training} />
        </div>
      </div>

      <div className="plan-meta">
        {selected.weather && (
          <p className="weather">
            {selected.weather.summary} · {Math.round(selected.weather.tempC)}°C ·
            wind {Math.round(selected.weather.windKmh)} km/h
            {selected.weather.source === "clickhouse"
              ? " · via ClickHouse weather grid"
              : selected.weather.source === "open-meteo"
                ? " · live Open-Meteo"
                : ""}
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

      <ul className="tips">
        {selected.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}
