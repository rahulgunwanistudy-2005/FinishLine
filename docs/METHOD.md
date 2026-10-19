# Method

Finish Line drives Chromium. It measures a chosen activation journey, not people or impairments, and does not certify WCAG conformance.

## Counts and estimates

Mouse counts clicks. Keyboard counts Tab, Enter, Space and an Escape attempt. Virtual screen reader counts accessibility-tree announcements at Tab stops. Voice counts label-resolution commands and duplicate-name disambiguation. Zoom counts fractional vertical viewport scroll distances. Budget phone measures wall time to visible, enabled, stable targets.

The 1980 Card/Moran/Newell paper, figure 1, gives P = 1.1 s, K = 0.28 s for an average non-secretarial typist, M = 1.35 s, and a 0.2 s button press following P. Source: https://iihm.imag.fr/blanch/ens/2010-2011/M1/EIHM/cours/1980-Card-KLM.pdf

This project uses one M per step as a simplified task model. Mouse uses 1.3 s/step. Keyboard uses K × keys + M × steps. Speech uses 300 words/minute plus 0.2 s per announcement and M/step. Voice uses 2.0 s speech + 0.5 s recognition per command and M/step. Scroll uses 0.8 s/screen plus mouse cost. Phone adds measured usable time to mouse cost. Speech, voice and scrolling constants are **project assumptions**, not validated KLM operators. Experienced screen-reader users may navigate and listen much faster. No estimate is a real user-session measurement.

Budget phone uses CDP network emulation at latency 150 ms, download 1638.4 kilobits/s, upload 750 kilobits/s, CPU slowdown 4, viewport 412 × 823. This is inspired by Lighthouse’s slow-4G simulation profile and mobile viewport, not its complete DevTools-adjusted network profile or simulated score. Source for viewport and profile selection: https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md

## Semantics

Names, roles and states come from Chromium CDP Accessibility.getPartialAXTree. The screen-reader lane follows Tab order and checks the selected control for a usable name; it does not run VoiceOver/NVDA or browse mode. Native controls and identity matching prevent duplicate labels from silently selecting the wrong target. Voice performs name matching, with a show-numbers path for duplicate and icon-only controls; no speech recognition is run.

## Activation

Prefer explicit expectations: URL includes a string, or a selector becomes visible. Without an expectation, compare URL, observed DOM content mutations, dialog visibility and expanded state. The heuristic can mistake unrelated updates for success. A mouse failure makes the journey invalid; results must not be treated as accessibility conclusions.

## Personas and credit

Grounding: UK GDS personas Ashleigh (screen reader), Chris (keyboard), Claudia (magnification). Their caveat: “A simulation is never a true representation of an impairment.” https://alphagov.github.io/accessibility-personas/

## Correctness

`pnpm test:matrix` serves every fixture and compares all six actual lane results against JSON sidecars. The generated docs/matrix.json is exposed verbatim at /api/matrix and rendered at /method. Passing a matrix cell means the declared expectation matched, including expected DNFs; it does not mean the fixture passes accessibility.
