import { mkdir, writeFile, readFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { races, laneResults, frames } from "./schema.js";
import type { Race, Lane } from "../../../packages/core/index.js";
const root = path.resolve(".data");
export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
      max: 5,
    })
  : undefined;
let db = pool ? drizzle(pool) : undefined;
export const storageMode = () => (db ? "postgres" : "local-files");
export const memory = new Map<string, Race>();
export async function initStore() {
  await mkdir(path.join(root, "races"), { recursive: true });
  await mkdir(path.join(root, "frames"), { recursive: true });
  if (pool)
    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS races(id text PRIMARY KEY,url text NOT NULL,journey jsonb NOT NULL,source text NOT NULL,engine_version text NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL,cache_key text NOT NULL,document jsonb NOT NULL);CREATE TABLE IF NOT EXISTS lane_results(race_id text NOT NULL REFERENCES races(id) ON DELETE CASCADE,lane text NOT NULL,status text NOT NULL,cost jsonb NOT NULL,est_seconds real NOT NULL,stopped_at_step integer,reason_code text,wcag jsonb NOT NULL,events jsonb NOT NULL,PRIMARY KEY(race_id,lane));CREATE TABLE IF NOT EXISTS frames(id text PRIMARY KEY,race_id text NOT NULL,lane text NOT NULL,t_index integer NOT NULL,jpeg bytea NOT NULL,width integer NOT NULL,height integer NOT NULL);CREATE TABLE IF NOT EXISTS deploy_checks(project_id text NOT NULL,deployment_id text PRIMARY KEY,race_id text NOT NULL,readiness_score real,regression jsonb NOT NULL);`,
      );
    } catch {
      db = undefined;
    }
  if (db) {
    for (const row of await db.select().from(races)) {
      const race = row.document;
      if (["queued", "running"].includes(race.status)) {
        race.status = "failed";
        race.error =
          "The engine restarted before this run completed. Start another race.";
      }
      memory.set(race.id, race);
    }
  } else
    for (const file of await readdir(path.join(root, "races"))) {
      if (!file.endsWith(".json")) continue;
      try {
        const race = JSON.parse(
          await readFile(path.join(root, "races", file), "utf8"),
        ) as Race;
        if (["queued", "running"].includes(race.status)) {
          race.status = "failed";
          race.error =
            "The engine restarted before this run completed. Start another race.";
        }
        memory.set(race.id, race);
      } catch {}
    }
}
export async function saveRace(race: Race) {
  memory.set(race.id, race);
  if (db)
    await db.transaction(async (tx) => {
      const row = {
        id: race.id,
        url: race.url,
        journey: race.journey,
        source: race.source,
        engineVersion: race.engineVersion,
        status: race.status,
        createdAt: new Date(race.createdAt),
        cacheKey: race.cacheKey,
        document: race,
      };
      await tx
        .insert(races)
        .values(row)
        .onConflictDoUpdate({ target: races.id, set: row });
      for (const r of race.results)
        await tx
          .insert(laneResults)
          .values({ raceId: race.id, ...r })
          .onConflictDoUpdate({
            target: [laneResults.raceId, laneResults.lane],
            set: r,
          });
    });
  else {
    const temp = path.join(root, "races", `${race.id}.${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(race));
    await rename(temp, path.join(root, "races", `${race.id}.json`));
  }
}
export async function saveFrame(
  raceId: string,
  jpeg: Buffer,
  lane: Lane,
  index: number,
) {
  const id = randomUUID();
  if (db)
    await db
      .insert(frames)
      .values({
        id,
        raceId,
        lane,
        tIndex: index,
        jpeg,
        width: lane === "zoom" ? 320 : lane === "budget" ? 412 : 1280,
        height: lane === "zoom" ? 512 : lane === "budget" ? 823 : 800,
      });
  else await writeFile(path.join(root, "frames", `${id}.jpg`), jpeg);
  return id;
}
export async function getFrame(id: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return undefined;
  if (db) {
    const row = await db.select().from(frames).where(eq(frames.id, id));
    if (row[0]) return row[0].jpeg;
  }
  try {
    return await readFile(path.join(root, "frames", `${id}.jpg`));
  } catch {
    try {
      return await readFile(path.resolve("benchmark/frames", `${id}.jpg`));
    } catch {
      return undefined;
    }
  }
}
export async function databaseHealth() {
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
