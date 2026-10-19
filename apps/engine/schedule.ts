import pLimit from "p-limit";
import { runLane } from "./lanes.js";

type RunLane = typeof runLane;

// Unset keeps every lane in parallel. Constrained hosts can cap concurrent lanes process-wide.
export function laneConcurrency(
  env: NodeJS.ProcessEnv = process.env,
): number | null {
  const raw = env.ENGINE_LANE_CONCURRENCY;
  const value = raw?.trim();
  if (!value) return null;
  if (!/^[1-9]\d*$/.test(value))
    throw new Error(
      `ENGINE_LANE_CONCURRENCY must be a positive whole number or unset; received “${raw}”.`,
    );
  return Number(value);
}

// runLane starts its 45 second budget and the budget phone's usable-time clock only when called,
// so time spent waiting for a slot is never charged to a lane.
export function createLaneScheduler(
  limit: number | null,
  run: RunLane = runLane,
) {
  const slots = limit ? pLimit(limit) : undefined;
  const schedule = (...args: Parameters<RunLane>) =>
    slots ? slots(() => run(...args)) : run(...args);
  return Object.assign(schedule, {
    state: () => ({ limit, waiting: slots?.pendingCount ?? 0 }),
  });
}

let shared: ReturnType<typeof createLaneScheduler> | undefined;
export function laneScheduler() {
  shared ??= createLaneScheduler(laneConcurrency());
  return shared;
}
export const scheduleLane = (...args: Parameters<RunLane>) =>
  laneScheduler()(...args);
