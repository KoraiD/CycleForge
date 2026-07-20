"use client";

import type { TrainingEffect } from "@/lib/types";

const ZONE_COLORS = {
  z1: "#8fb39a",
  z2: "#1f6b4a",
  z3: "#c4a035",
  z4: "#c45c26",
  z5: "#8b2e2e",
} as const;

export function TrainingBlock({ training }: { training: TrainingEffect }) {
  const zones = [
    { key: "z1", label: "Z1", value: training.zoneMix.z1 },
    { key: "z2", label: "Z2", value: training.zoneMix.z2 },
    { key: "z3", label: "Z3", value: training.zoneMix.z3 },
    { key: "z4", label: "Z4", value: training.zoneMix.z4 },
    { key: "z5", label: "Z5", value: training.zoneMix.z5 },
  ] as const;

  return (
    <div className="training-block">
      <div className="training-block__meta">
        <div>
          <span className="label">Stimulus</span>
          <strong>{training.stimulus}</strong>
        </div>
        <div>
          <span className="label">Est. TSS</span>
          <strong>{training.tssEst}</strong>
        </div>
        <div>
          <span className="label">IF</span>
          <strong>{training.ifEst.toFixed(2)}</strong>
        </div>
        {training.ftpWatts ? (
          <div>
            <span className="label">FTP / NP</span>
            <strong>
              {training.ftpWatts}
              {training.npEst ? ` / ${training.npEst}` : ""} W
            </strong>
          </div>
        ) : null}
      </div>
      <div className="zone-bar" aria-label="Zone mix">
        {zones.map((z) =>
          z.value > 0 ? (
            <div
              key={z.key}
              className="zone-bar__seg"
              style={{
                width: `${z.value}%`,
                background: ZONE_COLORS[z.key],
              }}
              title={`${z.label}: ${z.value}%`}
            />
          ) : null,
        )}
      </div>
      <div className="zone-legend">
        {zones.map((z) => (
          <span key={z.key}>
            <i style={{ background: ZONE_COLORS[z.key] }} />
            {z.label} {z.value}%
          </span>
        ))}
      </div>
      <p className="recovery">{training.recoveryHint}</p>
    </div>
  );
}
