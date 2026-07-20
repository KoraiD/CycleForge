# CycleForge — Run guide

End-to-end guide: env setup → seed → UI + agent → tests → ClickHouse queries → Trigger dashboard.

Working directory for most commands: `apps/web`.

---

## 1. Prerequisites

- Node.js **22+** and npm **10+**
- Accounts / keys:
  - [Trigger.dev](https://trigger.dev) — `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`
  - [Google AI Studio](https://aistudio.google.com/apikey) — `GOOGLE_GENERATIVE_AI_API_KEY`
  - [ClickHouse Cloud](https://clickhouse.com/cloud) — `CLICKHOUSE_*`
  - [OpenRouteService](https://openrouteservice.org) — `ORS_API_KEY` (optional but recommended)

Without Trigger/Google, the UI still runs in **local demo mode** (golden/fallback routes).

---

## 2. Environment

```bash
cd apps/web
cp .env.example .env.local
```

Fill at least:

| Variable | Purpose |
| --- | --- |
| `TRIGGER_SECRET_KEY` | Agent chat + durable tasks |
| `TRIGGER_PROJECT_REF` | Trigger project id (`proj_…`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini via Google AI Studio |
| `GOOGLE_GENERATIVE_AI_MODEL` | Optional; default `gemini-flash-latest` |
| `CLICKHOUSE_URL` / `USER` / `PASSWORD` / `DATABASE` | Persist + SQL ranking |
| `ORS_API_KEY` | Live Amsterdam bike geometries |

Never commit `.env.local`.

---

## 3. Install & seed ClickHouse

```bash
cd apps/web
npm install
npm run seed:clickhouse
npm run ingest:weather   # Open-Meteo → weather_forecast_grid (Amsterdam tiles)
```

Seed loads `.env.local` automatically and applies:

- Tables: `plan_sessions`, `routes`, `route_scores`, `weather_forecast_grid`, `rider_history_rides`
- View: `route_scores_ranked` (SQL recomputed totals)
- ~20 seed rides for “similar past rides”
- Demo athlete fixture (`demo-ams-rider`, ~3 weeks) into `rider_history_rides`
- Weather grid ingest (also available as Trigger task `ingest-weather-grid`, schedule every 6h)

In the UI: **Load demo athlete history** (or agent tool `load_demo_athlete`) before generating routes to attach load-aware coaching.

Re-run seed anytime after schema changes.

---

## 4. Run the full stack (UI + agent)

Use **two terminals** from `apps/web`:

```bash
# Terminal 1 — Next.js UI
npm run dev
```

```bash
# Terminal 2 — Trigger.dev local worker
npm run dev:trigger
```

- UI: [http://localhost:3000](http://localhost:3000)
- First Trigger run may open a browser login once

### Health check

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

Expect all `true` for a full agent demo:

```json
{
  "ok": true,
  "clickhouseConfigured": true,
  "orsConfigured": true,
  "googleConfigured": true,
  "triggerConfigured": true
}
```

If `triggerConfigured` or `googleConfigured` is false, the UI shows **local demo mode**.

---

## 5. Manual UI walkthrough

1. Open [http://localhost:3000](http://localhost:3000).
2. Click **Try the demo prompt** (or paste your own goal).
3. Watch the visual pane show **Generating routes…** while tools run.
4. Confirm the **Plan Panel**: map, 3 candidates, elevation, TSS, tips.
5. Click another route candidate — KPIs / elevation update.
6. Use refine chips: **Shorter** / **Hillier** / **Easier**.
7. Optional: adjust the in-chat **wizard**, then **Generate routes**.

Demo prompt:

> I have 90 minutes tomorrow morning near Amsterdam — endurance ride, some hills if possible, avoid busy roads.

---

## 6. Tests & quality gates

```bash
cd apps/web
npm run check          # lint + typecheck + vitest
```

Or individually:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:watch     # while developing
```

CI runs the same checks on PRs to `main` (see `.github/workflows/ci.yml`).

---

## 7. ClickHouse queries (for demo / video)

Open the ClickHouse Cloud SQL console (or any CH client) against the same service as `.env.local`.

**Rank latest scores (SQL-computed total):**

```sql
SELECT
  route_id,
  session_id,
  total_sql,
  total_stored,
  goal_fit,
  weather_fit,
  created_at
FROM route_scores_ranked
ORDER BY created_at DESC
LIMIT 12;
```

**Similar historical rides** (same formula the app uses):

```sql
SELECT
  label,
  abs(distance_m - 40000) / 1000
    + abs(elev_gain_m - 80) / 10
    + abs(duration_s - 5400) / 600 AS dist
FROM routes
WHERE is_seed = 1
ORDER BY dist ASC
LIMIT 3;
```

**Recent sessions:**

```sql
SELECT session_id, status, goals_text, created_at
FROM plan_sessions
ORDER BY created_at DESC
LIMIT 10;
```

**Nearest weather tile (pipeline join demo):**

```sql
SELECT tile_id, tile_lat, tile_lng, temp_c, wind_kmh, precip_mm, summary, observed_at
FROM weather_forecast_grid
WHERE abs(tile_lat - 52.36) <= 0.15 AND abs(tile_lng - 4.87) <= 0.15
ORDER BY (abs(tile_lat - 52.36) + abs(tile_lng - 4.87)) ASC, observed_at DESC
LIMIT 5;
```

Weights for `total_sql` match `apps/web/src/lib/scoring.ts`:

`goal_fit×0.45 + safety_proxy×0.2 + scenic_proxy×0.15 + weather_fit×0.2`

---

## 8. Trigger.dev dashboard

While the local worker is running (`npm run dev:trigger`), generate a plan in the UI, then open the Trigger.dev dashboard for your project.

You should see a run tree like:

```text
cycleforge-agent
  └─ generate-route-candidates
       └─ fetch-ors-route-batch
            ├─ fetch-ors-route   (Steady canal loop)
            ├─ fetch-ors-route   (Park & parkway)
            └─ fetch-ors-route   (Waterland push)
  └─ score-and-enrich-routes
```

The three `fetch-ors-route` children are launched with `batchTriggerAndWait` (parallel fan-out).

---

## 9. Optional: refresh golden ORS fallbacks

If ORS routes change and you want to refresh offline GeoJSON:

```bash
cd apps/web
node scripts/capture-golden-routes.mjs
```

Writes `src/data/golden-routes/{centraal,vondelpark,amstel}.json`. Requires `ORS_API_KEY` in `.env.local`.

---

## 10. Troubleshooting

| Symptom | What to check |
| --- | --- |
| “local demo mode” banner | `/api/health` — Trigger + Google keys |
| Agent hangs / no plan | Terminal 2 worker running? Trigger login done? |
| Synthetic circles on map | ORS key missing/failing → golden/synthetic fallback |
| Empty “similar rides” | `npm run seed:clickhouse` |
| `/api/health` 500 | Restart Next; clear `apps/web/.next` if cache is corrupt |
| Lint fails on `.trigger/**` | Already ignored in `eslint.config.mjs`; delete stale `.trigger/tmp` if needed |
| Gemini model 404 | Use `gemini-flash-latest` (set in `.env.example`) |

---

## Quick cheat sheet

```bash
cd apps/web
cp .env.example .env.local   # then fill keys
npm install
npm run seed:clickhouse
npm run check

# Terminal 1
npm run dev

# Terminal 2
npm run dev:trigger

# Verify
curl -s http://localhost:3000/api/health | python3 -m json.tool
open http://localhost:3000
```
