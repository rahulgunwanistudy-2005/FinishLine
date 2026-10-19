# Build status — 19 October 2026

## Working locally

- Combined Fastify + Chromium service, six isolated input-method contexts, two-race queue, SSE progress, durable file fallback and Postgres adapter.
- Strict shared schemas, measured costs, explicitly estimated clock, deterministic reasons/fixes, frame storage and evidence drawer.
- Track-first Home, replay, results table, share links, method page, Deployxa connection state, screenshot/list journey picker, speech/captions/mute/rate and reduced motion.
- Ten fixtures, 60 matrix expectations, 19 unit/browser regression tests. The matrix and reports are published inside the app.
- Official Playwright Linux ARM64 container builds, Chromium launches and all 60 matrix expectations pass. Actual evidence: docs/container-check.json and docs/matrix-linux.json.
- Real recorded controlled original/repaired bakery runs: 4/6 and 6/6. Homepage self-race retained separately; no builder results invented.
- A real public example.com journey finishes all six lanes. Its API check verifies live progress, done delivery, cache deduplication, SSRF rejection and both MCP tools.
- Local Postgres 14: actual race/lane upserts and JPEG round trip pass; unreachable-DB fallback also checked.
- axe: zero violations across all main routes, race and evidence drawer. 320px/390px reflow passes. Local production Lighthouse: accessibility 100, performance 94.
- Deployxa CLI v1.0.8 runs. Runtime MCP discovery, deploy list/trigger, gate, readiness lookup, sandbox-only rollback and CI hook are implemented but need an account to verify.
- Submission draft and narrated demo script in SUBMISSION.md. A 30-second silent GIF of actual recorded fixture playback is in docs/finish-line-demo.gif. Screenshots, quality reports and actual timelines retained.

## Pending external inputs

1. DEPLOYXA_API_KEY and actual plan capabilities, to verify tool schemas, hosted Chromium, deployment and managed Postgres/previews. Separate scoped sandbox credentials are optional for rollback verification.
2. At least three original AI-builder bakery exports and full generation transcripts. The exact prompt is in benchmark/PROMPT.md. Current fixtures are not those subjects.
3. Human keyboard and VoiceOver/NVDA passes, manual per-store agreement and an optional consenting screen-reader participant. Automation is not reported as any of these.
4. Final narrated video and Devpost upload after the live deployment and evidence are ready.

## Explicit limits/cuts

- Screenshot picker sees initial-page controls. It does not yet replay intermediate steps to reveal new choices; use explicit API journeys for hidden later controls.
- Deployxa runtime-log attachment, a public rollback interface and OG-image generation are not implemented. Rollback remains an authenticated server endpoint for a bounded sandbox.
- Container verification covers local fixtures and service health. Public navigation was verified on the host; container public-network access and Deployxa hosting remain unverified. Building required a temporary authenticated npm-only host proxy; no Docker settings were changed.
- No claim of full WCAG conformance, real-user agreement, AI-builder ranking or verified Deployxa hosting.

See docs/PHASE0.md, docs/A11Y.md, docs/AGREEMENT.md and docs/LIMITS.md for detailed evidence and boundaries.
