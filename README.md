# CycleForge

**Chat a cycling goal. Get a map, not a wall of text.**

CycleForge is a visual training planner for the [ClickHouse × Trigger.dev Summer Hackathon 2026](https://triggerdev.clickhouse.com) — theme **Beyond the Wall of Text**.

You describe the ride you want. The app answers with **three route options on a map**, elevation, training load (TSS), weather-aware coaching, and a ride you can export — all backed by durable Trigger.dev jobs and ClickHouse analytics.

---

## Why CycleForge

The hackathon's own example was *“should I ride tomorrow?”* That's a fine question — but it's also the **easy** one, and a dozen apps already answer it. The motivation behind it is real, though, and it's something every regular rider knows in their legs: **if you cycle a lot — for training or for fun — the hardest part isn't deciding *whether* to ride. It's planning the *next* ride.**

Where to go. How long. How hard. Which roads. What the weather window looks like. That planning grind is what quietly eats the fun out of the sport.

So I built this open-source project to fix exactly that. **AI agents and great visualizations can turn the planning process into a fun game** — tweak a goal, the map morphs; ask again, the plan iterates. CycleForge **works with any agent** (cloud or fully local) and **runs entirely on your machine**, so it costs nothing to test ideas and refine a cycling plan in real time. And yes — it answers *“should I cycle?”* too, as a rich hourly weather window. It's just that the real answer is everything after *yes*.

---

## Architecture at a glance

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                         Browser — React 19 UI                       │
  │  Chat ▸ interactive wizard ▸ visual plan panel                      │
  │  map + road types · mini route cards · elevation · TSS zones        │
  │  "Should I cycle?" hourly weather strip (8 metrics per hour)        │
  └──────────────┬──────────────────────────────────────────────────────┘
                 │  server actions · AI SDK tools · REST
                 ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │              Next.js 16 — app server + plan builder                 │
  │  wizard state → route gen → scoring → coach note → plan payload     │
  └───┬───────────────────────────────┬─────────────────────────────────┘
      │ durable tasks                 │ SQL (JSONEachRow)
      ▼                               ▼
  ┌──────────────────────┐   ┌─────────────────────────────────────────┐
  │     Trigger.dev      │   │              ClickHouse                 │
  │  cycleforge-agent    │   │  plan_sessions      routes              │
  │  ├ generate routes   │   │  route_scores       route_scores_ranked │
  │  ├ fetch-ors ×3 ∥    │   │  weather_forecast_grid                  │
  │  ├ score + enrich    │   │  rider_history_rides                    │
  │  └ weather cron      │   │  training_blocks                        │
  └──────────┬───────────┘   └─────────────────────────────────────────┘
             │ best-effort, always with fallback
             ▼
  ┌──────────────────────┐   ┌─────────────────────────────────────────┐
  │   OpenRouteService   │   │              Open-Meteo                 │
  │  3 loop candidates   │   │  current + hourly: temp · wind · rain   │
  │  + elevation profile │   │  humidity · UV · visibility · AQI       │
  └──────────────────────┘   └─────────────────────────────────────────┘
```

Zero-config resilience: every external box has an in-repo fallback (synthetic
loops, in-memory ClickHouse, local demo agent), so the UI works end-to-end
with **no keys at all**.

---

## Try the demo

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
| Scrub the route cards | Each card **draws the loop** it proposes — shape at a glance |
| Read the road strip | Road types colored **on the map** + per-km summary (cycleway / paved / urban / gravel) |
| Check “Should I cycle?” | Temp · wind · rain · sun · humidity · UV · visibility · air quality, plus a per-hour visual strip |
| Tune & regenerate | Shorter / hillier / easier (or sliders) without leaving the plan |
| Download GPX · Open summary | Export the ride; share a printable visual summary |
| Open **Stack** | Visual architecture + **live ClickHouse table charts + Trigger run chart** |

Optional while generating: a **Trigger fan-out** graphic shows durable ORS + scoring steps.

---

## What’s in scope vs out of scope

### In this MVP (shipped)

- Visual chat → wizard → 3-route plan (Amsterdam-biased demo; map/address works elsewhere)
- Trigger.dev agent + parallel route fetch + score/enrich tasks + weather ingest
- ClickHouse sessions, routes, SQL ranking, weather grid, athlete history, similar rides
- Coach note, GPX export, summary page, GPX history upload (Strava / Garmin / TrainingPeaks export — free, no OAuth)
- Bring-your-own keys: host locally; paste Trigger, ClickHouse, and AI credentials in **Setup**
- AI providers: Google AI Studio, OpenAI, Anthropic, or local (Ollama / LM Studio, etc.)

### Out of scope (intentionally)

- Full Strava / Garmin / TrainingPeaks OAuth product. We evaluated this and it is **not quick or free**: Strava's API now requires a paid subscription for Standard Tier (June 2026 changes), and Garmin / TrainingPeaks require formal partner approval. The **free, already-working** path is one-click GPX export (all three platforms offer it) → **Upload GPX** in the app, which stores your rides in ClickHouse (`rider_history_rides`) and tunes coaching to your history.
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
Security notes: **[SECURITY.md](SECURITY.md)**.

---

## Why it's built this way

CycleForge was designed around a few principles — visual-first answers, durable
background work, and analytics you can query. They map directly to what the
hackathon rewards, which is why it scores well there:

| Principle | How CycleForge delivers |
| --- | --- |
| **Deep ClickHouse & Trigger.dev use** | Durable `chat.agent` + ORS fan-out + scoring; CH stores routes/scores, weather pipeline, SQL ranking, athlete history |
| **Problem fit** | The response *is* the product: wizard, map, charts, coach note — prose is secondary |
| **Technical implementation** | Next.js, AI SDK tools, parallel tasks, typed plan payload, fallbacks |
| **Innovation** | Training effect + SQL scoring + in-plan refine loop + weather/load visuals |
| **Scalability & impact** | Session/route tables + seed corpus; BYOK so others can host |
| **Presentation** | Clear demo path above; the product walks itself through |

### Tech stack

| Layer | Tech | What it does here |
| --- | --- | --- |
| **UI** | Next.js 16 · React 19 · MapLibre · Recharts | Chat, wizard, plan panel, road-type map overlay, hourly weather strip |
| **Agent** | Trigger.dev `chat.agent()` + AI SDK | Wizard tools, route generation fan-out, score & enrich, weather cron |
| **Analytics** | ClickHouse (Cloud or self-hosted) | Sessions, routes, SQL ranking, weather grid, athlete history, blocks |
| **Data** | OpenRouteService · Open-Meteo (+ AQ API) | Loop geometry + elevation; hourly temp/wind/rain/humidity/UV/visibility/AQI |
| **Quality** | TypeScript · Vitest · ESLint · GH Actions | `npm run check` — 56 unit tests, typed plan payload |

### Flow: from sentence to ride

```
 "90 min endurance, some hills, avoid busy roads"
        │
        ▼
 ① Chat agent (Trigger) parses goals → wizard state
        │
        ▼
 ② 3 ORS loop candidates fetched in parallel (fallback: synthetic loops)
        │
        ▼
 ③ Score & enrich: training effect · weather · tips → ClickHouse writes
        │
        ▼
 ④ SQL ranking + similar rides read back from ClickHouse
        │
        ▼
 ⑤ Visual plan: map w/ road types · mini route cards · elevation
    TSS zones · coach note · "Should I cycle?" hourly strip
        │
        ▼
 ⑥ Refine in place (shorter / hillier / easier) → back to ②
```

### Flow: hourly weather into “Should I cycle?”

```
 Open-Meteo hourly API ─┐
                        ├─► best-leave scorer ─► go / caution / wait per hour
 Open-Meteo AQ API ────┘         │
                                 ▼
              LeaveWindowHint { hours[] } ─► strip UI
              temp curve · wind row · rain mm · sun %
              humidity · UV · visibility · AQI (8 metric cells)
```

---

## For developers

| Doc | Use when |
| --- | --- |
| [docs/RUN.md](docs/RUN.md) | Health checks, seed, SQL for demos, CI |
| [apps/web/.env.example](apps/web/.env.example) | Manual env template (Setup UI preferred) |
| [clickhouse/schema.sql](clickhouse/schema.sql) | Tables + ranking view |

```bash
cd apps/web
npm run check          # lint + typecheck + vitest
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

---

## Community & contributing

CycleForge is open-source and we'd love contributions. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR, follow the
[Code of Conduct](CODE_OF_CONDUCT.md), and use the
[issue templates](.github/ISSUE_TEMPLATE) for bugs and feature requests.

Found a security issue or a leaked secret? See [SECURITY.md](SECURITY.md) —
report it privately via a GitHub security advisory rather than a public issue.

---

## Project layout

```text
.
├── README.md                 ← you are here (product + how to run)
├── SECURITY.md               ← secrets / public-repo rules
├── LICENSE                   ← MIT
├── docs/
│   └── RUN.md                ← technical local run + queries
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
