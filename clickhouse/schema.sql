-- CycleForge ClickHouse schema
-- Run against your ClickHouse Cloud service before first demo.

CREATE TABLE IF NOT EXISTS plan_sessions (
  session_id String,
  created_at DateTime64(3, 'UTC') DEFAULT now64(3),
  goals_text String,
  wizard_json String,
  status LowCardinality(String)
) ENGINE = MergeTree
ORDER BY (created_at, session_id);

CREATE TABLE IF NOT EXISTS routes (
  route_id String,
  session_id String,
  created_at DateTime64(3, 'UTC') DEFAULT now64(3),
  label String,
  profile LowCardinality(String),
  distance_m Float64,
  duration_s Float64,
  elev_gain_m Float64,
  elev_loss_m Float64,
  geometry_geojson String,
  elev_km Array(Float64),
  elev_m Array(Float64),
  ors_extras_json String,
  weather_json String,
  tips Array(String),
  training_json String,
  is_seed UInt8 DEFAULT 0
) ENGINE = MergeTree
ORDER BY (session_id, created_at, route_id);

CREATE TABLE IF NOT EXISTS route_scores (
  route_id String,
  session_id String,
  created_at DateTime64(3, 'UTC') DEFAULT now64(3),
  goal_fit Float64,
  safety_proxy Float64,
  scenic_proxy Float64,
  weather_fit Float64,
  total Float64
) ENGINE = MergeTree
ORDER BY (session_id, total, route_id);

-- Recompute ranking in SQL (same weights as apps/web/src/lib/scoring.ts).
-- Demo this in ClickHouse console for the judging video.
CREATE VIEW IF NOT EXISTS route_scores_ranked AS
SELECT
  route_id,
  session_id,
  created_at,
  goal_fit,
  safety_proxy,
  scenic_proxy,
  weather_fit,
  total AS total_stored,
  round(
    goal_fit * 0.45
    + safety_proxy * 0.2
    + scenic_proxy * 0.15
    + weather_fit * 0.2,
    2
  ) AS total_sql
FROM route_scores;

-- Open-data weather pipeline (Open-Meteo → Trigger ingest → plan-time SQL join).
CREATE TABLE IF NOT EXISTS weather_forecast_grid (
  tile_id String,
  tile_lat Float64,
  tile_lng Float64,
  observed_at DateTime64(3, 'UTC'),
  temp_c Float64,
  wind_kmh Float64,
  wind_dir_deg Float64,
  precip_mm Float64,
  weather_code UInt16,
  summary LowCardinality(String),
  source LowCardinality(String) DEFAULT 'open-meteo',
  ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
) ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY (tile_lat, tile_lng, observed_at);
