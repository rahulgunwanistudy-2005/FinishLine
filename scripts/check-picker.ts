import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { closeBrowser } from "../apps/engine/browser.js";
import { scan } from "../apps/engine/inspect.js";
import {
  RaceInputSchema,
  ScanInputSchema,
  type JourneyStep,
} from "../packages/core/index.js";

const origin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000";
const server = createServer(async (_req, response) => {
  response.setHeader("content-type", "text/html");
  response.end(await readFile("packages/fixtures/bakery-fixed.html"));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const fixture = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch();
const results = [];
await mkdir("docs/screenshots", { recursive: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let latest: Awaited<ReturnType<typeof scan>>;
    const previews: number[] = [];
    let submitted: JourneyStep[] = [];
    // Only the transport is intercepted: every scan comes from real Chromium
    // against our controlled fixture. Production private-URL guards stay intact.
    await page.route("**/api/journey/scan", async (route) => {
      const input = ScanInputSchema.parse(route.request().postDataJSON());
      assert.equal(input.url, "https://controlled-fixture.invalid/");
      latest = await scan(fixture, input.journey, fixture);
      previews.push(input.journey.length);
      await route.fulfill({ json: latest });
    });
    await page.route("**/api/races", async (route) => {
      const input = RaceInputSchema.parse(route.request().postDataJSON());
      submitted = input.journey ?? [];
      await route.fulfill({
        status: 400,
        json: {
          error: "Test captured the journey. No public race was submitted.",
        },
      });
    });
    await page.goto(origin + "/#race-your-site");
    await page
      .getByLabel("Website URL", { exact: true })
      .fill("https://controlled-fixture.invalid/");
    await page
      .getByRole("button", { name: "Scan this website", exact: true })
      .click();
    await page.locator(".picker-options").waitFor();
    assert(!latest!.elements.some((e) => e.target.css === "#checkout-button"));
    async function choose(css: string) {
      const element = latest.elements.find((e) => e.target.css === css);
      assert(element, `Missing picker control ${css}`);
      const checkbox = page
        .locator(".picker-options input")
        .nth(element.number - 1);
      await checkbox.focus();
      await page.keyboard.press("Space");
      assert(await checkbox.isChecked());
    }
    await choose("#add-first");
    const previewButton = page.getByRole("button", {
      name: "Preview selected actions",
      exact: true,
    });
    assert(await previewButton.isDisabled(), "Preview must require consent");
    await page.getByRole("checkbox", { name: /I’m authorized/ }).check();
    await previewButton.click();
    await page
      .getByText("The preview has completed 1 selected action.", {
        exact: false,
      })
      .waitFor();
    await page.waitForFunction(() =>
      document.activeElement?.classList.contains("picker-instruction"),
    );
    await choose("#open-cart");
    await previewButton.click();
    await page
      .getByText("The preview has completed 2 selected actions.", {
        exact: false,
      })
      .waitFor();
    await choose("#checkout-button");
    const markerNumbers = await page.locator(".scan-marker").allTextContents();
    assert.equal(
      new Set(markerNumbers).size,
      markerNumbers.length,
      "Screenshot control numbers must stay unique after selection",
    );
    assert(
      await previewButton.isDisabled(),
      "A complete three-step journey needs no further replay",
    );
    assert.equal(
      await page
        .getByRole("list", { name: "Selected journey steps" })
        .locator("li")
        .count(),
      3,
    );
    const axe = await new AxeBuilder({ page }).analyze();
    assert.equal(axe.violations.length, 0, JSON.stringify(axe.violations));
    await page.locator(".picker-options input:checked").last().focus();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    // Tall-element captures can include fixed layers outside the actual viewport.
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await page.locator(".site-picker").boundingBox();
    assert(box);
    await page.screenshot({
      path: `docs/screenshots/picker-${width}.png`,
      fullPage: true,
      clip: box,
    });
    await page
      .locator(".site-picker")
      .getByRole("button", { name: "Start race", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Test captured" })
      .waitFor();
    assert.deepEqual(
      submitted.map((step) => step.target.css),
      ["#add-first", "#open-cart", "#checkout-button"],
    );
    await page
      .getByRole("button", { name: "Edit previous step", exact: true })
      .click();
    await page
      .getByText("The preview has completed 1 selected action.", {
        exact: false,
      })
      .waitFor();
    assert(!latest!.elements.some((e) => e.target.css === "#checkout-button"));
    await page
      .getByRole("button", { name: "Reset journey", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="Selected journey steps"]'),
    );
    assert.deepEqual(previews, [0, 1, 2, 1, 0]);
    assert.deepEqual(errors, []);
    results.push({
      width,
      previewPrefixes: previews,
      keyboardSelection: true,
      uniqueControlNumbers: true,
      previewFocusReturned: true,
      authorizationRequired: true,
      submittedSelectors: submitted.map((step) => step.target.css),
      editAndReset: true,
      axeViolations: 0,
      horizontalOverflow: false,
      browserErrors: errors,
    });
    await context.close();
  }
  await writeFile(
    "docs/picker-check.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        source:
          "Controlled bakery fixture through real Chromium; API transport intercepted only to preserve production SSRF boundaries. Race submission captured, not executed.",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await closeBrowser();
  server.close();
}
