# CycleForge web app

Next.js UI + Trigger.dev tasks for CycleForge.

**Start here:** root [README](../../README.md) — what the product does, demo features, and how to run with your own keys.

| Doc | Purpose |
| --- | --- |
| [docs/RUN.md](../../docs/RUN.md) | Technical runbook, SQL, health |
| [docs/SUBMIT.md](../../docs/SUBMIT.md) | Video script + submit form |
| [SECURITY.md](../../SECURITY.md) | Secrets / public-repo rules |

```bash
npm install
npm run dev                 # then open http://localhost:3000/setup
npm run dev:trigger         # after saving Trigger credentials
npm run check               # lint + typecheck + test
```

Prefer the **Setup** UI over hand-editing env files. Never commit `.env.local` or `.data/`.
