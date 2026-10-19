import "../apps/web/server/env.js";
import { writeFile } from "node:fs/promises";
import {
  Deployxa,
  records,
  spendingPolicy,
} from "../apps/web/server/deployxa.js";

// Inspection only: no create, deploy, upgrade, database or billing-write calls.
const client = new Deployxa();
try {
  if (!(await client.connect())) throw new Error(client.error);
  const quota = (await client.call(
    "deployxa_get_organization_quota",
  )) as Record<string, unknown>;
  const settings = (await client.call(
    "deployxa_get_organization_settings",
  )) as Record<string, unknown>;
  const projects = records(await client.call("deployxa_list_projects"));
  const repository = (await client.call(
    "deployxa_get_repository_connection",
  )) as Record<string, unknown>;
  const usage = (quota.usage ?? {}) as Record<string, unknown>;
  const spec = (quota.spec ?? {}) as Record<string, unknown>;
  const report = {
    checkedAt: new Date().toISOString(),
    authenticated: true,
    toolCount: client.tools.length,
    plan: quota.plan ?? null,
    projects: projects.length,
    repositoryConnected: repository.connected === true,
    included: {
      memory: spec.memory ?? null,
      storage: spec.storage ?? null,
      managedDatabases: spec.managedDatabases ?? null,
    },
    billing: {
      costCents: usage.costCents ?? null,
      costLimitCents: usage.costLimitCents ?? null,
      creditsCents: quota.creditsCents ?? null,
      autoTopUpEnabled: settings.autoTopUpEnabled ?? null,
    },
    zeroSpendConstraint: {
      applicationPolicy: spendingPolicy,
      hardZeroCapReported: usage.costLimitCents === 0,
      deploymentPerformed: false,
      resourceWritesPerformed: false,
      decision:
        "Read-only verification. Do not provision until zero-cost terms and an enforced zero-spend cap are verified.",
    },
    capabilities: {
      deploymentStatus: client.has("deployxa_get_deployment_status"),
      readiness: client.has("deployxa_get_readiness_score"),
      runtimeLogStreaming: client.has("deployxa_stream_runtime_logs"),
      runtimeLogRead: client.has("deployxa_get_deployment_logs"),
    },
  };
  await writeFile(
    "docs/deployxa-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await client.client?.close();
}
