"use client";

import type { LeaveWindowHint } from "@/lib/types";

export function LeaveWindowCard({ leave }: { leave: LeaveWindowHint }) {
  return (
    <aside className="leave-window" aria-label="Best time to leave">
      <p className="eyebrow">Best time to leave</p>
      <p className="leave-window__best">
        <strong>{leave.bestStartLabel}</strong>
        <span className="leave-window__score">score {leave.score}</span>
      </p>
      <p className="leave-window__reason">{leave.reason}</p>
      {leave.alternatives.length > 0 ? (
        <ul className="leave-window__alts">
          {leave.alternatives.map((a) => (
            <li key={a.startIso}>
              {a.label} <span>score {a.score}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
