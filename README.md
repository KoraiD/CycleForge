# CycleForge

**Chat a cycling goal. Get a map, not a wall of text.**

CycleForge is a visual training planner for the [ClickHouse × Trigger.dev Summer Hackathon 2026](https://triggerdev.clickhouse.com) — theme **Beyond the Wall of Text**.

You describe the ride you want. The app answers with **three route options on a map**, elevation, training load (TSS), weather-aware coaching, and a ride you can export — all backed by durable Trigger.dev jobs and ClickHouse analytics.

---

## Try the demo (what judges / visitors should see)

Use this prompt (or click **Try the demo prompt** in the UI):

> I have 90 minutes tomorrow morning near Amsterdam — endurance ride, some hills if possible, avoid busy roads.

### Demo features (MVP)

| You do… | You get… |
| --- | --- |
| Load demo athlete history | ~3 weeks of fixture rides in ClickHouse → load-aware coach note + TSS calendar |
| Pick a start (map pin, address, or nearby suggestion) | Routes from *your* point — not a fixed city list |
| Send the goal (or demo prompt) | Wizard + **three scored loops** on an interactive map |
| Click routes / hover elevation | Map ↔ profile stay in sync; wind bands tint headwind vs tailwind |
| Scrub “Should I cycle?” hours | Best leave window from hourly weather (go / caution / wait) |
| Open “Explain this score” | Plain-language + SQL-flavored breakdown of ClickHouse ranking |
| Compare on the radar chart | Goal fit · quiet · scenic · weather across candidates |
| Tune & regenerate | Shorter / hillier / easier (or sliders) without leaving the plan |
| Download GPX · Open summary | Export the ride; share a printable visual summary |
| Open **Stack** | Live ClickHouse counts + Trigger run peek for the “how it works” story |

Optional while generating: a **Trigger fan-out** graphic shows durable ORS + scoring steps.

---

## What’s in scope vs out of scope

### In this MVP (shipped)

- Visual chat → wizard → 3-route plan (Amsterdam-biased demo; map/address works elsewhere)
- Trigger.dev agent + parallel route fetch + score/enrich tasks + weather ingest
- ClickHouse sessions, routes, SQL ranking, weather grid, athlete history, similar rides
- Coach note, GPX export, summary page, GPX history upload (no live OAuth)
- Bring-your-own keys: host locally; paste Trigger, ClickHouse, and AI credentials in **Setup**
- AI providers: Google AI Studio, OpenAI, Anthropic, or local (Ollama / LM Studio, etc.)

### Out of scope (intentionally)

- Full Strava / Garmin / TrainingPeaks OAuth product
- Multi-day tours, turn-by-turn navigation, live GPS tracking
- Power-meter physiology or a production SaaS multi-tenant deploy
- Bundled cloud credentials — **you bring your own**

---

## Run it on your machine (no shared secrets)

CycleForge is open-source and **bring-your-own-keys**. Nothing in this repo unlocks our (or anyone else’s) cloud accounts.

### You need

1. [Node.js 22+](https://nodejs.org) and npm  
2. Free/dev accounts as you like:
   - [Trigger.dev](https://trigger.dev) (agent + durable tasks)
   - [ClickHouse Cloud](https://clickhouse.com/cloud) or self-hosted ClickHouse
   - An AI key: [Google AI Studio](https://aistudio.google.com/apikey), [OpenAI](https://platform.openai.com), [Anthropic](https://console.anthropic.com), **or** a local server ([Ollama](https://ollama.com) / [LM Studio](https://lmstudio.ai))
   - Optional: [OpenRouteService](https://openrouteservice.org) for real bike geometries

### Steps

```bash
git clone https://github.com/KoraiD/CycleForge.git
cd CycleForge/apps/web
npm install
npm run dev
```

1. Open **http://localhost:3000/setup**  
2. Paste your Trigger, ClickHouse, and AI details → **Save & apply**  
   (saves locally to `.data/` + `.env.local`, pings ClickHouse, seeds tables when reachable)  
3. Restart the UI, then in a second terminal: `npm run dev:trigger`  
4. Open **http://localhost:3000** → Load demo athlete → Try the demo prompt  

**Without** Trigger or AI keys, the planner still works in **local demo mode** (cached/fallback routes) so you can explore the UI.

Secrets never leave your machine unless you put them in your own Trigger/ClickHouse projects. Do not commit `.env.local` or `.data/`.

Full technical runbook (queries, health checks, CI): **[docs/RUN.md](docs/RUN.md)**.  
Submit / video / scrub checklist: **[docs/SUBMIT.md](docs/SUBMIT.md)**.  
Security notes: **[SECURITY.md](SECURITY.md)**.

---

## Why this fits the hackathon

| Rubric | How CycleForge answers |
| --- | --- |
| **ClickHouse & Trigger.dev (25%)** | Durable `chat.agent` + ORS fan-out + scoring; CH stores routes/scores, weather pipeline, SQL ranking, athlete history |
| **Problem fit (20%)** | The response *is* the product: wizard, map, charts, coach note — prose is secondary |
| **Technical implementation (20%)** | Next.js, AI SDK tools, parallel tasks, typed plan payload, fallbacks |
| **Innovation (20%)** | Training effect + SQL scoring + in-plan refine loop + weather/load visuals |
| **Scalability & impact (10%)** | Session/route tables + seed corpus; BYOK so others can host |
| **Presentation (5%)** | Clear demo path above + ≤5 min script in SUBMIT |

### How the pieces connect

```text
Browser (Next.js)
  ├─ Chat + wizard + plan panel (map, charts, coach note)
  └─ Setup (your Trigger / ClickHouse / AI keys)
        │
        ▼
Trigger.dev  cycleforge-agent  (chat.agent)
  tools → generate routes → score & enrich
        │
        ├─ fetch-ors-route ×3 in parallel
        ├─ score-and-enrich-routes
        └─ ingest-weather-grid (schedule / CLI)
        │
        ▼
ClickHouse
  plan_sessions · routes · route_scores · route_scores_ranked
  weather_forecast_grid · rider_history_rides · training_blocks
```

---

## For developers

| Doc | Use when |
| --- | --- |
| [docs/RUN.md](docs/RUN.md) | Health checks, seed, SQL for demos, CI |
| [docs/SUBMIT.md](docs/SUBMIT.md) | Video script, form paste, public-repo scrub |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Full build plan / backlog |
| [apps/web/.env.example](apps/web/.env.example) | Manual env template (Setup UI preferred) |
| [clickhouse/schema.sql](clickhouse/schema.sql) | Tables + ranking view |

```bash
cd apps/web
npm run check          # lint + typecheck + vitest
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

---

## Project layout

```text
.
├── README.md                 ← you are here (product + how to run)
├── SECURITY.md               ← secrets / public-repo rules
├── LICENSE                   ← MIT
├── docs/
│   ├── RUN.md                ← technical local run + queries
│   ├── SUBMIT.md             ← video script, form copy, scrub checklist
│   └── IMPLEMENTATION.md     ← build plan / backlog (hackathon working doc)
├── clickhouse/               ← schema + seed SQL
└── apps/web/                 ← Next.js UI + Trigger tasks
```

---

## Scripts (from `apps/web`)

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the web app |
| `npm run dev:trigger` | Start the Trigger.dev worker |
| `npm run check` | Lint + typecheck + unit tests |
| `npm run seed:clickhouse` | Apply schema/seed (also done from Setup when CH is reachable) |
| `npm run ingest:weather` | Refresh open weather grid into ClickHouse |

---

## License

[MIT](LICENSE) — use it, fork it, host it with your own keys.
