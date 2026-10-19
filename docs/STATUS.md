# Build status — 19 October 2026

## Working locally

- Combined Fastify + Chromium service, six isolated input-method contexts, two-race queue, SSE progress, durable file fallback and Postgres adapter.
- Strict shared schemas, measured costs, explicitly estimated clock, deterministic reasons/fixes, frame storage and evidence drawer.
- Track-first Home, replay, results table, share links, method page, Deployxa connection state, screenshot/list journey picker with authorized action replay, edit/reset, speech/captions/mute/rate and reduced motion.
- Ten fixtures, 60 matrix expectations, 29 unit/browser/integration regression tests. The matrix and reports are published inside the app. Picker flows pass at 1440px/390px/320px, with zero axe violations and no overflow (docs/picker-check.json).
- Final official Playwright Linux ARM64 container builds, Chromium launches, all 29 regressions and all 60 matrix expectations pass. Its actual rollback response is 403. Evidence: docs/container-check.json and docs/matrix-linux.json.
- Real recorded controlled original/repaired bakery runs: 4/6 and 6/6. Homepage self-race retained separately; no builder results invented.
- A real public example.com journey finishes all six lanes. Its API check verifies live progress, done delivery, cache deduplication, SSRF rejection and both MCP tools.
- Local Postgres 14: actual race/lane upserts and JPEG round trip pass; unreachable-DB fallback also checked.
- axe: zero violations across all main routes, race and evidence drawer. 320px/390px reflow passes. Local production Lighthouse: accessibility 100, performance 94.
- Deployxa CLI v1.0.8 runs. Authenticated discovery returns 66 tools. Read-only quota, settings, project list and repository connection checks pass. Actual status/readiness tool aliases are supported. A fixed metadata allowlist blocks cloud writes and AI requests; rollback returns 403 before any cloud call. Actual HTTP safeguards pass (docs/zero-spend-check.json). Deploy race triggers, gate and CI hook still need an existing deployment to verify.
- Submission draft and narrated demo script in SUBMISSION.md. A 30-second silent GIF and a 2:53 MP4 of actual local app footage are retained, with burned-in captions, SRT and transcript. Narration uses the Mac’s offline computer voice; no human participant or hosted deployment is represented. Screenshots, quality reports and actual timelines retained.

## Pending external inputs

1. A verified zero-cost deployment path. The key works; the account is Free with $0 usage and auto-top-up off, but reports a $50 usage ceiling. No resources were created. Verify an enforced $0 spending cap and free deployment terms before provisioning. The repository provider is not connected. Managed databases and previews are unavailable on Free; no paid upgrade is authorized. See docs/deployxa-check.json.
2. At least three original AI-builder bakery exports and full generation transcripts. The exact prompt is in benchmark/PROMPT.md. Current fixtures are not those subjects.
3. Human keyboard and VoiceOver/NVDA passes, manual per-store agreement and an optional consenting screen-reader participant. Automation is not reported as any of these.
4. Review the prepared captioned demo and its sentence-estimated subtitle timings, then complete Devpost upload after the live deployment and evidence are ready.

## Explicit limits/cuts

- Deployxa runtime-log attachment, a public rollback interface and OG-image generation are not implemented. Rollback is disabled under the user’s zero-spend constraint.
- Container verification covers local fixtures and service health. Public navigation was verified on the host; container public-network access and Deployxa hosting remain unverified. Building required a temporary authenticated npm-only host proxy; no Docker settings were changed.
- No claim of full WCAG conformance, real-user agreement, AI-builder ranking or verified Deployxa hosting.

See docs/PHASE0.md, docs/A11Y.md, docs/AGREEMENT.md and docs/LIMITS.md for detailed evidence and boundaries.
