import { randomUUID } from "node:crypto";
import type { Locator, Page, CDPSession } from "playwright";
import type { Box, JourneyStep } from "../../packages/core/index.js";
export const interactiveSelector =
  "button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[tabindex]";
export type Descriptor = {
  ref: string;
  name: string;
  role: string;
  announcement: string;
  visible: string;
  box?: Box;
  tag: string;
  covered: boolean;
  covering: string;
  coveringFixed: boolean;
};
export async function describe(
  page: Page,
  locator: Locator,
  cdp: CDPSession,
): Promise<Descriptor> {
  const ref = randomUUID();
  const info = await locator.evaluate((node, ref) => {
    node.setAttribute("data-fl-ref", ref);
    const element = node as HTMLElement;
    const b = node.getBoundingClientRect();
    const top = document.elementFromPoint(
      b.x + b.width / 2,
      b.y + b.height / 2,
    );
    const covered = Boolean(top && top !== node && !node.contains(top));
    let coveringFixed = false;
    let ancestor = top;
    while (ancestor) {
      const position = getComputedStyle(ancestor).position;
      if (position === "fixed" || position === "sticky") coveringFixed = true;
      ancestor = ancestor.parentElement;
    }
    const input = node as HTMLInputElement;
    const label = input.labels?.[0]?.innerText || input.placeholder || "";
    return {
      tag: node.tagName.toLowerCase(),
      visible: (element.innerText || label || "").trim().replace(/\s+/g, " "),
      coveringFixed,
      box:
        b.width && b.height
          ? { x: b.x, y: b.y, w: b.width, h: b.height }
          : undefined,
      covered,
      covering: covered
        ? top?.getAttribute("aria-label") ||
          top?.tagName.toLowerCase() ||
          "overlay"
        : "",
    };
  }, ref);
  const doc = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: doc.root.nodeId,
    selector: `[data-fl-ref="${ref}"]`,
  });
  const { nodes } = await cdp.send("Accessibility.getPartialAXTree", {
    nodeId,
    fetchRelatives: false,
  });
  const ax = nodes.find((n) => !n.ignored) ?? nodes[0];
  const name = String(ax?.name?.value ?? "");
  const role = String(ax?.role?.value ?? info.tag);
  const states = (ax?.properties ?? [])
    .filter((p) =>
      ["checked", "expanded", "selected", "disabled"].includes(p.name),
    )
    .map((p) => `${p.name} ${String(p.value.value)}`);
  return {
    ref,
    ...info,
    name,
    role,
    announcement: [name, role, ...states].filter(Boolean).join(", "),
  };
}
export function targetLocator(page: Page, step: JourneyStep) {
  // The picker supplies a precise CSS identity, essential when names are duplicated.
  return page.locator(step.target.css).first();
}
export async function resolveTarget(
  page: Page,
  step: JourneyStep,
  timeout = 10000,
) {
  let locator = targetLocator(page, step);
  if (!(await locator.count()) && step.target.role && step.target.name)
    locator = page
      .getByRole(step.target.role as Parameters<Page["getByRole"]>[0], {
        name: step.target.name,
        exact: true,
      })
      .first();
  if (!(await locator.count()) && step.target.text)
    locator = page.getByText(step.target.text, { exact: true }).first();
  await locator.waitFor({ state: "attached", timeout });
  return locator;
}
const navigationCounts = new WeakMap<Page, number>();
export function watchNavigation(page: Page) {
  navigationCounts.set(page, 0);
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      navigationCounts.set(page, (navigationCounts.get(page) ?? 0) + 1);
  });
}
export async function effectSnapshot(page: Page) {
  const snapshot = await page.evaluate(() => ({
    url: location.href,
    mutations:
      (window as unknown as { __finishLine: { mutations: number } })
        .__finishLine?.mutations ?? 0,
    dialogs: document.querySelectorAll(
      "dialog[open],[role=dialog]:not([hidden])",
    ).length,
    expanded: [...document.querySelectorAll("[aria-expanded]")]
      .map((e) => e.getAttribute("aria-expanded"))
      .join(","),
  }));
  return { ...snapshot, navigationRequests: navigationCounts.get(page) ?? 0 };
}
export async function hasEffect(
  page: Page,
  before: Awaited<ReturnType<typeof effectSnapshot>>,
  step: JourneyStep,
) {
  try {
    if (step.expect?.urlIncludes) {
      await page.waitForURL((u) => u.href.includes(step.expect!.urlIncludes!), {
        timeout: 15000,
      });
      return true;
    }
    if (step.expect?.selectorAppears) {
      await page
        .locator(step.expect.selectorAppears)
        .waitFor({ state: "visible", timeout: 1500 });
      return true;
    }
    await page.waitForFunction(
      (before) => {
        const mutations =
          (window as unknown as { __finishLine?: { mutations: number } })
            .__finishLine?.mutations ?? 0;
        return (
          location.href !== before.url ||
          mutations !== before.mutations ||
          document.querySelectorAll("dialog[open],[role=dialog]:not([hidden])")
            .length !== before.dialogs ||
          [...document.querySelectorAll("[aria-expanded]")]
            .map((e) => e.getAttribute("aria-expanded"))
            .join(",") !== before.expanded
        );
      },
      before,
      { timeout: 1500 },
    );
    return true;
  } catch {
    if ((navigationCounts.get(page) ?? 0) > before.navigationRequests) {
      try {
        await page.waitForURL(
          (u) =>
            step.expect?.urlIncludes
              ? u.href.includes(step.expect.urlIncludes)
              : u.href !== before.url,
          { timeout: 15000 },
        );
        return true;
      } catch {
        throw new Error(
          "Navigation started, but the destination did not load within its budget. This measurement is unknown.",
        );
      }
    }
    return false;
  }
}
export async function scan(
  url: string,
  journey: JourneyStep[] = [],
  trustedUrl?: string,
) {
  if (journey.length > 2)
    throw new Error("Preview supports at most two prior actions.");
  const { guardedContext, navigate } = await import("./browser.js");
  const context = await guardedContext({ trustedUrl });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    watchNavigation(page);
    await navigate(page, url);
    for (const [index, step] of journey.entries()) {
      const target = await resolveTarget(page, step);
      const before = await effectSnapshot(page);
      await target.click();
      if (!(await hasEffect(page, before, step)))
        throw new Error(
          `Preview step ${index + 1} (${step.label}) had no observable effect. Choose another action.`,
        );
      await page.waitForLoadState("load", { timeout: 15000 });
      await page
        .waitForLoadState("networkidle", { timeout: 1500 })
        .catch(() => {});
    }
    const cdp = await context.newCDPSession(page);
    await cdp.send("Accessibility.enable");
    const elements = [];
    const locators = await page.locator(interactiveSelector).all();
    for (const locator of locators.slice(0, 150)) {
      if (!(await locator.isVisible())) continue;
      const d = await describe(page, locator, cdp);
      const css = await locator.evaluate((node) => {
        if (node.id) return `#${CSS.escape(node.id)}`;
        let e: Element | null = node;
        const path: string[] = [];
        while (e && e !== document.body) {
          let index = 1;
          let sib = e.previousElementSibling;
          while (sib) {
            if (sib.tagName === e.tagName) index++;
            sib = sib.previousElementSibling;
          }
          path.unshift(`${e.tagName.toLowerCase()}:nth-of-type(${index})`);
          e = e.parentElement;
        }
        return "body > " + path.join(" > ");
      });
      elements.push({
        number: elements.length + 1,
        label: d.visible || d.name || `Unnamed ${d.role}`,
        target: { css, role: d.role, name: d.name },
        box: d.box,
      });
    }
    return {
      screenshot: `data:image/jpeg;base64,${(await page.screenshot({ type: "jpeg", quality: 65 })).toString("base64")}`,
      width: 1280,
      height: 800,
      completedSteps: journey.length,
      elements,
    };
  } finally {
    await context.close();
  }
}

export async function usableTarget(
  page: Page,
  step: JourneyStep,
  timeout: number,
) {
  const target = await resolveTarget(page, step, timeout);
  await target.waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector) as HTMLButtonElement | null;
      return Boolean(el && !el.disabled);
    },
    step.target.css,
    { timeout },
  );
  await target.evaluate(
    `el => new Promise(resolve => { let prior=el.getBoundingClientRect(); const check=()=>requestAnimationFrame(()=>{const next=el.getBoundingClientRect();if(next.x===prior.x&&next.y===prior.y&&next.width===prior.width&&next.height===prior.height)requestAnimationFrame(()=>resolve());else{prior=next;check();}});check();})`,
  );
  return target;
}
