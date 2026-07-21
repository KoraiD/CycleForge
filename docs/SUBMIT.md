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

## B5a — Show judges the ClickHouse rows (prove it's real data)

**Goal:** give judges a concrete, copy-paste way to confirm the app is reading from a **live ClickHouse** — not hardcoded fixtures or the in-memory fallback. Do this live in the video *and* leave the steps here so judges can re-run them.

**Why it matters:** the UI always renders (it falls back to an in-memory stand-in when CH is absent), so "the demo works" alone doesn't prove CH is wired up. The fastest proof is to **create a row from the app, then read it back in the CH console / `clickhouse-client`.**

### Step 1 — open the CH console

- **ClickHouse Cloud:** service → **SQL console** (or connect `clickhouse-client` / the MCP ClickHouse tools).
- **Local Docker:** `docker exec -it <container> clickhouse-client` (see [`clickhouse/README.md`](../clickhouse/README.md)).
- Not sure of host/user? They're shown (masked) on the in-app **Setup** page.

### Step 2 — confirm the app is using CH (not memory)

- In-app: **`/stack`** page shows **live per-table row counts** queried from CH (not a screenshot).
- API: **`/api/health`** reports `clickhouse: ok` when configured.
- If either shows CH missing, the app is on the in-memory path — configure CH first (Setup page).

### Step 3 — generate fresh rows from the app

Run a real flow so rows land in CH:

- **Ask for a plan** (demo prompt) → writes `plan_sessions` + `routes` + `route_scores`.
- **Upload a GPX** (Strava/Garmin/TrainingPeaks export) → writes `rider_history_rides` under your `upload-<session>` athlete id.
- **Refresh weather** (`npm run ingest:weather`) → writes `weather_forecast_grid`.

### Step 4 — read the rows back (copy/paste)

```sql
-- the plan you just generated (note the fresh created_at)
SELECT session_id, goal_text, created_at
FROM plan_sessions
ORDER BY created_at DESC
LIMIT 3;

-- its scored route candidates, re-ranked by the SQL view
SELECT route_id, session_id, total_sql, goal_fit, weather_fit, created_at
FROM route_scores_ranked
ORDER BY created_at DESC
LIMIT 6;

-- the GPX you just uploaded (athlete_id = upload-<session prefix>)
SELECT label, intensity, tss_est, distance_m, started_at
FROM rider_history_rides
ORDER BY started_at DESC
LIMIT 5;
```

**Sanity trick for the video:** right after generating a plan, run the `plan_sessions` query *before and after* — the row count increments and a new `created_at` appears. That before/after delta is the clearest on-camera proof the data is real.

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

**The story we tell:** the hackathon's own example was *“should I ride tomorrow?”* — and honestly, that's the **easy** question. A dozen apps answer it. But the motivation behind it is real, and it's something every regular rider feels: **if you cycle a lot — for training or for fun — the hardest part isn't deciding whether to ride. It's planning the next ride.** Where to go, how long, how hard, which roads, what the weather window looks like. That planning grind is what kills the fun. So I built this open-source project to fix it: **an AI agent plus rich visualizations turn the planning process into a fun game** — and because it works with *any* agent and runs fully locally, it's easy to test ideas and iterate on a cycling plan in real time.

**Theme alignment:** Beyond the Wall of Text — show the **visual plan** first; Trigger + ClickHouse prove the stack. Match the **shipped MVP** (see README “Demo features”), not backlog ideas.

Record **1080p**. Start on the product UI, not slides. Prefer **agent mode** (health all green) when showing Trigger.

| Time | On screen | Say (approx.) |
| --- | --- | --- |
| **0:00–0:20** | Logo + empty home | “The hackathon's example was *‘should I ride tomorrow?’* — but that's the easy question; plenty of tools answer it. If you ride a lot, the hard part is **planning the next ride**. So I built CycleForge: an open-source planner where an AI agent + great visuals turn planning into a fun game.” |
| **0:20–0:40** | Load demo athlete → history chip / TSS calendar | “It knows my training. We load a fixture athlete into ClickHouse — three weeks of rides — so coaching is grounded in my recent load. No OAuth wall for the demo; GPX upload (from Strava, Garmin, or TrainingPeaks) works if you want your own files.” |
| **0:40–0:55** | Wizard: map/address start (brief) | “Start from a map pin or address — then we generate three candidates from there.” |
| **0:55–1:25** | Demo prompt → generating → Plan Panel | “One prompt. A durable Trigger agent fans out route fetches and scores them. And it works with *any* agent — even a fully local model — so I can iterate on a plan in real time. The answer is the map, not a paragraph.” |
| **1:25–2:05** | Click routes · elevation sync · wind tint · radar · score explain | “Interactive plan: select candidates, elevation stays in sync, wind bands on the map, road-type mix, radar compare, and explain-this-score tied to our ClickHouse ranking weights.” |
| **2:05–2:30** | Commute verdict scrubber + coach note | “*Should I cycle?* — yes, we answer that too, as an hourly weather window: temp, wind, rain, sun, humidity, UV, visibility, air quality. Plus a short coach note grounded in weather and my load.” |
| **2:30–2:50** | Shorter / regenerate · GPX · summary | “Tune without leaving the view. Export GPX. Open a shareable summary.” |
| **2:50–3:35** | Trigger dashboard run tree | “Here's the durable tree: agent → ORS fan-out ×3 → score-and-enrich. That's Trigger doing real orchestration.” |
| **3:35–4:25** | ClickHouse console: run the §B5a before/after query | “And this is a live ClickHouse, not a fixture. I just generated that plan — watch the row appear: weather pipeline, SQL re-ranking, athlete history the coach note used. The counts go up as I use the app.” |
| **4:25–4:45** | Stack page (live counts) or architecture one-liner | “The Stack page shows live table counts. Insight-to-words: the map and the next workout *are* the answer.” |
| **4:45–5:00** | End card: logo + repo URL | “CycleForge — open source, MIT — bring your own keys, run it locally with any agent. Link in the description.” |

### Speaker notes (the through-line)

- **Open on the problem, not the product.** One line: “*Should I ride tomorrow?* is easy — planning the next ride is the hard part.” That's the hook and the whole motivation. Land it before you show any UI.
- **Position the two tools honestly.** “The hackathon example asked *should I ride tomorrow*. We answer that too (the hourly weather window) — but the real value is everything after *yes*: where, how long, how hard.”
- **“Fun game” beat.** When the plan appears, say the planning feels like a game now — tweak a chip, the map morphs; ask again, it iterates in real time. Emphasize it's **agent-agnostic** and **runs locally**, so experimenting costs nothing.
- **Prove the stack is real, don't just claim it.** The ClickHouse before/after row-count moment (§B5a) is your receipts — say “watch the count go up,” then run it.
- **Close on open source.** Free, MIT, BYOK, runs on your machine, works with any agent — invite people to clone it and plan their own ride.

### If you are short on time (cut order)

Keep: hook (planning is the hard part) → prompt → plan → Trigger tree → ClickHouse before/after → end card.
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
The hackathon's example was *“should I ride tomorrow?”* — but that's the easy question, and plenty of tools answer it. For anyone who rides regularly, the hard part is **planning the next ride**: where, how long, how hard, which roads, which weather window. CycleForge makes that planning feel like a game. An AI agent (any agent — even a fully local model) answers with an interactive wizard, map candidates, elevation, training effect, leave-window guidance, a coach note, GPX export, and a printable summary — the visual plan *is* the response. And because it runs locally with your own keys, you can test ideas and iterate on a plan in real time.

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
