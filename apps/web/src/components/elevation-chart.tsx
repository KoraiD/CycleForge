"use client";

import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EffortSegment, ElevPoint } from "@/lib/types";

const ZONE_FILL: Record<number, string> = {
  1: "rgba(143, 179, 154, 0.28)",
  2: "rgba(31, 107, 74, 0.18)",
  3: "rgba(196, 160, 53, 0.28)",
  4: "rgba(196, 92, 38, 0.32)",
  5: "rgba(139, 46, 46, 0.35)",
};

function elevAtKm(profile: ElevPoint[], km: number): number | null {
  if (!profile.length) return null;
  if (km <= profile[0].km) return profile[0].elevM;
  const last = profile[profile.length - 1];
  if (km >= last.km) return last.elevM;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if (km <= b.km) {
      const t = (km - a.km) / Math.max(b.km - a.km, 1e-6);
      return a.elevM + t * (b.elevM - a.elevM);
    }
  }
  return last.elevM;
}

export function ElevationChart({
  profile,
  accent = "#1f6b4a",
  hoverKm = null,
  onHoverKm,
  effortSegments = [],
}: {
  profile: ElevPoint[];
  accent?: string;
  hoverKm?: number | null;
  onHoverKm?: (km: number | null) => void;
  effortSegments?: EffortSegment[];
}) {
  if (!profile.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
        No elevation data
      </div>
    );
  }

  const minKm = profile[0].km;
  const maxKm = profile[profile.length - 1].km;
  const hoverElev =
    hoverKm === null || hoverKm === undefined
      ? null
      : elevAtKm(profile, hoverKm);

  const setHoverFromPointer = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const padL = 36;
    const padR = 8;
    const inner = Math.max(rect.width - padL - padR, 1);
    const x = Math.max(0, Math.min(inner, clientX - rect.left - padL));
    const t = x / inner;
    const km = Math.round((minKm + t * (maxKm - minKm)) * 100) / 100;
    onHoverKm?.(km);
  };

  return (
    <div
      className="h-44 w-full elevation-chart"
      onPointerMove={(e) => setHoverFromPointer(e.clientX, e.currentTarget)}
      onMouseMove={(e) => setHoverFromPointer(e.clientX, e.currentTarget)}
      onPointerLeave={() => onHoverKm?.(null)}
      onMouseLeave={() => onHoverKm?.(null)}
    >
      {effortSegments.length > 0 ? (
        <div className="effort-overlay" aria-hidden>
          {effortSegments.map((seg) => {
            const left = ((seg.fromKm - minKm) / Math.max(maxKm - minKm, 0.01)) * 100;
            const width =
              ((seg.toKm - seg.fromKm) / Math.max(maxKm - minKm, 0.01)) * 100;
            return (
              <span
                key={`${seg.fromKm}-${seg.toKm}-${seg.zone}`}
                title={`${seg.label} · Z${seg.zone}`}
                style={{
                  left: `${Math.max(0, left)}%`,
                  width: `${Math.max(1.5, width)}%`,
                  background: ZONE_FILL[seg.zone],
                }}
              />
            );
          })}
        </div>
      ) : null}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={profile}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="km"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickFormatter={(v) => `${v} km`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="elevM"
            width={36}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickFormatter={(v) => `${v}m`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [`${value} m`, "Elevation"]}
            labelFormatter={(label) => `${label} km`}
          />
          {hoverKm !== null && hoverKm !== undefined ? (
            <ReferenceLine
              x={hoverKm}
              stroke={accent}
              strokeDasharray="3 3"
              strokeOpacity={0.7}
            />
          ) : null}
          {hoverKm !== null &&
          hoverKm !== undefined &&
          hoverElev !== null ? (
            <ReferenceDot
              x={hoverKm}
              y={hoverElev}
              r={4}
              fill={accent}
              stroke="#fff"
              strokeWidth={1.5}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="elevM"
            stroke={accent}
            fill="url(#elevFill)"
            strokeWidth={2}
            isAnimationActive={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {hoverKm !== null && hoverKm !== undefined && hoverElev !== null ? (
        <p className="elevation-hover-readout" aria-live="polite">
          {hoverKm.toFixed(1)} km · {Math.round(hoverElev)} m
        </p>
      ) : null}
    </div>
  );
}
