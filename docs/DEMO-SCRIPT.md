# Demo video script — about 2:40

**Live app:** https://finishline-race.vercel.app
**Demo website (real, public):** https://react-shopping-cart-67954.firebaseapp.com/
This is the open-source React Shopping Cart demo. Its cart lives only in the browser, with no accounts, orders or payments, so racing it changes nothing on anyone's server.

**Journey to pick:** 1. the first **Add to cart** (marker 11, under "Cropped Stay Groovy off white") → 2. **+** in the cart drawer (raises the quantity).
Do **not** add CHECKOUT: it does nothing in this demo, and Finish Line correctly rejects it as a journey the mouse can't verify.

**Verified result (19 Oct 2026, engine 0.4.0, both local and hosted):** **4 of 6 finish.**

| Lane | Result | What to say |
| --- | --- | --- |
| Mouse | Finished, 2 clicks | the control lane |
| Keyboard | **DNF**, 28 keys | Tab cycles the whole page and never reaches Add to cart. Every Add to cart has `tabindex="-1"` (verified independently). WCAG 2.1.1, 2.4.3 |
| Screen reader | **DNF**, 27 announcements | same barrier, heard aloud. WCAG 2.1.1, 4.1.2 |
| Voice control | Finished, 5 commands | 16 identical "Add to cart" buttons force "show numbers" |
| 400% zoom | Finished, 1.1 screens | |
| Budget phone | Finished | 18.3 s usable on the hosted server (5.4 s on a laptop) |

Backup recording of the hosted run: https://finishline-race.vercel.app/race/57e173bd-4131-4433-b490-a06e4258c914 (the free server's storage is temporary, so this link can disappear after the server sleeps; re-run if it's gone).

---

## Script

### 0:00–0:15 — Hook (landing page, hero visible)

**Screen:** https://finishline-race.vercel.app, at the top. Slowly move the cursor across the track figure so the dots scatter.

**Say:**
> "'Works on my mouse.' That's how most checkouts ship. This is Finish Line. One website, one journey, six real browsers: mouse, keyboard, screen reader, voice control, 400% zoom and a budget phone."

### 0:15–0:35 — What the hero means

**Screen:** point at the figure, then the terminal.

**Say:**
> "This track isn't decoration. It's drawn from a recorded race. Four runners crossed the line; the screen reader and voice control stopped at the first turn. The terminal prints the same results straight from the engine."

### 0:35–1:00 — The recorded race and its evidence

**Screen:** click **Watch the race**, then **Start race** on the console. Let the runners move and the screen-reader captions play. When it shows **4 of 6 finished**, click the **Screen reader** lane.

**Say:**
> "Every lane is a real browser. Counts are measured; the clock is an estimate, and we label it that way. Click a lane and you get the receipt: the exact frame, the event trail, the WCAG criteria and a fix you can copy straight into your editor."

Click **Copy fix prompt**, then close the dialog.

### 1:00–1:45 — Live race on a real website (the main moment)

**Screen:** scroll to **Your site. Your finish line.**

1. Paste `https://react-shopping-cart-67954.firebaseapp.com/` and press the search button.
2. Tick **I'm authorized to run this journey.**
3. Select marker **11**, the first **Add to cart**.
4. Click **Preview selected actions**. The cart drawer opens in the preview.
5. Select **+** in the drawer.
6. Click **Start race**.

**Say while it runs:**
> "Now a real, public store. I paste the URL, and Finish Line numbers every control it can see. I pick Add to cart, preview it so the cart drawer appears, then pick plus. Six isolated Chromium browsers now run that exact journey."

**Editing tip:** on the hosted free server the race takes about 2 minutes. Cut the wait, or open the backup link above.

### 1:45–2:15 — The reveal

**Screen:** results show **4 of 6 finished**. Open the **Keyboard** lane.

**Say:**
> "The mouse finishes in two clicks. The keyboard never does: it tabs through the entire page, 28 keys, and never reaches Add to cart, because every one of those buttons is removed from the tab order. A screen-reader user hits the same wall after 27 announcements. Voice control does finish, but sixteen identical 'Add to cart' buttons cost it five commands instead of two."

### 2:15–2:35 — Trust and design

**Screen:** open **Method & limits** and scroll to the correctness matrix (60/60).

**Say:**
> "We test the tester: sixty fixture checks prove each lane detects what it should. When our own engine struggles, we say *unknown*, never 'inaccessible'. And the app holds itself to the same bar: zero axe violations in light and dark, captions, mute, reduced motion and full keyboard access."

### 2:35–2:45 — Close

**Screen:** back to the top of the landing page.

**Say:**
> "Same checkout. Six ways through. Finish Line: push code, everyone finishes."

---

## Before you hit record

- [ ] **Wake the server 3 minutes early:** open https://finish-line.onrender.com/health and wait until it shows JSON (the free tier sleeps; the first load can take about a minute).
- [ ] **Mind the rate limit:** scanning, previewing and racing allow 5 requests per 10 minutes for the whole app. One full take uses 3 (scan, preview, race). If you see "Rate limit exceeded", wait the time it shows.
- [ ] **Do a dry run first,** wait 10 minutes, then record the real take.
- [ ] **Turn the sound on** in your recorder: the screen-reader lane speaks. Set speech speed to 1× and don't press mute.
- [ ] **Window:** a 1440×900 browser window or larger, zoom 100%, light theme, bookmarks bar hidden.
- [ ] **Reduced motion off:** in macOS, Accessibility → Display → Reduce motion off, or the race shows results without animation.
- [ ] **Recorder:** macOS Cmd+Shift+5 (record selected portion) or QuickTime. Record your voice-over separately if that's easier.
- [ ] **Fallback:** if the live race fails or stalls, use the backup race link above, or the controlled bakery race on the home page. Say it's a recording; don't present a recording as live.
- [ ] **Upload:** put the video on YouTube (Unlisted is fine) and paste the link into Devpost's video field. Keep it under 3 minutes.

## Honesty guardrails for the voice-over

- Say "virtual screen reader" or "screen-reader lane", not "VoiceOver" or "NVDA": no human assistive-technology session was run.
- The bakery on the home page is a **controlled test fixture**, not a real store and not built by an AI builder.
- The React Shopping Cart findings are real and reproducible, but they belong to a public demo app. Don't describe it as a production shop.
- "4 of 6 finished" is a completed-journey result, not a WCAG compliance score.
