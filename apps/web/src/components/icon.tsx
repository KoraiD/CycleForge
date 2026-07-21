"use client";

import type { JSX } from "react";

export type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
};

function Base({
  size = 18,
  className = "",
  strokeWidth = 1.7,
  title,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={`icon ${className}`.trim()}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ---------- intensity / terrain ---------- */
export function IconIntensityEasy(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 4c2.5 3.5 4.5 6.2 4.5 9a4.5 4.5 0 1 1-9 0c0-2.8 2-5.5 4.5-9z" />
      <path d="M12 13.5V17" />
    </Base>
  );
}
export function IconIntensityEndurance(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12l3.5-2.5" />
    </Base>
  );
}
export function IconIntensityTempo(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8z" />
    </Base>
  );
}
export function IconIntensityHills(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 19l6-10 4 6 2.5-3.5L21 19z" />
      <path d="M3 19h18" />
    </Base>
  );
}
export function IconTerrainFlat(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 14h18" />
      <path d="M4 18h5M15 18h5" opacity="0.6" />
      <path d="M6 14V9M12 14V7M18 14v-4" opacity="0.45" />
    </Base>
  );
}
export function IconTerrainRolling(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 17c2.5-5 5-5 7.5 0s5 5 7.5 0" />
      <path d="M3 20.5h18" opacity="0.6" />
    </Base>
  );
}
export function IconTerrainHilly(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 20l5-9 4 6 3-4 6 7z" />
      <path d="M3 20h18" />
    </Base>
  );
}

/* ---------- weather ---------- */
export function IconTemp(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a3.5 3.5 0 1 1-4 0z" />
    </Base>
  );
}
export function IconWind(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 8h9a2.5 2.5 0 1 0-2.4-3.2" />
      <path d="M3 12h13a2.5 2.5 0 1 1-2.4 3.2" />
      <path d="M3 16h7" />
    </Base>
  );
}
export function IconRain(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M7 14a5 5 0 1 1 2-9.6A6 6 0 0 1 20 8.5 3.5 3.5 0 0 1 17 15z" />
      <path d="M8 17l-1 2M12 17l-1 2M16 17l-1 2" />
    </Base>
  );
}
export function IconSun(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Base>
  );
}
export function IconHumidity(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3c3 4.5 6 7.8 6 11a6 6 0 1 1-12 0c0-3.2 3-6.5 6-11z" />
    </Base>
  );
}
export function IconUv(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.2 5.2l1.8 1.8M17 17l1.8 1.8M5.2 18.8 7 17M17 7l1.8-1.8" strokeWidth="1.3" />
    </Base>
  );
}
export function IconVisibility(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </Base>
  );
}
export function IconAir(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="9" cy="12" r="3.2" opacity="0.75" />
      <circle cx="15.5" cy="12" r="3.2" opacity="0.45" />
      <path d="M3 17.5h9M12 6.5h9" opacity="0.6" />
    </Base>
  );
}
export function IconCloudSun(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M9 5.5a3 3 0 0 1 4.6 2.5" />
      <path d="M7.5 18a4.5 4.5 0 1 1 1.5-8.8A5.5 5.5 0 0 1 20 12a3 3 0 0 1-2 5.8z" />
    </Base>
  );
}

/* ---------- stack / nav ---------- */
export function IconDatabase(p: IconProps) {
  return (
    <Base {...p}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </Base>
  );
}
export function IconLightning(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M13 2 4.5 14H11l-1.5 8L19 10h-6.5L13 2z" />
    </Base>
  );
}
export function IconBrowser(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 8.5h18" />
      <path d="M6 6.5h.01M9 6.5h.01" strokeWidth="2.2" />
    </Base>
  );
}
export function IconRoute(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="5.5" cy="18.5" r="2" />
      <circle cx="18.5" cy="5.5" r="2" />
      <path d="M5.5 18.5c6 0 7-13 13-13" strokeDasharray="3 2.4" />
    </Base>
  );
}
export function IconCloud(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M7 18a5 5 0 1 1 2-9.6A6 6 0 0 1 20 12.5 3.5 3.5 0 0 1 17 18z" />
    </Base>
  );
}
export function IconChart(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 4v15.5h16" />
      <path d="M7 15l4-5 3 3 5-7" />
    </Base>
  );
}

export const INTENSITY_META = {
  easy: { Icon: IconIntensityEasy, blurb: "Zone 1–2 spin" },
  endurance: { Icon: IconIntensityEndurance, blurb: "Steady base miles" },
  tempo: { Icon: IconIntensityTempo, blurb: "Brisk sustained effort" },
  hills: { Icon: IconIntensityHills, blurb: "Climb-focused work" },
} as const;

export const TERRAIN_META = {
  flat: { Icon: IconTerrainFlat, blurb: "Minimal climbing" },
  rolling: { Icon: IconTerrainRolling, blurb: "Gentle ups & downs" },
  hilly: { Icon: IconTerrainHilly, blurb: "Max climb for the area" },
} as const;

export type IntensityIconKey = keyof typeof INTENSITY_META;
export type TerrainIconKey = keyof typeof TERRAIN_META;

export const icons = {
  intensityEasy: IconIntensityEasy,
  intensityEndurance: IconIntensityEndurance,
  intensityTempo: IconIntensityTempo,
  intensityHills: IconIntensityHills,
  terrainFlat: IconTerrainFlat,
  terrainRolling: IconTerrainRolling,
  terrainHilly: IconTerrainHilly,
  temp: IconTemp,
  wind: IconWind,
  rain: IconRain,
  sun: IconSun,
  humidity: IconHumidity,
  uv: IconUv,
  visibility: IconVisibility,
  air: IconAir,
  cloudSun: IconCloudSun,
  database: IconDatabase,
  lightning: IconLightning,
  browser: IconBrowser,
  route: IconRoute,
  cloud: IconCloud,
  chart: IconChart,
};

export type IconName = keyof typeof icons;

export function IconByName({ name, ...rest }: IconProps & { name: IconName }) {
  const Cmp = icons[name] as (props: IconProps) => JSX.Element;
  return <Cmp {...rest} />;
}
