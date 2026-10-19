# Phase 0 — 19 October 2026

Repository started empty. Selected a combined Fastify web + Playwright engine service, with a module boundary for later separation. Local durable JSON/JPEG storage is the development fallback; Postgres is supported when DATABASE_URL is set.

| Check | Evidence | State / fallback |
| --- | --- | --- |
| Deployxa Chromium container | Official Playwright container builds locally; Chromium launches; Linux matrix passes 60/60 | Not verified remotely. Deployment remains pending credentials. |
| Discovery document | Live GET https://mcp.deployxa.com/.well-known/mcp.json returned 404 | Do not infer tools from the brief. Current docs confirm https://mcp.deployxa.com/mcp. Authenticated tools/list pending key. |
| Managed Postgres | No account or plan information supplied | Unverified. Local files for development, DATABASE_URL adapter for deployment. |
| CLI | npm exec returned Deployxa v1.0.8 | Login and remote deployment pending credentials. |

Source checked: https://deployxa.com/docs/mcp-server. It describes Streamable HTTP, API-key/OAuth authentication and 63 tools. This is documentation, not evidence of tools available to this account.

Requested frontend-design and webapp-testing skills installed. engineering-workflow and project-quality-audit were not present in the local skill catalog; project quality checks are performed directly. All benchmark stores, transcripts and manual assistive-technology results are pending user-supplied inputs. Fixture recordings will be clearly labeled and never attributed to AI builders.

## Local verification completed

- Deployxa CLI actually installed through npm exec and returned **v1.0.8**.
- Local Chromium screenshots, all six lane drivers and the public example.com journey were exercised. The public race completed in all six lanes; SSE, idempotency and Finish Line MCP tools were verified (`docs/api-smoke.json`).
- Local Postgres 14 adapter verification: actual race document and six-lane upserts plus byte-identical JPEG round trip passed (`docs/postgres-check.json`). This does not verify Deployxa managed Postgres.
- Official Playwright base image downloaded successfully. Initial builds failed because container networking could not reach npm. A temporary authenticated npm-only host proxy allowed the build to complete without changing Docker settings. The resulting Linux ARM64 image launches Chromium 141.0.7390.37, returns healthy engine status and passes all 60 fixture expectations. Actual image ID, runtime versions and health response are in `docs/container-check.json`; the full Linux matrix is in `docs/matrix-linux.json`. Public outbound navigation inside this container remains unverified.
- Combined application builds and runs in local production mode. Deployxa hosting and hosted Chromium remain pending the account key, not established failures of that platform.
