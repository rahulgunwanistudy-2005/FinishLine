import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import type { Race } from "../packages/core/index.js";
const origin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000";
const manifest = process.argv[2]
  ? (JSON.parse(await readFile(process.argv[2], "utf8")) as {
      title: string;
      url: string;
      journey: Race["journey"];
    }[])
  : undefined;
const date = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Kolkata",
});
await mkdir(`benchmark/runs/${date}`, { recursive: true });
await mkdir("benchmark/frames", { recursive: true });
for (const subject of manifest ?? [
  { fixture: "bakery-original" },
  { fixture: "bakery-fixed" },
]) {
  const fixture = "fixture" in subject ? String(subject.fixture) : undefined;
  const response = await fetch(
    `${origin}${fixture ? `/api/fixtures/${fixture}/race` : "/api/races"}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fixture ? {} : subject),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  const { id } = (await response.json()) as { id: string };
  let race: Race;
  const until = Date.now() + 120000;
  do {
    await delay(500);
    race = (await (await fetch(`${origin}/api/races/${id}`)).json()) as Race;
  } while (["queued", "running"].includes(race.status) && Date.now() < until);
  if (race.status !== "done")
    throw new Error(`${fixture ?? "Subject"}: ${race.error ?? race.status}`);
  if (manifest) {
    race.source = "benchmark";
    race.title = "title" in subject ? String(subject.title) : race.title;
  }
  for (const lane of race.results)
    for (const event of lane.events)
      if (event.frameId) {
        const frame = await fetch(`${origin}/api/frames/${event.frameId}`);
        if (!frame.ok) throw new Error("Frame is missing");
        await writeFile(
          `benchmark/frames/${event.frameId}.jpg`,
          Buffer.from(await frame.arrayBuffer()),
        );
      }
  await writeFile(
    `benchmark/runs/${date}/${fixture ?? id}.json`,
    JSON.stringify(race, null, 2),
  );
  console.log(
    `${race.title ?? race.url}: ${race.results.filter((r) => r.status === "finished").length}/${race.results.length} finished (${id})`,
  );
}
// Keep the complete generation prompt beside the recordings, never synthesize builder transcripts.
await copyFile("benchmark/PROMPT.md", `benchmark/runs/${date}/PROMPT.md`).catch(
  () => {},
);
