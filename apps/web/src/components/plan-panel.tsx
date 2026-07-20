"use client";

import { useMemo, useState } from "react";
import { ROUTE_COLORS } from "@/lib/constants";
import type { PlanPayload } from "@/lib/types";
import { ElevationChart } from "./elevation-chart";
import { RouteMap } from "./route-map";
import { TrainingBlock } from "./training-block";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
}

export function PlanPanel({
  plan,
  onSelectRoute,
}: {
  plan: PlanPayload;
  onSelectRoute?: (routeId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(plan.selectedRouteId);

  const selected = useMemo(() => {
    return (
      plan.routes.find((r) => r.routeId === selectedId) ?? plan.routes[0] ?? null
    );
  }, [plan.routes, selectedId]);

  if (!selected) return null;

  const selectedIndex = Math.max(
    0,
    plan.routes.findIndex((r) => r.routeId === selected.routeId),
  );
  const accent = ROUTE_COLORS[selectedIndex % ROUTE_COLORS.length];

  const handleSelect = (routeId: string) => {
    setSelectedId(routeId);
    onSelectRoute?.(routeId);
  };

  return (
    <section className="plan-panel animate-in">
      <header className="plan-panel__header">
        <div>
          <p className="eyebrow">Visual plan</p>
          <h2>{selected.label}</h2>
        </div>
        <div className="score-pill">
          Fit {Math.round(selected.score.total * 100)}
        </div>
      </header>

      <RouteMap
        routes={plan.routes}
        selectedRouteId={selected.routeId}
        onSelect={handleSelect}
      />

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
          <ElevationChart profile={selected.elevProfile} accent={accent} />
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
