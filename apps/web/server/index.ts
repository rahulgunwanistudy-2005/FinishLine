import "./env.js";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  ENGINE_VERSION,
  RaceInputSchema,
  ScanInputSchema,
  regressions,
  type Race,
} from "../../../packages/core/index.js";
import { getBrowser, healthBrowser } from "../../engine/browser.js";
import { scan } from "../../engine/inspect.js";
import { assertPublicUrl } from "../../engine/security.js";
import {
  initStore,
  memory,
  getFrame,
  databaseHealth,
  saveRace,
  storageMode,
} from "./store.js";
import { createRace, bus, queueState, setRaceLogger } from "./runner.js";
import { deployxa, records, Deployxa, spendingPolicy } from "./deployxa.js";
import { registerMcp } from "./mcp.js";
import { compressJson } from "./compress.js";
const port = Number(process.env.PORT ?? 3000);
const app = Fastify({
  logger: { redact: ["req.headers.authorization", "req.headers.cookie"] },
  bodyLimit: 32768,
  requestTimeout: 100000,
});
setRaceLogger((data, message) => app.log.info(data, message));
await app.register(rateLimit, { global: false });
app.addHook("onRequest", async (req, reply) => {
  const origin = req.headers.origin;
  if (
    origin &&
    origin !== `http://${req.headers.host}` &&
    origin !== `https://${req.headers.host}` &&
    origin !== process.env.PUBLIC_ORIGIN
  ) {
    reply.code(403).send({ error: "Cross-origin requests are not allowed." });
  }
});
app.addHook("onSend", async (req, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "no-referrer");
  if (typeof payload === "string" && !reply.hasHeader("Content-Encoding")) {
    const compressed = await compressJson(
      payload,
      String(reply.getHeader("Content-Type") ?? ""),
      req.headers["accept-encoding"] ?? "",
    );
    if (compressed) {
      const vary = String(reply.getHeader("Vary") ?? "");
      reply.header(
        "Vary",
        vary ? `${vary}, Accept-Encoding` : "Accept-Encoding",
      );
      reply.header("Content-Encoding", compressed.encoding);
      reply.removeHeader("Content-Length");
      return compressed.body;
    }
  }
  return payload;
});
app.setErrorHandler((error, _req, reply) => {
  const err = error as Error & { statusCode?: number };
  reply.code(err instanceof z.ZodError ? 400 : (err.statusCode ?? 400)).send({
    error:
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join("; ")
        : err.message,
  });
});
await initStore();
const recordings: Race[] = [];
async function loadRecordings(dir: string) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(
    () => [],
  )) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await loadRecordings(file);
    else if (entry.name.endsWith(".json")) {
      try {
        const race = JSON.parse(await readFile(file, "utf8")) as Race;
        if (race.id && race.results && race.status === "done") {
          memory.set(race.id, race);
          recordings.push(race);
        }
      } catch {}
    }
  }
}
await loadRecordings("benchmark/runs");
const fixtureNames = ["bakery-original", "bakery-fixed"];
app.get("/fixtures/:name", async (req, reply) => {
  const { name } = req.params as { name: string };
  if (!/^[a-z-]+\.html$/.test(name))
    return reply.code(404).send({ error: "Fixture not found" });
  try {
    return reply
      .type("text/html")
      .send(await readFile(path.resolve("packages/fixtures", name)));
  } catch {
    return reply.code(404).send({ error: "Fixture not found" });
  }
});
app.get("/api/benchmark", async () => ({
  races: recordings,
  buildersPending: true,
}));
app.get("/api/matrix", async () => {
  try {
    return JSON.parse(await readFile("docs/matrix.json", "utf8")) as unknown;
  } catch {
    return {
      checkedAt: null,
      rows: [],
      note: "Correctness matrix has not been run.",
    };
  }
});
app.get("/api/health", async () => health());
app.get("/health", async () => health());
app.get("/health/engine", async (_req, reply) => {
  const browser = await getBrowser();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto("https://example.com", { timeout: 15000 });
    return reply
      .type("image/jpeg")
      .send(await page.screenshot({ type: "jpeg", quality: 65 }));
  } finally {
    await context.close();
  }
});
async function health() {
  async function bounded(check: () => Promise<boolean>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        check(),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 4000);
        }),
      ]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  const [database, chromium, mcp] = await Promise.all([
    bounded(databaseHealth),
    bounded(healthBrowser),
    bounded(() => deployxa.health()),
  ]);
  return {
    database: {
      ok: database,
      mode: storageMode(),
      note:
        storageMode() === "postgres"
          ? undefined
          : process.env.DATABASE_URL
            ? "Postgres was unavailable at boot; local durable files are active."
            : "Postgres is not configured; local durable files are active.",
    },
    engine: { ok: chromium, chromium, version: ENGINE_VERSION },
    deployxa: {
      ok: mcp,
      toolCount: deployxa.tools.length,
      reason: deployxa.error || undefined,
      capabilities: deployxa.tools.map((t) => t.name),
      spendingPolicy,
    },
    benchmark: {
      ok: recordings.length > 0,
      count: recordings.length,
      kind: recordings.some((r) => r.source === "benchmark")
        ? "includes-builder-recordings"
        : "controlled-fixtures-only",
    },
    queue: queueState(),
  };
}
app.post(
  "/api/races",
  { config: { rateLimit: { max: 5, timeWindow: 600000 } } },
  async (req, reply) => {
    const input = RaceInputSchema.parse(req.body);
    const race = await createRace(input);
    return reply
      .code(202)
      .send({ id: race.id, queuePosition: race.queuePosition });
  },
);
app.post(
  "/api/fixtures/:name/race",
  { config: { rateLimit: { max: 5, timeWindow: 600000 } } },
  async (req, reply) => {
    const { name } = req.params as { name: string };
    if (!fixtureNames.includes(name))
      return reply.code(404).send({ error: "Fixture not found" });
    const url = `http://127.0.0.1:${port}/fixtures/${name}.html`;
    const race = await createRace(
      {
        url,
        journey: [
          {
            label: "Add to cart",
            target: { css: "#add-first" },
            expect: { selectorAppears: "#added:not(:empty)" },
          },
          {
            label: "Open cart",
            target: { css: "#open-cart" },
            expect: { selectorAppears: "#cart" },
          },
          {
            label: "Checkout",
            target: { css: "#checkout-button" },
            expect: { selectorAppears: "#checkout" },
          },
        ],
      },
      {
        source: "fixture",
        title:
          name === "bakery-original"
            ? "Corner bakery / original"
            : "Corner bakery / repaired",
        trustedUrl: url,
      },
    );
    return reply.code(202).send({ id: race.id });
  },
);
app.get("/api/races/:id", async (req, reply) => {
  const race = memory.get((req.params as { id: string }).id);
  return race ?? reply.code(404).send({ error: "Race not found" });
});
app.get("/api/races/:id/events", async (req, reply) => {
  const id = (req.params as { id: string }).id;
  const race = memory.get(id);
  if (!race) return reply.code(404).send({ error: "Race not found" });
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (kind: string, data: unknown) =>
    res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`);
  send("snapshot", race);
  if (!["queued", "running"].includes(race.status)) {
    send("done", race);
    res.end();
    return;
  }
  const listener = (kind: string, data: unknown) => {
    send(kind, data);
    if (kind === "done") res.end();
  };
  bus.on(id, listener);
  const ping = setInterval(() => res.write(": heartbeat\n\n"), 15000);
  req.raw.on("close", () => {
    clearInterval(ping);
    bus.off(id, listener);
  });
});
app.get("/api/frames/:id", async (req, reply) => {
  const jpeg = await getFrame((req.params as { id: string }).id);
  return jpeg
    ? reply
        .type("image/jpeg")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .send(jpeg)
    : reply.code(404).send({ error: "Frame not found" });
});
app.post(
  "/api/journey/scan",
  { config: { rateLimit: { max: 5, timeWindow: 600000 } } },
  async (req) => {
    const { url, journey } = ScanInputSchema.parse(req.body);
    await assertPublicUrl(url);
    return scan(url, journey);
  },
);
app.get("/api/deployxa/projects", async () => ({
  connected: !!deployxa.client,
  connecting: deployxa.connecting,
  configured: !!process.env.DEPLOYXA_API_KEY,
  reason: deployxa.error,
  capabilities: deployxa.tools.map((t) => t.name),
  projects: deployxa.has("deployxa_list_projects")
    ? records(await deployxa.call("deployxa_list_projects"))
    : [],
}));
app.get("/api/deployxa/projects/:id/deployments", async (req) => {
  const { id } = req.params as { id: string };
  const deployments = deployxa.has("deployxa_list_deployments")
    ? records(
        await deployxa.call("deployxa_list_deployments", { projectId: id }),
      )
    : [];
  const readiness = deployxa.has("deployxa_get_readiness_score")
    ? await deployxa
        .call("deployxa_get_readiness_score", { projectId: id })
        .catch(() => null)
    : null;
  return {
    deployments,
    readiness,
    races: [...memory.values()].filter((r) => r.deployxaProjectId === id),
  };
});
app.post(
  "/api/deployxa/deployments/:id/race",
  { config: { rateLimit: { max: 5, timeWindow: 600000 } } },
  async (req) => {
    const { id } = z
      .object({ id: z.string().min(1).max(200) })
      .parse(req.params);
    const input = z
      .object({
        projectId: z.string().min(1),
        journey: z
          .array(RaceInputSchema.shape.journey.unwrap().element)
          .min(1)
          .max(3)
          .optional(),
      })
      .parse(req.body);
    let deployment: Record<string, unknown> = {};
    const end = Date.now() + 120000;
    while (Date.now() < end) {
      const data = await deployxa.call("deployxa_get_deployment_status", {
        deploymentId: id,
        projectId: input.projectId,
      });
      deployment = data as Record<string, unknown>;
      const status = String(deployment.status ?? "").toLowerCase();
      if (
        [
          "healthy",
          "live",
          "ready",
          "success",
          "succeeded",
          "running",
        ].includes(status)
      )
        break;
      if (["failed", "error", "cancelled"].includes(status)) {
        const diagnosis = deployxa.canRead("deployxa_diagnose_deployment")
          ? await deployxa.call("deployxa_diagnose_deployment", {
              deploymentId: id,
              projectId: input.projectId,
            })
          : "Deployment is unhealthy";
        throw new Error(JSON.stringify(diagnosis));
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    const url = String(deployment.url ?? deployment.deployment_url ?? "");
    if (
      !url ||
      !["healthy", "live", "ready", "success", "succeeded", "running"].includes(
        String(deployment.status).toLowerCase(),
      )
    )
      throw new Error(
        "Deployxa did not report a healthy deployment URL within 120 seconds.",
      );
    const savedJourney = [...memory.values()]
      .filter(
        (r) => r.deployxaProjectId === input.projectId && r.status === "done",
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.journey;
    const race = await createRace(
      { url, journey: input.journey ?? savedJourney },
      { source: "deploy" },
    );
    race.deployxaProjectId = input.projectId;
    race.deployxaDeploymentId = id;
    await saveRace(race);
    return { id: race.id };
  },
);
app.get("/api/deployxa/gate/:raceId", async (req) => {
  const race = memory.get((req.params as { raceId: string }).raceId);
  if (!race) return { error: "Race not found" };
  const previous = [...memory.values()]
    .filter(
      (r) =>
        r.id !== race.id &&
        r.deployxaProjectId &&
        r.deployxaProjectId === race.deployxaProjectId &&
        r.status === "done" &&
        r.createdAt < race.createdAt,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    previousRaceId: previous?.id ?? null,
    regressions:
      previous && race.status === "done"
        ? regressions(previous.results, race.results)
        : [],
    complete: race.status === "done",
  };
});
app.post("/api/deployxa/sandbox/rollback", async (req) => {
  if (!spendingPolicy.cloudMutationsAllowed)
    throw Object.assign(
      new Error(
        "Rollback is disabled by the zero-spend policy. No cloud changes are allowed.",
      ),
      { statusCode: 403 },
    );
  const token = process.env.SANDBOX_ADMIN_TOKEN;
  const supplied = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
  if (
    !token ||
    Buffer.byteLength(token) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(supplied))
  )
    throw Object.assign(
      new Error("Sandbox administrator authentication required."),
      { statusCode: 403 },
    );
  const { confirm, deploymentId } = z
    .object({ confirm: z.string(), deploymentId: z.string() })
    .parse(req.body);
  if (
    !process.env.DEPLOYXA_SANDBOX_PROJECT_ID ||
    !process.env.DEPLOYXA_SANDBOX_PROJECT_NAME ||
    confirm !== process.env.DEPLOYXA_SANDBOX_PROJECT_NAME
  )
    throw new Error("Type the configured sandbox project name to confirm.");
  const sandbox = new Deployxa();
  if (
    !process.env.DEPLOYXA_SANDBOX_KEY ||
    !(await sandbox.connect(process.env.DEPLOYXA_SANDBOX_KEY, false))
  )
    throw new Error("Sandbox key unavailable.");
  try {
    const deployment = (await sandbox.call("deployxa_get_deployment_status", {
      deploymentId,
      projectId: process.env.DEPLOYXA_SANDBOX_PROJECT_ID,
    })) as Record<string, unknown>;
    if (
      String(deployment.project_id ?? deployment.projectId) !==
      process.env.DEPLOYXA_SANDBOX_PROJECT_ID
    )
      throw new Error("The deployment does not belong to the sandbox project.");
    const result = await sandbox.call("deployxa_rollback_deployment", {
      projectId: process.env.DEPLOYXA_SANDBOX_PROJECT_ID,
      deploymentId,
      confirmed: true,
    });
    app.log.info({
      action: "sandbox_rollback",
      deploymentId,
      projectId: process.env.DEPLOYXA_SANDBOX_PROJECT_ID,
    });
    return result;
  } finally {
    await sandbox.client?.close();
  }
});
registerMcp(app);
if (process.env.NODE_ENV === "production") {
  await app.register(fastifyStatic, {
    root: path.resolve("dist"),
    wildcard: false,
    preCompressed: true,
  });
  app.setNotFoundHandler(async (req, reply) =>
    req.url.startsWith("/api/")
      ? reply.code(404).send({ error: "Not found" })
      : reply.sendFile("index.html"),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { server: app.server } },
    appType: "spa",
  });
  app.addHook("onClose", () => vite.close());
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api/"))
      return reply.code(404).send({ error: "Not found" });
    reply.hijack();
    vite.middlewares(req.raw, reply.raw, () => {
      reply.raw.statusCode = 404;
      reply.raw.end("Not found");
    });
  });
}
await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
void getBrowser().catch((e) =>
  app.log.error({ error: String(e) }, "Chromium unavailable"),
);
void deployxa.start();
process.on("SIGTERM", () => {
  void app.close().then(() => process.exit(0));
});
