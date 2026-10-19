# Hosting (free tiers only)

Authorized by the user on 19 October 2026: Render **free** web service + Vercel **Hobby**. No paid plan, card, domain, database or add-on. See `docs/ZERO-SPEND.md`.

## Backend — Render

| Setting | Value |
| --- | --- |
| Service | `finish-line` (web service, Docker) |
| Plan / region | `free` / Singapore |
| Dockerfile | `Dockerfile.web` (official Playwright 1.56.1 image, Chromium included) |
| Branch | `main`, auto-deploy on commit |
| Environment | `NODE_ENV=production`, `HOST=0.0.0.0`, `PUBLIC_ORIGIN=<Vercel production origin>` |
| URL | https://finish-line.onrender.com |

The service runs the complete app: Fastify API, the six-lane Chromium engine, SSE progress, MCP endpoint and the built UI. No `DATABASE_URL` is set, so it uses local files, which are ephemeral on Render free. Recorded benchmark races ship in `benchmark/` and always load. No Deployxa key is configured on the host, so the Deploys page shows its disconnected state honestly.

Render free instances spin down after inactivity; the first request after idle can take about a minute while the container and Chromium start. The instance has 512 MB of memory, so live races are slower than on a workstation and may report `unknown` if the engine is starved. Engine failures are never reported as accessibility DNFs.

## Frontend — Vercel

`vercel.json` builds the Vite UI (`pnpm build` → `dist/`) and proxies `/api/*`, `/health`, `/health/*`, `/fixtures/*` and `/mcp` to Render, so the browser stays same-origin. The Render server's origin guard accepts the Vercel origin through `PUBLIC_ORIGIN`. All other paths fall back to `index.html` for client routing.

Live race progress streams over SSE through the Vercel proxy. If a stream is interrupted, the UI fetches the stored race result instead.
