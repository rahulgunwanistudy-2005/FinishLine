import { writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Race } from "../packages/core/index.js";
const origin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000";
const report: Record<string, unknown> = { checkedAt: new Date().toISOString() };
async function post(url: string, body: unknown) {
  return fetch(origin + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
for (const url of [
  "http://127.0.0.1",
  "file:///etc/passwd",
  "http://169.254.169.254/latest/meta-data",
]) {
  const res = await post("/api/races", {
    url,
    journey: [{ label: "Go", target: { css: "button" } }],
  });
  if (res.ok) throw new Error("SSRF boundary failed");
  report[url] = res.status;
}
const scanned = await post("/api/journey/scan", { url: "https://example.com" });
if (!scanned.ok) throw new Error(await scanned.text());
report.scan = await scanned.json();
const input = {
  url: `https://example.com/?finish-line=${Date.now()}`,
  journey: [
    {
      label: "Learn more",
      target: { css: "a" },
      expect: { urlIncludes: "iana.org" },
    },
  ],
};
const res = await post("/api/races", input);
if (!res.ok) throw new Error(await res.text());
const { id } = (await res.json()) as { id: string };
const cached = await post("/api/races", input);
const duplicate = (await cached.json()) as { id: string };
if (id !== duplicate.id) throw new Error("Cache did not deduplicate");
report.idempotency = true;
const stream = await fetch(`${origin}/api/races/${id}/events`);
const reader = stream.body!.getReader();
const decoder = new TextDecoder();
let wire = "";
const deadline = Date.now() + 95000;
while (Date.now() < deadline) {
  const { done, value } = await reader.read();
  if (done) break;
  wire += decoder.decode(value);
  if (wire.includes("event: done")) break;
}
await reader.cancel();
report.sse = {
  progressEvents: (wire.match(/event: progress/g) ?? []).length,
  done: wire.includes("event: done"),
};
const race = (await (await fetch(`${origin}/api/races/${id}`)).json()) as Race;
report.publicRace = {
  id: race.id,
  status: race.status,
  results: race.results.map((r) => ({
    lane: r.lane,
    status: r.status,
    reason: r.reasonCode,
    detail: r.events.at(-1)?.text,
  })),
};
const client = new Client({ name: "finish-line-smoke", version: "1" });
try {
  await client.connect(
    new StreamableHTTPClientTransport(new URL(origin + "/mcp")),
  );
  report.mcpTools = (await client.listTools()).tools.map((t) => t.name);
  report.mcpGetRace = !(
    await client.callTool({ name: "get_race", arguments: { id } })
  ).isError;
} finally {
  await client.close();
}
const scan = report.scan as { screenshot?: string };
delete scan.screenshot;
await writeFile("docs/api-smoke.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (race.status !== "done" || race.results.some((r) => r.status !== "finished"))
  process.exitCode = 1;
