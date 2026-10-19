import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { JourneyStepSchema } from "../../../packages/core/index.js";
import { createRace, waitForRace } from "./runner.js";
import { memory } from "./store.js";
export function registerMcp(app: FastifyInstance) {
  app.post(
    "/mcp",
    { config: { rateLimit: { max: 5, timeWindow: 600000 } } },
    async (req, reply) => {
      const server = new McpServer({ name: "finish-line", version: "0.1.0" });
      server.registerTool(
        "race_url",
        {
          description:
            "Drive a public URL through six isolated Chromium input-method lanes. Counts are measured; human times are estimates. An active journey may submit forms. Use only a journey you are authorized to run.",
          inputSchema: {
            url: z.string().url().max(2048),
            journey: z.array(JourneyStepSchema).min(1).max(3).optional(),
          },
        },
        async (input) => {
          try {
            const race = await createRace(input);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(await waitForRace(race.id)),
                },
              ],
            };
          } catch (e) {
            return {
              isError: true,
              content: [{ type: "text", text: String(e) }],
            };
          }
        },
      );
      server.registerTool(
        "get_race",
        {
          description: "Get a recorded or live Finish Line race by ID.",
          inputSchema: { id: z.string().uuid() },
        },
        async ({ id }) => ({
          content: [
            {
              type: "text",
              text: JSON.stringify(
                memory.get(id) ?? { error: "Race not found" },
              ),
            },
          ],
        }),
      );
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      reply.hijack();
      reply.raw.on("close", () => {
        void transport.close();
        void server.close();
      });
      await transport.handleRequest(req.raw, reply.raw, req.body);
    },
  );
}
