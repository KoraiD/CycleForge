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
import type { TrainingBlockPlan } from "@/lib/training-block-plan";
import { CommuteVerdict } from "./commute-verdict";
import { ElevationChart } from "./elevation-chart";
import { INTENSITY_META, TERRAIN_META } from "./icon";
import { RouteMiniMap } from "./route-mini-map";
import { RoadTypeStrip } from "./road-type-strip";
import { HistoryChart } from "./history-chart";
import { DurationField } from "./duration-field";
import { RouteMap } from "./route-map";
import { RouteRadar } from "./route-radar";
import { ScoreChart } from "./score-chart";
import { ScoreExplainDrawer } from "./score-explain";
import { TrainingBlock } from "./training-block";
import { TrainingBlockPanel } from "./training-block-panel";
import { TssCalendar } from "./tss-calendar";

const INTENSITIES: Intensity[] = ["easy", "endurance", "tempo", "hills"];
const TERRAINS: TerrainBias[] = ["flat", "rolling", "hilly"];

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
}

export type PlanTweak = Partial<
  Pick<
    WizardState,
    "durationMin" | "intensity" | "terrainBias" | "avoidBusyRoads" | "ftpWatts"
  >
> & { preset?: "shorter" | "hillier" | "easier" };

export function PlanPanel({
  plan,
  onSelectRoute,
  onApplyTweaks,
  refining,
  selectingRoute,
  trainingBlock = null,
  onCreateTrainingBlock,
  blockBusy,
  morphFrom = null,
}: {
  plan: PlanPayload;
  onSelectRoute?: (routeId: string) => void;
  onApplyTweaks?: (tweak: PlanTweak) => void;
  refining?: boolean;
  selectingRoute?: boolean;
  trainingBlock?: TrainingBlockPlan | null;
  onCreateTrainingBlock?: () => void;
  blockBusy?: boolean;
  morphFrom?: GeoJSON.LineString | null;
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

  const panelBusy = Boolean(refining || selectingRoute);

  return (
    <section className="plan-panel animate-in" aria-busy={panelBusy}>
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
            aria-disabled={panelBusy}
            onClick={(e) => {
              if (panelBusy) e.preventDefault();
            }}
          >
            Open summary
          </Link>
          <button
            type="button"
            className="ghost gpx-export"
            disabled={panelBusy}
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
          {coachNote.split("\n\n").map((para, i) => (
            <p key={`coach-${i}`}>{para}</p>
          ))}
        </article>
      ) : null}

      {plan.leaveWindow ? <CommuteVerdict leave={plan.leaveWindow} /> : null}

      <ScoreExplainDrawer route={selected} wizard={plan.wizard} />

      {selectingRoute && (
        <div className="route-select-progress" role="status">
          <span className="route-select-spinner" aria-hidden />
          <p>Loading selected route — scoring details and map sync…</p>
        </div>
      )}

      {refining && !selectingRoute && (
        <p className="status-banner" role="status">
          Updating routes with your tweaks…
        </p>
      )}

      <div className="tweak-panel">
        <div className="tweak-panel__head">
          <p className="eyebrow">Tune this result</p>
        </div>

        <DurationField
          durationMin={draftDuration}
          intensity={draftIntensity}
          disabled={panelBusy}
          onChange={setDraftDuration}
        />

        <div className="chip-row chip-row--visual">
          <span className="chip-label">Intensity</span>
          {INTENSITIES.map((value) => {
            const { Icon, blurb } = INTENSITY_META[value];
            return (
              <button
                key={value}
                type="button"
                disabled={panelBusy}
                className={draftIntensity === value ? "chip chip--icon active" : "chip chip--icon"}
                onClick={() => setDraftIntensity(value)}
              >
                <Icon size={20} className="chip__icon" />
                <span className="chip__text">
                  <strong>{value}</strong>
                  <small>{blurb}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div className="chip-row chip-row--visual">
          <span className="chip-label">Terrain</span>
          {TERRAINS.map((value) => {
            const { Icon, blurb } = TERRAIN_META[value];
            return (
              <button
                key={value}
                type="button"
                disabled={panelBusy}
                className={draftTerrain === value ? "chip chip--icon active" : "chip chip--icon"}
                onClick={() => setDraftTerrain(value)}
              >
                <Icon size={20} className="chip__icon" />
                <span className="chip__text">
                  <strong>{value}</strong>
                  <small>{blurb}</small>
                </span>
              </button>
            );
          })}
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={draftQuiet}
            disabled={panelBusy}
            onChange={(e) => setDraftQuiet(e.target.checked)}
          />
          Prefer quieter roads
        </label>

        <button
          type="button"
          className="primary tweak-apply"
          disabled={panelBusy || !tweaksDirty || !onApplyTweaks}
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
        morphFrom={morphFrom}
      />

      <RoadTypeStrip route={selected} accent={accent} />

      <RouteRadar
        routes={plan.routes}
        selectedRouteId={selected.routeId}
        wizard={plan.wizard}
        onSelect={handleSelect}
        onPreview={setPreviewRouteId}
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
                  disabled={panelBusy}
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
              <span className="route-card__drawing" aria-hidden>
                <RouteMiniMap
                  geometry={route.geometry}
                  color={ROUTE_COLORS[index % ROUTE_COLORS.length]}
                  active={active}
                />
              </span>
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
            effortSegments={selected.effortSegments}
          />
        </div>
        <div>
          <h3>Training effect</h3>
          <TrainingBlock training={selected.training} />
        </div>
      </div>

      {onCreateTrainingBlock ? (
        <TrainingBlockPanel
          block={trainingBlock}
          onCreate={onCreateTrainingBlock}
          busy={blockBusy}
        />
      ) : null}

      <div className="plan-grid">
        <div>
          <h3>Score breakdown</h3>
          <ScoreChart score={selected.score} />
        </div>
        {plan.historyContext ? (
          <div>
            <h3>Athlete load</h3>
            <HistoryChart history={plan.historyContext} />
            <TssCalendar history={plan.historyContext} />
          </div>
        ) : null}
      </div>

      <div className="plan-meta">
        {selected.weather ? (
          <p className="weather weather--prominent">
            <span className="eyebrow">Weather on route</span>
            {selected.weather.summary} · {Math.round(selected.weather.tempC)}°C ·
            wind {Math.round(selected.weather.windKmh)} km/h
            {selected.weather.source === "clickhouse"
              ? " · via ClickHouse weather grid"
              : selected.weather.source === "open-meteo"
                ? " · live Open-Meteo"
                : ""}
          </p>
        ) : (
          <p className="weather weather--missing">
            No weather snapshot on this route yet.
          </p>
        )}
        <p className="comparison">
          Span {plan.comparison.minDistanceKm.toFixed(1)}–
          {plan.comparison.maxDistanceKm.toFixed(1)} km ·{" "}
          {Math.round(plan.comparison.minClimbM)}–
          {Math.round(plan.comparison.maxClimbM)} m climb — use Compare routes
          above to switch candidates.
        </p>
        {selected.similarRideLabels.length > 0 && (
          <p className="similar">
            Similar past rides: {selected.similarRideLabels.join(" · ")}
          </p>
        )}
      </div>

      <ul className="tips">
        {selected.tips.map((tip, i) => (
          <li key={`tip-${i}`}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}
