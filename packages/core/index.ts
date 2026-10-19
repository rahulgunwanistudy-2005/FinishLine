import { lanes, reasons } from "./model.js";
export * from "./model.js";
import { z } from "zod";
export const ENGINE_VERSION = "0.4.0";
export const LaneSchema = z.enum(lanes);
export type Lane = z.infer<typeof LaneSchema>;
export type ReasonCode = keyof typeof reasons;
export const JourneyStepSchema = z.object({
  label: z.string().min(1).max(200),
  target: z.object({
    role: z.string().max(80).optional(),
    name: z.string().max(300).optional(),
    css: z.string().min(1).max(500),
    text: z.string().max(300).optional(),
  }),
  expect: z
    .object({
      urlIncludes: z.string().max(500).optional(),
      selectorAppears: z.string().max(500).optional(),
    })
    .optional(),
});
export type JourneyStep = z.infer<typeof JourneyStepSchema>;
export const RaceInputSchema = z.object({
  url: z
    .string()
    .url()
    .max(2048)
    .refine((v) => /^https?:\/\//i.test(v), "Use an http or https URL"),
  journey: z.array(JourneyStepSchema).min(1).max(3).optional(),
});
export const ScanInputSchema = z
  .object({
    url: RaceInputSchema.shape.url,
    journey: z.array(JourneyStepSchema).max(2).default([]),
    authorized: z.boolean().default(false),
  })
  .refine((input) => !input.journey.length || input.authorized, {
    message: "Confirm you are authorized before previewing actions.",
    path: ["authorized"],
  });
export type Box = { x: number; y: number; w: number; h: number };
export type LaneEvent = {
  i: number;
  kind:
    | "focus"
    | "announce"
    | "command"
    | "scroll"
    | "activate"
    | "wait"
    | "finish"
    | "dnf"
    | "unknown";
  step: number;
  box?: Box;
  text?: string;
  frameId?: string;
  costDelta: number;
  estSecondsDelta: number;
};
export type LaneResult = {
  lane: Lane;
  status: "finished" | "dnf" | "unknown";
  cost: {
    unit:
      "clicks" | "keys" | "announcements" | "commands" | "screens" | "seconds";
    value: number;
  };
  estSeconds: number;
  stoppedAtStep: number | null;
  reasonCode: ReasonCode | null;
  wcag: readonly string[];
  events: LaneEvent[];
};
export type Race = {
  id: string;
  url: string;
  title?: string;
  journey: JourneyStep[];
  source: "benchmark" | "public" | "deploy" | "fixture" | "self";
  engineVersion: string;
  status: "queued" | "running" | "done" | "failed" | "invalid_journey";
  createdAt: string;
  cacheKey: string;
  results: LaneResult[];
  queuePosition?: number;
  error?: string;
  deployxaProjectId?: string;
  deployxaDeploymentId?: string;
};
