# Hosting (free tiers only)

Authorized by the user on 19 October 2026: Render **free** web service + Vercel **Hobby**. No paid plan, card, domain, database or add-on. See `docs/ZERO-SPEND.md`.

## Backend — Render

| Setting | Value |
| --- | --- |
| Service | `finish-line` (web service, Docker) |
| Plan / region | `free` / Singapore |
| Dockerfile | `Dockerfile.web` (official Playwright 1.56.1 image, Chromium included) |
| Branch | `main`, auto-deploy on commit |
| Environment | `NODE_ENV=production`, `HOST=0.0.0.0`, `PUBLIC_ORIGIN=https://finishline-race.vercel.app`, `ENGINE_LANE_CONCURRENCY=1` |
| URL | https://finish-line.onrender.com |

The service runs the complete app: Fastify API, the six-lane Chromium engine, SSE progress, MCP endpoint and the built UI. No `DATABASE_URL` is set, so it uses local files, which are ephemeral on Render free. Recorded benchmark races ship in `benchmark/` and always load. No Deployxa key is configured on the host, so the Deploys page shows its disconnected state honestly.

## Lane concurrency — `ENGINE_LANE_CONCURRENCY`

By default each race starts all six lanes at once (two races may run together, so up to twelve Chromium contexts). On a small host the lanes compete for CPU, and slow lanes hit the 45 s engine budget and come back `unknown`. Set `ENGINE_LANE_CONCURRENCY` to cap how many lanes run at the same time across the whole process:

| Value | Behaviour |
| --- | --- |
| unset or empty | Unchanged: every lane of a race starts at once. |
| `1` | Lanes run one at a time. |
| `2` | At most two lanes run at a time, shared across both active races. |
| anything else (`0`, `-1`, `1.5`, `two`) | The server refuses to start, so a typo cannot fall back silently. |

What it does and does not change:

- A waiting lane has not started. Its 45 s budget, page load and the budget phone's usable-time clock start only when it gets a slot, so queue time is never charged to a lane. The measurement code and budgets are unchanged; engine limits are still `unknown`, never DNF.
- Results are unchanged on a host with spare CPU: on 19 October 2026 (engine 0.4.0, macOS workstation) `pnpm test:matrix` passed 60/60 with the setting unset (19 s), `2` (37 s) and `1` (67 s). `docs/matrix.json` records which setting produced it (`laneConcurrency`).
- Races take longer. A sequential race can take up to 6 × 45 s plus page loads; the UI keeps streaming progress, and the MCP `race_url` wait still returns after 90 s with the honest "still queued or running" message.
- `/api/health` reports the active setting as `queue.lanes.limit` (`null` means unlimited) and the number of lanes waiting for a slot.

**Not yet verified on Render.** `1` or `2` is the suggested starting point for the free instance, but no hosted race has been run with the setting and the Render environment has not been changed. Adding the variable is the user's decision; it is an environment variable only, with no plan or billing change.

## Free-instance behaviour

Render free instances spin down after inactivity; the first request after idle can take about a minute while the container and Chromium start. The instance has 512 MB of memory, so live races are slower than on a workstation and may report `unknown` if the engine is starved. Engine failures are never reported as accessibility DNFs.

## Frontend — Vercel

| Setting | Value |
| --- | --- |
| Project | `finish-line` (Hobby team) |
| Public URL | https://finishline-race.vercel.app |
| Deployment protection | Vercel Authentication on preview deployments only; production is public |
| Branch | `main`, deploys on push |


`vercel.json` builds the Vite UI (`pnpm build` → `dist/`) and proxies `/api/*`, `/health`, `/health/*`, `/fixtures/*` and `/mcp` to Render, so the browser stays same-origin. The Render server's origin guard accepts the Vercel origin through `PUBLIC_ORIGIN`. All other paths fall back to `index.html` for client routing.

Live race progress streams over SSE through the Vercel proxy. If a stream is interrupted, the UI fetches the stored race result instead.

## Hosted verification — 19 October 2026, engine 0.4.0

- `/api/health` on Render: Chromium launched, engine 0.4.0, three recorded races loaded, local-file storage, all spending flags false, no Deployxa key.
- Through https://finishline-race.vercel.app: Home, Method and Deploys render with no browser errors; the recorded original bakery race replays to "4 of 6 finished"; a proxied POST passes the origin guard; SSE progress streams; frames load as JPEG.
- A live controlled-fixture race (original bakery) on the free instance returned mouse finished, zoom finished, screen reader DNF (`SR_NO_NAME`), and keyboard, voice and budget phone **unknown** (`ENGINE_TIMEOUT`: the 45 s lane budget was exceeded). The same fixture locally gives 4/6 (keyboard and budget phone finish; voice DNF). The free instance's small CPU share starves six concurrent Chromium lanes (see `ENGINE_LANE_CONCURRENCY` above). These are engine limits, correctly reported as unknown and not as accessibility failures. This hosted run is not a retained benchmark.

### After `ENGINE_LANE_CONCURRENCY=1` — 19 October 2026 (18:31 UTC), engine 0.4.0

With lanes running one at a time on the free instance, a live original-bakery race through https://finishline-race.vercel.app returned **4 of 6**: mouse, keyboard, 400% zoom and budget phone finished; screen reader DNF (`SR_NO_NAME`) and voice control DNF (`VOICE_WRONG_TARGET`). These are the same verdicts and reasons as the local run. Budget phone measured 11.0 s of usable time against 5.2 s locally, because of the slower host CPU. That is a real measurement and shows the lane depends on the host. This hosted run is not a retained benchmark.
