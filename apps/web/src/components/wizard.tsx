"use client";

import { useEffect, useState } from "react";
import type { NearbyStart } from "@/lib/nearby-starts";
import type { GeocodeHit } from "@/lib/geocode";
import type { Intensity, TerrainBias, WizardState } from "@/lib/types";
import { StartPickerMap } from "./start-picker-map";

const INTENSITIES: Intensity[] = ["easy", "endurance", "tempo", "hills"];
const TERRAINS: TerrainBias[] = ["flat", "rolling", "hilly"];

export function Wizard({
  wizard,
  onChange,
  onConfirm,
  busy,
  collapsed = false,
  hasPlan = false,
}: {
  wizard: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onConfirm: () => void;
  busy?: boolean;
  collapsed?: boolean;
  hasPlan?: boolean;
}) {
  const [address, setAddress] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [startHint, setStartHint] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyStart[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const showBody = !collapsed || expanded;
  const startPicked =
    wizard.startLabel &&
    wizard.startLabel !== "Pick a start on the map" &&
    !wizard.startLabel.startsWith("Pick a start");

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

  useEffect(() => {
    if (!startPicked) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setNearbyLoading(true);
      void fetch(
        `/api/nearby-starts?lat=${wizard.startLat}&lng=${wizard.startLng}`,
      )
        .then((r) => r.json())
        .then((data: { results?: NearbyStart[] }) => {
          if (!cancelled) setNearby(data.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setNearby([]);
        })
        .finally(() => {
          if (!cancelled) setNearbyLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [startPicked, wizard.startLat, wizard.startLng]);

  const nearbyChips = startPicked ? nearby : [];

  const onAddressChange = (value: string) => {
    setAddress(value);
    if (value.trim().length < 2) setHits([]);
  };

  const applyStart = (lat: number, lng: number, label: string, hint: string) => {
    onChange({
      startPreset: "custom",
      startLat: lat,
      startLng: lng,
      startLabel: label,
    });
    setStartHint(hint);
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
          {wizard.ftpWatts ? ` · FTP ${wizard.ftpWatts} W` : ""}
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

      <label className="field">
        <span>FTP (watts) — optional, improves TSS</span>
        <input
          type="number"
          min={80}
          max={500}
          step={5}
          placeholder="e.g. 240"
          value={wizard.ftpWatts ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              onChange({ ftpWatts: null });
              return;
            }
            const n = Number(v);
            onChange({
              ftpWatts: Number.isFinite(n) && n > 0 ? Math.max(80, n) : null,
            });
          }}
        />
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
        <button type="button" className="chip active">
          Map / address
        </button>
        {nearbyLoading && startPicked ? (
          <span className="start-search-status">Finding nearby starts…</span>
        ) : null}
        {nearbyChips.map((n) => (
          <button
            key={`${n.label}-${n.lat}`}
            type="button"
            className={
              wizard.startLabel === n.label ? "chip active" : "chip"
            }
            onClick={() =>
              applyStart(
                n.lat,
                n.lng,
                n.label,
                `Start set to ${n.label} (${n.distanceKm} km away). Generate routes to rebuild.`,
              )
            }
            title={`${n.distanceKm} km from pin`}
          >
            {n.label}
          </button>
        ))}
      </div>

      {startHint ? <p className="start-hint">{startHint}</p> : null}

      <div className="start-custom">
        <label className="field">
          <span>Search address</span>
          <input
            type="search"
            value={address}
            placeholder="e.g. Utrecht Centraal or Berlin Prenzlauer Berg"
            onChange={(e) => onAddressChange(e.target.value)}
            autoComplete="off"
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
                    applyStart(
                      hit.lat,
                      hit.lng,
                      hit.label,
                      `Start pinned to ${hit.label}. Nearby options will appear above.`,
                    );
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
          onPick={({ lat, lng }) => {
            applyStart(
              lat,
              lng,
              `Pin ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              `Start updated to ${lat.toFixed(4)}, ${lng.toFixed(4)}. Nearby options refresh above.`,
            );
          }}
        />
        <p className="start-current">
          Start: <strong>{wizard.startLabel || "Custom"}</strong> (
          {wizard.startLat.toFixed(4)}, {wizard.startLng.toFixed(4)})
        </p>
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
        disabled={busy || !startPicked}
        onClick={onConfirm}
      >
        {busy
          ? "Generating…"
          : !startPicked
            ? "Pick a start first"
            : hasPlan
              ? "Regenerate from this start"
              : "Generate routes"}
      </button>
    </section>
  );
}
