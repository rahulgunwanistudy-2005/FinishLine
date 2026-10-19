import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { writeFile } from "node:fs/promises";
export class Deployxa {
  client?: Client;
  tools: Tool[] = [];
  error = "DEPLOYXA_API_KEY is not configured.";
  async connect(key = process.env.DEPLOYXA_API_KEY, recordDiscovery = true) {
    if (!key) return false;
    try {
      const client = new Client({ name: "finish-line", version: "0.1.0" });
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL("https://mcp.deployxa.com/mcp"),
          { requestInit: { headers: { Authorization: `Bearer ${key}` } } },
        ),
        { timeout: 8000 },
      );
      const discovered: Tool[] = [];
      let cursor: string | undefined;
      do {
        const listed = await client.listTools(cursor ? { cursor } : undefined, {
          timeout: 8000,
        });
        discovered.push(...listed.tools);
        cursor = listed.nextCursor;
        if (discovered.length > 500)
          throw new Error("Tool discovery exceeded its safety cap.");
      } while (cursor);
      this.client = client;
      this.tools = discovered;
      this.error = "";
      if (recordDiscovery)
        await writeFile(
          "docs/deployxa-tools.json",
          JSON.stringify(
            {
              checkedAt: new Date().toISOString(),
              authenticated: true,
              endpoint: "https://mcp.deployxa.com/mcp",
              tools: this.tools,
            },
            null,
            2,
          ),
        );
      return true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "MCP connection failed";
      return false;
    }
  }
  has(name: string) {
    return this.tools.some((t) => t.name === name);
  }
  async call(name: string, values: Record<string, unknown> = {}) {
    if (!this.client || !this.has(name))
      throw new Error(`Deployxa capability unavailable: ${name}`);
    const tool = this.tools.find((t) => t.name === name)!;
    const properties = tool.inputSchema.properties ?? {};
    const args: Record<string, unknown> = {};
    for (const key of Object.keys(properties)) {
      const normalized = key.replace(/_/g, "").toLowerCase();
      const match = Object.keys(values).find(
        (k) => k.replace(/_/g, "").toLowerCase() === normalized,
      );
      if (match) args[key] = values[match];
    }
    const missing = (tool.inputSchema.required ?? []).filter(
      (k) => !(k in args),
    );
    if (missing.length)
      throw new Error(
        `The discovered ${name} schema requires ${missing.join(", ")}. Configure this integration against its actual schema.`,
      );
    const result = await this.client.callTool(
      { name, arguments: args },
      undefined,
      { timeout: 15000 },
    );
    if (result.isError)
      throw new Error(
        "Deployxa returned a tool error. Inspect deployment health in the dashboard.",
      );
    if (result.structuredContent) return result.structuredContent;
    const text = (result.content as { type: string; text?: string }[])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { message: text };
    }
  }
  async health() {
    if (!this.client) return false;
    try {
      await this.client.ping({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}
export const deployxa = new Deployxa();
export function records(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data))
    return data.filter((v) => v && typeof v === "object");
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["projects", "deployments", "data", "items"])
      if (obj[key]) return records(obj[key]);
  }
  return [];
}
