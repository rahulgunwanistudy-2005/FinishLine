import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  real,
  primaryKey,
  customType,
} from "drizzle-orm/pg-core";
import type {
  Race,
  JourneyStep,
  LaneEvent,
} from "../../../packages/core/index.js";
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const races = pgTable("races", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  journey: jsonb("journey").$type<JourneyStep[]>().notNull(),
  source: text("source").notNull(),
  engineVersion: text("engine_version").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  cacheKey: text("cache_key").notNull(),
  document: jsonb("document").$type<Race>().notNull(),
});
export const laneResults = pgTable(
  "lane_results",
  {
    raceId: text("race_id")
      .references(() => races.id, { onDelete: "cascade" })
      .notNull(),
    lane: text("lane").notNull(),
    status: text("status").notNull(),
    cost: jsonb("cost").notNull(),
    estSeconds: real("est_seconds").notNull(),
    stoppedAtStep: integer("stopped_at_step"),
    reasonCode: text("reason_code"),
    wcag: jsonb("wcag").$type<readonly string[]>().notNull(),
    events: jsonb("events").$type<LaneEvent[]>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.raceId, t.lane] })],
);
export const frames = pgTable("frames", {
  id: text("id").primaryKey(),
  raceId: text("race_id").notNull(),
  lane: text("lane").notNull(),
  tIndex: integer("t_index").notNull(),
  jpeg: bytea("jpeg").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
});
export const deployChecks = pgTable("deploy_checks", {
  projectId: text("project_id").notNull(),
  deploymentId: text("deployment_id").primaryKey(),
  raceId: text("race_id").notNull(),
  readinessScore: real("readiness_score"),
  regression: jsonb("regression").notNull(),
});
