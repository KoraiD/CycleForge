"use client";

import { START_PRESETS } from "@/lib/constants";
import type { Intensity, StartPreset, TerrainBias, WizardState } from "@/lib/types";

const INTENSITIES: Intensity[] = ["easy", "endurance", "tempo", "hills"];
const TERRAINS: TerrainBias[] = ["flat", "rolling", "hilly"];
const PRESETS = Object.keys(START_PRESETS) as Array<Exclude<StartPreset, "custom">>;

export function Wizard({
  wizard,
  onChange,
  onConfirm,
  busy,
}: {
  wizard: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <section className="wizard animate-in">
      <header>
        <p className="eyebrow">Interactive wizard</p>
        <h3>Tune the ride</h3>
      </header>

      <label className="field">
        <span>Duration (min)</span>
        <input
          type="range"
          min={45}
          max={210}
          step={15}
          value={wizard.durationMin}
          onChange={(e) => onChange({ durationMin: Number(e.target.value) })}
        />
        <strong>{wizard.durationMin} min</strong>
      </label>

      <div className="chip-row">
        <span className="chip-label">Intensity</span>
        {INTENSITIES.map((value) => (
          <button
            key={value}
            type="button"
            className={wizard.intensity === value ? "chip active" : "chip"}
            onClick={() => onChange({ intensity: value })}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="chip-row">
        <span className="chip-label">Terrain</span>
        {TERRAINS.map((value) => (
          <button
            key={value}
            type="button"
            className={wizard.terrainBias === value ? "chip active" : "chip"}
            onClick={() => onChange({ terrainBias: value })}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="chip-row">
        <span className="chip-label">Start</span>
        {PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            className={wizard.startPreset === value ? "chip active" : "chip"}
            onClick={() => onChange({ startPreset: value })}
          >
            {START_PRESETS[value].label}
          </button>
        ))}
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={wizard.avoidBusyRoads}
          onChange={(e) => onChange({ avoidBusyRoads: e.target.checked })}
        />
        Prefer quieter roads
      </label>

      <button
        type="button"
        className="primary"
        disabled={busy}
        onClick={onConfirm}
      >
        {busy ? "Generating…" : "Generate routes"}
      </button>
    </section>
  );
}
