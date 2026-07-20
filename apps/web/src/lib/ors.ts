import {
  buildElevProfile,
  elevGainLoss,
  lineDistanceM,
} from "./geometry";
import { buildFallbackRoutes, type RawRoute } from "./fallback-routes";
import { targetDistanceM } from "./scoring";
import type { WizardState } from "./types";

type OrsFeature = {
  geometry?: { type: string; coordinates?: number[][] };
  properties?: {
    summary?: { distance?: number; duration?: number };
  };
};

async function fetchOrsRoundTrip(input: {
  wizard: WizardState;
  lengthM: number;
  points: number;
  seed: number;
  profile: string;
}): Promise<RawRoute | null> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return null;

  const cyclingProfile =
    input.wizard.intensity === "tempo" || input.wizard.avoidBusyRoads === false
      ? "cycling-road"
      : "cycling-regular";

  try {
    const res = await fetch(
      `https://api.openrouteservice.org/v2/directions/${cyclingProfile}/geojson`,
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [[input.wizard.startLng, input.wizard.startLat]],
          elevation: true,
          extra_info: ["steepness", "waytype"],
          options: {
            round_trip: {
              length: Math.round(input.lengthM),
              points: input.points,
              seed: input.seed,
            },
            avoid_features: input.wizard.avoidBusyRoads ? ["highways"] : [],
          },
        }),
      },
    );

    if (!res.ok) {
      console.warn("ORS error", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as { features?: OrsFeature[] };
    const feature = data.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;

    const geometry: GeoJSON.LineString = {
      type: "LineString",
      coordinates: coords,
    };
    const distanceM = feature?.properties?.summary?.distance ?? lineDistanceM(coords);
    const durationS = feature?.properties?.summary?.duration ?? (distanceM / 1000 / 24) * 3600;
    const { gain, loss } = elevGainLoss(coords);

    return {
      label: input.profile,
      profile: input.profile,
      geometry,
      distanceM,
      durationS,
      elevGainM: gain,
      elevLossM: loss,
      elevProfile: buildElevProfile(coords),
      busyPenalty: input.wizard.avoidBusyRoads ? 0.1 : 0.3,
      source: "ors",
    };
  } catch (err) {
    console.warn("ORS fetch failed", err);
    return null;
  }
}

export async function generateRawRoutes(wizard: WizardState): Promise<RawRoute[]> {
  const target = targetDistanceM(wizard);
  const variants = [
    { label: "Steady canal loop", profile: "endurance-flat", length: target * 0.92, points: 3, seed: 1 },
    { label: "Park & parkway", profile: "rolling-endurance", length: target * 1.0, points: 4, seed: 7 },
    { label: "Waterland push", profile: "hilly-loop", length: target * 1.12, points: 5, seed: 13 },
  ];

  // Fan-out ORS requests in parallel (hackathon: durable fan-out also via Trigger task)
  const settled = await Promise.all(
    variants.map(async (v) => {
      const route = await fetchOrsRoundTrip({
        wizard,
        lengthM: v.length,
        points: v.points,
        seed: v.seed,
        profile: v.profile,
      });
      return route ? { ...route, label: v.label, profile: v.profile } : null;
    }),
  );
  const results = settled.filter((r): r is RawRoute => r !== null);

  if (results.length >= 3) return results.slice(0, 3);

  const fallback = buildFallbackRoutes(wizard);
  const merged = [...results];
  for (const fb of fallback) {
    if (merged.length >= 3) break;
    if (!merged.some((r) => r.label === fb.label)) merged.push(fb);
  }
  return merged.slice(0, 3);
}
