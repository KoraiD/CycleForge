"use client";

import { useState } from "react";
import { explainRouteScore } from "@/lib/score-explain";
import type { RouteCandidate, WizardState } from "@/lib/types";

export function ScoreExplainDrawer({
  route,
  wizard,
}: {
  route: RouteCandidate;
  wizard: WizardState;
}) {
  const [open, setOpen] = useState(false);
  const explain = explainRouteScore(route, wizard);

  return (
    <div className="score-explain">
      <button
        type="button"
        className="ghost score-explain__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide score explain" : "Explain this score"}
      </button>
      {open ? (
        <div className="score-explain__panel" role="region">
          <p className="score-explain__total">
            Fit <strong>{explain.total}</strong>
            <span> = weighted goal · quiet · scenic · weather</span>
          </p>
          <ul className="score-explain__weights">
            {explain.weights.map((w) => (
              <li key={w.key}>
                <span>{w.label}</span>
                <div className="score-explain__bar">
                  <i style={{ width: `${Math.round(w.value * 100)}%` }} />
                </div>
                <strong>
                  {Math.round(w.value * 100)} × {w.weight}
                </strong>
              </li>
            ))}
          </ul>
          {explain.narrative.map((line, i) => (
            <p key={`n-${i}`} className="score-explain__line">
              {line}
            </p>
          ))}
          <pre className="score-explain__sql">{explain.sqlHint}</pre>
        </div>
      ) : null}
    </div>
  );
}
