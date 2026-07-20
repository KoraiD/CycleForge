"use client";

import type { TrainingBlockPlan } from "@/lib/training-block-plan";

export function TrainingBlockPanel({
  block,
  onCreate,
  busy,
}: {
  block: TrainingBlockPlan | null;
  onCreate: () => void;
  busy?: boolean;
}) {
  return (
    <section className="training-block-panel">
      <div className="training-block-panel__head">
        <div>
          <p className="eyebrow">Multi-day block</p>
          <h3>4-day training plan</h3>
        </div>
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={onCreate}
        >
          {busy ? "Saving…" : block ? "Rebuild & save" : "Build & save to CH"}
        </button>
      </div>
      {!block ? (
        <p className="muted">
          Generate a 4-day microcycle from your goals / FTP / athlete load and
          write it to ClickHouse <code>training_blocks</code>.
        </p>
      ) : (
        <>
          <p className="training-block-panel__notes">{block.notes}</p>
          <p className="training-block-panel__total">
            Total target TSS <strong>{block.totalTargetTss}</strong>
          </p>
          <ol className="training-block-days">
            {block.days.map((d) => (
              <li key={d.dayIndex}>
                <span className="day-label">{d.label}</span>
                <span className="day-focus">{d.focus}</span>
                <span className="day-meta">
                  {d.intensity} · {d.durationMin} min · TSS {d.targetTss}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
