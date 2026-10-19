# Finish Line design plan

## Palette
- Paper blue #EFF3F8: timing sheet canvas.
- Stadium navy #182C4B: text and scoreboard.
- Track blue #2359D9: action and primary lane.
- Signal coral #B73348: did not finish.
- Finish teal #16736C: verified finish.
- White #FFFFFF: lane surface.

## Typography
Barlow Condensed (600–800) for lane labels and scoreboard figures; Barlow (400–700) for readable instructions. Both have tabular figures. The narrow display family recalls athletics timing displays without turning evidence into tiny monospace labels. Load through Google Fonts with swap; fallback sans-serif remains usable offline.

## Layout
A generous left-aligned timing console is the hero, with an offset explanatory side panel. Home centers the working race, not a marketing headline. Desktop max width 1320px; 24px mobile padding. Mobile lanes reflow to a compact two-line arrangement.

Home:
```
[Finish Line]          [The race] [Deploys] [Method] [Race your site]
[Same checkout. Six ways through.]       [Live browser testing]
[Recorded fixture selector] [3 journey steps] [Sound] [Start race]
[01 Mouse        -------- runner ----------------| time]
[02 Keyboard     -------- runner ----------------| time]
[03 Screen reader ----- runner ------------------| time]
[04 Voice control ----- runner ------------------| time]
[05 400% zoom    -------- runner ----------------| time]
[06 Budget phone -------- runner ----------------| time]
[Recording date / estimated clock]               [Finish count]
[Benchmark table]                    [Race your site / journey picker]
```
Race:
```
[Back] [Site and journey]               [Replay] [Sound]
[Six lanes, event-driven progress]      [Evidence drawer when selected]
[Photo finish strip / accessible result table]
```

## Principles
1. Motion is evidence: only actual captured browser events move a runner.
2. The finish line is shared; costs and barriers are individual.
3. Proof stays one click away: every verdict opens its frames and fix.

## Review and revision
An initial full navy scoreboard read as a generic developer dashboard. Revised to pale blue with white lane surfaces, blue lane-number blocks and a single solid navy results strip. Dropped decorative grain, a large marketing hero and generic metric cards. Lane numbers are actual race order and carry useful orientation. No gradients, all-caps eyebrows, pill-card grid or decorative hover motion.

## Restraint pass
The final visual QA removes any decorative starting flags; the finish pattern remains because it marks the measured goal.

## Final visual and accessibility critique

Removed the decorative flag/eyebrow above the homepage heading, shortened the desktop lanes so the track dominates the first viewport, and darkened lane numbers after real contrast findings. Removed abbreviated aria-labels from lane controls so their accessible names retain the visible content. Google Fonts were fetched from their original source with licenses and served locally to remove render-blocking third-party latency. Mobile screenshots confirm all six lanes remain legible and selectable at narrow widths.
