import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const browser = await chromium.launch();
await mkdir("/tmp/finish-line-gif", { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1300 },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000");
  await page.waitForLoadState("networkidle");
  const board = await page.locator(".race-console").boundingBox();
  if (!board) throw new Error("Race board unavailable");
  const start = Date.now();
  for (let i = 0; i < 60; i++) {
    await delay(Math.max(0, start + i * 500 - Date.now()));
    if (i === 4)
      await page
        .getByRole("button", { name: "Start race", exact: true })
        .first()
        .click();
    await page.screenshot({
      path: `/tmp/finish-line-gif/${String(i).padStart(3, "0")}.png`,
      clip: { x: board.x, y: board.y, width: board.width, height: 960 },
    });
  }
  console.log(
    "Captured 30 seconds of actual fixture playback. GIF has no audio; speech remains available in the app.",
  );
} finally {
  await browser.close();
}
