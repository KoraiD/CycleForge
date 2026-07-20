import demoAthlete from "@/data/demo-athlete.json";
import type { HistoryContext, Intensity } from "./types";

export const DEMO_ATHLETE_ID = demoAthlete.athleteId;

export type RiderHistoryRide = {
  athleteId: string;
  rideId: string;
  startedAt: Date;
  label: string;
  distanceM: number;
  durationS: number;
  elevGainM: number;
  tssEst: number;
  intensity: Intensity;
  source: "fixture" | "upload";
};

type FixtureRide = (typeof demoAthlete.rides)[number];

function daysAgoDate(daysAgo: number, now: Date): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(9, 0, 0, 0);
  return d;
}

export function buildDemoAthleteRides(now = new Date()): RiderHistoryRide[] {
  return demoAthlete.rides.map((ride: FixtureRide) => ({
    athleteId: DEMO_ATHLETE_ID,
    rideId: ride.rideId,
    startedAt: daysAgoDate(ride.daysAgo, now),
    label: ride.label,
    distanceM: ride.distanceM,
    durationS: ride.durationS,
    elevGainM: ride.elevGainM,
    tssEst: ride.tssEst,
    intensity: ride.intensity as Intensity,
    source: "fixture" as const,
  }));
}

function hoursInWindow(rides: RiderHistoryRide[], sinceMs: number): number {
  return (
    rides
      .filter((r) => r.startedAt.getTime() >= sinceMs)
      .reduce((sum, r) => sum + r.durationS, 0) / 3600
  );
}

function tssInWindow(rides: RiderHistoryRide[], sinceMs: number): number {
  return rides
    .filter((r) => r.startedAt.getTime() >= sinceMs)
    .reduce((sum, r) => sum + r.tssEst, 0);
}

export function summarizeAthleteHistory(
  rides: RiderHistoryRide[],
  opts: { athleteId: string; athleteLabel: string; source: "fixture" | "upload"; now?: Date },
): HistoryContext {
  const now = opts.now ?? new Date();
  const sorted = [...rides].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
  const ms7 = now.getTime() - 7 * 86400000;
  const ms28 = now.getTime() - 28 * 86400000;

  const hard = sorted.find(
    (r) =>
      r.intensity === "tempo" ||
      r.intensity === "hills" ||
      r.tssEst >= 120,
  );
  const lastHardDaysAgo = hard
    ? Math.floor((now.getTime() - hard.startedAt.getTime()) / 86400000)
    : null;

  const hoursLast7d = Math.round(hoursInWindow(sorted, ms7) * 10) / 10;
  const hoursLast28d = Math.round(hoursInWindow(sorted, ms28) * 10) / 10;
  const tssLast7d = Math.round(tssInWindow(sorted, ms7));
  const tssLast28d = Math.round(tssInWindow(sorted, ms28));

  const recentLabels = sorted.slice(0, 4).map((r) => r.label);

  let loadHint = "steady aerobic block";
  if (tssLast7d >= 280 || (lastHardDaysAgo !== null && lastHardDaysAgo <= 1)) {
    loadHint = "recent hard load — bias recovery";
  } else if (tssLast7d < 120 && hoursLast7d < 4) {
    loadHint = "lighter week — room for a quality session";
  }

  const summaryLine = [
    `${opts.athleteLabel}: ${sorted.length} rides / ${hoursLast28d}h in 4 weeks`,
    `last 7d ${hoursLast7d}h · TSS ${tssLast7d}`,
    hard
      ? `last hard “${hard.label}” ${lastHardDaysAgo}d ago`
      : "no hard days logged",
    loadHint,
  ].join(" · ");

  return {
    athleteId: opts.athleteId,
    athleteLabel: opts.athleteLabel,
    source: opts.source,
    rideCount: sorted.length,
    weeks: 4,
    hoursLast7d,
    hoursLast28d,
    tssLast7d,
    tssLast28d,
    lastHardLabel: hard?.label ?? null,
    lastHardDaysAgo,
    recentLabels,
    summaryLine,
    loadHint,
  };
}

export function summarizeDemoAthlete(now = new Date()): HistoryContext {
  return summarizeAthleteHistory(buildDemoAthleteRides(now), {
    athleteId: DEMO_ATHLETE_ID,
    athleteLabel: demoAthlete.label,
    source: "fixture",
    now,
  });
}

/** Soft intensity nudge from recent load (does not override explicit user choices). */
export function suggestIntensityFromHistory(
  history: HistoryContext,
  current: Intensity,
): Intensity | null {
  if (history.loadHint.includes("recovery")) {
    if (current === "tempo" || current === "hills") return "easy";
    if (current === "endurance") return "easy";
  }
  if (history.loadHint.includes("quality") && current === "easy") {
    return "endurance";
  }
  return null;
}
