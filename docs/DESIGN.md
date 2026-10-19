# Finish Line design system

**Current system (19 Oct 2026): monochrome technical.** Inspired by the ORDO landing-page language: mono display type (JetBrains Mono, self-hosted) with Inter for reading, square geometry, hairline grid rules, numbered section labels (`■ 01 / The race`), figure annotations with crosshairs, and a terminal panel. Colour carries meaning only: green #135A45 = finished, red #B42318 = did not finish, amber #8F5200 = unknown; dark-theme equivalents are #5FD3A1 / #FF8A80 / #F0B45A. Black solid buttons, outlined secondary buttons, black pill for the header action.

**Hero.** Left: kicker, two-tone mono headline, lede, actions, badges and a spec strip (engine status, matrix count and recording date, all from the API). Right: Fig. 01, a particle-drawn six-lane stadium track (`apps/web/src/hero.tsx`). Each runner replays its recorded stopping point, paced by its estimated seconds; finished runners rest on the start/finish line. Pointer movement displaces dots with critically damped springs and tilts the camera with independent X/Y springs. The figure pauses offscreen and when settled. Reduced motion renders the final state without movement. The canvas carries a text alternative summarizing the result. Below it, a terminal prints the same race's lane results from the API.

The token layer is the "ORDO layer" at the end of `apps/web/src/styles.css`; it overrides the earlier Apple-style base described below, whose motion, material and accessibility rules still apply.

---

The interface follows Apple's interface principles, translated for the web: content first, translucent chrome, restrained colour, system typography and motion that starts from the current value and settles without overshoot. The track remains the main experience.

## Colour

Semantic tokens live on `:root` in `apps/web/src/styles.css` and are redefined under `prefers-color-scheme: dark`.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` / `--bg-alt` | #FBFBFD / #F5F5F7 | #000000 / #0D0D0F | Page, grouped sections |
| `--surface` | #FFFFFF | #1C1C1E | Console, lanes, sheet |
| `--text` / `--text-2` | #1D1D1F / #6E6E73 | #F5F5F7 / #A1A1A6 | Primary and secondary text |
| `--accent` / `--link` | #0071E3 / #0066CC | #0A84FF / #2997FF | Tint: icons, progress, links |
| `--accent-fill` | #0071E3 | #0071E3 | Solid fills under white text (hover darkens to #0068D1) |
| `--green` | #1D7D37 | #30D158 | Verified finish |
| `--red` / `--red-fill` | #C4001A | #FF6961 / #D70015 | Did not finish |
| `--orange` / `--orange-fill` | #A94300 | #FFA94D / #B64400 | Unknown: engine limit, never a DNF |

Tint and fill are separate so white text on solid buttons and badges stays at or above 4.5:1 in both appearances. axe runs clean in light and dark.

## Typography

The system font stack (San Francisco on Apple platforms) with no downloaded web fonts. Tracking is size-specific: display headings at −0.015em with 1.05 leading, 17px body at −0.022em with 1.47 leading, 12–13px captions near −0.01em. Hierarchy comes from weight and size together. Figures use tabular numerals. All sizes are in `rem` so text scaling reflows the layout.

## Layout

```
[Translucent global nav: brand · The race · Deploy history · Method & limits · Race your site]
                      Finish Line
               Same checkout.
             Six ways through.          (secondary tone)
     One website. One journey. ...
     [Watch the race]  Race your site ›
     ● Real browsers. Real barriers. · Measured actions. Estimated human time.

┌ Race console (rounded 28px surface) ───────────────────────────────┐
│ [cb] Corner bakery / original          [🔊] [1×] [▶ Start race]     │
│ Journey ① Add to cart › ② Open cart › ③ Checkout   ⚑ finish line     │
│ ┌ lane card ────────────────────────────────────────────────────┐ │
│ │ 01  Mouse        ●━━━━━━━━━━━━━━━━━━━━━━━━━━┊   3.9s  ✓       │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ … six lane cards on the grouped background …                        │
│ Recorded date · engine version          Counts measured. Time estimated │
│ The photo finish — 4 of 6 finished. [Copy race link]  photo strip   │
└─────────────────────────────────────────────────────────────────────┘
[The starting field: benchmark table]   [Your site. Your finish line: picker]
[Footer on #F5F5F7]
```

Content width 75rem for the console, 61.25rem for reading text. Under 48rem lanes reflow into two lines (method and time, then the full-width course), and the evidence sheet becomes a bottom sheet.

## Materials and depth

- Global navigation and the sheet header use `backdrop-filter: saturate(180%) blur(20px)` over a semi-transparent background, with a hairline scroll edge instead of an opaque bar.
- The evidence sheet pairs a dimming, lightly blurred scrim with a larger, heavier surface shadow.
- `prefers-reduced-transparency` makes chrome solid; `prefers-contrast: more` darkens secondary text and adds defined borders; `forced-colors` keeps progress visible.

## Motion

- Runners and progress animate only `transform` (a rail translated by the measured percentage, and a `scaleX` fill) with a critically damped curve (`cubic-bezier(0.22, 1, 0.36, 1)`, ~0.48s). Every change animates from the current on-screen value, so replays and new events never jump.
- Buttons and lanes respond on press (`scale(0.97)` in 80ms), not on release.
- The evidence sheet materialises: opacity, scale and blur arrive together (slides up from the bottom on phones). It closes immediately so focus returns to the lane without waiting on motion.
- DNF/Unknown badges materialise in place. Nothing overshoots: no bounce is applied because no gesture carries momentum.
- `prefers-reduced-motion` replaces scale, blur and slides with short cross-fades and turns off progress transitions. The race also offers “Show results” and “Step through” instead of playback.

## Principles

1. Motion is evidence: only captured browser events move a runner.
2. The finish line is shared; costs and barriers are individual.
3. Proof stays one click away: every verdict opens its frames and fix.
4. Restraint: one accent colour, semantic status colours, no decorative gradients, no all-caps labels, no marketing filler. Every element is explained by the evidence it carries.

## Accessibility invariants

Captions for announcements and voice commands stay in the lane, with mute, speech rate, visible focus rings (4px accent halo), semantic result tables, a live region for lane outcomes and 44px minimum hit targets. `pnpm check:a11y` and `pnpm check:picker` must report zero axe violations at 1440, 390 and 320px with no horizontal overflow.
