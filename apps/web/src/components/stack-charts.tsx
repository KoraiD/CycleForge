"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StackStats } from "@/lib/clickhouse";

const CH_GREEN = "#3f8f6b";
const TRIGGER_PURPLE = "#7c5cbf";

const RUN_STATUS_COLORS: Record<string, string> = {
  COMPLETED: CH_GREEN,
  EXECUTING: "#2f5d8c",
  QUEUED: "#c4a035",
  DELAYED: "#c4a035",
  FAILED: "#c45c26",
  CRASHED: "#c45c26",
  CANCELED: "#8a8f8c",
  SYSTEM_FAILURE: "#c45c26",
};

function statusColor(status: string): string {
  const key = status.toUpperCase();
  return RUN_STATUS_COLORS[key] ?? "#5d6b63";
}

function runLabel(createdAt: string, id: string): string {
  const d = new Date(createdAt);
  if (!Number.isFinite(d.getTime())) return id.slice(0, 6);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function StackCharts({ stats }: { stats: StackStats }) {
  const tableData = useMemo(() => {
    const rows = [
      { name: "sessions", value: stats.counts.planSessions },
      { name: "routes", value: stats.counts.routesLive },
      { name: "seed", value: stats.counts.routesSeed },
      { name: "scores", value: stats.counts.routeScores },
      { name: "weather", value: stats.counts.weatherTiles },
      { name: "history", value: stats.counts.riderHistoryRides },
      { name: "blocks", value: stats.counts.trainingBlocks },
    ];
    return rows.map((r) => ({ name: r.name, value: r.value ?? null }));
  }, [stats.counts]);

  const hasLiveTables = tableData.some((r) => r.value !== null);
  const liveTableData = tableData.filter(
    (r): r is { name: string; value: number } => r.value !== null,
  );

  // Demo day-shape so the chart still tells the story with zero config.
  const demoTableData = useMemo(() => {
    const demo: Array<{ name: string; value: number; demo: true }> = [
      { name: "sessions", value: 18, demo: true },
      { name: "routes", value: 51, demo: true },
      { name: "seed", value: 20, demo: true },
      { name: "scores", value: 51, demo: true },
      { name: "weather", value: 64, demo: true },
      { name: "history", value: 21, demo: true },
      { name: "blocks", value: 3, demo: true },
    ];
    return demo;
  }, []);

  const runChart = useMemo(() => {
    const runs = stats.recentRuns.slice(0, 10).reverse();
    return runs.map((r, i) => ({
      name: runLabel(r.createdAt, r.id),
      value: 1,
      status: r.status,
      task: r.taskIdentifier,
      key: `${r.id}-${i}`,
    }));
  }, [stats.recentRuns]);

  const showRuns = runChart.length > 0;

  return (
    <div className="stack-charts">
      <div className="stack-chart-card">
        <div className="stack-chart-card__head">
          <h3>ClickHouse rows per table</h3>
          <span className={`stack-pill ${hasLiveTables ? "on" : "off"}`}>
            {hasLiveTables ? "live" : "demo shape"}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart
            data={hasLiveTables ? liveTableData : demoTableData}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, _name, item) => [
                `${value} rows${(item?.payload as { demo?: boolean })?.demo ? " (demo)" : ""}`,
                "Table",
              ]}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={22}>
              {(hasLiveTables ? liveTableData : demoTableData).map((d) => (
                <Cell
                  key={d.name}
                  fill={CH_GREEN}
                  fillOpacity={"demo" in d ? 0.45 : 0.95}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="stack-chart-card">
        <div className="stack-chart-card__head">
          <h3>Recent Trigger.dev runs</h3>
          <span className={`stack-pill ${showRuns ? "on" : "off"}`}>
            {showRuns ? "live" : "no runs yet"}
          </span>
        </div>
        {showRuns ? (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={runChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis hide domain={[0, 1.4]} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(_value, _name, item) => {
                  const p = item?.payload as { task?: string; status?: string };
                  return [`${p?.task ?? "run"} — ${p?.status ?? ""}`, "Run"];
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={20}>
                {runChart.map((d) => (
                  <Cell key={d.key} fill={statusColor(d.status)} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="stack-chart-empty">
            <span className="stack-chart-empty__spark" aria-hidden />
            <p>
              Generate a plan (or wait for the cron heartbeat) and refresh — run
              history appears here, colored by status.
            </p>
          </div>
        )}
        <ul className="stack-chart-legend" aria-label="Run status colors">
          <li><span style={{ background: CH_GREEN }} /> completed</li>
          <li><span style={{ background: "#2f5d8c" }} /> executing</li>
          <li><span style={{ background: "#c4a035" }} /> queued</li>
          <li><span style={{ background: "#c45c26" }} /> failed</li>
        </ul>
        <span className="stack-chart-legend__brand" style={{ color: TRIGGER_PURPLE }}>
          ◆ Trigger.dev
        </span>
      </div>
    </div>
  );
}
