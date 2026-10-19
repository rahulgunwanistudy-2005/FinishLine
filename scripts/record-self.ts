import "././../apps/web/server/env.js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { lanes, ENGINE_VERSION, type Race } from "../packages/core/index.js";
import { runLane } from "../apps/engine/lanes.js";
import { closeBrowser } from "../apps/engine/browser.js";
const url = new URL("/", process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000")
  .href;
const race: Race = {
  id: randomUUID(),
  title: "Finish Line / self-race",
  url,
  journey: [
    {
      label: "Start race",
      target: { css: ".start-button" },
      expect: { selectorAppears: ".race-console.playing, .race-console.done" },
    },
  ],
  source: "self",
  status: "running",
  createdAt: new Date().toISOString(),
  engineVersion: ENGINE_VERSION,
  cacheKey: "self-race",
  results: [],
};
await mkdir("benchmark/frames", { recursive: true });
try {
  race.results = await Promise.all(
    lanes.map((lane) =>
      runLane(
        lane,
        url,
        race.journey,
        {
          frame: async (jpeg) => {
            const id = randomUUID();
            await writeFile(`benchmark/frames/${id}.jpg`, jpeg);
            return id;
          },
        },
        url,
      ),
    ),
  );
  race.status =
    race.results.find((r) => r.lane === "mouse")?.status === "finished"
      ? "done"
      : "invalid_journey";
  const date = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  await mkdir(`benchmark/runs/${date}`, { recursive: true });
  await writeFile(
    `benchmark/runs/${date}/self-race.json`,
    JSON.stringify(race, null, 2),
  );
  for (const result of race.results)
    console.log(
      `${result.lane}: ${result.status} ${result.reasonCode ?? ""} ${result.events.at(-1)?.text}`,
    );
  if (
    race.results.some(
      (r) =>
        ["mouse", "keyboard", "screenreader", "voice"].includes(r.lane) &&
        r.status !== "finished",
    )
  )
    process.exitCode = 1;
} finally {
  await closeBrowser();
}
