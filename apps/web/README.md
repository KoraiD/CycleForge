# CycleForge web app

Next.js + Trigger.dev application for CycleForge.

See the root [README](../../README.md) for architecture, env vars, and submission notes.  
See [docs/IMPLEMENTATION.md](../../docs/IMPLEMENTATION.md) for the full hackathon plan.  
See [docs/RUN.md](../../docs/RUN.md) for the end-to-end run guide (UI, tests, queries).

```bash
cp .env.example .env.local
npm install
npm run check          # lint + typecheck + test
npm run dev            # terminal 1
npm run dev:trigger    # terminal 2 (agent mode)
```
