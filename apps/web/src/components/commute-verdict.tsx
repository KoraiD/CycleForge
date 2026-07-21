"use client";

import { useMemo, useState } from "react";
import type { HourlyRideScore, LeaveWindowHint } from "@/lib/types";
import {
  IconAir,
  IconCloudSun,
  IconHumidity,
  IconRain,
  IconSun,
  IconTemp,
  IconUv,
  IconVisibility,
  IconWind,
} from "./icon";

function hourLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function weatherTone(h: HourlyRideScore): "sun" | "cloud" | "rain" {
  const code = h.weatherCode ?? 0;
  if (code >= 51 || h.precipMm >= 0.4) return "rain";
  if ((h.cloudCoverPct ?? 0) > 55 || code >= 3) return "cloud";
  return "sun";
}

function tempColor(tempC: number): string {
  // -5 → deep blue, 12 → teal, 22 → green, 32 → orange.
  const t = Math.max(-5, Math.min(34, tempC));
  const hue = 214 - ((t + 5) / 39) * 188; // 214 (blue) → 26 (orange)
  return `hsl(${Math.round(hue)} 62% 42%)`;
}

function MetricCell({
  icon,
  label,
  value,
  unit,
  tone,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  tone?: "good" | "warn" | "bad" | null;
  detail?: string;
}) {
  return (
    <li className={`wx-cell${tone ? ` wx-cell--${tone}` : ""}`} title={detail ?? `${label} ${value}${unit ?? ""}`}>
      <span className="wx-cell__icon" aria-hidden>{icon}</span>
      <span className="wx-cell__label">{label}</span>
      <span className="wx-cell__value">
        {value}
        {unit ? <em>{unit}</em> : null}
      </span>
    </li>
  );
}

function aqiTone(aqi: number | null | undefined): "good" | "warn" | "bad" | null {
  if (aqi === null || aqi === undefined) return null;
  if (aqi <= 40) return "good";
  if (aqi <= 70) return "warn";
  return "bad";
}

function uvTone(uv: number | null | undefined): "good" | "warn" | "bad" | null {
  if (uv === null || uv === undefined) return null;
  if (uv < 3) return "good";
  if (uv < 6) return "warn";
  return "bad";
}

function visTone(m: number | null | undefined): "good" | "warn" | "bad" | null {
  if (m === null || m === undefined) return null;
  if (m >= 10000) return "good";
  if (m >= 4000) return "warn";
  return "bad";
}

function windTone(kmh: number): "good" | "warn" | "bad" {
  if (kmh <= 18) return "good";
  if (kmh <= 30) return "warn";
  return "bad";
}

function rainTone(mm: number): "good" | "warn" | "bad" {
  if (mm < 0.2) return "good";
  if (mm < 1) return "warn";
  return "bad";
}

function fmtKm(m: number): string {
  return m >= 10000 ? `${Math.round(m / 1000)}` : (m / 1000).toFixed(1);
}

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

  const strip = useMemo(() => {
    if (!hours.length) return null;
    const maxTemp = Math.max(...hours.map((h) => h.tempC));
    const minTemp = Math.min(...hours.map((h) => h.tempC));
    const tempSpan = Math.max(maxTemp - minTemp, 1);
    const maxScore = Math.max(...hours.map((h) => h.score), 1);
    return hours.map((h, i) => ({
      ...h,
      active: i === idx,
      tone: weatherTone(h),
      tempHeight: 30 + ((h.tempC - minTemp) / tempSpan) * 62,
      scoreHeight: Math.max(10, (h.score / maxScore) * 100),
      clock: hourLabel(h.time),
    }));
  }, [hours, idx]);

  if (!hours.length || !current) {
    return (
      <aside className="leave-window" aria-label="Best time to leave">
        <p className="eyebrow">Should I cycle?</p>
        <p className="leave-window__best">
          <strong>{leave.bestStartLabel}</strong>
          <span className="leave-window__score">score {leave.score}</span>
        </p>
        <p className="leave-window__reason">{leave.reason}</p>
      </aside>
    );
  }

  const tone = weatherTone(current);
  const precip = current.precipMm;

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
          <strong>{current.label}</strong>
          <span>
            score {current.score} · {current.summary} · {Math.round(current.tempC)}°C · wind{" "}
            {Math.round(current.windKmh)} km/h
          </span>
        </div>
      </div>

      <ul className="wx-grid" aria-label="Conditions at selected hour">
        <MetricCell
          icon={<IconTemp size={17} />}
          label="Temp"
          value={`${Math.round(current.tempC)}`}
          unit="°C"
          detail={`Feels like a ${tone === "rain" ? "wet" : tone} ${Math.round(current.tempC)}°C`}
        />
        <MetricCell
          icon={<IconWind size={17} />}
          label="Wind"
          value={`${Math.round(current.windKmh)}`}
          unit=" km/h"
          tone={windTone(current.windKmh)}
        />
        <MetricCell
          icon={<IconRain size={17} />}
          label="Rain"
          value={precip < 0.05 ? "0" : precip.toFixed(1)}
          unit=" mm"
          tone={rainTone(precip)}
        />
        <MetricCell
          icon={<IconSun size={17} />}
          label="Sun"
          value={`${Math.round(100 - (current.cloudCoverPct ?? 0))}`}
          unit="%"
          detail={`Cloud cover ${Math.round(current.cloudCoverPct ?? 0)}%${current.isDay === false ? " · night" : ""}`}
          tone={(current.cloudCoverPct ?? 0) <= 40 ? "good" : (current.cloudCoverPct ?? 0) <= 75 ? "warn" : "bad"}
        />
        <MetricCell
          icon={<IconHumidity size={17} />}
          label="Humidity"
          value={current.humidityPct === null || current.humidityPct === undefined ? "—" : `${Math.round(current.humidityPct)}`}
          unit={current.humidityPct === null || current.humidityPct === undefined ? "" : "%"}
          tone={
            current.humidityPct === null || current.humidityPct === undefined
              ? null
              : current.humidityPct <= 70
                ? "good"
                : current.humidityPct <= 85
                  ? "warn"
                  : "bad"
          }
        />
        <MetricCell
          icon={<IconUv size={17} />}
          label="UV"
          value={current.uvIndex === null || current.uvIndex === undefined ? "—" : current.uvIndex.toFixed(1)}
          tone={uvTone(current.uvIndex)}
          detail={
            current.uvIndex === null || current.uvIndex === undefined
              ? "UV index unavailable"
              : `UV index ${current.uvIndex.toFixed(1)} — ${current.uvIndex < 3 ? "low" : current.uvIndex < 6 ? "moderate, sunscreen advised" : "high, protect skin"}`
          }
        />
        <MetricCell
          icon={<IconVisibility size={17} />}
          label="Visibility"
          value={current.visibilityM === null || current.visibilityM === undefined ? "—" : fmtKm(current.visibilityM)}
          unit={current.visibilityM === null || current.visibilityM === undefined ? "" : " km"}
          tone={visTone(current.visibilityM)}
        />
        <MetricCell
          icon={<IconAir size={17} />}
          label="Air"
          value={current.aqi === null || current.aqi === undefined ? "—" : `${Math.round(current.aqi)}`}
          unit={current.aqi === null || current.aqi === undefined ? "" : " AQI"}
          tone={aqiTone(current.aqi)}
          detail={
            current.aqi === null || current.aqi === undefined
              ? "Air quality unavailable"
              : `European AQI ${Math.round(current.aqi)} — ${current.aqi <= 40 ? "good" : current.aqi <= 70 ? "fair" : "poor"}`
          }
        />
      </ul>

      <div className="wx-strip" role="list" aria-label="Conditions per hour">
        {strip?.map((h, i) => (
          <button
            key={h.time}
            type="button"
            role="listitem"
            className={`wx-hour${h.active ? " active" : ""} verdict-${h.verdict}`}
            onClick={() => setIdx(i)}
            title={`${h.label} — score ${h.score}, ${Math.round(h.tempC)}°C, ${Math.round(h.windKmh)} km/h wind, ${h.precipMm.toFixed(1)} mm rain`}
          >
            <span className="wx-hour__score" style={{ height: `${h.scoreHeight * 0.28}%` }} aria-hidden />
            <span className={`wx-hour__sky wx-hour__sky--${h.tone}`} aria-hidden>
              {h.tone === "sun" ? <IconSun size={13} /> : h.tone === "rain" ? <IconRain size={13} /> : <IconCloudSun size={13} />}
            </span>
            <span className="wx-hour__temps" aria-hidden>
              <span
                className="wx-hour__temp"
                style={{ height: `${h.tempHeight}%`, backgroundColor: tempColor(h.tempC) }}
              />
            </span>
            <span className="wx-hour__wind" aria-hidden>
              {Math.round(h.windKmh)}
            </span>
            <span className="wx-hour__clock">{h.clock}</span>
          </button>
        ))}
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

      <p className="commute-verdict__hint">
        Best window {leave.bestStartLabel} · bars = ride score · temp curve & wind per hour
      </p>
    </aside>
  );
}
