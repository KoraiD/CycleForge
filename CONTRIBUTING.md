# Contributing to CycleForge

Thanks for your interest in contributing! CycleForge is a visual cycling
training planner built for the ClickHouse × Trigger.dev hackathon, and it's
open-source under the [MIT License](LICENSE).

## Ground rules

- **No secrets, ever.** CycleForge is bring-your-own-keys. Never commit
  `.env.local`, `.data/`, API keys, or any credentials. See
  [SECURITY.md](SECURITY.md). If you find a leaked secret, rotate it and open
  an issue **without** pasting the secret.
- **Respect the [Code of Conduct](CODE_OF_CONDUCT.md).**

## Development setup

You need [Node.js 22+](https://nodejs.org). The app lives in `apps/web`.

```bash
git clone https://github.com/KoraiD/CycleForge.git
cd CycleForge/apps/web
npm install
npm run dev
```

Then open **http://localhost:3000/setup**. You can explore the UI in **local
demo mode** with no keys at all — add Trigger.dev, ClickHouse, and an AI key
only if you want the full agent pipeline.

### Useful commands (from `apps/web`)

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the web app |
| `npm run dev:trigger` | Start the Trigger.dev worker (needs Trigger keys) |
| `npm run check` | Lint + typecheck + unit tests — **run before every PR** |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build` | Production build |

## Making a change

1. Fork and create a branch from `main`
   (`git checkout -b feat/my-change`).
2. Make your change. Keep it focused — one concern per PR.
3. Add or update tests in `apps/web/src/**/*.test.ts` for logic changes.
4. Run `npm run check` and make sure it's green.
5. Open a pull request with a clear summary and, for UI changes, a screenshot
   or short clip.

### Code style

- TypeScript, strict. No `any` unless justified.
- Imports at the top of the module (no inline `import()` unless there's a
  documented circular-dependency reason).
- Use a `never`-exhaustiveness check in `switch` over unions/enums.
- React 19 + Next.js App Router. Prefer server components/actions where
  practical; keep client components lean and memoize heavy computation.
- The product is **visual-first** ("Beyond the Wall of Text"). New agent
  answers should render as interactive components, not paragraphs.

## Project layout

```
apps/web/src/lib/        pure logic (scoring, geometry, training, weather, clickhouse)
apps/web/src/components/ React UI (map, charts, plan panel, wizard, verdict)
apps/web/src/app/        routes, server actions, API routes
apps/web/src/trigger/    Trigger.dev tasks (agent, ORS fan-out, scoring, ingest)
clickhouse/              schema + seed SQL
docs/                    RUN (technical), SUBMIT (hackathon), IMPLEMENTATION
```

## Reporting bugs & requesting features

Use the GitHub issue templates. For bugs, include steps to reproduce, expected
vs actual, your browser/OS, and whether you were in demo mode or fully
configured. For security issues, follow [SECURITY.md](SECURITY.md) instead of
opening a public issue with sensitive details.

## License

By contributing, you agree your contributions are licensed under the
[MIT License](LICENSE).
