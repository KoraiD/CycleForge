# CycleForge — Full Hackathon Implementation Plan

**Event:** ClickHouse × Trigger.dev Virtual Summer Hackathon 2026  
**Build window:** 17 July 09:00 CET → 23 July midnight AoE  
**Product:** Visual cycling training planner (Amsterdam metro MVP)  
**Repo status:** Private until flip-to-public for submission  

This document is the working plan for finishing, hardening, demoing, and submitting CycleForge. It assumes the MVP scaffold already exists under `apps/web`.

---

## 1. Goals & non-goals

### Goals (must ship)

1. End-to-end **chat → wizard → 3 routes → Plan Panel** in under ~60s for the demo prompt.
2. **Meaningful Trigger.dev**: `chat.agent()` + child tasks visible in the dashboard.
3. **Meaningful ClickHouse**: persist routes, SQL ranking, similar-rides query (show in video).
4. **Visual-first UX**: map, elevation, KPIs, training effect, tips — not a wall of text.
5. Reliable **fallback** when ORS / Trigger / CH are flaky.
6. Clean **README + license + tests + lint** for judges cloning the repo.

### Non-goals (explicitly cut)

- Auth / multi-user accounts  
- Strava / Garmin import  
- Multi-day tours  
- Perfect physiological model  
- Global routing quality beyond Amsterdam demo region  
- OLTP+OLAP bonus unless Day 3 core demo is already rock-solid  

---

## 2. Success criteria (definition of done)

| # | Criterion | How we verify |
| --- | --- | --- |
| 1 | Demo prompt produces Plan Panel with 3 selectable routes | Manual + Playwright smoke |
| 2 | Elevation + TSS + tips render for selected route | UI check |
| 3 | Refine (“hillier”) changes climb / ranking | Manual |
| 4 | Trigger run tree shows agent + generate + score tasks | Dashboard screenshot |
| 5 | ClickHouse `route_scores` query returns ranked rows | SQL in video |
| 6 | `npm run check` green | CI / local |
| 7 | Repo public + MIT + ≤5 min video | Submission form |

---

## 3. Current baseline (already built)

- Next.js App Router UI: Chat, Wizard, Plan Panel, MapLibre, Recharts  
- Trigger tasks: `cycleforge-agent`, `generate-route-candidates`, `fetch-ors-route-batch`, `score-and-enrich-routes`  
- Lib engines: geometry, scoring, training, tips, weather, ORS + fallback  
- ClickHouse schema + seed SQL; in-memory fallback  
- Local demo mode when Trigger/Google AI missing  
- Vitest unit tests + strict ESLint  

---

## 4. Workstreams

### A — Product polish (highest demo impact)

| Task | Owner focus | Est. | Priority |
| --- | --- | --- | --- |
| A1 Progressive “Generating routes…” state while tools run | UI | 2h | P0 |
| A2 Sync map hover ↔ elevation chart (optional nice-to-have) | UI | 3h | P2 |
| A3 Stronger empty / error states (ORS down, CH down) | UI | 1h | P0 |
| A4 Refine chips in Plan Panel (“shorter”, “hillier”, “easier”) | UI | 2h | P1 |
| A5 Prefetch weather after start preset chosen (`chat.inject` if time) | Agent | 2h | P2 |

### B — Trigger.dev depth (25% rubric)

| Task | Est. | Priority |
| --- | --- | --- |
| B1 Confirm project ref + credits; deploy agent once | 1h | P0 |
| B2 Split ORS into 3 parallel `schemaTask` children via `batchTriggerAndWait` | 2h | P0 |
| B3 Ensure tool `toModelOutput` compresses plan JSON for the model (keep full UI payload) | 2h | P1 |
| B4 Tags/metadata on runs: `sessionId`, `preset`, `source=ors|fallback` | 1h | P1 |
| B5 Dashboard walkthrough notes for video | 30m | P0 |

### C — ClickHouse depth (25% rubric)

| Task | Est. | Priority |
| --- | --- | --- |
| C1 Apply schema + seed on Cloud; verify from app | 1h | P0 |
| C2 Move score aggregation into a pure SQL view/query (document in README) | 2h | P0 |
| C3 Session analytics query for comparison strip (min/max from CH) | 1h | P1 |
| C4 Log `plan_sessions.status` transitions: draft → confirmed → scored | 1h | P1 |
| C5 (Stretch) Postgres OLTP for wizard writes + CH analytics for bonus | 4h+ | P3 |

### D — Routing quality

| Task | Est. | Priority |
| --- | --- | --- |
| D1 Obtain ORS key; validate round_trip + elevation in Amsterdam | 1h | P0 |
| D2 Cache 3 “golden” GeoJSON files per start preset for hard fallback | 2h | P0 |
| D3 Tune length/seed variants so candidates look visually distinct | 2h | P1 |

### E — Quality / repo hygiene

| Task | Est. | Priority |
| --- | --- | --- |
| E1 Keep `npm run check` green | ongoing | P0 |
| E2 Add GitHub Actions: lint + typecheck + test on PR | 1h | P1 |
| E3 Flip repo public before submit; scrub secrets | 30m | P0 |
| E4 Record ≤5 min video from script below | 2h | P0 |

---

## 5. Day-by-day schedule

Assuming remaining days until **23 July AoE**. Compress earlier if behind.

### Day N — Stabilize vertical slice (today)

- [x] Private GitHub repo live; teammates invited  
- [x] `.env.local` filled (Trigger, Google AI Studio, ClickHouse, ORS)  
- [x] `npm run check` green  
- [x] Manual demo prompt works in **agent mode** (not only local demo)  
- [x] ClickHouse seed applied  

### Day N+1 — Depth for judges

- [x] B2 parallel ORS child tasks (`fetch-ors-route` ×3 via `batchTriggerAndWait`)  
- [x] C2 SQL scoring story polished (`route_scores_ranked` view)  
- [x] D2 golden GeoJSON fallbacks committed under `apps/web/src/data/golden-routes/`  
- [x] A1 generating state + A3 errors  
- [x] A4 refine chips on Plan Panel  
- [ ] Dry-run Trigger dashboard + CH console (capture for video)  

### Day N+2 — Polish & video

- [ ] A4 refine chips  
- [ ] README screenshots (optional)  
- [ ] Record demo video (script §7)  
- [ ] Flip repo **public**; verify clone on clean machine  
- [ ] Submission form draft (title, tagline, CH/Trigger usage paragraph)  

### Final morning (before AoE freeze)

- [ ] No large refactors  
- [ ] Rehearse video once  
- [ ] Captain submits  
- [ ] Freeze commits  

---

## 6. Technical implementation notes

### 6.1 Agent contract

System prompt forces **tools over prose**. Tools return structured payloads:

```ts
{ ui: "wizard" | "plan" | "error", wizard?, plan?, summary? }
```

Frontend extracts the latest `plan` / `wizard` from tool parts and renders components. Keep assistant text ≤ 2 sentences.

### 6.2 Plan payload (source of truth for UI)

`PlanPayload` in `apps/web/src/lib/types.ts`:

- `wizard`, `routes[]`, `selectedRouteId`, `comparison`  
- Each `RouteCandidate` includes geometry, elevProfile, training, tips, score, similarRideLabels, source  

### 6.3 Failure matrix

| Failure | Behavior |
| --- | --- |
| No `TRIGGER_SECRET_KEY` | Local demo mode via `generateDemoPlan` |
| No `ORS_API_KEY` / ORS 429 | Synthetic loops (`buildFallbackRoutes`) |
| No ClickHouse | In-memory session/route maps; similar rides from seed constants |
| Open-Meteo down | `weather: null`; tips skip weather lines |

### 6.4 Security

- Never commit `.env*` (only `.env.example`)  
- Server actions mint Trigger public tokens scoped to `chatId`  
- Repo stays **private** until submission hour  

---

## 7. Demo video script (≤ 5 minutes)

| Time | Action | Say |
| --- | --- | --- |
| 0:00–0:15 | Open app fullscreen | “CycleForge — visual training plans, not walls of text.” |
| 0:15–0:45 | Paste demo prompt, show wizard | “Chat intake → interactive wizard in the transcript.” |
| 0:45–1:40 | Generate; map fills; click alternate route | “Three scored loops. Selecting updates elevation and TSS.” |
| 1:40–2:20 | Ask “make it hillier” | “Refine regenerates with new constraints.” |
| 2:20–3:10 | Trigger.dev dashboard | “Durable `chat.agent` plus child tasks for ORS fan-out and scoring.” |
| 3:10–4:00 | ClickHouse console | Run `route_scores` + similar rides SQL. |
| 4:00–4:45 | Architecture one-liner + impact | “Insight-to-words: the map is the answer.” |
| 4:45–5:00 | End card | Repo URL + stack logos |

**Recording tips:** skip intros; start on live product; disable OS notifications; use a charged ORS/CH/Trigger path (not demo mode) for the video.

---

## 8. Submission copy (draft)

**Title:** CycleForge  

**Tagline:** Chat a training goal. Get a map, elevation, and training effect — not a paragraph.

**How we use Trigger.dev:** Durable `cycleforge-agent` (`chat.agent`) orchestrates wizard state, fans out route generation tasks, and scores/enrichment runs with realtime UI streaming.

**How we use ClickHouse:** Primary analytics store for sessions, routes, and scores; SQL ranking and similar-ride retrieval against a seeded ride history.

---

## 9. Risks & mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| ORS rate limit mid-demo | Med | Golden GeoJSON cache; silent fallback |
| Agent rambles | Med | System prompt + UI ignores long text |
| Weak CH story | Med | Live SQL in video; seed data always present |
| Trigger credits | Low | Monitor usage; request one-time top-up if needed |
| Scope creep | High | Protect P0 only after Day N+1 |

---

## 10. Stretch (only if P0/P1 done)

1. **OLTP + OLAP bonus:** wizard writes to ClickHouse Cloud Postgres; analytics stay in CH.  
2. A→B rides when end coords provided.  
3. Export GPX for selected route.  
4. Dark-friendly print stylesheet for judges reviewing screenshots.  

---

## 11. Checklist before code freeze

- [ ] `npm run check` passes  
- [ ] Agent mode demo recorded  
- [ ] Repo public + MIT  
- [ ] Secrets scrubbed (`git log -p` / `gitleaks` if available)  
- [ ] README matches shipped behavior  
- [ ] Form submitted by captain  

---

*Last updated for CycleForge MVP — keep this file in sync with what actually ships.*
