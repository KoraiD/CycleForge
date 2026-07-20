import type { StartPreset } from "./types";

export const AMSTERDAM_BBOX = {
  minLng: 4.72,
  minLat: 52.28,
  maxLng: 5.05,
  maxLat: 52.45,
};

export const START_PRESETS: Record<
  Exclude<StartPreset, "custom">,
  { label: string; lat: number; lng: number }
> = {
  // Slightly south of the station so ORS can snap onto the cycling network.
  centraal: { label: "Amsterdam Centraal", lat: 52.378, lng: 4.8985 },
  vondelpark: { label: "Vondelpark", lat: 52.3577, lng: 4.8686 },
  amstel: { label: "Amstel Station", lat: 52.3462, lng: 4.9179 },
};

export const ROUTE_COLORS = ["#1f6b4a", "#c45c26", "#2f5d8c"] as const;

export const AGENT_SYSTEM_PROMPT = `You are CycleForge, a visual cycling training planner for the Amsterdam metro area.

CRITICAL RULES:
- Keep text extremely short (1–2 sentences max per turn). The UI renders maps, charts, and wizard controls.
- Prefer tools over prose. Never dump long route descriptions.
- Flow: (1) upsert_wizard_state from the user's goal, (2) show/update wizard until confirmed, (3) generate_route_candidates, (4) present the plan briefly, (5) refine_plan or select_route on follow-ups.
- Defaults when unspecified: 90 minutes, endurance, rolling terrain, Vondelpark start, avoid busy roads.
- Riders may start from Amsterdam presets OR a custom lat/lng / address (startPreset=custom). Prefer their chosen start.
- After generating routes, say something like: "Three loops are on the map — pick one or ask to refine."`;
