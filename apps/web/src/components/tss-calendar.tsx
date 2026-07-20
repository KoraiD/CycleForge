"use client";

import { useMemo } from "react";
import type { HistoryContext } from "@/lib/types";

function daysBack(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function TssCalendar({ history }: { history: HistoryContext }) {
  const cells = useMemo(() => {
    const map = new Map(
      (history.dailyLoad ?? []).map((d) => [d.date, d]),
    );
    const max = Math.max(
      1,
      ...(history.dailyLoad ?? []).map((d) => d.tss),
    );
    return daysBack(28).map((date) => {
      const hit = map.get(date);
      const tss = hit?.tss ?? 0;
      return {
        date,
        tss,
        hours: hit?.hours ?? 0,
        label: hit?.label,
        intensity: tss / max,
      };
    });
  }, [history.dailyLoad]);

  return (
    <div className="tss-calendar">
      <p className="eyebrow">Load calendar</p>
      <p className="tss-calendar__lede">
        {history.athleteLabel} · last 28 days · TSS heat
      </p>
      <div className="tss-calendar__grid" role="list">
        {cells.map((c) => (
          <div
            key={c.date}
            role="listitem"
            className="tss-cell"
            title={
              c.tss
                ? `${c.date}: TSS ${c.tss}${c.label ? ` · ${c.label}` : ""}`
                : `${c.date}: rest`
            }
            style={{
              background: c.tss
                ? `color-mix(in srgb, var(--accent) ${Math.round(c.intensity * 85)}%, #e8efe9)`
                : "#eef1ee",
            }}
          />
        ))}
      </div>
      <div className="tss-calendar__legend">
        <span>Rest</span>
        <span className="tss-calendar__ramp" />
        <span>Hard</span>
      </div>
    </div>
  );
}
