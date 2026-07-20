"use client";

import { useMemo, useState } from "react";
import type { LeaveWindowHint } from "@/lib/types";

export function CommuteVerdict({ leave }: { leave: LeaveWindowHint }) {
  const hours = useMemo(() => leave.hours ?? [], [leave.hours]);
  const bestIdx = Math.max(
    0,
    hours.findIndex((h) => h.time === leave.bestStartIso),
  );
  const [idx, setIdx] = useState(bestIdx >= 0 ? bestIdx : 0);
  const current = hours[idx] ?? null;

  const verdict = current?.verdict ?? "caution";
  const verdictLabel =
    verdict === "go" ? "Go ride" : verdict === "caution" ? "Caution" : "Wait";

  const chart = useMemo(() => {
    if (!hours.length) return null;
    const max = Math.max(...hours.map((h) => h.score), 1);
    return hours.map((h, i) => ({
      ...h,
      height: Math.max(8, (h.score / max) * 100),
      active: i === idx,
    }));
  }, [hours, idx]);

  if (!hours.length) {
    return (
      <aside className="leave-window" aria-label="Best time to leave">
        <p className="eyebrow">Commute verdict</p>
        <p className="leave-window__best">
          <strong>{leave.bestStartLabel}</strong>
          <span className="leave-window__score">score {leave.score}</span>
        </p>
        <p className="leave-window__reason">{leave.reason}</p>
      </aside>
    );
  }

  return (
    <aside className="commute-verdict" aria-label="Should I cycle?">
      <div className="commute-verdict__head">
        <div>
          <p className="eyebrow">Should I cycle?</p>
          <p className={`commute-verdict__cta verdict-${verdict}`}>
            {verdictLabel}
          </p>
        </div>
        <div className="commute-verdict__pick">
          <strong>{current?.label}</strong>
          <span>
            score {current?.score} · {current?.summary} ·{" "}
            {Math.round(current?.tempC ?? 0)}°C · wind{" "}
            {Math.round(current?.windKmh ?? 0)} km/h
          </span>
        </div>
      </div>

      <label className="commute-verdict__scrub">
        <span className="sr-only">Scrub departure hour</span>
        <input
          type="range"
          min={0}
          max={Math.max(hours.length - 1, 0)}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
        />
      </label>

      <div className="commute-verdict__bars" role="list">
        {chart?.map((h, i) => (
          <button
            key={h.time}
            type="button"
            role="listitem"
            className={
              h.active
                ? `commute-bar active verdict-${h.verdict}`
                : `commute-bar verdict-${h.verdict}`
            }
            style={{ height: `${h.height}%` }}
            title={`${h.label}: ${h.score}`}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>
      <p className="commute-verdict__hint">
        Best window {leave.bestStartLabel} · drag or click an hour
      </p>
    </aside>
  );
}
