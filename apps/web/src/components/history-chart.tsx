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
import type { HistoryContext } from "@/lib/types";

export function HistoryChart({ history }: { history: HistoryContext }) {
  const data = [
    { name: "7d h", value: history.hoursLast7d, fill: "#2f5d8c" },
    { name: "28d h", value: history.hoursLast28d, fill: "#1f6b4a" },
    { name: "7d TSS", value: history.tssLast7d, fill: "#c45c26" },
    { name: "28d TSS", value: history.tssLast28d, fill: "#c4a035" },
  ];

  return (
    <div className="history-chart">
      <div className="history-chart__meta">
        <div>
          <span className="label">Athlete</span>
          <strong>{history.athleteLabel}</strong>
        </div>
        <div>
          <span className="label">Rides</span>
          <strong>{history.rideCount}</strong>
        </div>
        <div>
          <span className="label">Load</span>
          <strong className="history-chart__hint">{history.loadHint}</strong>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={32}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
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
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {history.recentLabels.length > 0 ? (
        <p className="history-chart__recent">
          Recent: {history.recentLabels.slice(0, 3).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
