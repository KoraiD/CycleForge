export type Intensity = "easy" | "endurance" | "tempo" | "hills";
export type TerrainBias = "flat" | "rolling" | "hilly";
export type StartPreset = "centraal" | "vondelpark" | "amstel" | "custom";

export type WizardState = {
  sessionId: string;
  goalsText: string;
  durationMin: number;
  intensity: Intensity;
  terrainBias: TerrainBias;
  startPreset: StartPreset;
  startLat: number;
  startLng: number;
  /** Human-readable start (address or preset label). */
  startLabel: string;
  avoidBusyRoads: boolean;
  confirmed: boolean;
};

export type ElevPoint = {
  km: number;
  elevM: number;
};

export type ZoneMix = {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
};

export type TrainingEffect = {
  tssEst: number;
  ifEst: number;
  stimulus: "recovery" | "endurance" | "tempo" | "climb" | "vo2";
  zoneMix: ZoneMix;
  recoveryHint: string;
};

export type WeatherSnapshot = {
  tempC: number;
  windKmh: number;
  windDirDeg: number;
  precipMm: number;
  summary: string;
  /** Where the snapshot was resolved from. */
  source?: "clickhouse" | "open-meteo";
};

export type RouteScore = {
  goalFit: number;
  safetyProxy: number;
  scenicProxy: number;
  weatherFit: number;
  total: number;
};

export type RouteCandidate = {
  routeId: string;
  sessionId: string;
  label: string;
  profile: string;
  distanceM: number;
  durationS: number;
  elevGainM: number;
  elevLossM: number;
  geometry: GeoJSON.LineString;
  elevProfile: ElevPoint[];
  weather: WeatherSnapshot | null;
  tips: string[];
  training: TrainingEffect;
  score: RouteScore;
  similarRideLabels: string[];
  source: "ors" | "fallback" | "seed";
};

export type PlanPayload = {
  sessionId: string;
  wizard: WizardState;
  routes: RouteCandidate[];
  selectedRouteId: string;
  comparison: {
    minClimbM: number;
    maxClimbM: number;
    minDistanceKm: number;
    maxDistanceKm: number;
  };
};

export const DEFAULT_WIZARD = (sessionId: string): WizardState => ({
  sessionId,
  goalsText: "",
  durationMin: 90,
  intensity: "endurance",
  terrainBias: "rolling",
  startPreset: "vondelpark",
  startLat: 52.3577,
  startLng: 4.8686,
  startLabel: "Vondelpark",
  avoidBusyRoads: true,
  confirmed: false,
});
