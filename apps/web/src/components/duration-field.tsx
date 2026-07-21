"use client";

import { useState } from "react";
import { kmToMinutes, minutesToKm } from "@/lib/duration";
import type { Intensity } from "@/lib/types";

/** Duration slider with a min ↔ km unit toggle (km converts via intensity speed). */
export function DurationField({
  durationMin,
  intensity,
  onChange,
  disabled = false,
}: {
  durationMin: number;
  intensity: Intensity;
  onChange: (durationMin: number) => void;
  disabled?: boolean;
}) {
  const [unit, setUnit] = useState<"min" | "km">("min");
  const km = minutesToKm(durationMin, intensity);

  const setFromMin = (min: number) => onChange(min);
  const setFromKm = (nextKm: number) =>
    onChange(Math.min(300, Math.max(30, kmToMinutes(nextKm, intensity))));

  return (
    <div className="field duration-field">
      <div className="duration-field__head">
        <span>Duration</span>
        <span
          className="duration-field__toggle"
          role="group"
          aria-label="Duration unit"
        >
          <button
            type="button"
            className={unit === "min" ? "active" : ""}
            onClick={() => setUnit("min")}
            aria-pressed={unit === "min"}
          >
            min
          </button>
          <button
            type="button"
            className={unit === "km" ? "active" : ""}
            onClick={() => setUnit("km")}
            aria-pressed={unit === "km"}
          >
            km
          </button>
        </span>
      </div>
      {unit === "min" ? (
        <label className="duration-field__slider">
          <input
            type="range"
            min={45}
            max={210}
            step={15}
            value={durationMin}
            disabled={disabled}
            onChange={(e) => setFromMin(Number(e.target.value))}
          />
          <strong>{durationMin} min</strong>
        </label>
      ) : (
        <label className="duration-field__slider">
          <input
            type="range"
            min={15}
            max={95}
            step={5}
            value={Math.min(95, Math.max(15, Math.round(km / 5) * 5))}
            disabled={disabled}
            onChange={(e) => setFromKm(Number(e.target.value))}
          />
          <strong>{km} km</strong>
        </label>
      )}
      <small className="duration-field__hint">
        ≈ {km} km · {durationMin} min at {intensity} pace
      </small>
    </div>
  );
}
