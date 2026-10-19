import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { writeFile } from "node:fs/promises";
const toolAliases: Record<string, string[]> = {
  deployxa_get_deployment_status: ["deployxa_get_deployment"],
  deployxa_get_readiness_score: ["deployxa_get_readiness"],
};
// Explicitly audited metadata reads only. A remote readOnlyHint is insufficient:
// AI tools can consume credits even when they do not change a deployment.
const allowedReadTools = new Set([
  "deployxa_list_projects",
  "deployxa_get_project",
  "deployxa_list_deployments",
  "deployxa_get_deployment_status",
  "deployxa_get_deployment",
  "deployxa_get_readiness_score",
  "deployxa_get_readiness",
  "deployxa_get_deployment_logs",
  "deployxa_get_organization_quota",
  "deployxa_get_organization_settings",
  "deployxa_get_repository_connection",
]);
export const spendingPolicy = {
  cashSpendingAllowed: false,
  cloudMutationsAllowed: false,
  aiRequestsAllowed: false,
};
export class Deployxa {
  client?: Client;
  tools: Tool[] = [];
  error = "DEPLOYXA_API_KEY is not configured.";
  connecting = false;
  async start(
    key = process.env.DEPLOYXA_API_KEY,
    pause = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {
    if (!key) return false;
    this.connecting = true;
    this.error = "Connecting to Deployxa…";
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (await this.connect(key)) return true;
        if (attempt < 2) await pause(1000 * (attempt + 1));
      }
      return false;
    } finally {
      this.connecting = false;
    }
  }
  async connect(key = process.env.DEPLOYXA_API_KEY, recordDiscovery = true) {
    if (!key) return false;
    const client = new Client({ name: "finish-line", version: "0.1.0" });
    try {
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL("https://mcp.deployxa.com/mcp"),
          {
            requestInit: { headers: { Authorization: `Bearer ${key}` } },
            fetch: (url, init) =>
              fetch(url, {
                ...init,
                signal: init?.signal
                  ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
                  : AbortSignal.timeout(15000),
              }),
          },
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
      await client.close().catch(() => {});
      this.client = undefined;
      this.tools = [];
      this.error = e instanceof Error ? e.message : "MCP connection failed";
      return false;
    }
  }
  has(name: string) {
    return !!this.tool(name);
  }
  canRead(name: string) {
    const tool = this.tool(name);
    return (
      !!tool &&
      allowedReadTools.has(tool.name) &&
      tool.annotations?.readOnlyHint === true
    );
  }
  private tool(name: string) {
    return [name, ...(toolAliases[name] ?? [])]
      .map((candidate) => this.tools.find((t) => t.name === candidate))
      .find((t) => !!t);
  }
  async call(name: string, values: Record<string, unknown> = {}) {
    if (!this.client || !this.has(name))
      throw new Error(`Deployxa capability unavailable: ${name}`);
    const tool = this.tool(name)!;
    if (!this.canRead(name))
      throw new Error(
        "Zero-spend policy permits only audited read-only metadata tools. Purchases, deployments, rollback and AI requests are blocked.",
      );
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
      { name: tool.name, arguments: args },
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
