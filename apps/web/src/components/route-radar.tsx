"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ROUTE_COLORS } from "@/lib/constants";
import type { RouteCandidate } from "@/lib/types";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function deltaLabel(
  value: number,
  unit: string,
  higherIsBetter: boolean,
): { text: string; better: boolean | null } {
  if (Math.abs(value) < 0.05) return { text: "same", better: null };
  const better = higherIsBetter ? value > 0 : value < 0;
  const sign = value > 0 ? "+" : "";
  return {
    text: `${sign}${value}${unit}`,
    better,
  };
}

function Delta({
  mark,
  active,
}: {
  mark: { text: string; better: boolean | null };
  active: boolean;
}) {
  if (active) return <small className="route-compare__delta">selected</small>;
  if (mark.better === null) {
    return <small className="route-compare__delta">{mark.text}</small>;
  }
  return (
    <small
      className={
        mark.better
          ? "route-compare__delta route-compare__delta--up"
          : "route-compare__delta route-compare__delta--down"
      }
    >
      {mark.text}
    </small>
  );
}

type AxisKey = "goalFit" | "safetyProxy" | "scenicProxy" | "weatherFit" | "total";

const AXES: Array<{ key: AxisKey; label: string }> = [
  { key: "goalFit", label: "Goal" },
  { key: "safetyProxy", label: "Quiet" },
  { key: "scenicProxy", label: "Scenic" },
  { key: "weatherFit", label: "Weather" },
  { key: "total", label: "Total" },
];

export function RouteRadar({
  routes,
  selectedRouteId,
  onSelect,
  onPreview,
}: {
  routes: RouteCandidate[];
  selectedRouteId: string;
  onSelect: (routeId: string) => void;
  onPreview?: (routeId: string | null) => void;
}) {
  const ranked = [...routes].sort((a, b) => b.score.total - a.score.total);
  const selected =
    routes.find((r) => r.routeId === selectedRouteId) ?? ranked[0] ?? null;
  const best = ranked[0] ?? null;

  const chartData = AXES.map((axis) => {
    const row: Record<string, string | number> = { axis: axis.label };
    for (const route of routes) {
      row[route.routeId] = Math.round(route.score[axis.key] * 100);
    }
    return row;
  });

  const bestDist = Math.min(...routes.map((r) => r.distanceM));
  const bestClimb = Math.min(...routes.map((r) => r.elevGainM));
  const bestTss = Math.min(...routes.map((r) => r.training.tssEst));
  const bestFit = Math.max(...routes.map((r) => r.score.total));

  const vsBest =
    selected && best && selected.routeId !== best.routeId
      ? Math.round((selected.score.total - best.score.total) * 100)
      : 0;

  return (
    <section className="route-compare" aria-label="Compare routes">
      <header className="route-compare__head">
        <div>
          <p className="eyebrow">Compare routes</p>
          <h3 className="route-compare__title">
            {ranked.length} candidates · pick by fit, climb, or quiet roads
          </h3>
        </div>
        {selected && best ? (
          <p className="route-compare__verdict">
            {selected.routeId === best.routeId ? (
              <>
                <strong>{selected.label}</strong> leads on goal fit (
                {Math.round(selected.score.total * 100)})
              </>
            ) : (
              <>
                <strong>{best.label}</strong> leads · selected is{" "}
                <span
                  className={
                    vsBest >= 0
                      ? "route-compare__delta route-compare__delta--up"
                      : "route-compare__delta route-compare__delta--down"
                  }
                >
                  {vsBest >= 0 ? "+" : ""}
                  {vsBest} fit
                </span>
              </>
            )}
          </p>
        ) : null}
      </header>

      <div className="route-compare__layout">
        <div className="route-compare__chart" aria-hidden={false}>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={chartData}>
              <PolarGrid stroke="var(--line)" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: "var(--muted)", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              {routes.map((route, i) => (
                <Radar
                  key={route.routeId}
                  name={route.label}
                  dataKey={route.routeId}
                  stroke={ROUTE_COLORS[i % ROUTE_COLORS.length]}
                  fill={ROUTE_COLORS[i % ROUTE_COLORS.length]}
                  fillOpacity={
                    route.routeId === selectedRouteId ? 0.38 : 0.06
                  }
                  strokeWidth={route.routeId === selectedRouteId ? 2.75 : 1.15}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelect(route.routeId)}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
          <div className="route-compare__chips">
            {routes.map((route, i) => {
              const active = route.routeId === selectedRouteId;
              return (
                <button
                  key={route.routeId}
                  type="button"
                  className={active ? "radar-chip active" : "radar-chip"}
                  style={{
                    ["--route-accent" as string]:
                      ROUTE_COLORS[i % ROUTE_COLORS.length],
                  }}
                  aria-pressed={active}
                  onClick={() => onSelect(route.routeId)}
                  onMouseEnter={() => onPreview?.(route.routeId)}
                  onMouseLeave={() => onPreview?.(null)}
                  onFocus={() => onPreview?.(route.routeId)}
                  onBlur={() => onPreview?.(null)}
                >
                  <span className="radar-chip__fit">
                    {Math.round(route.score.total * 100)}
                  </span>
                  {route.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="route-compare__table-wrap">
          <table className="route-compare__table">
            <caption className="sr-only">
              Side-by-side route metrics. Click a row to select that route.
            </caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Dist</th>
                <th scope="col">Climb</th>
                <th scope="col">Time</th>
                <th scope="col">TSS</th>
                <th scope="col">Fit</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((route) => {
                const colorIndex = routes.findIndex(
                  (r) => r.routeId === route.routeId,
                );
                const active = route.routeId === selectedRouteId;
                const distKm = route.distanceM / 1000;
                const distDelta = selected
                  ? Number((distKm - selected.distanceM / 1000).toFixed(1))
                  : 0;
                const climbDelta = selected
                  ? Math.round(route.elevGainM - selected.elevGainM)
                  : 0;
                const fitDelta = selected
                  ? Math.round((route.score.total - selected.score.total) * 100)
                  : 0;
                const distMark = deltaLabel(distDelta, " km", false);
                const climbMark = deltaLabel(climbDelta, " m", false);
                const fitMark = deltaLabel(fitDelta, "", true);

                return (
                  <tr
                    key={route.routeId}
                    className={
                      active
                        ? "route-compare__row route-compare__row--active"
                        : "route-compare__row"
                    }
                    tabIndex={0}
                    aria-selected={active}
                    onClick={() => onSelect(route.routeId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(route.routeId);
                      }
                    }}
                    onMouseEnter={() => onPreview?.(route.routeId)}
                    onMouseLeave={() => onPreview?.(null)}
                    style={{
                      ["--route-accent" as string]:
                        ROUTE_COLORS[colorIndex % ROUTE_COLORS.length],
                    }}
                  >
                    <th scope="row">
                      <span className="route-compare__name">{route.label}</span>
                      {route.routeId === best?.routeId ? (
                        <span className="route-compare__badge">Best fit</span>
                      ) : null}
                    </th>
                    <td
                      className={
                        route.distanceM === bestDist
                          ? "route-compare__cell--best"
                          : undefined
                      }
                    >
                      <strong>{distKm.toFixed(1)} km</strong>
                      <Delta mark={distMark} active={active} />
                    </td>
                    <td
                      className={
                        route.elevGainM === bestClimb
                          ? "route-compare__cell--best"
                          : undefined
                      }
                    >
                      <strong>{Math.round(route.elevGainM)} m</strong>
                      <Delta mark={climbMark} active={active} />
                    </td>
                    <td>
                      <strong>{formatDuration(route.durationS)}</strong>
                    </td>
                    <td
                      className={
                        route.training.tssEst === bestTss
                          ? "route-compare__cell--best"
                          : undefined
                      }
                    >
                      <strong>{route.training.tssEst}</strong>
                    </td>
                    <td
                      className={
                        route.score.total === bestFit
                          ? "route-compare__cell--best"
                          : undefined
                      }
                    >
                      <strong>{Math.round(route.score.total * 100)}</strong>
                      <Delta mark={fitMark} active={active} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="route-compare__hint">
            Hover to preview on the map · click to select · deltas are vs the
            selected route
          </p>
        </div>
      </div>
    </section>
  );
}
