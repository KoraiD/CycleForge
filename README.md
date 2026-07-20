# CycleForge

**Visual cycling training planner** for the [ClickHouse × Trigger.dev Summer Hackathon 2026](https://triggerdev.clickhouse.com).

> Theme: **Beyond the Wall of Text** — chat should answer with maps, elevation, training metrics, and an interactive wizard. Prose is garnish.

CycleForge turns a training goal or trip idea into a **visual plan**: three route candidates on a map, elevation profiles, estimated training effect (TSS / zones), weather-aware tips, and ClickHouse-backed scoring + “similar rides”.

---

## Demo prompt

> I have 90 minutes tomorrow morning near Amsterdam — endurance ride, some hills if possible, avoid busy roads.

---

## Why this fits the judging rubric

| Criterion | How CycleForge addresses it |
| --- | --- |
| **Use of ClickHouse & Trigger.dev (25%)** | `chat.agent()` + durable child tasks; ClickHouse stores routes/scores and runs ranking + similar-ride SQL |
| **Problem fit (20%)** | Response *is* the product: wizard → map → charts → structured training data |
| **Technical implementation (20%)** | Next.js App Router, AI SDK tools, ORS fan-out with fallbacks, typed plan payload |
| **Innovation (20%)** | Training-effect block + SQL scoring + refine loop inside chat |
| **Scalability & impact (10%)** | Session/route tables designed for history; seeded rides simulate a real corpus |
| **Presentation (5%)** | Clear demo script in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) |

---

## Architecture

```text
Browser (Next.js)
  ├─ useChat + useTriggerChatTransport
  ├─ Wizard (in-transcript controls)
  └─ Plan Panel (MapLibre + Recharts)
        │
        ▼
Trigger.dev chat.agent  (cycleforge-agent)
  tools: upsert_wizard_state | generate_route_candidates
         select_route | refine_plan
        │
        ├─► generate-route-candidates
        │     └─► fetch-ors-route-batch
        │           ├─► fetch-ors-route  (Steady canal)
        │           ├─► fetch-ors-route  (Park & parkway)
        │           └─► fetch-ors-route  (Waterland)   ← batchTriggerAndWait
        └─► score-and-enrich-routes
              ├─ Open-Meteo weather
              ├─ training + tips engines
              └─ ClickHouse insert + route_scores_ranked + similar rides
```

### Trigger.dev (required, deep)

| Piece | ID / name | Role |
| --- | --- | --- |
| Chat agent | `cycleforge-agent` | Durable multi-turn session via `chat.agent()` |
| Tool | `upsert_wizard_state` | Merge wizard → memory + `plan_sessions` |
| Tool | `generate_route_candidates` | Kick durable generation + scoring |
| Task | `generate-route-candidates` | Orchestrate route fan-out |
| Task | `fetch-ors-route-batch` | Orchestrates durable ORS fan-out |
| Task | `fetch-ors-route` ×3 | Parallel child runs via `batchTriggerAndWait` |
| Task | `score-and-enrich-routes` | Weather, tips, training, ClickHouse persist/score |
| Tool | `select_route` / `refine_plan` | Interactive map + constraint deltas |

### ClickHouse (required, deep)

Tables: `plan_sessions`, `routes`, `route_scores` — see [`clickhouse/schema.sql`](clickhouse/schema.sql).

Meaningful queries:

```sql
-- Rank candidates for a session (SQL recomputes the weighted total)
SELECT route_id, total_sql, total_stored, goal_fit, weather_fit
FROM route_scores_ranked
WHERE session_id = {sessionId:String}
ORDER BY total_sql DESC;

-- Similar historical rides
SELECT label,
  abs(distance_m - {distanceM:Float64}) / 1000
  + abs(elev_gain_m - {elevGainM:Float64}) / 10
  + abs(duration_s - {durationS:Float64}) / 600 AS dist
FROM routes
WHERE is_seed = 1
ORDER BY dist ASC
LIMIT 3;
```

Seed data: [`clickhouse/seed.sql`](clickhouse/seed.sql) (~20 synthetic Amsterdam-area rides).

Without ClickHouse env vars, the app uses an in-memory stand-in so local demo still works.

---

## Repository layout

```text
.
├── README.md
├── LICENSE
├── package.json                 # root scripts (delegate to apps/web)
├── docs/
│   └── IMPLEMENTATION.md        # full hackathon build + submit plan
├── clickhouse/
│   ├── schema.sql
│   └── seed.sql
└── apps/web/                    # Next.js + Trigger tasks
    ├── src/
    │   ├── app/                 # UI routes + server actions
    │   ├── components/          # Chat, Wizard, Plan Panel, map, charts
    │   ├── data/golden-routes/  # cached ORS GeoJSON per start preset
    │   ├── lib/                 # scoring, geometry, ORS, CH, tips, tests
    │   └── trigger/             # chat.agent + schemaTasks
    ├── trigger.config.ts
    ├── vitest.config.ts
    └── .env.example
```

---

## Prerequisites

- Node.js 22+
- npm 10+
- Accounts (for full stack): [Trigger.dev](https://trigger.dev), [ClickHouse Cloud](https://clickhouse.com/cloud), [Google AI Studio](https://aistudio.google.com/apikey)
- Optional: [OpenRouteService](https://openrouteservice.org) API key

---

## Quick start

Full walkthrough (tests, UI, ClickHouse queries, Trigger dashboard): **[docs/RUN.md](docs/RUN.md)**.

```bash
git clone <your-private-repo-url>
cd CH-Trigger-Hackathon   # or cycleforge

cd apps/web
cp .env.example .env.local
# Fill TRIGGER_SECRET_KEY, TRIGGER_PROJECT_REF, GOOGLE_GENERATIVE_AI_API_KEY
# Optional: CLICKHOUSE_*, ORS_API_KEY

npm install
npm run seed:clickhouse   # if ClickHouse is configured

# Terminal 1
npm run dev

# Terminal 2 (full agent)
npm run dev:trigger
```

Open [http://localhost:3000](http://localhost:3000).

**Local demo mode:** if Trigger/Google AI are missing, the UI still generates plans via golden/fallback geometry + Open-Meteo (see health probe `/api/health`).

---

## Environment variables

Copy from [`apps/web/.env.example`](apps/web/.env.example):

| Variable | Required for | Notes |
| --- | --- | --- |
| `TRIGGER_SECRET_KEY` | Agent chat | From Trigger.dev dashboard |
| `TRIGGER_PROJECT_REF` | Deploy / `trigger.config.ts` | e.g. `proj_…` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Agent model | From [Google AI Studio](https://aistudio.google.com/apikey) |
| `GOOGLE_GENERATIVE_AI_MODEL` | Optional | Default `gemini-flash-latest` |
| `CLICKHOUSE_URL` | Persist / SQL score | Cloud HTTPS endpoint |
| `CLICKHOUSE_USER` / `PASSWORD` / `DATABASE` | ClickHouse auth | |
| `ORS_API_KEY` | Real geometries | Without it → synthetic Amsterdam loops |

---

## Scripts

From repo root or `apps/web`:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run dev:trigger` | Trigger.dev local worker |
| `npm run build` | Production build |
| `npm run lint` | ESLint (zero warnings) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run check` | lint + typecheck + test |
| `npm run seed:clickhouse` | Apply schema + seed |

---

## Testing & quality

```bash
cd apps/web
npm run check
```

Unit tests cover:

- Geometry (distance, elev gain/loss, synthetic loops)
- Scoring (targets, weather penalties)
- Training effect (stimulus / zones / TSS)
- Tips + comparison strip
- Fallback route generation
- Plan builder (merge wizard + end-to-end plan with mocks)

Linting uses `eslint-config-next` (core-web-vitals + TypeScript) with stricter project rules: no `any`, unused vars as errors, consistent type imports, `eqeqeq`.

---

## User flow

1. **Chat** a goal / trip idea.
2. **Wizard** tunes duration, intensity, terrain, start preset, quiet-road bias.
3. **Generate** three loop candidates.
4. **Plan Panel** shows map (selectable routes), KPIs, elevation, training effect, tips, similar rides.
5. **Refine** via chat (“make it hillier”) or re-run the wizard.

---

## Scope (evolving)

**Shipped:** Amsterdam presets + customable agent flow, 3 route candidates, visual plan, refine chips, ORS + golden fallbacks, ClickHouse scoring (`route_scores_ranked`), Trigger agent with parallel ORS fan-out, Google AI Studio.

**Shipped recently:** logo, map/address start, weather grid → CH, plan UX tweaks, coach note, GPX, summary page (`/summary/[sessionId]?route=`).

**Next (see plan):** demo athlete-history path (spike TrainingPeaks/Garmin/Strava/Apple Health — fixture/upload likely); submit polish (deploy notes, video, public repo).

**Out for this hackathon:** full multi-platform OAuth product, multi-day tours, turn-by-turn nav, live tracking, power-meter physiology.

---

## Submission checklist

- [ ] Public GitHub (flip this private repo to public before submit)
- [ ] MIT or Apache-2.0 license (MIT included)
- [ ] Demo video ≤ 5 minutes (start with live product)
- [ ] Meaningful Trigger.dev + ClickHouse usage described in README
- [ ] Code written during build window
- [ ] Captain submits via official form

See **[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)** for the revised backlog, day plan, athlete-data spike, and demo script.  
See **[docs/RUN.md](docs/RUN.md)** to run the stack locally.

---

## License

[MIT](LICENSE)
