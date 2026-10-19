# Finish Line

**Same checkout. Six people. Not everyone finishes.**

Finish Line drives one real activation journey through six isolated Chromium sessions: mouse, keyboard, virtual screen reader, voice-label matching, 320px reflow and a throttled phone. It replays the observed events as a race, with a frame trail, measured counts and deterministic fix prompts.

**Local preview:** http://127.0.0.1:3000. **Deployxa live URL:** pending credentials and remote verification.

The original and repaired Corner bakery are **controlled fixtures**, not AI-builder outputs. The recorded engine 0.4.0 runs finish **4/6** and **6/6** respectively. Every result has its actual date and browser evidence. No builder rankings, human sessions or manual assistive-technology results are invented.

![Finish Line race](docs/screenshots/home-desktop.png)

## Run locally

Node 24 and pnpm 11 are recommended. After cloning, run:

```sh
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open http://127.0.0.1:3000. The checked-in fixture recordings work without Chromium or a database. The engine needs Chromium for new measurements. Public races can activate forms; run only journeys you are authorized to execute.

For the production build: `pnpm build`, then `NODE_ENV=production pnpm start`. Copy `.env.example` to `.env` for optional settings. Never commit keys. The first imported environment module loads `.env` before database or platform clients initialize.

## Architecture

```mermaid
flowchart LR
  UI[React race and journey picker] --> Web[Fastify API / SSE / MCP]
  Web --> Engine[One Chromium, six isolated contexts]
  Engine --> Proxy[Authenticated outbound proxy\nDNS validation + IP-pinned sockets]
  Proxy --> Public[Public website]
  Web --> Storage[(Postgres or local files)]
  Engine --> Storage
  Web --> Deployxa[Deployxa MCP\nRuntime tool discovery]
  Recordings[Checked-in timelines and JPEGs] --> UI
```

The combined service is intentional. `apps/engine` owns browser drivers and network boundaries; `apps/web/server` owns queue, persistence, SSE, MCP and Deployxa integration; `packages/core` owns strict schemas, reasons and time estimates. A single service avoids an unauthenticated internal job API. `Dockerfile.engine` currently mirrors the combined Dockerfile; it is not a second independently deployed worker.

With DATABASE_URL configured, Drizzle writes races, lane results and JPEG frames into Postgres. Tables initialize at boot; a production database should use managed migrations. Without Postgres, `.data/` provides durable local files. Mount that directory on a persistent volume if deploying this fallback.

## What the lanes measure

| Lane | Real browser behavior | Measured cost | Main failure checks |
| --- | --- | --- | --- |
| Mouse | Click each target and verify its effect | Clicks | Failure invalidates the journey |
| Keyboard | Tab traversal, Enter/Space, Escape from a cycle | Keys | Unreachable, trapped, covered, no activation |
| Screen reader | Tab traversal + CDP accessibility-tree names, roles and states | Announcements | Unusable name or unreachable target |
| Voice control | Visible-label resolution against computed accessible names | Commands | No correct match; duplicates use show-numbers |
| 400% zoom | 320 × 512 CSS pixel viewport, scroll and hit-testing | Screens scrolled | Horizontal access, fixed/sticky occlusion |
| Budget phone | 412 × 823, 150 ms, 1.6 Mbps / 750 kbps, 4× CPU | Wall seconds | Target not usable within its budget |

The spoken lane uses Web Speech after Start race, with captions, mute and rate controls. It does not run an actual screen reader. Voice models command resolution, not speech recognition. See [method](docs/METHOD.md) and [limits](docs/LIMITS.md).

Human time is explicitly estimated. KLM P/K/M constants are sourced; voice, speech and scrolling assumptions are exposed. A finish does not certify WCAG compliance. Engine failures become unknown, never an accessibility DNF. Mouse failure invalidates comparison results.

## Correctness and quality

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:matrix
pnpm build
pnpm check:a11y    # with a local server running
```

Ten HTML fixtures isolate native buttons, clickable divs, empty names, label mismatches, traps, occlusion, reflow, slow rendering, missing key handlers and duplicated labels. All six lanes compare observations against JSON sidecars. The actual generated 60-cell report is [docs/matrix.json](docs/matrix.json), exposed at `/api/matrix` and rendered as a table at `/method`. CI reruns it and preserves the artifact.

| Fixture | Expected distinction |
| --- | --- |
| good-button | All finish |
| div-button | Keyboard/SR unreachable; voice cannot resolve the clickable div |
| icon-button | Screen reader lacks a name; voice uses numbers |
| label-mismatch | Voice cannot match visible text |
| focus-trap | Keyboard trap; SR cannot reach target |
| cookie-banner | Keyboard/SR target hidden on keyboard focus |
| wide-table | Zoom needs horizontal access |
| slow-button | All finish, with actual phone load cost |
| enter-does-nothing | Keyboard/SR activation fails |
| many-same-labels | Voice disambiguates, counting extra commands |

See [A11Y](docs/A11Y.md) for actual accessibility checks and [manual agreement](docs/AGREEMENT.md) for checks still pending. Browser automation is not a human keyboard or VoiceOver pass.

## API and agent use

- `POST /api/races` — `{url, journey?}`; returns an ID, caching identical inputs for ten minutes.
- `GET /api/races/:id`, `GET /api/races/:id/events` — snapshot and SSE progress.
- `POST /api/journey/scan` — screenshot + numbered controls; up to three picker selections.
- `GET /api/frames/:id`, `GET /api/benchmark`, `GET /api/matrix`.
- `GET /health` — actual Chromium, database and MCP checks, recording provenance, queue state. Unconfigured services are false, not green.
- `GET /health/engine` — a real example.com Chromium screenshot.
- `POST /mcp` — stateless Streamable HTTP, `race_url` and `get_race`, with the same public URL boundaries and rate limits.

Example journey:

```json
{"url":"https://example.com","journey":[{"label":"Learn more","target":{"css":"a"},"expect":{"urlIncludes":"iana.org"}}]}
```

Explicit `urlIncludes` or `selectorAppears` expectations are stronger than mutation-based activation heuristics. The picker sees only controls visible on the initial page; supply explicit API steps for controls revealed later.

## Deployxa integration

Source checked: [Deployxa MCP documentation](https://deployxa.com/docs/mcp-server). Actual CLI checked: **v1.0.8**. The discovery document in the brief returned 404. The app uses the documented `https://mcp.deployxa.com/mcp` endpoint and authenticated `tools/list`, including pagination. [Phase 0 evidence](docs/PHASE0.md).

Configure `DEPLOYXA_API_KEY` server-side with read-only scope. Discovery writes actual schemas to `docs/deployxa-tools.json`; no authenticated tools were available during the initial build. Capabilities appear only when discovered. Planned integration tool names are `deployxa_list_projects`, `deployxa_list_deployments`, `deployxa_get_deployment_status`, `deployxa_get_readiness_score`, `deployxa_diagnose_deployment` and `deployxa_rollback_deployment`. The runtime uses each returned input schema rather than assuming argument spelling.

Deploy history lists reported deployments and race links. Race this deploy waits up to 120 seconds for a healthy URL, uses the previous saved journey or an explicitly supplied one, then queues a race. The gate compares against the previous completed race for the same project; only Finish → DNF is a regression. Unknown requires review. Log streaming and automatic attachment of runtime log excerpts have not been implemented.

Rollback is administrator-only: SANDBOX_ADMIN_TOKEN plus a separate DEPLOYXA_SANDBOX_KEY, project ID/name, typed confirmation and deployment-ownership verification. There is no public rollback UI. It has not been exercised without a sandbox account.

A CI integration can run after a real Deployxa deploy. Set FINISH_LINE_ORIGIN, FINISH_LINE_JOURNEY (JSON) and DEPLOYXA_PROJECT_ID as environment variables:

```yaml
- name: Race the deployment
  env:
    FINISH_LINE_ORIGIN: ${{ vars.FINISH_LINE_ORIGIN }}
    FINISH_LINE_JOURNEY: ${{ vars.FINISH_LINE_JOURNEY }}
    DEPLOYXA_PROJECT_ID: ${{ vars.DEPLOYXA_PROJECT_ID }}
  run: deployxa deploy --json | node scripts/race-on-deploy.mjs
```

Do not claim hosting or promotion enforcement until this has been run with a real account. The script exits nonzero on regression or incomplete measurement; the UI banner alone is advisory.

## Benchmark recording

`pnpm record` records original and repaired controlled fixtures through the live local API and copies timelines and frames into `benchmark/`. `node --import tsx scripts/record-self.ts` records the permanent homepage self-race. Restart the server to load new recordings. `pnpm record path/to/subjects.json` accepts real builder subjects with title, URL and explicit journey. Preserve each original export and complete transcript according to [the exact prompt](benchmark/PROMPT.md).

## Security and operation

Five races per IP per ten minutes, two active races, at most twenty queued, 45 seconds per lane and up to forty viewport JPEGs per lane. The authenticated outbound proxy resolves and validates DNS and connects to the exact checked IP. All redirect/subresource requests are rechecked. Private/reserved/metadata addresses, alternate protocols, credentialed URLs and unusual public ports are blocked; service workers, WebSockets, downloads and popups are disabled. Local fixture/self-race exemptions are internal, exact and not accepted as user API parameters. Keep production network-level egress isolation as defense in depth.

Health is truthful when dependencies are absent. Recorded races stay available with the engine down. No secret goes to browser code; no API keys are printed in logs.
