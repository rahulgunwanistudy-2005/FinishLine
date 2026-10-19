import { describe, it, expect } from "vitest";
import {
  RaceInputSchema,
  ScanInputSchema,
  regressions,
  speechSeconds,
  type LaneResult,
} from "../packages/core/index.js";
import { trustedRequest } from "../apps/engine/proxy.js";
import { isPublicAddress, assertPublicUrl } from "../apps/engine/security.js";
describe("URL boundaries", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "0.0.0.0",
    "224.0.0.1",
  ])("rejects %s", (ip) => expect(isPublicAddress(ip)).toBe(false));
  it("accepts public addresses", () => {
    expect(isPublicAddress("1.1.1.1")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });
  it("rejects credentialed, local and alternate-protocol targets before DNS", async () => {
    for (const url of [
      "http://localhost",
      "http://user:pass@example.com",
      "file:///etc/passwd",
      "http://example.com:8080",
    ])
      await expect(assertPublicUrl(url)).rejects.toThrow();
  });
  it("enforces three-step and URL length limits", () => {
    expect(
      RaceInputSchema.safeParse({ url: "ftp://example.com" }).success,
    ).toBe(false);
    expect(
      RaceInputSchema.safeParse({
        url: "https://example.com",
        journey: Array(4).fill({ label: "Go", target: { css: "button" } }),
      }).success,
    ).toBe(false);
  });
});
it("requires authorization and caps replayed preview actions", () => {
  const url = "https://example.com";
  const step = { label: "Go", target: { css: "button" } };
  expect(ScanInputSchema.safeParse({ url }).success).toBe(true);
  expect(ScanInputSchema.safeParse({ url, journey: [step] }).success).toBe(
    false,
  );
  expect(
    ScanInputSchema.safeParse({ url, journey: [step, step], authorized: true })
      .success,
  ).toBe(true);
  expect(
    ScanInputSchema.safeParse({
      url,
      journey: [step, step, step],
      authorized: true,
    }).success,
  ).toBe(false);
});
describe("results", () => {
  it("only gates a finished to DNF regression, never unknown", () => {
    const a = { lane: "keyboard", status: "finished" } as LaneResult;
    expect(regressions([a], [{ ...a, status: "dnf" }])).toEqual(["keyboard"]);
    expect(regressions([a], [{ ...a, status: "unknown" }])).toEqual([]);
  });
  it("keeps speech estimation separate from measured counts", () =>
    expect(speechSeconds("Add to cart button")).toBe(1));
});

it("keeps internal self-race permissions on explicit read-only resource paths", () => {
  const self = "http://127.0.0.1:3000/";
  expect(trustedRequest(self + "api/benchmark", self)).toBe(true);
  expect(trustedRequest(self + "api/races", self)).toBe(false);
  expect(trustedRequest("http://127.0.0.1:4000/api/benchmark", self)).toBe(
    false,
  );
  expect(trustedRequest(self + "api/benchmark")).toBe(false);
});
