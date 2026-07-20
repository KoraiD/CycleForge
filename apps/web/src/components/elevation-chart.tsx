"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ElevPoint } from "@/lib/types";

export function ElevationChart({
  profile,
  accent = "#1f6b4a",
}: {
  profile: ElevPoint[];
  accent?: string;
}) {
  if (!profile.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
        No elevation data
      </div>
    );
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={profile} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          <Area
            type="monotone"
            dataKey="elevM"
            stroke={accent}
            fill="url(#elevFill)"
            strokeWidth={2}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
