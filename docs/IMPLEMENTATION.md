# CycleForge — Full Hackathon Implementation Plan

**Event:** ClickHouse × Trigger.dev Virtual Summer Hackathon 2026  
**Build window:** 17 July 09:00 CET → 23 July midnight AoE  
**Product:** Visual cycling training planner (geo-flexible; Amsterdam remains the default demo)  
**Repo status:** Private until flip-to-public for submission  

This document is the working plan for finishing, hardening, demoing, and submitting CycleForge. It assumes the MVP scaffold already exists under `apps/web`.

**Last plan revision:** 20 July 2026 — K1/K2/H1/H2 shipped + UI smoke findings; F1/D4/C6/C7 included in same PR.

---

## 1. Goals & non-goals

### Goals (must ship for a strong submit)

1. End-to-end **chat → location → wizard → 3 routes → Plan Panel** in under ~60–90s for the demo path.
2. **Meaningful Trigger.dev**: `chat.agent()` + child tasks (ORS fan-out, scoring, and new ingest jobs) visible in the dashboard.
3. **Meaningful ClickHouse**: not only session/route scores — a **fixed open-data pipeline** (weather + useful context tables) joined to rider needs at plan time.
4. **Visual-first UX**: richer route visuals, in-result tweaks, coach-style written suggestion, GPX + summary page.
5. **Wider geography**: start from an address or a map pick (not Amsterdam presets only).
6. Reliable **fallback** when ORS / Trigger / CH / external APIs are flaky.
7. Clean **README + license + tests + lint** + ≤5 min video.

### Goals (investigate / ship if demo-safe)

8. **Training history spike**: can we quickly get a few weeks of rides from TrainingPeaks / Garmin / Strava / Apple Health for the demo so the agent can refine suggestions? Prefer a **demo-import path** over full OAuth productization if time is short.

### Non-goals (explicitly cut or defer)

- Full multi-user auth / production OAuth product  
- Perfect physiological model / power-meter coaching  
- Turn-by-turn navigation / live tracking  
- Multi-day tours  
- Global ORS quality everywhere (bias demo cities; fail soft elsewhere)  
- Building four full athlete-platform integrations if one demo path is enough  

---

## 2. Success criteria (definition of done)

| # | Criterion | How we verify |
| --- | --- | --- |
| 1 | Demo produces Plan Panel with 3 selectable routes | Manual + smoke |
| 2 | Elevation + TSS + tips + **AI ride suggestion** render | UI check |
| 3 | Refine / in-result tweaks change ranking or geometry | Manual |
| 4 | Trigger run tree shows agent + fan-out + score (+ ingest if shipped) | Dashboard |
| 5 | ClickHouse shows pipeline tables + ranked scores + joins used in plan | SQL in video |
| 6 | Start via **address or map pin** (Amsterdam still works as default) | Manual |
| 7 | **GPX export** + mixed visual/text **summary page** for selected route | Manual |
| 8 | Logo (black line-art cycle + map lines) in app chrome | Visual |
| 9 | `npm run check` green; repo public + MIT + ≤5 min video | CI / submit |

---

## 3. Current baseline (shipped)

- Next.js App Router UI: Chat, Wizard, Plan Panel, MapLibre, Recharts  
- Google AI Studio / Gemini agent (`cycleforge-agent`)  
- Trigger tasks: agent, `generate-route-candidates`, `fetch-ors-route-batch` → **3× `fetch-ors-route`**, `score-and-enrich-routes`  
- Lib engines: geometry, scoring, training, tips, weather (live Open-Meteo), ORS + golden GeoJSON fallbacks  
- ClickHouse: `plan_sessions`, `routes`, `route_scores`, view `route_scores_ranked`, seed rides  
- Generating state, error UX, refine chips (shorter / hillier / easier)  
- Logo + BrandMark; map/address custom start (D4)  
- Weather pipeline: `weather_forecast_grid` + ingest task/CLI + plan-time CH join  
- Plan UX: click-to-select routes, S/F markers, wind badge, fit control, route cards  
- In-result tweak panel (duration / intensity / terrain / quiet) + Apply & regenerate  
- Wizard collapses once a plan exists (tweak panel owns refine)  
- `plan.coachNote` coaching card + Download GPX for selected route  
- Summary page `/summary/[sessionId]?route=` (print/PDF + copy link)  
- Demo athlete fixture → `rider_history_rides` + history-aware coach note  
- Local demo mode when Trigger/Google missing  
- Vitest + ESLint + GitHub Actions CI  
- Run guide: [`docs/RUN.md`](RUN.md)  

### Known UX gaps (motivate K-series)

- Chat / wizard / plan feel somewhat static after first generate  
- Map clicks select via legend more than the map itself  
- Mobile / narrow layouts and keyboard flow unpolished  
- Little feedback when geocode/ORS/weather is slow or partial  

---

## 4. Workstreams

Status: **done** · **next** · **spike** · **stretch**

### A — Product polish (UI)

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 | Generating routes state | done | P0 | — | Visual pane steps |
| A2 | Map hover ↔ elevation sync | done | P2 | — | Covered by K3 |
| A3 | Empty / error states | done | P0 | — | Soften further if new APIs fail |
| A4 | Refine chips | done | P1 | — | Extend with richer tweaks (see H2) |
| A5 | Prefetch weather on start change | next | P2 | 2h | CH weather grid available |

### B — Trigger.dev depth

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| B1 | Deploy agent once to Trigger cloud | next | P0 | 1h | Backup if local worker flakes |
| B2 | Parallel ORS children | done | P0 | — | `batchTriggerAndWait` |
| B3 | `toModelOutput` compress plan JSON | next | P1 | 2h | Reliability with Gemini |
| B4 | Run tags: sessionId, start, source | next | P1 | 1h | Dashboard clarity |
| B5 | Dashboard walkthrough notes for video | next | P0 | 30m | Non-code |
| B6 | Durable **ingest tasks** for open-data pipeline | done | P0 | — | `ingest-weather-grid` + 6h schedule + CLI |

### C — ClickHouse depth (expanded)

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| C1 | Schema + seed on Cloud | done | P0 | — | |
| C2 | `route_scores_ranked` SQL view | done | P0 | — | |
| C3 | Comparison strip from CH SQL | next | P1 | 1h | |
| C4 | Session status: draft → confirmed → scored | next | P1 | 1h | |
| C5 | Postgres OLTP + CH analytics bonus | stretch | P3 | 4h+ | Only if core demo solid |
| **C6** | **Fixed open-data pipeline → CH tables** | **done** | **P0** | — | `weather_forecast_grid` + Trigger ingest + `npm run ingest:weather` |
| **C7** | **Plan-time SQL matching** user needs ↔ pipeline tables | **done** | **P0** | — | `resolveWeather` nearest-tile SQL → live Open-Meteo fallback |

### D — Routing quality & geography

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| D1 | ORS Amsterdam validated | done | P0 | — | |
| D2 | Golden GeoJSON per Amsterdam preset | done | P0 | — | |
| D3 | Tune variants for visual distinctness | next | P1 | 2h | |
| **D4** | **Start by address (geocode) or map pick** | **done** | **P0** | — | Wizard “Map / address” + Open-Meteo geocode + click map |
| D5 | Golden/cache strategy for non-AMS starts | next | P1 | 3h | Snapshot last good ORS per session or bbox tile |

### E — Quality / submit

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| E1 | `npm run check` green | ongoing | P0 | — | |
| E2 | GitHub Actions CI | done | P1 | — | |
| E3 | Flip repo public; scrub secrets | next | P0 | 30m | Before submit |
| E4 | Record ≤5 min video | next | P0 | 2h | Update script §7 |
| E5 | Submission form copy | next | P0 | 1h | Update CH/Trigger paragraphs for pipeline |

### F — Brand

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| **F1** | **Logo: modern, black-only, line-drawn cycle + map lines behind** | **done** | **P0** | — | `public/logo.svg` + `app/icon.svg` + BrandMark |
| F2 | Apply logo in UI chrome without cluttering hero of plan | done | P1 | — | Chat header + empty/generating panes |

### G — Athlete history (demo)

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| **G1** | **Spike: TrainingPeaks / Garmin / Strava / Apple Health** | **done** | **P0** | — | Verdict in §4.3 — fixture path for hackathon |
| **G2** | Choose **one** demo path + fixture fallback | **done** | **P0** | — | `demo-ams-rider` fixture + Load demo athlete CTA / agent tool |
| **G3** | Store normalized rides in CH; agent uses volume/intensity trends | **done** | **P1** | — | `rider_history_rides` + historyContext → coach note / soft intensity nudge |
| G4 | Full OAuth product for all platforms | stretch | P3 | — | Post-hackathon |
| G5 | Manual GPX/FIT upload into `rider_history_rides` | stretch | P2 | 4h | Nice follow-on; not required for video |

### H — Richer plan visuals & tweaks

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| **H1** | **More visual elements on suggested routes** | **done** | **P0** | — | S/F markers, wind badge, selection outline, source badges, fit control |
| **H2** | **Richer in-result tweaking controls** | **done** | **P0** | — | Duration / intensity / terrain / quiet + Apply & regenerate (+ quick chips) |
| H3 | Map hover ↔ elevation (A2) | done | P2 | — | Covered by K3 |
| H4 | Climb-segment coloring on map polyline | next | P1 | 3h | From elev profile; deferred after smoke |
| H5 | Score ring / fit glyph on selected marker | next | P2 | 2h | Nice-to-have polish |

### I — AI coaching copy

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| **I1** | **Written training suggestion** from path + weather + scores (+ history if available) | **done** | **P0** | — | `buildCoachNote` → `plan.coachNote` + Plan Panel card |
| **I2** | Keep chat reply short; put coach prose in `plan.coachNote` | **done** | **P0** | — | Agent system prompt + note lives on plan / updates on select |

### J — Export & summary

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| **J1** | **GPX export** of selected route | **done** | **P0** | — | `routeToGpx` + Download GPX in Plan Panel |
| **J2** | **Mixed visual–text summary page** | **done** | **P0** | — | `/summary/[sessionId]` — map, KPIs, coach, elev, tips, similar rides, print |
| **J3** | Deep-link session + `?route=` for summary | **done** | **P1** | — | Open summary from plan; Copy link; selectRouteAction persists choice |

### K — UI usability & interactivity (new)

Polish how the product *feels* to use: clearer affordances, faster feedback, less dead UI.

| ID | Task | Status | Pri | Est. | Notes |
| --- | --- | --- | --- | --- | --- |
| **K1** | **Usability pass: layout, hierarchy, focus, disabled/busy states** | **done** | **P0** | — | Demo CTA, busy banners, disabled composer, keep plan while refining, compact wizard |
| **K2** | **Interactive map: click route to select; start pin drag; better legends** | **done** | **P0** | — | Hit layers + legend/cards; draggable start pin; fit + source badges |
| **K3** | **Linked interactions: map ↔ elevation ↔ route cards** | **done** | **P1** | — | Shared hoverKm + preview route highlight |
| **K4** | **Micro-feedback: toasts/inline status for geocode, generate, refine, export** | **next** | **P1** | **2h** | Especially when agent/tools are slow |
| **K5** | **Responsive / touch: usable on laptop + phone demo** | **next** | **P1** | **3h** | Stack panes; larger tap targets |
| K6 | Keyboard shortcuts / a11y basics (focus rings, labels) | next | P2 | 2h | Submit polish |
| K7 | Motion polish (2–3 intentional transitions, not noise) | next | P2 | 2h | Align with brand motion rules |
| **K8** | **Chat transcript declutter** (tool-name spam → progress chips) | **done** | **P1** | — | Text-only bubbles; progress chips while busy |
| **K9** | **Map chrome density** (hint / legend / wind / fit collide on small heights) | **done** | **P1** | — | Toolbar chrome, dismissible hint, scrollable/hideable legend |
| **K10** | **Start-preset vs custom pin coherence** after refine | **next** | **P2** | **1h** | Smoke: Map/address stays selected while label still “Vondelpark” |
| **K11** | **Persist browser session across summary ↔ home** | **done** | **P1** | — | sessionStorage session id + hydrate plan/history on mount |

---

## 4.1 ClickHouse open-data pipeline (C6/C7) — design intent

**Goal:** Fixed, repeatable ingest (Trigger tasks) of open sources into ClickHouse, then **SQL joins / filters** at plan time so scoring and coach notes are grounded in stored data—not only one-off HTTP calls.

### Candidate tables (v1)

| Table | Source ideas | Grain | Used for |
| --- | --- | --- | --- |
| `weather_forecast_grid` | Open-Meteo (batch) | lat/lng tile × hour | wind, precip, temp for ride window |
| `weather_obs_daily` (optional) | Open-Meteo archive | tile × day | “typical” conditions |
| `air_quality_hourly` (optional) | Open-Meteo air quality | tile × hour | tip / soft score penalty |
| `poi_cycle_context` (optional) | OSM extract / Overpass snapshot | point/polygon | parks, water, quiet tags near route |
| `rider_history_rides` | Demo import / fixtures | ride | load, TSS proxy, recent intensity |
| Existing | `routes`, `route_scores`, `plan_sessions` | — | plan persistence + ranking |

### Pipeline shape

```text
Trigger schedule / manual run
  → fetch open APIs (bounded bbox or demo cities)
  → normalize rows
  → insert into ClickHouse
Plan time (score-and-enrich-routes)
  → SQL: nearest weather for start + ride window
  → SQL: optional AQ / POI density along route bbox
  → feed scoreRoute + coachNote + tips
```

### Demo cities for ingest (pragmatic)

Until D4 is fully global: ingest **Amsterdam metro** thoroughly; optionally 1–2 other cities used in the video. Map-pick elsewhere still works with live Open-Meteo fallback if CH grid miss.

---

## 4.2 Geography widen (D4) — design intent

**Wizard / map UX**

1. Keep Amsterdam presets as one-click defaults.  
2. Add **address search** (geocode → lat/lng) — ORS geocode or Nominatim (respect ToS / rate limits).  
3. Add **map click-to-set start** on an interactive basemap (MapLibre).  
4. Store `startLat` / `startLng` / optional `startLabel` on wizard; `startPreset: "custom"` when not a preset.  
5. ORS round-trips from that point; golden fallback only when inside known AMS presets, else synthetic or last-session cache.

---

## 4.3 Athlete data spike (G1) — findings (20 Jul 2026)

| Platform | Likely demo path | Friction | Verdict |
| --- | --- | --- | --- |
| **Strava** | OAuth + Activities API | App review, refresh tokens, rate limits, webhook optional | **Skip for submit** unless a pre-approved app already exists |
| **Garmin** | Connect export / Health API | Partner program latency | **Skip** for 48h window |
| **TrainingPeaks** | Partner API / manual export | Access + parsing | **Defer**; manual export could feed G5 later |
| **Apple Health** | HealthKit | **iOS only** — no web API | **Out of scope** for Next.js demo |

**Hackathon decision (G2):** ship a **fixture demo athlete** (`demo-ams-rider`, 14 rides / ~3 weeks) into ClickHouse `rider_history_rides`, with UI **Load demo athlete history** + agent tool `load_demo_athlete`. Never block the main route demo on live OAuth. Optional later: GPX upload (G5).

**How coaching uses it (G3):** `historyContext` on the plan (hours/TSS last 7d & 28d, last hard day, load hint) → coach note + soft intensity nudge when load is high.

---

## 4.4 Logo (F1) — design brief

- **Style:** modern, **black only**, line drawing  
- **Motif:** bicycle (simplified) in foreground; **subtle mapping / route lines** behind (contour or path polylines)  
- **Deliverables:** `apps/web/public/logo.svg` (+ favicon derived), used in chat header, summary page, README  
- **Constraints:** works on light backgrounds; no purple/glow AI-slop; keep stroke weights consistent at 16–32px and ~128px  

---

## 5. Prioritized backlog for remaining days

Deadline: **23 July AoE**. Protect P0; cut stretch without guilt.

### Done recently

F1 logo · D4 map/address start · C6/C7 weather pipeline · **K1–K3/K8/K9** · **H1/H2** · **I1/I2** · **J1/J2/J3** · **G1/G2/G3** · B2/B6 Trigger fan-out + ingest · A1/A3/A4 polish  

### P0 — ship before video

1. **B1/B5/E3/E4/E5** Deploy notes, video, public repo, form copy  

### P1 — if P0 on track

- **K4/K5** status toasts, responsive  
- H4 climb segments · B3, B4, C3, C4, D3, D5, G5, A5  

### P2 / stretch

- K6/K7 a11y + motion · A2/H3 if not covered by K3 · C5 Postgres bonus · G4 full OAuth · multi-city deep ingest  

---

## 6. Day-by-day schedule (revised)

### Done — Day N / N+1

- [x] Vertical slice + agent mode (Google AI)  
- [x] Parallel ORS tasks, golden fallbacks, SQL ranking view  
- [x] Generating / error UX, refine chips  
- [x] `docs/RUN.md`  

### Day N+2 — Geography + brand + CH pipeline + plan UX

- [x] F1 Logo SVG + wire into header/favicon  
- [x] D4 Address geocode + map pick start  
- [x] C6 Trigger ingest for weather grid → CH; document schema  
- [x] C7 Plan-time SQL match weather/context → scores + tips  
- [x] K1/K2 Usability + interactive map  
- [x] H1/H2 Richer visuals + in-result tweaks  
- [x] G1 Spike note: athlete platforms (write findings in this doc §4.3)  

### Day N+3 — Coach + export + history

- [x] I1/I2 Coach suggestion field + UI card (chat stays short)  
- [x] J1 GPX export  
- [x] J2/J3 Summary page + session/`?route=` deep link  
- [x] G1/G2/G3 Athlete fixture → CH `rider_history_rides` → coach note  
- [x] K3/K8/K9 UX polish (map↔elev sync, chat declutter, map chrome)  

### Final day / morning — Harden + submit

- [ ] B3/B4 if time; dry-run Trigger + CH console  
- [ ] E4 Record video (script §7)  
- [ ] E3 Public repo + secret scrub  
- [ ] E5 Form submit; freeze commits  

---

## 7. Technical implementation notes

### 7.1 Agent contract

Tools return structured payloads:

```ts
{
  ui: "wizard" | "plan" | "error" | "summary",
  wizard?, plan?, summary?, error?
}
```

Chat text stays short (1–2 sentences). Longer coaching lives on `plan.coachNote` / summary page.

### 7.2 Plan payload (extend)

`PlanPayload` / `RouteCandidate` should grow to support:

- `coachNote: string` (AI suggestion for how to ride / progress)  
- `startLabel?: string`  
- richer `tweaks` / applied constraints echo  
- optional `historyContext` summary (from CH rider history)  
- `weather` preferably hydrated from CH pipeline with live fallback  

### 7.3 Failure matrix

| Failure | Behavior |
| --- | --- |
| No Trigger / Google | Local demo mode |
| No ORS / 429 | Golden (AMS) or synthetic |
| No ClickHouse | Memory maps; pipeline joins skipped |
| CH weather miss | Live Open-Meteo fallback |
| Athlete import unavailable | Fixture history or skip history-aware coaching |
| Geocode fail | Keep last start / ask user to drop a map pin |

### 7.4 Security

- Never commit `.env*` (only `.env.example`)  
- Scoped Trigger public tokens per `chatId`  
- Athlete tokens never logged; fixture preferred for public demo video  
- Repo private until submission hour  

---

## 8. Demo video script (≤ 5 minutes) — updated outline

| Time | Action | Say |
| --- | --- | --- |
| 0:00–0:15 | Logo + app open | “CycleForge — visual training plans, not walls of text.” |
| 0:15–0:40 | Set start via map/address (or AMS preset) | “Start anywhere — pin or address.” |
| 0:40–1:10 | Demo prompt + wizard | “Chat intake → interactive controls.” |
| 1:10–1:50 | Generate; show richer map + tweaks | “Three scored loops; tweak without leaving the plan.” |
| 1:50–2:20 | Show coach suggestion + optional history | “AI suggests how to ride this session from path + weather + load.” |
| 2:20–2:50 | GPX + summary page | “Export the ride; share a mixed visual summary.” |
| 2:50–3:30 | Trigger dashboard | “Durable agent, ORS fan-out, ingest + score tasks.” |
| 3:30–4:20 | ClickHouse console | Pipeline tables + `route_scores_ranked` + join example. |
| 4:20–4:50 | Architecture one-liner | “Insight-to-words: the map — and the next workout — are the answer.” |
| 4:50–5:00 | End card | Logo + repo URL |

---

## 9. Submission copy (draft — revise when pipeline ships)

**Title:** CycleForge  

**Tagline:** Chat a training goal. Get a map, elevation, coaching note, and a ride you can export — not a paragraph.

**How we use Trigger.dev:** Durable `cycleforge-agent` orchestrates planning; child tasks fan out ORS routes, score/enrich plans, and run fixed open-data ingest into ClickHouse.

**How we use ClickHouse:** Analytics + feature store: sessions/routes/scores, open weather (and related) pipeline tables, SQL ranking (`route_scores_ranked`), similar rides, and plan-time joins that ground suggestions in stored data.

---

## 10. Risks & mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Scope creep before 23 Jul | **High** | P0 list §5 only; spike ≠ four OAuth apps |
| ORS rate limit | Med | Golden AMS + session cache |
| Geocode/Nominatim ToS or rate limits | Med | Prefer ORS geocode; debounce; cache |
| Athlete API access blocked | High | GPX upload + fixture athlete |
| CH pipeline empty in video | Med | Seed + scheduled ingest before recording |
| Agent walls of text | Med | Coach note field; short chat |
| Weak CH story | Med | Show pipeline SQL joins live |
| Logo/brand late | Low | F1 early on N+2 |

---

## 11. Stretch (only if P0 done)

1. OLTP + OLAP (Cloud Postgres wizard + CH analytics).  
2. Multi-city deep POI/OSM snapshots.  
3. Strava OAuth beyond fixture.  
4. A→B point-to-point when end pin provided.  
5. Dark/print stylesheet for summary.  

---

## 12. Checklist before code freeze

- [ ] `npm run check` passes  
- [ ] Logo in UI  
- [ ] Map/address start works in demo  
- [ ] CH pipeline tables populated; join visible in console  
- [ ] Coach note + richer visuals + tweaks  
- [ ] GPX + summary page  
- [ ] Athlete path: fixture and/or one import (document spike outcome)  
- [ ] Agent mode demo recorded  
- [ ] Repo public + MIT  
- [ ] Secrets scrubbed  
- [ ] README / RUN.md match shipped behavior  
- [ ] Form submitted by captain  

---

## 13. Decision log (fill as we go)

| Date | Decision | Outcome |
| --- | --- | --- |
| 20 Jul | Google AI Studio instead of OpenAI | Shipped (PR #1) |
| 20 Jul | Expand beyond AMS-only; CH pipeline; GPX/summary; logo; athlete spike | Plan updated (this doc) |
| 20 Jul | Athlete platform for demo | **Fixture `demo-ams-rider`** (no live OAuth) |
| TBD | Geocoder choice (ORS vs Nominatim) | *pending D4* |

---

*Keep this file in sync with what actually ships. When picking work, reply with IDs (e.g. F1, D4, C6) from §4.*
