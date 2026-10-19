import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import pLimit from "p-limit";
import {
  ENGINE_VERSION,
  lanes,
  type Race,
  type JourneyStep,
} from "../../../packages/core/index.js";
import { laneScheduler } from "../../engine/schedule.js";
import { scan } from "../../engine/inspect.js";
import { assertPublicUrl } from "../../engine/security.js";
import { memory, saveFrame, saveRace } from "./store.js";
export const bus = new EventEmitter();
bus.setMaxListeners(200);
const limit = pLimit(2);
// Validates ENGINE_LANE_CONCURRENCY at startup instead of on the first race.
const lanesScheduler = laneScheduler();
const waiting: string[] = [];
let logRace: (
  data: Record<string, unknown>,
  message: string,
) => void = () => {};
export function setRaceLogger(logger: typeof logRace) {
  logRace = logger;
}
export function queueState() {
  return {
    active: limit.activeCount,
    waiting: limit.pendingCount,
    lanes: lanesScheduler.state(),
  };
}
type RaceOptions = {
  source?: Race["source"];
  title?: string;
  trustedUrl?: string;
  force?: boolean;
};
const preparing = new Map<string, Promise<Race>>();
export async function createRace(
  input: { url: string; journey?: JourneyStep[] },
  options: RaceOptions = {},
) {
  if (!options.trustedUrl) await assertPublicUrl(input.url);
  const key = JSON.stringify([
    input.url,
    input.journey ?? null,
    ENGINE_VERSION,
  ]);
  if (!options.force) {
    const pending = preparing.get(key);
    if (pending) return pending;
  }
  const pending = createRaceImpl(input, options);
  if (!options.force) preparing.set(key, pending);
  try {
    return await pending;
  } finally {
    if (preparing.get(key) === pending) preparing.delete(key);
  }
}
async function createRaceImpl(
  input: { url: string; journey?: JourneyStep[] },
  options: {
    source?: Race["source"];
    title?: string;
    trustedUrl?: string;
    force?: boolean;
  } = {},
) {
  const cacheKey = createHash("sha256")
    .update(JSON.stringify([input.url, input.journey ?? null, ENGINE_VERSION]))
    .digest("hex");
  if (!options.force) {
    const cached = [...memory.values()].find(
      (r) =>
        r.cacheKey === cacheKey &&
        Date.now() - Date.parse(r.createdAt) < 600000 &&
        !["failed", "invalid_journey"].includes(r.status),
    );
    if (cached) return cached;
  }
  if (limit.pendingCount >= 20)
    throw new Error("The race queue is full. Try again shortly.");
  let journey = input.journey;
  if (!journey) {
    const scanned = await scan(input.url);
    const element = scanned.elements.find((e) =>
      /add to cart|buy|checkout|sign up|subscribe|submit|book/i.test(e.label),
    );
    if (!element)
      throw new Error(
        "No default journey found. Use the journey picker to choose a control.",
      );
    journey = [{ label: element.label, target: element.target }];
  }
  const race: Race = {
    id: randomUUID(),
    url: input.url,
    journey,
    source: options.source ?? "public",
    title: options.title,
    engineVersion: ENGINE_VERSION,
    status: "queued",
    createdAt: new Date().toISOString(),
    cacheKey,
    results: [],
    queuePosition: limit.pendingCount + 1,
  };
  await saveRace(race);
  waiting.push(race.id);
  void limit(async () => {
    waiting.splice(waiting.indexOf(race.id), 1);
    for (const [i, id] of waiting.entries()) {
      const queued = memory.get(id);
      if (queued) {
        queued.queuePosition = i + 1;
        bus.emit(id, "snapshot", queued);
      }
    }
    race.status = "running";
    race.queuePosition = 0;
    await saveRace(race);
    logRace({ raceId: race.id, status: race.status }, "Race started");
    bus.emit(race.id, "snapshot", race);
    try {
      // Each lane owns an isolated context. A mouse failure invalidates the journey after every context is safely closed.
      // ENGINE_LANE_CONCURRENCY may hold lanes for a slot; each lane's budget starts when it runs.
      await Promise.all(
        lanes.map(async (lane) => {
          const result = await lanesScheduler(
            lane,
            race.url,
            race.journey,
            {
              frame: (jpeg, lane, index) =>
                saveFrame(race.id, jpeg, lane, index),
              event: (lane, event) =>
                bus.emit(race.id, "progress", { lane, event }),
            },
            options.trustedUrl,
          );
          race.results.push(result);
          bus.emit(race.id, "lane", result);
        }),
      );
      race.results.sort(
        (a, b) => lanes.indexOf(a.lane) - lanes.indexOf(b.lane),
      );
      race.status =
        race.results.find((r) => r.lane === "mouse")?.status === "finished"
          ? "done"
          : "invalid_journey";
      if (race.status === "invalid_journey")
        race.error =
          "Journey couldn’t be completed with a mouse; pick again. Other lane observations are diagnostic, not valid race results.";
    } catch (e) {
      race.status = "failed";
      race.error = e instanceof Error ? e.message : "The engine failed.";
    }
    await saveRace(race);
    logRace({ raceId: race.id, status: race.status }, "Race completed");
    bus.emit(race.id, "done", race);
  }).catch(async (e) => {
    race.status = "failed";
    race.error = String(e);
    await saveRace(race);
    logRace({ raceId: race.id, status: race.status }, "Race completed");
    bus.emit(race.id, "done", race);
  });
  return race;
}
export async function waitForRace(id: string) {
  const race = memory.get(id);
  if (!race) throw new Error("Race not found");
  if (!["queued", "running"].includes(race.status)) return race;
  return new Promise<Race>((resolve, reject) => {
    const listener = (kind: string, data: Race) => {
      if (kind === "done") {
        cleanup();
        resolve(data);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Race is still queued or running. Use get_race to check again.",
        ),
      );
    }, 90000);
    const cleanup = () => {
      clearTimeout(timer);
      bus.off(id, listener);
    };
    bus.on(id, listener);
  });
}
