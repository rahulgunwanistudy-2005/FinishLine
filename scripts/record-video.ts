import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

const origin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000";
const directory = "/tmp/finish-line-video";
await mkdir(directory, { recursive: true });
const { races } = (await (await fetch(origin + "/api/benchmark")).json()) as {
  races: { id: string; title: string }[];
};
const original = races.find((race) => /original/i.test(race.title))!;
const repaired = races.find((race) => /repaired/i.test(race.title))!;
assert(original && repaired, "Actual retained recordings are required");
const scenes: {
  name: string;
  route: string;
  seconds: number;
  text: string;
  setup?: (page: Page) => Promise<void>;
  action?: (page: Page) => Promise<void>;
}[] = [
  {
    name: "Landing",
    route: "/",
    seconds: 18,
    // Muting scrolls the console into view; film the hero from the top.
    setup: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await delay(300);
    },
    text: "Finish Line. Same checkout, six ways through. This demo uses computer generated narration. Six real Chromium browsers race one journey: mouse, keyboard, screen reader, voice control, four hundred percent zoom and a budget phone. The track is drawn from a real recording, and the terminal prints the same results.",
    action: async (page) => {
      const figure = page.locator(".track-figure");
      const box = await figure.boundingBox();
      if (!box) return;
      await delay(4000);
      for (let step = 0; step <= 60; step++) {
        await page.mouse.move(
          box.x + box.width * (0.15 + 0.7 * (step / 60)),
          box.y + box.height * (0.45 + 0.2 * Math.sin(step / 6)),
        );
        await delay(90);
      }
    },
  },
  {
    name: "The race",
    route: `/race/${original.id}`,
    seconds: 26,
    text: "These are actual recorded browser measurements on a controlled bakery fixture, not an AI builder benchmark. Four of six lanes finish. The screen reader and voice lanes stop at real barriers. Counts are measured. The human time clock is an estimate.",
    action: async (page) => {
      await delay(1500);
      await page
        .getByRole("button", { name: "Start race", exact: true })
        .click();
    },
  },
  {
    name: "The evidence",
    route: `/race/${original.id}`,
    seconds: 25,
    text: "Each lane opens its evidence. The screen reader lane reached a button without a usable name. You can inspect the actual browser frame, its announcement and the event trail. The fix prompt comes from a closed reason code. Nothing here is a human screen reader session, and a finished lane is not a certificate of accessibility.",
    setup: async (page) => {
      await page.locator(".lane-screenreader").click();
      await page.getByRole("dialog").waitFor();
    },
    action: async (page) => {
      await delay(12000);
      await page
        .getByRole("button", { name: "Copy fix prompt", exact: true })
        .scrollIntoViewIfNeeded();
    },
  },
  {
    name: "Correctness",
    route: "/method",
    seconds: 20,
    text: "The engine has a published correctness matrix. Ten deliberately isolated fixtures, six lanes each. All sixty expectations pass, including focus traps, missing names, mismatched labels, occlusion and reflow. Unknown engine failures are kept separate from accessibility failures. The method also publishes its limits and timing assumptions.",
    setup: async (page) => {
      await page
        .getByRole("heading", { name: "The correctness matrix", exact: true })
        .scrollIntoViewIfNeeded();
    },
  },
  {
    name: "The repair",
    route: `/race/${repaired.id}`,
    seconds: 28,
    text: "This is the repaired controlled bakery. It follows the same three step journey: add the first product, open the cart, then checkout. The dated rerun finishes all six lanes. Both versions retain their real timelines and screenshots. We do not attribute these hand authored fixtures to any AI builder.",
    action: async (page) => {
      await delay(1000);
      await page
        .getByRole("button", { name: "Start race", exact: true })
        .click();
    },
  },
  {
    name: "Your journey",
    route: "/#race-your-site",
    seconds: 22,
    text: "For an authorized public site, paste its URL and inspect real controls. Select up to three actions in order. Preview can replay earlier selections to reveal the next page or a cart drawer. It requires authorization because those actions can change the target site. This example only inspects example dot com.",
    setup: async (page) => {
      await page.locator(".site-picker").scrollIntoViewIfNeeded();
    },
    action: async (page) => {
      await page
        .getByLabel("Website URL", { exact: true })
        .fill("https://example.com");
      await page
        .getByRole("button", { name: "Scan this website", exact: true })
        .click();
      await page.locator(".picker-options").waitFor({ timeout: 30000 });
      await page.locator(".picker-options input").first().check();
      await page.locator(".picker-options").scrollIntoViewIfNeeded();
    },
  },
  {
    name: "Deploys and close",
    route: "/deploys",
    seconds: 22,
    text: "Finish Line also connects read only to Deployxa. A deploy can trigger a race, and a lane that drops from finish to did not finish flags that deploy. Cloud writes, rollback and AI requests are blocked. Finish Line is live on free hosting at finish line race dot vercel dot app. Push code. Everyone finishes.",
  },
];
const browser = await chromium.launch();
const clips: string[] = [];
const evidence = [];
function timestamp(seconds: number) {
  const milliseconds = Math.round(seconds * 1000);
  return `${String(Math.floor(milliseconds / 3600000)).padStart(2, "0")}:${String(Math.floor(milliseconds / 60000) % 60).padStart(2, "0")}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")},${String(milliseconds % 1000).padStart(3, "0")}`;
}
let total = 0;
let subtitleIndex = 1;
let subtitles = "";
try {
  for (const [index, scene] of scenes.entries()) {
    const base = `${directory}/${index}`;
    await writeFile(base + ".txt", scene.text);
    execFileSync("/usr/bin/say", [
      "-r",
      "170",
      "-f",
      base + ".txt",
      "-o",
      base + ".aiff",
    ]);
    const audioDuration = Number(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          base + ".aiff",
        ],
        { encoding: "utf8" },
      ),
    );
    assert(audioDuration > 1, "Offline narration must contain real audio");
    const duration = Math.max(scene.seconds, audioDuration + 0.5);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      recordVideo: { dir: directory, size: { width: 1280, height: 1000 } },
      reducedMotion: "no-preference",
    });
    const started = Date.now();
    const page = await context.newPage();
    await page.goto(origin + scene.route);
    await page.waitForLoadState("networkidle");
    const mute = page.getByRole("button", {
      name: "Mute announcements",
      exact: true,
    });
    if (await mute.count()) await mute.click();
    await scene.setup?.(page);
    const trimStart = (Date.now() - started) / 1000;
    const ready = Date.now();
    await scene.action?.(page);
    await delay(Math.max(0, duration * 1000 + 300 - (Date.now() - ready)));
    const video = page.video()!;
    await context.close();
    const source = await video.path();
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      String(trimStart),
      "-i",
      source,
      "-i",
      base + ".aiff",
      "-t",
      String(duration),
      "-vf",
      "fps=25",
      "-c:v",
      "libx264",
      "-threads",
      "2",
      "-preset",
      "fast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-af",
      "apad",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      base + ".mp4",
    ]);
    const sentences = scene.text.match(/[^.!?]+[.!?]+/g) ?? [scene.text];
    const totalCharacters = sentences.reduce(
      (sum, sentence) => sum + sentence.length,
      0,
    );
    let elapsed = 0;
    for (const sentence of sentences) {
      const next =
        elapsed + (audioDuration * sentence.length) / totalCharacters;
      subtitles += `${subtitleIndex++}\n${timestamp(total + elapsed)} --> ${timestamp(total + next)}\n${sentence.trim()}\n\n`;
      elapsed = next;
    }
    evidence.push({
      scene: scene.name,
      route: scene.route,
      seconds: duration,
      narrationSeconds: audioDuration,
    });
    total += duration;
    clips.push(`file '${base}.mp4'`);
    console.log(`Captured ${scene.name}: ${duration.toFixed(1)}s`);
  }
  assert(total < 180, "Submission demo must remain under three minutes");
  await writeFile(`${directory}/concat.txt`, clips.join("\n") + "\n");
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    `${directory}/concat.txt`,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "docs/finish-line-demo.mp4",
  ]);
  await writeFile("docs/finish-line-demo.srt", subtitles.trimEnd() + "\n");
  await writeFile(
    "docs/DEMO-NARRATION.md",
    "# Demo narration\n\nComputer-generated narration using the Mac's offline voice. Footage is actual local app playback and inspection; browser audio is muted. No human participant is represented; footage is the local production build of the same code deployed at https://finishline-race.vercel.app. Caption timings are proportional sentence estimates; review them before public upload.\n\n" +
      scenes.map((scene) => `## ${scene.name}\n\n${scene.text}\n`).join("\n"),
  );
  await writeFile(
    "docs/video-check.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        durationSeconds: total,
        syntheticNarration: true,
        source:
          "Actual local production-build browser capture. Original/repaired timelines are recorded measurements; public URL scan is live. The same code is hosted on Render free and Vercel Hobby; no paid resources.",
        scenes: evidence,
      },
      null,
      2,
    ) + "\n",
  );
  execFileSync(process.execPath, ["scripts/caption-video.mjs"], {
    stdio: "inherit",
  });
} finally {
  await browser.close();
}
