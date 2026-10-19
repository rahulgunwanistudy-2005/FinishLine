import { describe, expect, it, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Deployxa } from "../apps/web/server/deployxa.js";

function connection(tools: Tool[]) {
  const client = new Deployxa();
  const callTool = vi
    .fn()
    .mockResolvedValue({
      content: [{ type: "text", text: '{"status":"running"}' }],
    });
  client.client = { callTool } as unknown as Client;
  client.tools = tools;
  return { client, callTool };
}

describe("Deployxa read-only integration", () => {
  it.each(["deployxa_create_deployment", "deployxa_purchase_domain"])(
    "blocks %s before any network call",
    async (name) => {
      const { client, callTool } = connection([
        {
          name,
          inputSchema: { type: "object" },
          annotations: { readOnlyHint: false },
        },
      ]);
      await expect(client.call(name)).rejects.toThrow("read-only");
      expect(callTool).not.toHaveBeenCalled();
    },
  );
  it("fails closed when a tool lacks a read-only declaration", async () => {
    const { client, callTool } = connection([
      { name: "unknown", inputSchema: { type: "object" } },
    ]);
    await expect(client.call("unknown")).rejects.toThrow("read-only");
    expect(callTool).not.toHaveBeenCalled();
  });
  it.each([
    [
      "deployxa_get_deployment_status",
      "deployxa_get_deployment",
      "deploymentId",
    ],
    ["deployxa_get_readiness_score", "deployxa_get_readiness", "projectId"],
  ])(
    "resolves %s only to a discovered tool",
    async (requested, discovered, field) => {
      const { client, callTool } = connection([
        {
          name: discovered,
          annotations: { readOnlyHint: true },
          inputSchema: {
            type: "object",
            properties: { [field]: { type: "string" } },
            required: [field],
          },
        },
      ]);
      expect(client.has(requested)).toBe(true);
      await expect(client.call(requested)).rejects.toThrow("requires");
      expect(callTool).not.toHaveBeenCalled();
      expect(await client.call(requested, { [field]: "test-id" })).toEqual({
        status: "running",
      });
      expect(callTool.mock.calls[0][0]).toEqual({
        name: discovered,
        arguments: { [field]: "test-id" },
      });
      expect(client.has("not-discovered")).toBe(false);
    },
  );
});
