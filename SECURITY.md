# Security & public-repo hygiene

CycleForge is designed to be **self-hosted with bring-your-own keys**. This repository must never contain live credentials.

## What must never be committed

| Path / pattern | Why |
| --- | --- |
| `apps/web/.env.local`, `.env` | Live API keys |
| `apps/web/.data/**` | Runtime config, plan cache, athlete uploads |
| `*.pem`, `*.key`, `credentials.json` | Certs / service accounts |
| Hackathon brief PDFs (`*.pdf`) | Local-only materials (gitignored) |

`.gitignore` already covers these. Before flipping the GitHub repo to **public**:

```bash
# Must report as ignored
git check-ignore -v apps/web/.env.local apps/web/.data/runtime-config.json

# Must list nothing sensitive
git ls-files | rg -i 'env\.local|runtime-config|\.pem|\.pdf$|secret'

# Placeholders only in the example file
cat apps/web/.env.example
```

## How secrets are stored locally

1. Prefer **http://localhost:3000/setup** — writes `apps/web/.data/runtime-config.json` and syncs `apps/web/.env.local`.
2. The Setup API returns **masked** values only (`publicRuntimeConfig`); raw keys are never sent back to the browser after save.
3. Restart Next + `npm run dev:trigger` after changing Trigger secrets so the worker reloads env.

## Reporting issues

If you find a secret that was accidentally published, rotate that key immediately in the provider dashboard, then open an issue (without pasting the secret).
