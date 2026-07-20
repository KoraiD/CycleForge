import type { HistoryContext, RouteCandidate, WizardState } from "./types";

/** Short coaching prose for the plan panel — not a chat wall of text. */
export function buildCoachNote(input: {
  wizard: WizardState;
  route: RouteCandidate;
  history?: HistoryContext | null;
}): string {
  const { wizard, route, history } = input;
  const km = route.distanceM / 1000;
  const climb = Math.round(route.elevGainM);
  const tss = route.training.tssEst;
  const start = wizard.startLabel || "your start";
  const weather = route.weather;

  const opener = [
    `Ride ${route.label} from ${start} as a ${wizard.intensity} session`,
    `(~${km.toFixed(1)} km, ${climb} m gain, est. TSS ${tss}).`,
  ].join(" ");

  const howTo: string[] = [];
  switch (wizard.intensity) {
    case "easy":
      howTo.push(
        "Keep it conversational — soft cadence, no chasing strava segments.",
      );
      break;
    case "endurance":
      howTo.push(
        "Settle into steady Z2 after a 10-minute spin-up; save matches for the last third only if you feel good.",
      );
      break;
    case "tempo":
      howTo.push(
        "Hold tempo on open stretches; soft-pedal junctions and regroup before the next push.",
      );
      break;
    case "hills":
      howTo.push(
        "Treat rises as seated openers — smooth torque, easy gear, no sprinting the crests.",
      );
      break;
    default: {
      const _exhaustive: never = wizard.intensity;
      void _exhaustive;
    }
  }

  // Weather always surfaces in the coach note when a snapshot exists.
  if (weather) {
    const wxBits = [
      weather.summary,
      `${Math.round(weather.tempC)}°C`,
      `wind ${Math.round(weather.windKmh)} km/h`,
    ];
    if (weather.precipMm >= 0.5) wxBits.push("wet roads possible");
    howTo.push(`Weather: ${wxBits.join(" · ")}.`);
    if (weather.windKmh >= 22) {
      howTo.push(
        "Budget harder effort into the breeze and recover with it.",
      );
    } else if (weather.tempC >= 24) {
      howTo.push("Warm day — start hydrated and ease the first 10 minutes.");
    } else if (weather.tempC <= 8) {
      howTo.push("Cool start — arm warmers until you are warm.");
    }
  }

  if (history?.loadHint.includes("recovery")) {
    howTo.push(
      "Recent athlete load is high — keep this session controlled and skip optional surges.",
    );
  } else if (history?.loadHint.includes("quality")) {
    howTo.push(
      "Last week was lighter — this is a good day to complete the planned stimulus.",
    );
  }

  if (wizard.terrainBias === "hilly" || climb > 150) {
    howTo.push("Expect short Dutch rollers — stay seated and keep power even.");
  } else if (wizard.terrainBias === "flat" || climb < 50) {
    howTo.push("Use the flat stretches for cadence drills every 10–15 minutes.");
  }

  if (wizard.avoidBusyRoads) {
    howTo.push("Stay on the quieter lines the router preferred when traffic builds.");
  }

  const fit = Math.round(route.score.total * 100);
  const close = [
    `Goal fit ${fit}/100 for your ${wizard.durationMin}-minute brief.`,
    route.training.recoveryHint,
  ];

  if (history) {
    close.push(
      `History: ${history.hoursLast7d}h / TSS ${history.tssLast7d} last 7d` +
        (history.lastHardLabel
          ? ` · last hard “${history.lastHardLabel}” ${history.lastHardDaysAgo}d ago`
          : "") +
        ".",
    );
  } else if (route.similarRideLabels.length > 0) {
    close.push(
      `Closest corpus rides: ${route.similarRideLabels.slice(0, 2).join(", ")}.`,
    );
  }

  return [opener, howTo.slice(0, 3).join(" "), close.join(" ")]
    .filter((p) => p.trim().length > 0)
    .join("\n\n");
}

export function attachCoachNote<
  T extends {
    wizard: WizardState;
    routes: RouteCandidate[];
    selectedRouteId: string;
    historyContext?: HistoryContext;
  },
>(plan: T): T & { coachNote: string } {
  const route =
    plan.routes.find((r) => r.routeId === plan.selectedRouteId) ??
    plan.routes[0];
  return {
    ...plan,
    coachNote: route
      ? buildCoachNote({
          wizard: plan.wizard,
          route,
          history: plan.historyContext,
        })
      : "Confirm a route to get a short coaching note.",
  };
}
