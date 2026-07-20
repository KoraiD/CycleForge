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
  /** Functional threshold power (watts). Improves IF/TSS when set. */
  ftpWatts: number | null;
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
  /** Present when TSS used rider FTP. */
  ftpWatts?: number | null;
  /** Estimated normalized power when FTP is known. */
  npEst?: number | null;
};

export type LeaveWindowHint = {
  bestStartIso: string;
  bestStartLabel: string;
  score: number;
  reason: string;
  alternatives: Array<{ startIso: string; label: string; score: number }>;
};

export type EffortSegment = {
  fromKm: number;
  toKm: number;
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
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
  /** Climb-based effort bands for elevation overlay. */
  effortSegments?: EffortSegment[];
};

/** Aggregates from rider_history_rides / demo fixture for coaching. */
export type HistoryContext = {
  athleteId: string;
  athleteLabel: string;
  source: "fixture" | "upload";
  rideCount: number;
  weeks: number;
  hoursLast7d: number;
  hoursLast28d: number;
  tssLast7d: number;
  tssLast28d: number;
  lastHardLabel: string | null;
  lastHardDaysAgo: number | null;
  recentLabels: string[];
  summaryLine: string;
  loadHint: string;
};

export type PlanPayload = {
  sessionId: string;
  wizard: WizardState;
  routes: RouteCandidate[];
  selectedRouteId: string;
  /** Short coaching suggestion for the selected route (lives on the plan, not in chat). */
  coachNote: string;
  /** Present when a demo/imported athlete is bound to the session. */
  historyContext?: HistoryContext;
  /** Best departure window from hourly weather. */
  leaveWindow?: LeaveWindowHint | null;
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
  startPreset: "custom",
  startLat: 52.3676,
  startLng: 4.9041,
  startLabel: "Pick a start on the map",
  avoidBusyRoads: true,
  confirmed: false,
  ftpWatts: null,
});
