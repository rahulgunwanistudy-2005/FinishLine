import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  initStore,
  saveRace,
  saveFrame,
  getFrame,
  pool,
  databaseHealth,
  storageMode,
} from "../apps/web/server/store.js";
import type { Race } from "../packages/core/index.js";
if (!process.env.DATABASE_URL || !pool)
  throw new Error("Use a temporary test database through DATABASE_URL");
await initStore();
if (!(await databaseHealth()) || storageMode() !== "postgres")
  throw new Error("Postgres connection failed");
const race = JSON.parse(
  await readFile("benchmark/runs/2026-10-19/bakery-fixed.json", "utf8"),
) as Race;
race.id = randomUUID();
let frameId: string | undefined;
try {
  await saveRace(race);
  await saveRace(race);
  const frame = race.results.flatMap((l) => l.events).find((e) => e.frameId)!;
  const jpeg = await readFile(`benchmark/frames/${frame.frameId}.jpg`);
  frameId = await saveFrame(race.id, jpeg, "mouse", 0);
  const restored = await getFrame(frameId);
  if (!restored?.equals(jpeg)) throw new Error("JPEG round trip failed");
  const rows = await pool.query(
    "SELECT count(*) AS count FROM lane_results WHERE race_id=$1",
    [race.id],
  );
  if (Number(rows.rows[0].count) !== 6)
    throw new Error("Lane result upsert failed");
  const document = await pool.query("SELECT document FROM races WHERE id=$1", [
    race.id,
  ]);
  if (document.rows[0].document.results.length !== 6)
    throw new Error("Race document round trip failed");
  const report = {
    checkedAt: new Date().toISOString(),
    database: "isolated local Postgres 14",
    managedDeployxa: false,
    connected: true,
    raceRoundTrip: true,
    laneUpsertCount: 6,
    jpegRoundTrip: true,
  };
  await writeFile("docs/postgres-check.json", JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  if (frameId) await pool.query("DELETE FROM frames WHERE id=$1", [frameId]);
  await pool.query("DELETE FROM races WHERE id=$1", [race.id]);
  await pool.end();
}
