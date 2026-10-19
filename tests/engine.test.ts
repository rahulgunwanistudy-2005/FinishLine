import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { runLane } from "../apps/engine/lanes.js";
import { closeBrowser } from "../apps/engine/browser.js";
import type { JourneyStep } from "../packages/core/index.js";
const server = createServer(async (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    await readFile(
      _req.url?.includes("slow")
        ? "packages/fixtures/slow-button.html"
        : "packages/fixtures/bakery-fixed.html",
    ),
  );
});
let url = "";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture server failed");
  url = `http://127.0.0.1:${address.port}/`;
});
afterAll(async () => {
  server.close();
  await closeBrowser();
});
it("wraps the document between journey steps to reach a cart earlier in DOM order", async () => {
  const journey: JourneyStep[] = [
    {
      label: "Add to cart",
      target: { css: "#add-first" },
      expect: { selectorAppears: "#added:not(:empty)" },
    },
    {
      label: "Open cart",
      target: { css: "#open-cart" },
      expect: { selectorAppears: "#cart" },
    },
    {
      label: "Checkout",
      target: { css: "#checkout-button" },
      expect: { selectorAppears: "#checkout" },
    },
  ];
  const results = await Promise.all(
    (["keyboard", "screenreader"] as const).map((lane) =>
      runLane(lane, url, journey, {}, url),
    ),
  );
  for (const result of results) {
    expect(result.status, `${result.lane}: ${result.events.at(-1)?.text}`).toBe(
      "finished",
    );
    expect(result.events.filter((e) => e.kind === "activate")).toHaveLength(3);
  }
}, 60000);

it("reports a measured performance deadline as DNF rather than an engine timeout", async () => {
  const target = url + "slow";
  const result = await runLane(
    "budget",
    target,
    [{ label: "Add to cart", target: { css: "#target" } }],
    { usableBudgetMs: 500 },
    target,
  );
  expect(result.status).toBe("dnf");
  expect(result.reasonCode).toBe("BUDGET_TIMEOUT");
  expect(result.cost.value).toBeGreaterThanOrEqual(0.5);
}, 15000);
