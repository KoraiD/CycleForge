# CycleForge — Submit playbook

Checklist for **deploy (B1)**, **Trigger/ClickHouse walkthrough (B5)**, **public-repo scrub (E3)**, **demo video (E4)**, and **form copy (E5)**.

Deadline context: **23 July AoE**. Captain submits via the official hackathon form.

Related: [`RUN.md`](RUN.md) · [`../README.md`](../README.md) · [`../SECURITY.md`](../SECURITY.md).

---

## 0. Pre-flight (same day as recording)

```bash
cd apps/web
npm run check
npm run seed:clickhouse
npm run ingest:weather
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

Expect `triggerConfigured`, `aiConfigured` (or `googleConfigured`), and `clickhouseConfigured` all `true` for the full agent demo. Keep two terminals ready: `npm run dev` + `npm run dev:trigger` (CLI pin **4.5.4** via `package.json`).

### UI warm-up (record-ready path)

1. **Load demo athlete history**
2. Confirm start is map/address-friendly (nearby suggestions OK)
3. **Try the demo prompt** → wait for Plan Panel
4. Click a second route · hover elevation ↔ map · open **Explain this score**
5. Scrub **Should I cycle?** if hours appear · glance radar + TSS calendar
6. **Open summary** · **Download GPX**
7. Leave Trigger **Runs** + ClickHouse SQL console open in other windows
8. Optional cutaway: **Stack** page (live CH counts)

---

## B1 — Deploy agent to Trigger Cloud (backup if local worker flakes)

Local `npm run dev:trigger` is enough for the video if the run tree is visible. Cloud deploy is the **backup** path.

### One-time

1. `cd apps/web && npx trigger.dev@4.5.4 login`
2. Confirm `TRIGGER_PROJECT_REF` (Setup UI or `.env.local`) matches the dashboard project.
3. In Trigger dashboard → **Environment variables**, set:
   - AI key(s) for your chosen provider (`GOOGLE_GENERATIVE_AI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, plus `CYCLEFORGE_AI_PROVIDER` / `CYCLEFORGE_AI_MODEL` as needed)
   - `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`
   - `ORS_API_KEY` (recommended)
   - Never put personal secrets in the public repo

### Deploy

```bash
cd apps/web
npx trigger.dev@4.5.4 deploy --dry-run   # preview
npx trigger.dev@4.5.4 deploy             # or: npm run deploy:trigger
```

### Verify

Dashboard shows deployments for `cycleforge-agent`, `generate-route-candidates`, `fetch-ors-route-batch`, `fetch-ors-route`, `score-and-enrich-routes`, `ingest-weather-grid` (and optional `stack-heartbeat-schedule`).

**Captain:** run a real deploy before the video if you rely on cloud workers.

---

## B5 — Trigger dashboard walkthrough (for the video)

**Goal:** prove durable orchestration + parallel ORS children + scoring (+ optional weather ingest). Aligns with **Use of Trigger.dev** in the rubric.

### Expected run tree

```text
cycleforge-agent
  ├─ tools: upsert_wizard_state / load_demo_athlete / generate_route_candidates / …
  └─ generate-route-candidates
       └─ fetch-ors-route-batch
            ├─ fetch-ors-route   ← parallel
            ├─ fetch-ors-route
            └─ fetch-ors-route
  └─ score-and-enrich-routes
```

Optional: `ingest-weather-grid` (manual or ~6h schedule).

### Narration beats (≈40s)

1. “The agent session is durable — not a one-shot serverless function.”
2. Zoom three sibling `fetch-ors-route` runs: “ORS fan-out via `batchTriggerAndWait`.”
3. Open `score-and-enrich-routes`: “Weather, training metrics, ClickHouse persist.”
4. If time: `ingest-weather-grid` — “fixed open-data pipeline into ClickHouse.”

### Do / don’t

- **Do** generate a fresh plan so the tree is warm.
- **Don’t** show secret env screens or `.env.local` on camera.
- **Don’t** dwell on failed retries; re-run if the tree is messy.

---

## B5b — ClickHouse console walkthrough (for the video)

**Goal:** prove meaningful CH usage (pipeline + ranking + athlete history), not just a KV dump.

**1. Weather pipeline (open data → CH):**

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

**Narration:** “Plan-time weather is nearest-tile SQL with Open-Meteo fallback; scores re-rank in SQL; coaching uses athlete load from `rider_history_rides`.”

---

## E3 — Flip repo public + scrub secrets

Follow [`SECURITY.md`](../SECURITY.md). Checklist:

- [x] `git check-ignore -v apps/web/.env.local` → ignored
- [x] `git check-ignore -v apps/web/.data/runtime-config.json` → ignored
- [x] `git ls-files` has no `.env.local`, `.data/`, `*.pdf`, real key material
- [x] [`apps/web/.env.example`](../apps/web/.env.example) has **placeholders only**
- [x] Local hackathon PDFs stay untracked (`*.pdf` gitignored)
- [ ] Screenshots / video do not show dashboard secret values *(captain — when recording)*
- [x] MIT [`LICENSE`](../LICENSE) present; README clone URL correct
- [ ] Captain: flip GitHub visibility to **Public** when ready

### Make public (captain)

1. GitHub → **Settings** → **Change visibility** → Public  
2. Pin README / clone URL for the form  
3. Note commit hash used in the video: `git rev-parse --short HEAD`

### After public

- [ ] Fresh clone + Setup with **new** keys (sanity)
- [ ] CI green on the branch you merge to default

---

## E4 — Demo video script (≤ 5 minutes)

**Theme alignment:** Beyond the Wall of Text — show the **visual plan** first; Trigger + ClickHouse prove the stack. Match the **shipped MVP** (see README “Demo features”), not backlog ideas.

Record **1080p**. Start on the product UI, not slides. Prefer **agent mode** (health all green) when showing Trigger.

| Time | On screen | Say (approx.) |
| --- | --- | --- |
| **0:00–0:15** | Logo + empty home | “CycleForge — chat a training goal, get a visual plan, not a wall of text. Built for the ClickHouse × Trigger.dev hackathon.” |
| **0:15–0:35** | Load demo athlete → history chip / TSS calendar hint | “We load a fixture athlete into ClickHouse — three weeks of rides for coaching. No OAuth wall for the demo; GPX upload exists if you want your own files.” |
| **0:35–0:55** | Wizard: map/address start (brief) | “Start from a map pin or address — then we generate three candidates from there.” |
| **0:55–1:25** | Demo prompt → generating (fan-out graphic if visible) → Plan Panel | “One prompt. A durable Trigger agent fans out route fetches and scores them. The answer is the map.” |
| **1:25–2:05** | Click routes · elevation sync · wind tint · radar · score explain | “Interactive plan: select candidates, elevation stays in sync, wind bands on the map, radar compare, and explain-this-score tied to our ClickHouse ranking weights.” |
| **2:05–2:30** | Commute verdict scrubber + coach note | “Should I cycle? Hourly weather windows. Short coach note grounded in weather and recent load — not a essay.” |
| **2:30–2:50** | Shorter / regenerate (optional morph) · GPX · summary | “Tune without leaving the view. Export GPX. Open a shareable summary.” |
| **2:50–3:35** | Trigger dashboard run tree | “Here’s the durable tree: agent → ORS fan-out ×3 → score-and-enrich. That’s Trigger doing real orchestration.” |
| **3:35–4:25** | ClickHouse: weather → `route_scores_ranked` → athlete rides | “ClickHouse isn’t a dump — weather pipeline, SQL re-ranking, athlete history the coach note used.” |
| **4:25–4:45** | Stack page (optional) or architecture one-liner | “Stack page shows live table counts. Insight-to-words: the map and the next workout *are* the answer.” |
| **4:45–5:00** | End card: logo + repo URL | “CycleForge — MIT — bring your own keys, run locally. Link in the description.” |

### If you are short on time (cut order)

Keep: prompt → plan → Trigger tree → ClickHouse SQL → end card.  
Cut first: Stack page, score-explain deep dive, regenerate morph.

### Recording tips

- Prefetch `seed:clickhouse` + `ingest:weather` before record.
- Jump-cut dead air while ORS runs; show the finished Trigger tree after.
- Never scroll env vars or Setup password fields on camera.
- Keep chat bubbles short (progress chips OK).

---

## E5 — Submission form copy (paste-ready)

**Project title:** CycleForge

**Tagline / one-liner:**  
Chat a training goal. Get a map, elevation, coaching note, and a ride you can export — not a paragraph.

**Repository URL:**  
`https://github.com/KoraiD/CycleForge`

**Demo video URL:**  
*(add YouTube/Loom/Drive link after upload)*

**How we use Trigger.dev:**  
Durable `cycleforge-agent` (`chat.agent`) orchestrates planning tools. Child tasks fan out OpenRouteService geometry (`fetch-ors-route-batch` → parallel `fetch-ors-route` via `batchTriggerAndWait`), then `score-and-enrich-routes` attaches weather, training metrics, tips, and ClickHouse persistence. Scheduled/manual `ingest-weather-grid` loads open weather into ClickHouse for plan-time joins. Tools include `load_demo_athlete`, `select_route`, and `refine_plan` for an interactive loop inside the durable session.

**How we use ClickHouse:**  
Feature store + analytics for the planner: `plan_sessions`, `routes`, `route_scores`, SQL view `route_scores_ranked` (recomputes weighted totals), open-data `weather_forecast_grid` (nearest-tile join with Open-Meteo fallback), `rider_history_rides` for the demo athlete (and GPX uploads), similar-ride lookups over a seed corpus, plus optional `training_blocks`. The UI surfaces CH-backed weather, history aggregates, score explain, and a Stack page with live counts.

**Problem / insight-to-words:**  
Training chat usually dumps paragraphs. CycleForge answers with an interactive wizard, map candidates, elevation, training effect, leave-window guidance, coach note, GPX export, and a printable summary — the visual plan *is* the response.

**Tech stack:**  
Next.js 16, Trigger.dev 4.5, ClickHouse, BYOK AI (Google AI Studio / OpenAI / Anthropic / local OpenAI-compatible), MapLibre, OpenRouteService, Open-Meteo.

**What’s in / out of scope:**  
See README — MVP is the visual planner + Trigger/CH pipeline + local BYOK host; not full athlete-platform OAuth or turn-by-turn nav.

**License:** MIT

**Team / captain:** *(fill before submit)*

---

## Captain freeze checklist

- [ ] `npm run check` green on the commit you will demo
- [ ] Seed + weather ingest fresh
- [ ] Trigger deploy done **or** local worker proven with run tree
- [ ] Video uploaded; link in form
- [ ] Repo public; [`SECURITY.md`](../SECURITY.md) scrub done
- [ ] Form fields from §E5
- [ ] Freeze feature commits (docs-only OK)

---

## Quick links

| Item | Where |
| --- | --- |
| Product + demo features | [`../README.md`](../README.md) |
| Local run | [`RUN.md`](RUN.md) |
| Security scrub | [`../SECURITY.md`](../SECURITY.md) |
| Env template | [`../apps/web/.env.example`](../apps/web/.env.example) |
| Schema | [`../clickhouse/schema.sql`](../clickhouse/schema.sql) |
| CI | [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
