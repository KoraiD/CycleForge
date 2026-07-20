import {
  buildElevProfile,
  elevGainLoss,
  lineDistanceM,
} from "./geometry";
import { buildFallbackRoutes, type RawRoute } from "./fallback-routes";
import { nameRouteCandidates } from "./name-routes";
import { placeAwareRouteLabels } from "./route-labels";
import {
  ROUTE_VARIANTS,
  variantLengthM,
  type RouteVariant,
} from "./route-variants";
import type { WizardState } from "./types";

type OrsFeature = {
  geometry?: { type: string; coordinates?: number[][] };
  properties?: {
    summary?: { distance?: number; duration?: number };
  };
};

export async function fetchOrsVariant(
  wizard: WizardState,
  variant: RouteVariant,
): Promise<RawRoute | null> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return null;

  const cyclingProfile =
    wizard.intensity === "tempo" || wizard.avoidBusyRoads === false
      ? "cycling-road"
      : "cycling-regular";

  try {
    // cycling-regular rejects avoid_features:highways; prefer quieter profile instead.
    const options: Record<string, unknown> = {
      round_trip: {
        length: Math.round(variantLengthM(wizard, variant)),
        points: variant.points,
        seed: variant.seed,
      },
    };
    if (wizard.avoidBusyRoads && cyclingProfile === "cycling-road") {
      options.avoid_features = ["highways"];
    }

    const res = await fetch(
      `https://api.openrouteservice.org/v2/directions/${cyclingProfile}/geojson`,
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [[wizard.startLng, wizard.startLat]],
          elevation: true,
          extra_info: ["steepness", "waytype"],
          options,
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
    const distanceM =
      feature?.properties?.summary?.distance ?? lineDistanceM(coords);
    const durationS =
      feature?.properties?.summary?.duration ?? (distanceM / 1000 / 24) * 3600;
    const { gain, loss } = elevGainLoss(coords);

    const labels = placeAwareRouteLabels(wizard);
    const labelIndex = Math.max(
      0,
      ROUTE_VARIANTS.findIndex((v) => v.seed === variant.seed),
    );

    return {
      label: labels[labelIndex] ?? variant.label,
      profile: variant.profile,
      geometry,
      distanceM,
      durationS,
      elevGainM: gain,
      elevLossM: loss,
      elevProfile: buildElevProfile(coords),
      busyPenalty: wizard.avoidBusyRoads ? 0.1 : 0.3,
      source: "ors",
    };
  } catch (err) {
    console.warn("ORS fetch failed", err);
    return null;
  }
}

export function mergeWithFallbacks(
  wizard: WizardState,
  partial: Array<RawRoute | null>,
): RawRoute[] {
  const results = partial.filter((r): r is RawRoute => r !== null);
  if (results.length >= 3) return results.slice(0, 3);

  const fallback = buildFallbackRoutes(wizard);
  const merged = [...results];
  for (const fb of fallback) {
    if (merged.length >= 3) break;
    if (!merged.some((r) => r.label === fb.label || r.profile === fb.profile)) {
      merged.push(fb);
    }
  }
  return merged.slice(0, 3);
}

/** Local / demo path — parallel ORS in-process (Trigger path uses child tasks). */
export async function generateRawRoutes(wizard: WizardState): Promise<RawRoute[]> {
  const settled = await Promise.all(
    ROUTE_VARIANTS.map((variant) => fetchOrsVariant(wizard, variant)),
  );
  const merged = mergeWithFallbacks(wizard, settled);
  const names = await nameRouteCandidates(wizard, merged);
  return merged.map((route, i) => ({
    ...route,
    label: names[i] ?? route.label,
  }));
}
