import type { Intensity } from "./types";

/** Assumed moving speed per intensity — single source for min ↔ km conversion. */
export function speedKmhFor(intensity: Intensity): number {
  switch (intensity) {
    case "easy":
      return 20;
    case "endurance":
      return 24;
    case "tempo":
      return 27;
    case "hills":
      return 23;
  }
}

export function kmToMinutes(km: number, intensity: Intensity): number {
  return Math.round((km / speedKmhFor(intensity)) * 60);
}

export function minutesToKm(min: number, intensity: Intensity): number {
  return Math.round(((min / 60) * speedKmhFor(intensity)) * 10) / 10;
}
