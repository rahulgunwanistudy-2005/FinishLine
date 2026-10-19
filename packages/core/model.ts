import type { Lane, LaneResult, Race } from "./index.js";
export const lanes = [
  "mouse",
  "keyboard",
  "screenreader",
  "voice",
  "zoom",
  "budget",
] as const;
export const reasons = {
  KB_UNREACHABLE: {
    wcag: ["2.1.1", "2.4.3"],
    hint: "Use a native button or link. Keep it in the normal tab order and give it a keyboard activation handler.",
  },
  KB_TRAP: {
    wcag: ["2.1.2"],
    hint: "Allow focus to leave this region. Provide an accessible close action and support Escape.",
  },
  KB_NO_ACTIVATION: {
    wcag: ["2.1.1"],
    hint: "Use a native button, or handle Enter and Space so they trigger the same action as a click.",
  },
  KB_FOCUS_HIDDEN: {
    wcag: ["2.4.11"],
    hint: "Keep the focused control visible above fixed overlays. Add scroll padding or move the obstructing banner.",
  },
  SR_NO_NAME: {
    wcag: ["4.1.2", "1.1.1"],
    hint: "Give the control a specific accessible name that matches its visible label, using text content, a label, or aria-label.",
  },
  SR_UNREACHABLE: {
    wcag: ["2.1.1", "4.1.2"],
    hint: "Use semantic interactive elements that can be reached with Tab. Give each a usable accessible name.",
  },
  VOICE_NO_MATCH: {
    wcag: ["2.5.3"],
    hint: "Include the visible label in the accessible name. Prefer a native button with its visible text as its name.",
  },
  VOICE_WRONG_TARGET: {
    wcag: ["2.5.3"],
    hint: "Make the visible label part of this control’s accessible name and distinguish it from other controls.",
  },
  VOICE_NO_ACTIVATION: {
    wcag: ["2.1.1"],
    hint: "Ensure the resolved control activates the intended action and exposes a verifiable result.",
  },
  ZOOM_HSCROLL: {
    wcag: ["1.4.10"],
    hint: "Use responsive widths and wrapping so this control fits within a 320 CSS pixel viewport.",
  },
  ZOOM_COVERED: {
    wcag: ["2.4.11"],
    hint: "Reflow fixed overlays at narrow widths and keep the target visible and operable.",
  },
  BUDGET_TIMEOUT: {
    wcag: [],
    hint: "Reduce blocking JavaScript and network work; render the interactive control within 30 seconds.",
  },
  ENGINE_TIMEOUT: {
    wcag: [],
    hint: "The measurement timed out. Retry and inspect engine or network health; this is not an accessibility verdict.",
  },
  PAGE_ERROR: {
    wcag: [],
    hint: "The site or browser failed to load. Retry after checking the URL and engine health.",
  },
  TARGET_HIDDEN: {
    wcag: [],
    hint: "This target is hidden at this viewport. Menu discovery is not measured; select a visible journey.",
  },
} as const;
export const laneMeta: Record<
  Lane,
  { name: string; unit: LaneResult["cost"]["unit"]; short: string }
> = {
  mouse: { name: "Mouse", unit: "clicks", short: "Point and click" },
  keyboard: { name: "Keyboard", unit: "keys", short: "Tab, then activate" },
  screenreader: {
    name: "Screen reader",
    unit: "announcements",
    short: "Virtual, Tab mode",
  },
  voice: {
    name: "Voice control",
    unit: "commands",
    short: "Click the visible label",
  },
  zoom: { name: "400% zoom", unit: "screens", short: "320 CSS pixel reflow" },
  budget: {
    name: "Budget phone",
    unit: "seconds",
    short: "Throttled Chromium",
  },
};
// Published KLM P and M, average non-secretarial typist K. Speech, voice and scrolling are explicit project assumptions.
export const KLM = {
  point: 1.1,
  click: 0.2,
  key: 0.28,
  mental: 1.35,
  wordsPerMinute: 300,
  announcementPause: 0.2,
  voice: 2.5,
  scroll: 0.8,
} as const;
export const speechSeconds = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length / 5 + KLM.announcementPause;
export const fixPrompt = (race: Race, result: LaneResult) =>
  `Fix the ${laneMeta[result.lane].name} journey on ${race.url}.\nStep: ${race.journey[result.stoppedAtStep ?? 0]?.label ?? "Unknown"}\nObserved: ${result.events.at(-1)?.text ?? result.status}\n${result.reasonCode ? reasons[result.reasonCode].hint : "Preserve the working behavior."}\nWCAG: ${result.wcag.join(", ") || "Not a conformance finding"}.\nVerify with the same journey, preserve visible design, and rerun Finish Line. Do not claim full WCAG compliance from this check.`;
export const regressions = (previous: LaneResult[], current: LaneResult[]) =>
  current
    .filter(
      (r) =>
        r.status === "dnf" &&
        previous.some((p) => p.lane === r.lane && p.status === "finished"),
    )
    .map((r) => r.lane);
