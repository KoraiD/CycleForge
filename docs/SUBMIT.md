# CycleForge — Submit playbook

Single checklist for **deploy notes (B1)**, **Trigger/ClickHouse video walkthrough (B5)**, **public-repo scrub (E3)**, **demo video (E4)**, and **form copy (E5)**.

Deadline context: **23 July AoE**. Captain submits via the official hackathon form.

Related docs: [`RUN.md`](RUN.md) (local run) · [`IMPLEMENTATION.md`](IMPLEMENTATION.md) (plan).

---

## 0. Pre-flight (same day as recording)

```bash
cd apps/web
npm run check
npm run seed:clickhouse
npm run ingest:weather
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

Expect all health flags `true` for the full agent demo. Keep two terminals ready: `npm run dev` + `npm run dev:trigger` (pin **4.5.4** via `package.json`).

UI warm-up path (record-ready):

1. **Load demo athlete history**
2. **Try the demo prompt**
3. Select a route · hover elevation ↔ map
4. **Open summary** · **Download GPX**
5. Leave Trigger dashboard + ClickHouse console open in other windows

---

## B1 — Deploy agent to Trigger Cloud (backup if local worker flakes)

Local `npm run dev:trigger` is enough for the video if the run tree is visible. Cloud deploy is the **backup** path.

### One-time

1. Log in: `cd apps/web && npx trigger.dev@4.5.4 login`
2. Confirm `TRIGGER_PROJECT_REF` in `.env.local` matches the dashboard project.
3. In Trigger dashboard → **Environment variables** (prod/staging), set at least:
   - `GOOGLE_GENERATIVE_AI_API_KEY`
   - `GOOGLE_GENERATIVE_AI_MODEL` (optional; default `gemini-flash-latest`)
   - `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`
   - `ORS_API_KEY` (recommended)
   - Do **not** put personal secrets in the public repo

### Deploy

```bash
cd apps/web
# Preview what would ship
npx trigger.dev@4.5.4 deploy --dry-run

# Production deploy
npx trigger.dev@4.5.4 deploy
# or: npm run deploy:trigger
```

### Verify

1. Dashboard shows a new deployment for `cycleforge-agent`, `generate-route-candidates`, `fetch-ors-route-batch`, `fetch-ors-route`, `score-and-enrich-routes`, `ingest-weather-grid`.
2. Trigger a plan from the UI (local Next still fine if `TRIGGER_SECRET_KEY` points at that project).
3. Open the run and confirm the fan-out tree (see B5).

**Captain action:** run real `deploy` once before the video if relying on cloud workers. Dry-run alone is not a deploy.

---

## B5 — Trigger dashboard walkthrough (for the video)

**Goal:** prove durable orchestration + parallel ORS children + scoring (+ optional ingest).

### What to open

Trigger.dev project → **Runs** (filter recent) while generating a plan with the agent worker live.

### Expected run tree

```text
cycleforge-agent
  ├─ (tools) upsert_wizard_state / load_demo_athlete / generate_route_candidates / …
  └─ generate-route-candidates
       └─ fetch-ors-route-batch
            ├─ fetch-ors-route   ← parallel
            ├─ fetch-ors-route
            └─ fetch-ors-route
  └─ score-and-enrich-routes
```

Optional separate run (if you show pipeline):

```text
ingest-weather-grid   (manual or 6h schedule)
```

### Narration beats (≈40s)

1. “Agent session is durable — not a single serverless function.”
2. Zoom the three sibling `fetch-ors-route` runs: “ORS fan-out via `batchTriggerAndWait`.”
3. Open `score-and-enrich-routes`: “Weather resolve, training metrics, ClickHouse persist.”
4. If time: show `ingest-weather-grid` schedule — “fixed open-data pipeline into CH.”

### Do / don’t

- **Do** generate a fresh plan so the tree is warm.
- **Don’t** scroll through secret env screens on camera.
- **Don’t** dwell on failed retries; re-run if the tree is messy.

---

## B5b — ClickHouse console walkthrough (for the video)

Run these in order (copy from here during recording).

**1. Pipeline weather (open data → CH):**

```sql
SELECT tile_id, tile_lat, tile_lng, temp_c, wind_kmh, precip_mm, summary, observed_at
FROM weather_forecast_grid
WHERE abs(tile_lat - 52.36) <= 0.15 AND abs(tile_lng - 4.87) <= 0.15
ORDER BY observed_at DESC
LIMIT 8;
```

**2. SQL ranking view:**

```sql
SELECT route_id, session_id, total_sql, total_stored, goal_fit, weather_fit, created_at
FROM route_scores_ranked
ORDER BY created_at DESC
LIMIT 12;
```

**3. Athlete history fixture:**

```sql
SELECT label, intensity, tss_est, distance_m, started_at
FROM rider_history_rides
WHERE athlete_id = 'demo-ams-rider'
ORDER BY started_at DESC
LIMIT 14;
```

**Narration:** “Plan-time weather is nearest-tile SQL with live Open-Meteo fallback; scores are re-ranked in SQL; coaching can use athlete load from `rider_history_rides`.”

---

## E3 — Flip repo public + scrub secrets

### Scrub (before making public)

- [ ] `apps/web/.env.local` is **not** tracked (`git check-ignore -v apps/web/.env.local`)
- [ ] No real keys in git history for this branch (`git log -p --all -S 'tr_dev_' -- '*.env*' | head` should be empty of real secrets)
- [ ] Only placeholders in [`apps/web/.env.example`](../apps/web/.env.example)
- [ ] Screenshots / recordings do not show dashboard secret values
- [ ] Local `.data/plans/` stays gitignored (session cache)

### Make public (captain)

1. GitHub → repository **Settings** → **Danger zone** → **Change visibility** → Public  
   (or create a clean public mirror if the org prefers)
2. Confirm MIT [`LICENSE`](../LICENSE) is present
3. Pin README demo link / clone URL for the form
4. Tag or note the commit hash used in the video (`git rev-parse --short HEAD`)

### After public

- [ ] Clone fresh into a temp dir and follow [`RUN.md`](RUN.md) with **new** keys (sanity)
- [ ] CI green on `main` after merge

---

## E4 — Demo video script (≤ 5 minutes)

Record **1080p**, voice-over or live narration. Start on the product, not slides.

| Time | On screen | Say (approx.) |
| --- | --- | --- |
| 0:00–0:12 | Logo + empty home | “CycleForge — visual training plans, not walls of text.” |
| 0:12–0:35 | Load demo athlete → chip appears | “We load a fixture athlete into ClickHouse — no OAuth wall for the demo.” |
| 0:35–1:05 | Try demo prompt → generating → plan | “Chat goal → durable Trigger agent → three scored loops on a map.” |
| 1:05–1:35 | Click routes · hover elev ↔ map · tweak panel | “Interactive plan: select, sync elevation, regenerate without leaving the view.” |
| 1:35–2:00 | Coach note + athlete banner | “Short coaching lives on the plan — grounded in weather and recent load.” |
| 2:00–2:25 | Download GPX · Open summary · Print | “Export the ride; share a mixed visual summary.” |
| 2:25–3:10 | Trigger dashboard run tree | “Agent, ORS fan-out, score task — durable and parallel.” |
| 3:10–4:10 | ClickHouse: weather → ranked → athlete | “Open-data pipeline, SQL ranking, athlete history table.” |
| 4:10–4:40 | Architecture one-liner (optional slide or README) | “Insight-to-words: the map — and the next workout — are the answer.” |
| 4:40–5:00 | End card: logo + public repo URL | “CycleForge — MIT — link in description.” |

### Recording tips

- Prefetch weather + seed before pressing record.
- Prefer **agent mode** (health all green) for the Trigger section; local demo mode still works for UI-only shots.
- Cut dead air while ORS runs; jump cut to the finished plan if needed, then cut to the already-finished Trigger tree.
- Keep chat short on camera (progress chips, not tool-name spam).

---

## E5 — Submission form copy (paste-ready)

**Project title:** CycleForge

**Tagline / one-liner:**  
Chat a training goal. Get a map, elevation, coaching note, and a ride you can export — not a paragraph.

**Repository URL:**  
`https://github.com/KoraiD/CycleForge` *(confirm after visibility flip)*

**Demo video URL:**  
*(add YouTube/Loom/Drive link after upload)*

**How we use Trigger.dev:**  
Durable `cycleforge-agent` (`chat.agent`) orchestrates planning tools. Child tasks fan out OpenRouteService geometry (`fetch-ors-route-batch` → parallel `fetch-ors-route` via `batchTriggerAndWait`), then `score-and-enrich-routes` attaches weather, training metrics, tips, and ClickHouse persistence. A scheduled/manual `ingest-weather-grid` task loads open weather into ClickHouse for plan-time joins. Optional tool `load_demo_athlete` seeds fixture ride history for load-aware coaching.

**How we use ClickHouse:**  
Feature store + analytics for the planner: `plan_sessions`, `routes`, `route_scores`, SQL view `route_scores_ranked` (recomputes weighted totals), open-data `weather_forecast_grid` (nearest-tile join at plan time with live Open-Meteo fallback), `rider_history_rides` for the demo athlete fixture, and similar-ride lookups over seed corpus. The UI surfaces CH-backed weather source and history aggregates on the plan and summary page.

**Problem / insight-to-words:**  
Training chat usually dumps paragraphs. CycleForge answers with an interactive wizard, map candidates, elevation, training effect, coach note, GPX export, and a printable summary — the visual plan *is* the response.

**Tech stack:**  
Next.js 16, Trigger.dev 4.5, ClickHouse Cloud, Google AI Studio (Gemini), MapLibre, OpenRouteService, Open-Meteo.

**License:** MIT

**Team / captain:** *(fill before submit)*

---

## Captain freeze checklist

- [ ] `npm run check` green on the commit you will demo
- [ ] Seed + weather ingest fresh
- [ ] Trigger deploy done **or** local worker proven with run tree screenshot
- [ ] Video uploaded; link pasted into form
- [ ] Repo public; secrets scrubbed
- [ ] Form fields filled from §E5
- [ ] Freeze further feature commits (docs-only OK)

---

## Quick links

| Item | Where |
| --- | --- |
| Local run | [`RUN.md`](RUN.md) |
| Product plan / backlog | [`IMPLEMENTATION.md`](IMPLEMENTATION.md) |
| Env template | [`apps/web/.env.example`](../apps/web/.env.example) |
| Schema | [`clickhouse/schema.sql`](../clickhouse/schema.sql) |
| CI | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
