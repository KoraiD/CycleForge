# AGENTS.md

## Cursor Cloud specific instructions

CycleForge is a monorepo. The only app lives in `apps/web` (Next.js 16 + Turbopack, React 19). The root `package.json` scripts just delegate into `apps/web`, so you can run everything from the repo root (`npm run dev`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run check`). Standard commands are documented in `README.md` and `apps/web/package.json`; don't duplicate them here.

Node 22 is required (matches CI in `.github/workflows/ci.yml`).

### Running without external accounts (default here)
The app is designed to run fully in **local demo mode** without any secrets. Agent chat mode is only enabled when BOTH `TRIGGER_SECRET_KEY` and `OPENAI_API_KEY` are present (see `/api/health` and `src/components/chat.tsx`). When either is missing, the UI automatically falls back to `generateDemoPlan` (server action) which builds plans via synthetic Amsterdam loops, Open-Meteo weather, and an in-memory ClickHouse stand-in (`src/lib/clickhouse.ts`). So the visual product (map, elevation, training effect, tips, similar rides) works end-to-end with zero configuration. To exercise it, open `http://localhost:3000` and click "Try the demo prompt".

`npm run dev:trigger` starts the Trigger.dev worker and needs Trigger credentials; it is not required for the demo/UI flow.

### Non-obvious gotchas
- The first `vitest run` immediately after a cold `npm ci` can flake: `src/lib/plan-builder.test.ts > builds a scored plan with three routes` may hit the default 5s test timeout on the very first transform/import. Simply re-running `npm run test` passes (all 20 tests green). It is an environment cold-start artifact, not a real failure.
- ORS/ClickHouse/Trigger env vars may be injected into the VM, so `/api/health` can report them as configured. That's fine — `generateRawRoutes` (`src/lib/ors.ts`) falls back to synthetic routes if ORS calls fail, and ClickHouse writes are best-effort with an in-memory fallback, so the demo path never hard-depends on those services being reachable.
