"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RouteScore } from "@/lib/types";

const BARS = [
  { key: "goalFit", label: "Goal", color: "#1f6b4a" },
  { key: "safetyProxy", label: "Quiet", color: "#2f5d8c" },
  { key: "scenicProxy", label: "Scenic", color: "#c4a035" },
  { key: "weatherFit", label: "Weather", color: "#c45c26" },
] as const;

export function ScoreChart({ score }: { score: RouteScore }) {
  const data = BARS.map((b) => ({
    name: b.label,
    value: Math.round(score[b.key] * 100),
    color: b.color,
  }));

  return (
    <div className="score-chart">
      <div className="score-chart__total" aria-label="Total goal fit">
        <svg viewBox="0 0 36 36" className="score-ring">
          <circle cx="18" cy="18" r="15.5" className="score-ring__track" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            className="score-ring__value"
            style={{
              strokeDasharray: `${Math.round(score.total * 100)} 100`,
            }}
          />
        </svg>
        <div>
          <span className="label">Goal fit</span>
          <strong>{Math.round(score.total * 100)}</strong>
        </div>
      </div>
      <div className="score-chart__bars">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={58}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value) => [`${value}`, "Score"]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={12}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
