import type { BrowserContext, Page, Locator } from "playwright";
import { guardedContext, navigate } from "./browser.js";
import {
  describe,
  effectSnapshot,
  hasEffect,
  interactiveSelector,
  resolveTarget,
  watchNavigation,
  usableTarget,
} from "./inspect.js";
import {
  KLM,
  laneMeta,
  reasons,
  speechSeconds,
  type Lane,
  type LaneEvent,
  type LaneResult,
  type JourneyStep,
  type ReasonCode,
  type Box,
} from "../../packages/core/index.js";
export type Hooks = {
  usableBudgetMs?: number;
  event?: (lane: Lane, event: LaneEvent) => void;
  frame?: (jpeg: Buffer, lane: Lane, index: number) => Promise<string>;
};
class Verdict extends Error {
  constructor(
    public code: ReasonCode,
    message: string,
    public unknown = false,
  ) {
    super(message);
  }
}
const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
export async function runLane(
  lane: Lane,
  url: string,
  journey: JourneyStep[],
  hooks: Hooks = {},
  trustedUrl?: string,
): Promise<LaneResult> {
  const result: LaneResult = {
    lane,
    status: "unknown",
    cost: { unit: laneMeta[lane].unit, value: 0 },
    estSeconds: 0,
    stoppedAtStep: null,
    reasonCode: null,
    wcag: [],
    events: [],
  };
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let stepIndex = 0;
  let frames = 0;
  let expired = false;
  const add = async (
    kind: LaneEvent["kind"],
    text: string,
    costDelta = 0,
    estSecondsDelta = 0,
    box?: Box,
    capture = true,
  ) => {
    if (expired) return;
    const e: LaneEvent = {
      i: result.events.length,
      kind,
      step: stepIndex,
      text,
      costDelta,
      estSecondsDelta,
      box,
    };
    if (page && hooks.frame && capture && frames < 40) {
      try {
        e.frameId = await hooks.frame(
          await page.screenshot({ type: "jpeg", quality: 55, timeout: 2500 }),
          lane,
          frames++,
        );
      } catch {
        /* Evidence capture is optional; verdict is not. */
      }
    }
    result.cost.value += costDelta;
    result.estSeconds += estSecondsDelta;
    result.events.push(e);
    hooks.event?.(lane, e);
  };
  const work = async () => {
    context = await guardedContext({
      width: lane === "zoom" ? 320 : lane === "budget" ? 412 : 1280,
      height: lane === "zoom" ? 512 : lane === "budget" ? 823 : 800,
      mobile: lane === "budget",
      trustedUrl,
    });
    page = await context.newPage();
    watchNavigation(page);
    page.setDefaultTimeout(5000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Accessibility.enable");
    if (lane === "budget") {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: (1638.4 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
        connectionType: "cellular3g",
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    let usableStart = Date.now();
    await navigate(page, url);
    for (stepIndex = 0; stepIndex < journey.length; stepIndex++) {
      if (expired) return;
      if (stepIndex > 0 && lane !== "budget")
        await page
          .waitForLoadState("networkidle", { timeout: 5000 })
          .catch(() => {});
      const step = journey[stepIndex];
      let target: Locator;
      const usableBudgetMs = hooks.usableBudgetMs ?? 30000;
      if (lane === "budget") {
        let deadline: ReturnType<typeof setTimeout> | undefined;
        const remaining = Math.max(
          1,
          usableBudgetMs - (Date.now() - usableStart),
        );
        try {
          target = await Promise.race([
            usableTarget(page, step, remaining),
            new Promise<never>((_, reject) => {
              deadline = setTimeout(
                () =>
                  reject(
                    new Verdict(
                      "BUDGET_TIMEOUT",
                      `“${step.label}” was not usable within ${usableBudgetMs / 1000} seconds.`,
                    ),
                  ),
                remaining,
              );
            }),
          ]);
        } catch (error) {
          if (
            error instanceof Verdict ||
            (error instanceof Error && error.name === "TimeoutError")
          ) {
            const seconds = (Date.now() - usableStart) / 1000;
            await add("wait", "Usability deadline reached", seconds, seconds);
            throw new Verdict(
              "BUDGET_TIMEOUT",
              `“${step.label}” was not usable within ${usableBudgetMs / 1000} seconds.`,
            );
          }
          throw error;
        } finally {
          clearTimeout(deadline);
        }
      } else target = await resolveTarget(page, step);
      if (lane === "keyboard" || lane === "screenreader" || lane === "voice")
        await add(
          "wait",
          "Consider the next step",
          0,
          KLM.mental,
          undefined,
          false,
        );
      if (lane === "keyboard" || lane === "screenreader") {
        if (stepIndex === 0)
          await page.evaluate(() => {
            (document.activeElement as HTMLElement)?.blur();
            document.body.focus();
          });
        let reached = false;
        let escaped = false;
        let crossedDocument = false;
        const stops: string[] = [];
        const captured = new Set<string>();
        for (let count = 0; count < 150; count++) {
          await page.keyboard.press("Tab");
          const active = page.locator(":focus").first();
          if (
            !(await active.count()) ||
            (await active.evaluate(
              (n) => n === document.body || n === document.documentElement,
            ))
          ) {
            if (lane === "keyboard")
              await add("focus", "Document", 1, KLM.key, undefined, false);
            if (crossedDocument)
              throw new Verdict(
                lane === "keyboard" ? "KB_UNREACHABLE" : "SR_UNREACHABLE",
                `“${step.label}” never receives keyboard focus. ${(await target.evaluate((n) => n.tagName === "DIV" && !n.hasAttribute("tabindex"))) ? "It is a clickable div outside the tab order." : "The tab order returned to the document."}`,
              );
            crossedDocument = true;
            continue;
          }
          const d = await describe(page, active, cdp);
          const identity = await active.evaluate((n) => {
            const el = n as HTMLElement;
            return (
              el.id ||
              el.outerHTML.replace(/ data-fl-ref="[^"]*"/g, "").slice(0, 600)
            );
          });
          stops.push(identity);
          const isTarget = await target.evaluate(
            (n) => n === document.activeElement,
          );
          const capture = !captured.has(identity);
          captured.add(identity);
          if (lane === "screenreader")
            await add(
              "announce",
              d.announcement,
              1,
              speechSeconds(d.announcement),
              d.box,
              capture,
            );
          else await add("focus", d.announcement, 1, KLM.key, d.box, capture);
          if (isTarget) {
            reached = true;
            if (
              lane === "screenreader" &&
              (!normal(d.name) ||
                /^(button|link|image|icon)$/.test(normal(d.name)) ||
                /\.(png|jpg|svg|gif)$/i.test(d.name))
            )
              throw new Verdict(
                "SR_NO_NAME",
                `Reached “${step.label}”, but it was announced only as “${d.announcement}”. The control has no usable name.`,
              );
            if (d.covered)
              throw new Verdict(
                "KB_FOCUS_HIDDEN",
                `“${step.label}” is covered by ${d.covering} when it receives focus.`,
              );
            const key = ["checkbox", "radio", "switch"].includes(d.role)
              ? "Space"
              : "Enter";
            const before = await effectSnapshot(page);
            await page.keyboard.press(key);
            await add(
              "activate",
              `Press ${key}`,
              lane === "keyboard" ? 1 : 0,
              lane === "keyboard" ? KLM.key : 0,
              undefined,
            );
            if (!(await hasEffect(page, before, step))) {
              if (key === "Enter" && d.role === "button") {
                await page.keyboard.press("Space");
                await add(
                  "activate",
                  "Try Space",
                  lane === "keyboard" ? 1 : 0,
                  lane === "keyboard" ? KLM.key : 0,
                  undefined,
                );
                if (await hasEffect(page, before, step)) break;
              }
              throw new Verdict(
                "KB_NO_ACTIVATION",
                `“${step.label}” receives focus, but keyboard activation produces no observable effect.`,
              );
            }
            break;
          }
          if (stops.length >= 20 && new Set(stops.slice(-20)).size <= 3) {
            if (!escaped) {
              await page.keyboard.press("Escape");
              if (lane === "keyboard")
                await add(
                  "focus",
                  "Try Escape to leave the focus cycle",
                  1,
                  KLM.key,
                  undefined,
                  false,
                );
              escaped = true;
              stops.length = 0;
            } else
              throw new Verdict(
                lane === "keyboard" ? "KB_TRAP" : "SR_UNREACHABLE",
                `Focus repeats inside ${new Set(stops.slice(-20)).size} controls, even after Escape. “${step.label}” cannot be reached.`,
              );
          }
          if (
            stops.length > 20 &&
            stops[0] === identity &&
            new Set(stops).size > 3
          )
            throw new Verdict(
              lane === "keyboard" ? "KB_UNREACHABLE" : "SR_UNREACHABLE",
              `The tab order cycles without reaching “${step.label}”.`,
            );
        }
        if (!reached)
          throw new Verdict(
            lane === "keyboard" ? "KB_UNREACHABLE" : "SR_UNREACHABLE",
            `“${step.label}” was not reached within 150 Tab presses.`,
          );
      } else if (lane === "voice") {
        const d = await describe(page, target, cdp);
        const phrase = normal(d.visible);
        let selected: Locator | undefined;
        if (!phrase) {
          await add(
            "command",
            "Show numbers; choose the target number",
            2,
            KLM.voice * 2,
            d.box,
          );
          selected = target;
        } else {
          await add("command", `Click ${d.visible}`, 1, KLM.voice, d.box);
          const matches: Locator[] = [];
          const candidates = await page.locator(interactiveSelector).all();
          if (candidates.length > 300)
            throw new Verdict(
              "ENGINE_TIMEOUT",
              "Voice name resolution exceeds the 300-control measurement budget. No accessibility failure is claimed.",
              true,
            );
          for (const el of candidates) {
            if (!(await el.isVisible())) continue;
            const candidate = await describe(page, el, cdp);
            if (normal(candidate.name).includes(phrase)) matches.push(el);
          }
          if (!matches.length)
            throw new Verdict(
              "VOICE_NO_MATCH",
              `The command “click ${d.visible}” matched no interactive control. This control’s accessible name is “${d.name || "(empty)"}”.`,
            );
          let correct = false;
          for (const match of matches) {
            if (
              await match.evaluate(
                (node, ref) => node.getAttribute("data-fl-ref") === ref,
                d.ref,
              )
            ) {
              correct = true;
              selected = match;
              break;
            }
          }
          // describe() assigns fresh evidence refs, so compare stable element identity directly.
          if (!correct) {
            for (const match of matches) {
              const handle = await target.elementHandle();
              try {
                if (await match.evaluate((n, target) => n === target, handle)) {
                  correct = true;
                  selected = match;
                  break;
                }
              } finally {
                await handle?.dispose();
              }
            }
          }
          if (!correct)
            throw new Verdict(
              "VOICE_WRONG_TARGET",
              `“Click ${d.visible}” resolves to a different control.`,
            );
          if (matches.length > 1)
            await add(
              "command",
              `Show numbers; choose this control from ${matches.length} matches`,
              2,
              KLM.voice * 2,
              d.box,
            );
        }
        const before = await effectSnapshot(page);
        await selected!.click({ timeout: 5000, noWaitAfter: true });
        await add("activate", `Activate “${step.label}”`, 0, 0);
        if (!(await hasEffect(page, before, step)))
          throw new Verdict(
            "VOICE_NO_ACTIVATION",
            `The voice target resolves correctly, but activating “${step.label}” has no observable effect.`,
          );
      } else {
        if (!(await target.isVisible()))
          throw new Verdict(
            "TARGET_HIDDEN",
            `“${step.label}” is hidden at this viewport. Menu discovery is outside this measurement.`,
            true,
          );
        if (lane === "zoom") {
          const box = await target.boundingBox();
          const horizontal = await page.evaluate(
            () =>
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth + 1,
          );
          if (horizontal && box && (box.x < 0 || box.x + box.width > 320))
            throw new Verdict(
              "ZOOM_HSCROLL",
              `“${step.label}” is outside the 320 CSS pixel viewport and requires horizontal scrolling.`,
            );
          const beforeY = await page.evaluate(() => scrollY);
          await target.scrollIntoViewIfNeeded();
          const afterY = await page.evaluate(() => scrollY);
          const screens = Math.abs(afterY - beforeY) / 512;
          if (screens)
            await add(
              "scroll",
              `Scroll ${screens.toFixed(2)} screens`,
              screens,
              screens * KLM.scroll,
            );
          const d = await describe(page, target, cdp);
          if (d.covered && d.coveringFixed)
            throw new Verdict(
              "ZOOM_COVERED",
              `“${step.label}” is covered by ${d.covering}.`,
            );
        }
        if (lane === "budget") {
          const seconds = (Date.now() - usableStart) / 1000;
          await add(
            "wait",
            "Target visible, enabled and stable",
            seconds,
            seconds,
          );
          if (seconds * 1000 > usableBudgetMs)
            throw new Verdict(
              "BUDGET_TIMEOUT",
              `“${step.label}” was not usable within ${usableBudgetMs / 1000} seconds.`,
            );
        }
        const before = await effectSnapshot(page);
        if (lane === "budget") usableStart = Date.now();
        await target.click({ timeout: 5000, noWaitAfter: true });
        await add(
          "activate",
          `Click “${step.label}”`,
          lane === "mouse" ? 1 : 0,
          KLM.point + KLM.click,
        );
        if (!(await hasEffect(page, before, step)))
          throw new Verdict(
            "PAGE_ERROR",
            `Clicking “${step.label}” produces no observable effect. Pick a journey with a verifiable result.`,
            true,
          );
      }
      if (lane !== "budget") usableStart = Date.now();
    }
    result.status = "finished";
    stepIndex = Math.max(0, journey.length - 1);
    await add("finish", "Journey completed", 0, 0);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          void context?.close();
          reject(
            new Verdict(
              "ENGINE_TIMEOUT",
              "The lane exceeded its 45 second measurement budget.",
              true,
            ),
          );
        }, 45000);
      }),
    ]);
  } catch (e) {
    const v =
      e instanceof Verdict
        ? e
        : new Verdict(
            "PAGE_ERROR",
            e instanceof Error
              ? e.message.includes("15000")
                ? "The site didn’t load in 15 seconds."
                : e.message.slice(0, 300)
              : "The page could not be measured.",
            true,
          );
    result.status = v.unknown ? "unknown" : "dnf";
    result.reasonCode = v.code;
    result.wcag = reasons[v.code].wcag;
    result.stoppedAtStep = stepIndex;
    expired = false;
    await add(result.status, v.message, 0, 0);
    expired = true;
  } finally {
    clearTimeout(timer);
    await context?.close().catch(() => {});
  }
  result.cost.value = Math.round(result.cost.value * 100) / 100;
  result.estSeconds = Math.round(result.estSeconds * 100) / 100;
  return result;
}
