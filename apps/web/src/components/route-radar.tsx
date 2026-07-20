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

export function RouteRadar({
  routes,
  selectedRouteId,
  onSelect,
}: {
  routes: RouteCandidate[];
  selectedRouteId: string;
  onSelect: (routeId: string) => void;
}) {
  const axes = [
    { key: "goalFit", label: "Goal" },
    { key: "safetyProxy", label: "Quiet" },
    { key: "scenicProxy", label: "Scenic" },
    { key: "weatherFit", label: "Weather" },
    { key: "total", label: "Total" },
  ] as const;

  const data = axes.map((axis) => {
    const row: Record<string, string | number> = { axis: axis.label };
    for (const route of routes) {
      row[route.routeId] = Math.round(route.score[axis.key] * 100);
    }
    return row;
  });

  return (
    <div className="route-radar">
      <p className="eyebrow">Compare routes</p>
      <div className="route-radar__chart">
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={data}>
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
                  route.routeId === selectedRouteId ? 0.35 : 0.08
                }
                strokeWidth={route.routeId === selectedRouteId ? 2.5 : 1.25}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="route-radar__legend">
        {routes.map((route, i) => (
          <button
            key={route.routeId}
            type="button"
            className={
              route.routeId === selectedRouteId
                ? "radar-chip active"
                : "radar-chip"
            }
            style={{
              ["--route-accent" as string]:
                ROUTE_COLORS[i % ROUTE_COLORS.length],
            }}
            onClick={() => onSelect(route.routeId)}
          >
            {route.label}
          </button>
        ))}
      </div>
    </div>
  );
}
