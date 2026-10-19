import { createServer } from "node:http";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { laneConcurrency, scheduleLane } from "../apps/engine/schedule.js";
import { closeBrowser } from "../apps/engine/browser.js";
import {
  lanes,
  ENGINE_VERSION,
  type JourneyStep,
  type Lane,
  type LaneResult,
} from "../packages/core/index.js";
const server = createServer(async (req, res) => {
  try {
    const name = (req.url ?? "").slice(1);
    if (!/^[a-z-]+\.html$/.test(name)) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(await readFile(`packages/fixtures/${name}`));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("No fixture port");
const rows = [];
let failures = 0;
try {
  for (const file of (await readdir("packages/fixtures"))
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    const fixture = JSON.parse(
      await readFile(`packages/fixtures/${file}`, "utf8"),
    ) as {
      journey: JourneyStep[];
      expected: Record<Lane, { status: string; reasonCode: string | null }>;
    };
    const name = file.replace(".json", "");
    const url = `http://127.0.0.1:${address.port}/${name}.html`;
    const results = await Promise.all(
      lanes.map((lane) => scheduleLane(lane, url, fixture.journey, {}, url)),
    );
    const cells = results.map((result: LaneResult) => {
      const expected = fixture.expected[result.lane];
      const pass =
        expected.status === result.status &&
        expected.reasonCode === result.reasonCode;
      if (!pass) failures++;
      return {
        lane: result.lane,
        pass,
        expected,
        actual: {
          status: result.status,
          reasonCode: result.reasonCode,
          cost: result.cost,
        },
        detail: result.events.at(-1)?.text,
      };
    });
    rows.push({ fixture: name, cells });
    console.log(
      `${name}: ${cells.map((c) => `${c.lane} ${c.pass ? "PASS" : `FAIL (${c.actual.status}/${c.actual.reasonCode})`}`).join(" | ")}`,
    );
  }
  await writeFile(
    "docs/matrix.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engineVersion: ENGINE_VERSION,
        laneConcurrency: laneConcurrency() ?? "unlimited",
        total: rows.length * lanes.length,
        passed: rows.length * lanes.length - failures,
        rows,
      },
      null,
      2,
    ),
  );
} finally {
  server.close();
  await closeBrowser();
}
if (failures) process.exitCode = 1;
