import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
const results = [];
await mkdir("docs/screenshots", { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const benchmark = (await (await fetch(`${origin}/api/benchmark`)).json()) as {
    races: { id: string }[];
  };
  for (const route of [
    "/",
    "/method",
    "/deploys",
    ...(benchmark.races[0] ? [`/race/${benchmark.races[0].id}`] : []),
  ]) {
    await page.goto(origin + route);
    await page.waitForLoadState("networkidle");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    results.push({
      route,
      viewport: 1440,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    await page.screenshot({
      path: `docs/screenshots/${route === "/" ? "home" : route.split("/")[1]}-desktop.png`,
      fullPage: true,
    });
  }
  await page.goto(origin);
  await page.waitForLoadState("networkidle");
  if (benchmark.races.length) {
    await page
      .getByRole("button", { name: "Start race", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: /of 6 finished/ })
      .waitFor({ timeout: 60000 });
    await page.screenshot({
      path: "docs/screenshots/results-desktop.png",
      fullPage: true,
    });
    await page.locator(".lane-screenreader").click();
    await page.getByRole("dialog").waitFor();
    // Audit the settled sheet, not a frame of its entry fade.
    await page.waitForFunction(() =>
      document
        .querySelector("dialog")
        ?.getAnimations()
        .every((a) => a.playState === "finished"),
    );
    const drawer = await new AxeBuilder({ page }).analyze();
    results.push({
      route: "evidence drawer",
      viewport: 1440,
      violations: drawer.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    await page.screenshot({ path: "docs/screenshots/evidence-desktop.png" });
    await page
      .getByRole("button", { name: "Copy fix prompt", exact: true })
      .click();
    const prompt = await page.evaluate(() => navigator.clipboard.readText());
    if (!prompt.includes("Fix the Screen reader journey"))
      throw new Error("Fix prompt copy failed");
    await page.getByRole("button", { name: "Close evidence" }).click();
    const focusReturned = await page
      .locator(".lane-screenreader")
      .evaluate((el) => el === document.activeElement);
    if (!focusReturned)
      throw new Error(
        "Focus did not return to the lane after closing evidence",
      );
    await page
      .getByRole("button", { name: "Copy race link", exact: true })
      .click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    if (!link.includes("/race/")) throw new Error("Race link copy failed");
    results.push({
      check: "clipboard and dialog focus",
      fixPromptCopied: true,
      raceLinkCopied: true,
      focusReturned,
    });
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/method", "/deploys"]) {
      await page.goto(origin + route);
      await page.waitForLoadState("networkidle");
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      results.push({
        route,
        viewport: width,
        overflow,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      });
      if (width === 390 && route === "/")
        await page.screenshot({
          path: "docs/screenshots/home-mobile.png",
          fullPage: true,
        });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin);
  await page.waitForLoadState("networkidle");
  if (benchmark.races.length) {
    await page
      .getByRole("button", { name: "Start race", exact: true })
      .first()
      .click();
    await page.getByRole("heading", { name: /of 6 finished/ }).waitFor();
  }
  results.push({ check: "browser errors", errors });
  await writeFile(
    "docs/a11y-results.json",
    JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  if (
    results.some(
      (r) =>
        ("violations" in r && r.violations!.length) ||
        ("overflow" in r && r.overflow),
    ) ||
    errors.length
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
