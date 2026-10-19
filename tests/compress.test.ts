import { expect, it } from "vitest";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { compressJson } from "../apps/web/server/compress.js";
const payload = JSON.stringify({
  events: Array(100).fill({ kind: "focus", text: "Add to cart" }),
});
it.each(["br", "gzip"])(
  "delivers valid %s JSON with fewer bytes",
  async (encoding) => {
    const result = await compressJson(
      payload,
      "application/json; charset=utf-8",
      encoding,
    );
    expect(result?.encoding).toBe(encoding);
    expect(result!.body.length).toBeLessThan(Buffer.byteLength(payload));
    const decoded =
      encoding === "br"
        ? brotliDecompressSync(result!.body)
        : gunzipSync(result!.body);
    expect(decoded.toString()).toBe(payload);
  },
);
it("honors encoding preferences and explicit exclusions", async () => {
  expect(
    (await compressJson(payload, "application/json", "br;q=0.1, gzip;q=1"))
      ?.encoding,
  ).toBe("gzip");
  expect(
    (await compressJson(payload, "application/json", "*;q=1, br;q=0"))
      ?.encoding,
  ).toBe("gzip");
  expect(
    await compressJson(payload, "application/json", "br;q=0,gzip;q=0"),
  ).toBeUndefined();
  expect(
    await compressJson(payload, "application/json", "identity;q=1,br;q=0.5"),
  ).toBeUndefined();
});
it("leaves small responses and non-JSON evidence alone", async () => {
  expect(
    await compressJson("{}", "application/json", "br,gzip"),
  ).toBeUndefined();
  expect(await compressJson(payload, "image/jpeg", "br,gzip")).toBeUndefined();
  expect(
    await compressJson(payload, "text/event-stream", "br,gzip"),
  ).toBeUndefined();
});
