"use client";

import { useEffect, useState } from "react";
import { START_PRESETS } from "@/lib/constants";
import type { GeocodeHit } from "@/lib/geocode";
import type { Intensity, StartPreset, TerrainBias, WizardState } from "@/lib/types";
import { StartPickerMap } from "./start-picker-map";

const INTENSITIES: Intensity[] = ["easy", "endurance", "tempo", "hills"];
const TERRAINS: TerrainBias[] = ["flat", "rolling", "hilly"];
const PRESETS = Object.keys(START_PRESETS) as Array<Exclude<StartPreset, "custom">>;

export function Wizard({
  wizard,
  onChange,
  onConfirm,
  busy,
  collapsed = false,
}: {
  wizard: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onConfirm: () => void;
  busy?: boolean;
  /** When a plan is already on screen, keep wizard compact so tweak panel owns refine. */
  collapsed?: boolean;
}) {
  const [address, setAddress] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const showCustom = wizard.startPreset === "custom";
  const showBody = !collapsed || expanded;

  useEffect(() => {
    const q = address.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      setSearching(true);
      void fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: { results?: GeocodeHit[] }) => {
          if (!cancelled) setHits(data.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [address]);

  const onAddressChange = (value: string) => {
    setAddress(value);
    if (value.trim().length < 2) setHits([]);
  };

  if (!showBody) {
    return (
      <section className="wizard wizard--compact animate-in">
        <header>
          <p className="eyebrow">Wizard</p>
          <h3>Start locked</h3>
        </header>
        <p className="wizard-summary">
          {wizard.durationMin} min · {wizard.intensity} · {wizard.terrainBias} ·{" "}
          {wizard.startLabel || "Custom start"}
        </p>
        <p className="wizard-hint">
          Use <strong>Tune this result</strong> on the plan to regenerate. Expand
          only to change start or goals.
        </p>
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={() => setExpanded(true)}
        >
          Edit start & goals
        </button>
      </section>
    );
  }

  return (
    <section className="wizard animate-in">
      <header className="wizard__header-row">
        <div>
          <p className="eyebrow">Interactive wizard</p>
          <h3>Tune the ride</h3>
        </div>
        {collapsed ? (
          <button
            type="button"
            className="ghost"
            onClick={() => setExpanded(false)}
          >
            Collapse
          </button>
        ) : null}
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
            onClick={() =>
              onChange({
                startPreset: value,
                startLabel: START_PRESETS[value].label,
              })
            }
          >
            {START_PRESETS[value].label}
          </button>
        ))}
        <button
          type="button"
          className={wizard.startPreset === "custom" ? "chip active" : "chip"}
          onClick={() =>
            onChange({
              startPreset: "custom",
              startLabel: wizard.startLabel || "Custom start",
            })
          }
        >
          Map / address
        </button>
      </div>

      {showCustom && (
        <div className="start-custom">
          <label className="field">
            <span>Search address</span>
            <input
              type="search"
              value={address}
              placeholder="e.g. Utrecht Centraal or Berlin Prenzlauer Berg"
              onChange={(e) => onAddressChange(e.target.value)}
            />
          </label>
          {searching && <p className="start-search-status">Searching…</p>}
          {hits.length > 0 && (
            <ul className="geocode-hits">
              {hits.map((hit) => (
                <li key={`${hit.label}-${hit.lat}-${hit.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        startPreset: "custom",
                        startLat: hit.lat,
                        startLng: hit.lng,
                        startLabel: hit.label,
                      });
                      setAddress(hit.label);
                      setHits([]);
                    }}
                  >
                    {hit.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <StartPickerMap
            lat={wizard.startLat}
            lng={wizard.startLng}
            onPick={({ lat, lng }) =>
              onChange({
                startPreset: "custom",
                startLat: lat,
                startLng: lng,
                startLabel: `Pin ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              })
            }
          />
          <p className="start-current">
            Start: <strong>{wizard.startLabel || "Custom"}</strong> (
            {wizard.startLat.toFixed(4)}, {wizard.startLng.toFixed(4)})
          </p>
        </div>
      )}

      {!showCustom && (
        <p className="start-current">
          Start: <strong>{wizard.startLabel || START_PRESETS.vondelpark.label}</strong>
        </p>
      )}

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
