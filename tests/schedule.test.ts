import { expect, it } from "vitest";
import {
  createLaneScheduler,
  laneConcurrency,
} from "../apps/engine/schedule.js";
import type { Lane, LaneResult } from "../packages/core/index.js";

it("keeps lanes unlimited unless ENGINE_LANE_CONCURRENCY is a positive whole number", () => {
  expect(laneConcurrency({})).toBeNull();
  expect(laneConcurrency({ ENGINE_LANE_CONCURRENCY: "" })).toBeNull();
  expect(laneConcurrency({ ENGINE_LANE_CONCURRENCY: " 2 " })).toBe(2);
  expect(laneConcurrency({ ENGINE_LANE_CONCURRENCY: "1" })).toBe(1);
  for (const bad of ["0", "-1", "1.5", "two", "2x"])
    expect(() => laneConcurrency({ ENGINE_LANE_CONCURRENCY: bad })).toThrow(
      /ENGINE_LANE_CONCURRENCY/,
    );
});

function fakeRun() {
  let active = 0;
  let peak = 0;
  const started: Lane[] = [];
  const release = new Map<Lane, () => void>();
  const run = async (lane: Lane) => {
    started.push(lane);
    active++;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => release.set(lane, resolve));
    active--;
    return { lane } as LaneResult;
  };
  return { run, started, release, peak: () => peak };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const six: Lane[] = [
  "mouse",
  "keyboard",
  "screenreader",
  "voice",
  "zoom",
  "budget",
];

it("starts every lane at once by default", async () => {
  const fake = fakeRun();
  const schedule = createLaneScheduler(null, fake.run as never);
  const all = Promise.all(six.map((lane) => schedule(lane, "", [])));
  await flush();
  expect(fake.started).toEqual(six);
  for (const done of fake.release.values()) done();
  await all;
  expect(fake.peak()).toBe(6);
});

it("calls runLane only when a slot frees, so queue time never reaches a lane budget", async () => {
  const fake = fakeRun();
  const schedule = createLaneScheduler(2, fake.run as never);
  const all = Promise.all(six.map((lane) => schedule(lane, "", [])));
  await flush();
  expect(fake.started).toEqual(["mouse", "keyboard"]);
  expect(schedule.state()).toEqual({ limit: 2, waiting: 4 });
  for (const [i, lane] of six.entries()) {
    fake.release.get(lane)!();
    await flush();
    expect(fake.started).toEqual(six.slice(0, Math.min(6, i + 3)));
  }
  const results = await all;
  expect(results.map((r) => r.lane)).toEqual(six);
  expect(fake.peak()).toBe(2);
});
