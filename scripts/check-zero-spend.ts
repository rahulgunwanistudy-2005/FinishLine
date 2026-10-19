import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const origin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000";
const health = await (await fetch(origin + "/health")).json();
assert.deepEqual(health.deployxa.spendingPolicy, {
  cashSpendingAllowed: false,
  cloudMutationsAllowed: false,
  aiRequestsAllowed: false,
});
const rollback = await fetch(origin + "/api/deployxa/sandbox/rollback", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    confirm: "any-project",
    deploymentId: "not-a-real-deployment",
  }),
});
const rollbackBody = await rollback.json();
assert.equal(rollback.status, 403);
assert.match(rollbackBody.error, /zero-spend/i);
const unauthorizedPreview = await fetch(origin + "/api/journey/scan", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: "https://example.com",
    journey: [{ label: "Go", target: { css: "a" } }],
    authorized: false,
  }),
});
assert.equal(unauthorizedPreview.status, 400);
const report = {
  checkedAt: new Date().toISOString(),
  origin,
  applicationPolicy: health.deployxa.spendingPolicy,
  rollback: { status: rollback.status, message: rollbackBody.error },
  unauthorizedPreviewStatus: unauthorizedPreview.status,
  cloudWritesPerformed: false,
  note: "Verifies application safeguards only. Does not alter or certify the provider's billing settings.",
};
await writeFile(
  "docs/zero-spend-check.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
