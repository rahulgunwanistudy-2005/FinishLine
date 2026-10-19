# Finish Line: Build Session Prompt

Paste this whole file as the first message of a fresh Claude Code session in an empty folder. It is the project bible. Follow it top to bottom.

---

## 0. Mission

You are the lead engineer and design lead for **Finish Line**, an entry to the Hyperbloom October UI/UX and Web Design hackathon on Devpost (https://hyperbloom-october.devpost.com). The sponsor is **Deployxa** (https://deployxa.com).

**Hard deadline:** Oct 19, 2026, 5:00 PM EDT, which is Oct 20, 2:30 AM IST. Plan to submit by Oct 20, 12:30 AM IST. Treat every hour as scarce.

**One sentence:** Same checkout. Six people. Not everyone finishes.

**What it does:** Finish Line takes one real user journey on a live URL, such as "Add to cart, then Checkout". It replays that journey headlessly through six input methods: mouse, keyboard, screen reader, voice control, 400% zoom and a budget phone. For each lane it measures the real cost and stamps DNF ("did not finish") wherever the site blocks that person. The result plays back as a race. Every Deployxa deploy can trigger a race, and a lane that regresses blocks promotion.

**Tagline, built on Deployxa's slogan "Push code. Get a live URL.":** Push code. Everyone finishes.

**Who judges:** two senior backend and API engineers (one at Amazon, one a Staff Engineer at Macy's with IEEE and API-governance background) plus high-school organizers. Engineers will re-run your numbers. Teenagers need to get it in 10 seconds. Design for both.

**Organizer criteria (equal weight, no other rubric is published):**
1. Thoughtful UX and user flows
2. Intuitive and visually compelling UI
3. Accessibility and inclusive design
4. Creative interaction and information architecture
5. Strong problem-solving and originality
6. A polished prototype or working implementation

### Non-negotiables

- **Real engine.** Every lane drives a real browser and measures real behavior. No hard-coded verdicts, no mocked lanes presented as real.
- **Honest numbers.** Never invent a statistic, a test result, a user quote or a "real user" session. Recorded benchmark runs are labeled with their date. Anything estimated is labeled "estimated" with its model shown.
- **Demo-safe at every checkpoint.** `main` must always deploy and show a working race. Recorded benchmark races load even if the engine is down.
- **No AI-slop look.** Follow section 6 exactly.
- **Winning on merit only.** If something can't be built in time, cut it and say so in the limits section. Don't fake it.

---

## 1. Session setup (do this first, in order)

### 1.1 Skills

Load these before writing code, if available:

1. **frontend-design** (Anthropic's official design skill, the "Claude design pack"). Install it if missing. Try these in order until one works:
   - `claude plugin install frontend-design@claude-plugins-official`
   - `/plugin marketplace add anthropics/claude-code` then `/plugin install frontend-design@claude-code-plugins`
   - `npx skills add https://github.com/anthropics/skills --skill frontend-design`

   If all fail, continue. Section 6 embeds its core rules.
2. **engineering-workflow** (Rahul's own skill), if installed. It defines project layout, vertical slices and quality gates. Where it conflicts with this file, this file wins for this project.
3. **project-quality-audit** (Rahul's own skill), if installed. Run it in Phase 7, before submission.
4. **webapp-testing** from anthropics/skills, if available, for browser verification of the UI.

### 1.2 Ask Rahul once, at the start, then work autonomously

Ask for all of these in a single message, then continue building while he gathers them:

1. A **Deployxa account** and an **API key** (`dxa_...`) from https://deployxa.com/dashboard/api-keys. Prefer a read-only key for the public app as `DEPLOYXA_API_KEY`. Also ask for a second key scoped to one sandbox project as `DEPLOYXA_SANDBOX_KEY`, used only for rollback.
2. Whether the Deployxa plan includes **managed Postgres** and **preview deployments**. Preview deployments are listed as a Pro feature. If they're unavailable, use normal deployments of sandbox projects as the "deploy history".
3. **The benchmark stores** (section 9). Rahul generates them himself in the AI builders' web UIs (Lovable, Bolt, v0, Claude, ChatGPT; at least 3) using the exact prompt in section 9. He gives you the exported code or repos. You deploy them to Deployxa.
4. Whether he can recruit **one real screen-reader user** today, with consent, through a campus disability-support cell. This is optional. Never simulate or invent this.

### 1.3 Verify before building (Phase 0, first 60 minutes)

These are the highest-risk unknowns. Prove each one or switch to its fallback before building features.

| Check | How | Fallback |
| --- | --- | --- |
| Chromium runs on Deployxa | Deploy a hello-world container from `mcr.microsoft.com/playwright:<latest stable>-noble` that screenshots example.com and returns it at `/health/engine` | Run the engine container on another host. Keep the web app, database and MCP server on Deployxa, and state this plainly in the README. |
| MCP tool names | Fetch `https://mcp.deployxa.com/.well-known/mcp.json`, connect with the MCP TypeScript SDK (`StreamableHTTPClientTransport`, `Authorization: Bearer <key>`), call `tools/list`, and save the result to `docs/deployxa-tools.json` | Use only the tools that actually exist. Known names from public docs include `deployxa_list_projects`, `deployxa_get_project`, `deployxa_get_deployment_status`, `deployxa_get_readiness_score`, `deployxa_rollback_deployment`, `deployxa_diagnose_deployment` and `deployxa_stream_runtime_logs`. The docs say 63 tools exist. |
| Managed Postgres | Provision through the dashboard, CLI, or `deployxa_attach_database` | Supabase Postgres. Same schema, different `DATABASE_URL`. |
| CLI | `npm i -g @deployxa/cli`, `deployxa login`, `deployxa deploy --json` | Dashboard deploys plus MCP status polling. |

Write the results to `docs/PHASE0.md` before Phase 1.

---

## 2. Product spec

### 2.1 Core loop

1. Pick a site: a recorded benchmark store, one of your Deployxa projects, or any public URL.
2. Define the journey: 1 to 3 steps, picked by clicking numbered boxes on a screenshot. You can also accept the auto-detected default (first element whose name matches `add to cart|buy|checkout|sign up|subscribe|submit|book`).
3. Press **Start race**.
4. Six lanes run in parallel. Playback shows each lane advancing on measured events.
5. A results card shows finishes, DNFs, cost per lane and the reason for each DNF, with the WCAG criterion and a fix.

### 2.2 The six lanes

| Lane | Real behavior driven | Cost unit (measured) | DNF when | WCAG |
| --- | --- | --- | --- | --- |
| Mouse (pace car) | Click each step's target | Clicks | Never. If the mouse fails, the journey is invalid and the race shows "Journey couldn't be completed with a mouse; pick again". | n/a |
| Keyboard | Tab, Shift+Tab, Enter, Space | Key presses | Target never receives focus within the limit; keyboard trap; activation does nothing | 2.1.1, 2.1.2, 2.4.3, 2.4.7 |
| Screen reader (virtual, Tab mode) | Same traversal; each stop's announcement built from the browser's accessibility tree | Announcements heard | Target reached but announced without a usable name; or unreachable | 4.1.2, 1.1.1, 2.4.4 |
| Voice control | "Click <visible label>" resolved against accessible names, the way Voice Control and Dragon do | Spoken commands | No element's accessible name contains the visible words; or the command resolves to the wrong element | 2.5.3 |
| 400% zoom | Viewport 320 CSS px wide (the WCAG reflow equivalent of 1280 px at 400%) | Screens scrolled | Horizontal scrolling required to reach the target; or target covered by a fixed or sticky element at click time | 1.4.10, 2.4.11 |
| Budget phone | Network and CPU throttling (constants in 4.6) | Seconds until the target is usable | Target not usable within 30 s | Performance |

**Priority:** Mouse, Keyboard, Screen reader and Voice are core. Zoom and Budget phone are stretch, built in Phase 4 only if Phases 1 to 3 are done.

**Lane labels in the UI** name the access method ("Screen reader"), not an invented person. On `/method`, credit the UK Government Digital Service accessibility personas (https://alphagov.github.io/accessibility-personas/) as the grounding: Ashleigh for screen reader, Chris for keyboard, Claudia for magnification. Quote their caveat that a simulation is never a true representation of an impairment. Finish Line measures cost; it does not simulate impairment.

### 2.3 Race clock: estimated human time (KLM)

Automation time is meaningless to a human, so the race clock uses the **Keystroke-Level Model** (Card, Moran and Newell, 1980). The measured cost units are hard facts. Time is an estimate built on them. Show the constants on `/method` and label the clock "estimated time".

- Mouse: per step, point (P) 1.1 s plus click (B+B) 0.2 s.
- Keyboard: per key press, K = 0.28 s, plus one mental operator (M) 1.35 s per step.
- Screen reader: per announcement, its spoken duration at 300 words per minute plus 0.2 s, plus M per step. Experienced users often go faster; say so.
- Voice: per command, 2.0 s to speak plus 0.5 s recognition, plus M per step.
- Zoom: per screen scrolled, 0.8 s, plus the mouse step cost.
- Budget phone: measured wall-clock time to usable, plus the mouse step cost.

Verify the KLM constants against a published source before shipping. If they differ, use the source's values and cite it.

### 2.4 The wow moment (protect this above everything)

On the home page, the hero is a ready-to-run benchmark race, not a marketing headline.

1. Six lanes and a **Start race** button. The click is the user gesture that unlocks audio.
2. The mouse lane crosses first.
3. The keyboard counter climbs in its lane.
4. The screen-reader lane speaks its real announcements aloud through the Web Speech API ("button. button. link. button."), with live captions under the lane.
5. A DNF stamp lands with a one-line reason: "Reached 'Add to cart' but it was announced only as 'button'."
6. The voice lane shows its spoken command in a bubble. Nothing matches, and it stamps DNF.
7. The results card reads, for example, "2 of 6 finished."

The video ending: the same store, fixed (section 9.3) and redeployed on Deployxa, raced again. All six cross together in a photo-finish frame. "Push code. Everyone finishes."

### 2.5 Screens

1. **`/` Home.** Hero = benchmark race. Below it, a leaderboard of AI builders (lanes finished, worst DNF reason). Below that, a "Race your site" field (URL in, journey picker).
2. **`/race/:id` Race.** Six horizontal lanes. Each lane shows: method name and icon, live counter in its unit, estimated time, progress along the journey steps, the current frame thumbnail with the focus box drawn on it, a captions line (screen reader) or command bubble (voice), and a finish or DNF marker. Selecting a lane opens a drawer with step-by-step evidence (frames, announcements, commands), the WCAG criterion, a deterministic fix hint, and a "Copy fix prompt" button for a coding agent.
3. **Results card.** A photo-finish strip: lanes in order of finish, DNFs at the bottom with the step where they stopped. Shareable link. A generated OG image is a stretch goal.
4. **`/deploys` Deploy history.** Connected Deployxa project: deployments, race result per deployment, the readiness score beside it, and a gate banner when a lane regresses ("Screen reader went from Finish to DNF in this deploy"). Rollback works only on the sandbox project, behind a confirm dialog.
5. **`/method` Method and limits.** How each lane measures, the constants, KLM, the engine correctness matrix (section 5), the manual agreement table (section 9.4), and plain limits.
6. **Journey picker** (inside "Race your site"): screenshot with numbered boxes on interactive elements; click up to 3 in order; keyboard-operable as a listbox of the same elements.

All copy is plain, sentence case and specific. Buttons say exactly what happens: "Start race", "Race this deploy", "Copy fix prompt", "Roll back sandbox".

---

## 3. Architecture

### 3.1 Shape

One TypeScript monorepo, two deployables on Deployxa, one Postgres.

```
               browser
                  |
        +---------v----------+         +------------------------+
        |  web (Fastify)     |  HTTP   |  engine (Fastify +     |
        |  - serves SPA      +-------->|  Playwright, 1 Chromium)|
        |  - /api, SSE       |         |  - job runner          |
        |  - /mcp (MCP srv)  |<--------+  - lane drivers        |
        |  - Deployxa MCP    |  events |  - frames -> Postgres  |
        |    client          |         +-----------+------------+
        +---------+----------+                     |
                  |                                |
                  +------------> Postgres <--------+
                               (Deployxa managed)
```

If Phase 0 shows web and engine fit in one container comfortably, run them as one service with two modules. Fewer moving parts beats elegance. Keep the module boundary either way, so they can split later.

### 3.2 Repo layout

```
finish-line/
  apps/
    web/            # Fastify server + React SPA (Vite)
      server/       # routes, SSE, MCP server, Deployxa client
      src/          # React UI
    engine/         # Playwright lane drivers, job runner
  packages/
    core/           # zod schemas, lane types, KLM model, reason codes, fix hints
    fixtures/       # static HTML fixture pages + expected verdicts
  benchmark/        # prompts, transcripts, recorded runs (JSON + frames)
  scripts/          # race-on-deploy.mjs, record-benchmark.ts
  docs/             # PHASE0.md, deployxa-tools.json, METHOD.md, LIMITS.md
  Dockerfile.web
  Dockerfile.engine
  SUBMISSION.md     # Devpost copy, video script
```

Tooling: pnpm workspaces, TypeScript strict, zod, Drizzle ORM, Vitest, Playwright Test, ESLint, Prettier.

### 3.3 Data model (Drizzle)

- `races`: id, url, journey (jsonb), source (`benchmark` | `public` | `deploy`), deployxa_project_id?, deployxa_deployment_id?, engine_version, status (`queued` | `running` | `done` | `failed`), created_at, cache_key.
- `lane_results`: race_id, lane, status (`finished` | `dnf` | `unknown`), cost (jsonb: unit, value), est_seconds, stopped_at_step, reason_code, wcag (text[]), events (jsonb).
- `frames`: id, race_id, lane, t_index, jpeg (bytea), width, height. Serve at `/api/frames/:id` with `Cache-Control: public, max-age=31536000, immutable`.
- `deploy_checks`: project_id, deployment_id, race_id, readiness_score?, regression (jsonb).

### 3.4 Shared schemas (`packages/core`)

```ts
type Lane = 'mouse' | 'keyboard' | 'screenreader' | 'voice' | 'zoom' | 'budget';

type JourneyStep = {
  label: string;                 // visible text the user saw
  target: { role?: string; name?: string; css: string; text?: string };
  expect?: { urlIncludes?: string; selectorAppears?: string };
};

type LaneEvent = {
  i: number;                     // order
  kind: 'focus' | 'announce' | 'command' | 'scroll' | 'activate' | 'wait' | 'finish' | 'dnf' | 'unknown';
  step: number;
  box?: { x: number; y: number; w: number; h: number };
  text?: string;                 // announcement, command, or reason
  frameId?: string;
  costDelta: number;             // in the lane's unit
  estSecondsDelta: number;       // KLM
};

type LaneResult = {
  lane: Lane;
  status: 'finished' | 'dnf' | 'unknown';
  cost: { unit: 'clicks' | 'keys' | 'announcements' | 'commands' | 'screens' | 'seconds'; value: number };
  estSeconds: number;
  stoppedAtStep: number | null;
  reasonCode: ReasonCode | null;
  wcag: string[];
  events: LaneEvent[];
};
```

Reason codes are a closed enum with one deterministic fix hint each, for example: `KB_UNREACHABLE`, `KB_TRAP`, `KB_NO_ACTIVATION`, `KB_FOCUS_HIDDEN`, `SR_NO_NAME`, `SR_UNREACHABLE`, `VOICE_NO_MATCH`, `VOICE_WRONG_TARGET`, `ZOOM_HSCROLL`, `ZOOM_COVERED`, `BUDGET_TIMEOUT`, `ENGINE_TIMEOUT`, `PAGE_ERROR`. Engine problems always produce `unknown`, never `dnf`.

### 3.5 API

- `POST /api/races` with `{ url, journey? }` returns `{ id }`. Validate with zod. Return the cached race if `cache_key = sha256(url + journey + engine_version)` is less than 10 minutes old.
- `GET /api/races/:id` returns the race and lane results.
- `GET /api/races/:id/events` is an SSE stream of lane progress, then `done`.
- `POST /api/journey/scan` with `{ url }` returns a screenshot plus numbered interactive elements (role, name, css, box) for the picker.
- `GET /api/benchmark` returns the leaderboard from recorded runs.
- `GET /api/deployxa/projects`, `GET /api/deployxa/projects/:id/deployments`, `POST /api/deployxa/deployments/:id/race`, `POST /api/deployxa/sandbox/rollback` (sandbox only, requires `{ confirm: projectName }`).
- `GET /health` returns JSON describing what this deployment can actually do right now: database reachable, engine reachable, Chromium launches, Deployxa MCP reachable, number of tools listed, benchmark loaded. Each check has a timeout and returns true/false. No lying green.
- `POST /mcp` is the Finish Line MCP server (section 7.5).

### 3.6 Engine runtime

- One Chromium per engine process, launched at boot and relaunched on crash.
- Each race creates six isolated `BrowserContext`s in parallel, with no shared storage.
- Global concurrency is 2 races (`p-limit`). Excess races queue with a visible position.
- Budgets: 45 s per lane, 90 s per race. On timeout the lane becomes `unknown` with `ENGINE_TIMEOUT`.
- Frames: JPEG quality 55, viewport only, at most 40 per lane, captured on meaningful events (focus change on a new element, announcement, activation, DNF).
- Block downloads, popups, `file:`, and non-http(s) URLs. Turn on `bypassCSP: false` and `javaScriptEnabled: true`.

---

## 4. Engine: lane algorithms

**Common setup.** Desktop lanes use a 1280×800 viewport. Before each step, wait for `load` plus network quiet (500 ms with no requests, capped at 5 s). Inject a `MutationObserver` counter so activation effects can be detected. Resolve a step's target by `role`+`name` first, then `css`, then `text`. Keep an `ElementHandle` per step for identity checks with `node.isSameNode`.

**Effect detection after activation.** Record the URL, mutation count, open `[role=dialog]` or `<dialog open>`, and `aria-expanded` changes. Wait up to 1500 ms. If nothing changed, the activation failed.

### 4.1 Mouse

`locator.click()` per step. Verify the step's `expect` (or any effect). Cost: 1 click per step. If the mouse lane fails, mark the race `invalid_journey` and stop all lanes.

### 4.2 Keyboard

1. Focus the document body.
2. Press Tab, up to 150 presses per step. After each press, read the active element's descriptor and box. Draw the focus box on the frame.
3. If the active element is the target, activate it: Enter for links and buttons, Space for checkbox, radio and switch. If Enter has no effect on a `role=button`, try Space (+1 key).
4. Cost: every key press.
5. Detect a **trap**: the same 3 or fewer elements repeat for 20 presses and do not include the target. Press Escape once and continue. If still trapped: `KB_TRAP`.
6. **Unreachable**: focus cycles back to the first stop, or the limit is hit, without reaching the target: `KB_UNREACHABLE`. A common cause is a `div` with a click handler and no `tabindex`; detect it and name it in the reason.
7. **Focus hidden** (WCAG 2.4.11): at each stop, if `elementFromPoint` at the focused box's center is not inside the focused element, flag it. If it happens on the target itself: `KB_FOCUS_HIDDEN`, with the covering element named, such as a cookie banner or sticky header.

### 4.3 Screen reader (virtual, Tab mode)

1. Use the same traversal as the keyboard lane.
2. At each stop, build the announcement from the accessibility tree through CDP (`Accessibility.getPartialAXTree` for the backend node), using computed name, role and states: for example "Add to cart, button" or "Menu, button, collapsed". Generic or empty roles fall back to their tag semantics.
3. Cost: one announcement per stop. Estimated seconds follow the KLM speech formula.
4. **`SR_NO_NAME`**: the target is reached but its accessible name is empty, or is only a generic word ("button", "link", "image", "icon", a file name). Reason text: "Reached the step, but it was announced only as 'button'. Nothing told her which button."
5. **`SR_UNREACHABLE`**: same rule as the keyboard lane.
6. Store the announcement list. The UI speaks it with `speechSynthesis` at a fixed rate, with captions.
7. On `/method`, state this limit: real screen-reader users also navigate by headings, landmarks and browse mode. Tab mode is one realistic route, not the only one. If `tactual` (npm) has a permissive license, you may use it to calibrate path length, and credit it.

### 4.4 Voice control

1. For each step, compute the visible label: the target's rendered text (`innerText`, trimmed, collapsed whitespace), or its visible `<label>`, or placeholder for inputs.
2. The command is `click <visible label>`.
3. Collect every interactive element on the page (buttons, links, inputs, `role` widgets) and its accessible name (CDP). Normalize both sides: lowercase, strip punctuation, collapse spaces.
4. Matches are elements whose accessible name contains the spoken phrase.
   - Exactly one match and it is the target: finish the step. Cost: 1 command.
   - Several matches including the target: the user says "show numbers", then picks a number. Cost: +2 commands. Not a DNF.
   - No match: `VOICE_NO_MATCH`. Reason text: "She said 'click Add to cart'. Nothing on the page is named that. The button's accessible name is '<name>'."
   - One match but not the target: `VOICE_WRONG_TARGET`.
   - No visible label (icon-only button): "show numbers" route, cost +2, and flag it.
5. After a successful resolution, activate the element by click, then run effect detection.

### 4.5 400% zoom (stretch)

1. Viewport 320×512 CSS px.
2. For each step, measure `document.documentElement.scrollWidth > clientWidth + 1`. If the target's box is outside the horizontal viewport and only reachable by horizontal scrolling: `ZOOM_HSCROLL`.
3. Scroll the target into view and count vertical screens scrolled (cost).
4. Before clicking, check `elementFromPoint` at its center. If a fixed or sticky element covers it: `ZOOM_COVERED`.
5. If the target is hidden at this width behind a collapsed menu, mark the step `unknown`, not `dnf`. Menu discovery is out of scope; say so.

### 4.6 Budget phone (stretch)

1. CDP `Network.emulateNetworkConditions` and `Emulation.setCPUThrottlingRate(4)`. Use the Lighthouse mobile profile: about 150 ms RTT, about 1.6 Mbps down, 750 kbps up, 4× CPU. Verify these values against Lighthouse documentation and print the ones you use on `/method`.
2. Mobile viewport 412×823, `isMobile: true`, `hasTouch: true`.
3. Cost: wall-clock seconds from navigation start until the target is visible, enabled and stable for 2 animation frames, summed over steps.
4. Over 30 s: `BUDGET_TIMEOUT`.

---

## 5. Engine correctness matrix (your proof of technical execution)

Build `packages/fixtures`: small static HTML pages, each isolating one behavior. Serve them from a local test server. Each fixture declares the expected status per lane in a JSON sidecar. Vitest plus Playwright runs every fixture through every lane and compares.

| Fixture | Expected |
| --- | --- |
| `good-button.html` (native button, clear label) | Every lane finishes |
| `div-button.html` (clickable div, no tabindex) | Keyboard DNF `KB_UNREACHABLE`, Screen reader DNF, Voice DNF or show-numbers |
| `icon-button.html` (icon-only button, no name) | Screen reader DNF `SR_NO_NAME`, Voice show-numbers |
| `label-mismatch.html` (visible "Add to cart", aria-label "Submit item") | Voice DNF `VOICE_NO_MATCH`, others finish |
| `focus-trap.html` (modal with no exit) | Keyboard DNF `KB_TRAP` |
| `cookie-banner.html` (sticky banner covering the focused button) | Keyboard DNF `KB_FOCUS_HIDDEN` |
| `wide-table.html` (fixed-width layout) | Zoom DNF `ZOOM_HSCROLL` |
| `slow-button.html` (button rendered after a large script) | Budget phone slower, or DNF past 30 s |
| `enter-does-nothing.html` (role=button, no key handler) | Keyboard DNF `KB_NO_ACTIVATION` |
| `many-same-labels.html` (12 "Add to cart" buttons) | Voice finishes with show-numbers cost |

Target: every expectation passes in CI. Publish the matrix (fixtures × lanes, pass/fail) on `/method` and in the README. This is the strongest single artifact for engineer judges.

---

## 6. Frontend and design

### 6.1 Process (from the frontend-design skill; follow even if the skill didn't load)

1. **Write a design plan first** in `docs/DESIGN.md`: 4–6 named hex colors, typefaces and roles, a layout concept with ASCII wireframes for Home and Race, and three principles.
2. **Review it against this brief.** If any part looks like what you'd produce for any similar page, revise it, and note what changed and why.
3. **Build.** Take screenshots and critique them as you go. Before shipping, remove one decorative thing.

### 6.2 Direction

**Subject:** athletics photo-finish and race-timing systems. Slit-scan finish photos, lane numbers, timing tape, a scoreboard with tabular figures, the finish line.

Draw distinctive choices from that world:
- The race track is the hero. Lanes have real lane numbers.
- The results card is a photo-finish strip.
- Numbers use a typeface with true tabular figures, set large.

**Banned defaults (these are tells of generated pages):**
- Warm cream background with a serif display and a terracotta accent
- Near-black background with a single acid-green or vermilion accent
- Broadsheet layout with hairline rules everywhere
- The SaaS card kit: identical rounded cards, one radius everywhere, soft grey shadows, gradient washes
- Tracked-out ALL-CAPS eyebrow labels, `A · B · C` meta strings, a monospace face for small data labels, `→` appended to buttons, emoji icons
- One accented word in a headline
- Fade-and-slide-up on every section; hover animations on every card
- Purple-to-blue gradients, Inter or other default system choices made without reason

Choose one typeface family (two at most, clearly distinct). It needs tabular figures and a condensed or narrow width for lane labels. Pick deliberately, write the reason in `DESIGN.md`, and load it from Google Fonts.

### 6.3 Motion and sound

- **One orchestrated moment:** the race. Everything else is still.
- Lanes advance only when a measured event happens. Motion is data.
- DNF stamps land with a short, physical motion.
- With `prefers-reduced-motion`, skip playback and show the final state, with a "Step through" control.
- Speech plays only after the Start click. Provide mute and speech-rate controls, and always show captions.
- No background music. A single short start tone is allowed, and it respects mute.

### 6.4 Accessibility of Finish Line itself (it races itself)

- Fully keyboard-operable, with visible focus that is never hidden by sticky elements.
- The race announces lane finishes and DNFs through one polite live region, throttled to one message per 1.5 s.
- The results are also available as a real `<table>`.
- Color is never the only signal: each lane has a number, an icon and a text status.
- Contrast is at least AA, targets are at least 24×24 px, it reflows at 320 px, and zoom works.
- **Self-race:** add the Finish Line homepage as a permanent benchmark entry. It must show every core lane finishing. Fix the UI until it does.
- Gates before submit: axe-core 0 violations on every route, Lighthouse accessibility 100 and performance ≥ 90 on Home, and a manual keyboard-only pass plus a VoiceOver or NVDA pass. Record these in `docs/A11Y.md`.

### 6.5 Frontend tech

React plus Vite plus TypeScript, CSS with tokens on `:root` (CSS modules or vanilla). Don't use Tailwind's default palette. Playback is a single `requestAnimationFrame` clock over recorded timelines, so any race replays identically. The bundle is small: no chart library unless it's needed for the deploy history.

---

## 7. Deployxa integration (target: Best Use of Deployxa)

The story to tell: **"Deployxa's readiness score says your app will run. Finish Line says who can use it."** Deployxa's 40 free tools cover DNS, SSL, Docker, CI and TTFB, but none covers accessibility. Finish Line fills that gap and is built on their newest surface, the MCP server.

### 7.1 Hosting

- Deploy `web` and `engine` (or the single combined service) to Deployxa with `deployxa deploy --prod` using the Dockerfiles. The engine image is based on the official Playwright image.
- Postgres is Deployxa-managed if available (`deployxa_attach_database` or the dashboard).
- Secrets go in through `deployxa env set` (or `deployxa_set_secret`): `DATABASE_URL`, `DEPLOYXA_API_KEY`, `DEPLOYXA_SANDBOX_KEY`, `DEPLOYXA_SANDBOX_PROJECT_ID`.
- Record the deploy logs and readiness score for the README.

### 7.2 Server-side MCP client (`apps/web/server/deployxa.ts`)

- Use the MCP TypeScript SDK with `StreamableHTTPClientTransport` to `https://mcp.deployxa.com/mcp`, sending `Authorization: Bearer ${DEPLOYXA_API_KEY}`.
- At boot, call `tools/list` and cache it. Feature-flag every capability on the tool actually existing. If a tool is missing, hide that UI and say why on `/health`.
- Use a read-only key on all public paths. Never expose keys to the browser.
- Use these tools when they exist: `deployxa_list_projects`, `deployxa_get_project`, `deployxa_get_deployment_status`, `deployxa_get_readiness_score`, `deployxa_diagnose_deployment` (when a deploy never becomes healthy, show Deployxa's diagnosis instead of racing), and `deployxa_stream_runtime_logs` (attach server errors captured during a race to the lane drawer).

### 7.3 Deploy-triggered races and the gate

- **"Race this deploy":** poll `deployxa_get_deployment_status` until healthy (2 s interval, 120 s cap), then race the deployment URL with the project's saved journey.
- **Regression rule:** compare with the previous deployment's race. Any lane going from `finished` to `dnf` is a regression. Show a gate banner: "Don't promote: Screen reader went from Finish to DNF."
- **Sandbox rollback:** `deployxa_rollback_deployment` using `DEPLOYXA_SANDBOX_KEY`, but only for `DEPLOYXA_SANDBOX_PROJECT_ID`, behind a typed-confirm dialog. Log it.

### 7.4 CI hook

`scripts/race-on-deploy.mjs`: reads `deployxa deploy --json` output from stdin, calls `POST /api/deployxa/deployments/:id/race`, waits, prints a lane table, and exits non-zero on regression. Document a 6-line GitHub Actions example in the README.

### 7.5 Finish Line MCP server (hosted on Deployxa)

Expose `POST /mcp` (Streamable HTTP, MCP TypeScript SDK) with two tools:
- `race_url(url, journey?)` returns lane results.
- `get_race(id)`.

This lets a coding agent deploy with Deployxa MCP, race with Finish Line MCP, fix and redeploy. Deployxa's own MCP page invites hosting your own MCP server on Deployxa; cite it.

### 7.6 Demo without a Deployxa account

Judges get recorded benchmark races (no engine needed), live "Race your site" on public URLs, and a read-only deploy history of the sandbox project. Rollback is shown in the video, not exposed to the public.

---

## 8. Security and reliability (engineers will check)

- **SSRF guard on every URL the engine opens:** allow only http(s). Resolve DNS and reject private, loopback, link-local and metadata ranges (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`, `fe80::/10`). Re-check on every navigation and redirect with `page.route`. Block `file:`, `data:` navigations and downloads.
- **Rate limits:** 5 races per IP per 10 minutes, a global queue, and visible queue position.
- **Validation:** zod everywhere at the edge. Cap URLs at 2,048 characters, and journeys at 3 steps.
- **Timeouts:** per lane and per race, as in 3.6. A dead target site produces `unknown` and the message "The site didn't load in 15 s."
- **Degradation:** if the engine is down, Home still plays recorded races and `/health` says so.
- **Logging:** structured JSON logs (pino) with a race id on every line. No secrets in logs.
- **Idempotency:** cache by `cache_key`. A double-click doesn't start two races.

---

## 9. Benchmark protocol (the headline result)

### 9.1 Generating the subjects

Rahul gives every builder this exact prompt in its own web UI. Save the prompt and the full transcript in `benchmark/<builder>/`:

> Build a small online store for a neighborhood bakery: a home page with 6 products, each with an "Add to cart" button, a cart drawer, and a checkout page with a name, email and "Place order" button. It must meet WCAG 2.2 Level AA accessibility. Use React.

Don't edit the generated code. Deploy each one to Deployxa unchanged. If a build fails, fix only build configuration (not UI code) and log the change.

### 9.2 The journey

The same journey for every store: step 1 "Add to cart" on the first product, step 2 open the cart, step 3 "Checkout" (or the builder's equivalent, matched by visible text).

### 9.3 The photo-finish ending

Take the worst-performing store. Fix it with a coding agent, using the fix prompts Finish Line generates. Redeploy it to Deployxa as a new deployment and race it again. Record both races. If not every lane finishes after fixing, show the honest result.

### 9.4 Validation

Hand-check the core lanes on every store with a real keyboard and VoiceOver (or NVDA). Record agree/disagree per lane in `docs/AGREEMENT.md`, and publish the agreement rate on `/method`, misses included. If a real screen-reader user participated with consent, add their result as a separate, clearly labeled row. Otherwise write nothing about real users.

### 9.5 Recording

`scripts/record-benchmark.ts` runs every race, stores timelines and frames under `benchmark/runs/<date>/`, and the UI loads these as the hero and leaderboard. Each run is labeled "Recorded <date>, engine <version>".

---

## 10. Definition of done

- [ ] Live URL on Deployxa. Home plays a benchmark race within 2 s of load, no login.
- [ ] Core lanes (mouse, keyboard, screen reader, voice) work on arbitrary public URLs.
- [ ] Engine correctness matrix passes in CI and is published.
- [ ] Benchmark of at least 3 AI-built stores, recorded, with a leaderboard and the photo-finish ending.
- [ ] Deployxa: hosting, managed DB (or documented fallback), MCP client with tool discovery, deploy-triggered race, regression gate, sandbox rollback, CI script, Finish Line MCP server.
- [ ] `/health` is truthful. `/method` documents constants, KLM, limits and agreement.
- [ ] Self-race passes. axe 0, Lighthouse a11y 100, keyboard and screen-reader passes recorded.
- [ ] `tsc --noEmit`, lint and tests are green. No `any` in core schemas. No TODOs on the golden path.
- [ ] README: what it is, live link, 30-second GIF, architecture diagram, how each lane works, correctness matrix, Deployxa integration with tool names, limits, run locally in 3 commands.
- [ ] `SUBMISSION.md` contains the Devpost copy and the video script (section 12).

---

## 11. Phase plan (about 20 working hours)

Commit at the end of every phase. Deploy at the end of Phases 1, 3, 5 and 7. If a phase overruns by 30 minutes, apply the cut order.

| Phase | Hours | Output | Exit check |
| --- | --- | --- | --- |
| 0 | 0–1 | Section 1.3 checks, repo scaffold, `PHASE0.md` | Chromium screenshot returned from a Deployxa URL (or fallback decided) |
| 1 | 1–5 | Core schemas, fixtures, mouse + keyboard + screen reader + voice lanes, job runner, Postgres, SSE | Matrix passes for core lanes locally; one race via API on a public site |
| 2 | 5–6 | Design plan in `DESIGN.md`, reviewed and revised | Plan passes the banned-defaults check |
| 3 | 6–11 | Home with hero race, race view, lane drawer, results card, journey picker, speech + captions | Golden path works end to end on Deployxa |
| 4 | 11–13 | Stretch lanes: zoom, then budget phone | Matrix extended and passing, or lanes cut and documented |
| 5 | 13–15 | Deployxa client, deploy history, gate, sandbox rollback, CI script, MCP server, `/health` | Race triggered from a real Deployxa deployment |
| 6 | 15–17 | Benchmark recording, leaderboard, photo-finish ending, agreement checks | Recorded runs load on Home |
| 7 | 17–18 | Self-race, axe, Lighthouse, manual passes, `project-quality-audit` | All gates green |
| 8 | 18–20 | README, `SUBMISSION.md`, screenshots, GIF, video script; help Rahul record | Ready for Devpost |

**Cut order, if behind:** budget phone lane, then zoom lane, then the Finish Line MCP server, then the CI script, then the deploy history chart (keep a list), then the OG image.

**Never cut:** the spoken screen-reader lane, the voice lane, the correctness matrix, the benchmark leaderboard, the self-race, truthful `/health`.

---

## 12. Submission package (write into `SUBMISSION.md`)

### 12.1 Devpost page structure

1. **Title:** Finish Line. **Tagline:** Same checkout. Six people. Not everyone finishes.
2. 30-second GIF of a race with a DNF stamp.
3. **The problem**, with four sourced numbers only:
   - WebAIM Million 2026 (https://webaim.org/projects/million/): empty buttons on 30.6% of home pages, empty links on 46.3%, missing labels on 51%; errors up 10.1%, with AI-assisted coding named as a likely cause.
   - The Netherlands ACM (https://www.acm.nl/en/publications/acm-majority-large-online-stores-are-not-accessible-customers-disabilities): ordering with assistive tech was impossible on 61% of about 100 major web shops.
   - AudioEye study (https://venturebeat.com/ai/we-asked-five-ai-tools-to-build-accessible-websites-all-15-sites-failed): 15 of 15 AI-built sites failed WCAG Level A. Note that it is vendor-sponsored.
   - WHO (https://www.who.int/europe/news-room/fact-sheets/item/disability): over 1 billion people live with a disability.
4. **How a race works:** the six lanes table, short.
5. **The result:** the AI-builder leaderboard and the photo-finish fix.
6. **Proof it's real:** the correctness matrix, the agreement table, the `/health` link, the repo.
7. **Built on Deployxa:** hosting, managed Postgres, MCP tools by name, deploy gate, CI script, Finish Line MCP server.
8. **Accessibility of Finish Line itself:** self-race, axe, Lighthouse, manual passes.
9. **Limits,** in plain words.
10. **Built with.**

### 12.2 Video script (under 3 minutes)

- **0:00–0:20** The race, cold open: lanes, the spoken "button. button. link.", DNF stamps, "2 of 6 finished."
- **0:20–0:35** "An AI built this store when asked for WCAG AA. Deployxa put it live in under a minute. Most people couldn't buy from it."
- **0:35–1:10** Race your own site: paste a URL, pick the journey, run it, open a lane drawer, see the evidence and the fix prompt.
- **1:10–1:40** The leaderboard of AI builders.
- **1:40–2:15** Deployxa: deploy history, regression gate, an agent using Deployxa MCP plus Finish Line MCP to fix and redeploy.
- **2:15–2:45** The photo finish: all lanes cross together. "Push code. Everyone finishes."
- **2:45–3:00** Proof (matrix, agreement), limits, link.

### 12.3 First 30 seconds on the live link

The hero race is ready with one obvious **Start race** button. Nothing loads lazily above the fold. On mobile, the lanes stack and still race.

---

## 13. How you work

- Work autonomously. Ask Rahul only for things in 1.2, or for a decision that can't be undone.
- Build vertical slices. Never leave `main` undeployable.
- After every phase, post one short status: done, next, risks, anything cut.
- Verify in a real browser (screenshots) before calling UI work done.
- Write tests for the engine before UI polish.
- When a fact about Deployxa is uncertain, check the live docs (https://deployxa.com/docs/mcp-server) or `tools/list`. Never guess an API.
- Keep the honesty rules in section 0 above everything else.

Start now with Phase 0.