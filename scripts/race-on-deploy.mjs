import { setTimeout as delay } from "node:timers/promises";
let text = "";
for await (const chunk of process.stdin) text += chunk;
const deployment = JSON.parse(text);
const id = deployment.id ?? deployment.deployment_id;
const projectId = deployment.project_id ?? process.env.DEPLOYXA_PROJECT_ID;
if (
  !id ||
  !projectId ||
  !process.env.FINISH_LINE_ORIGIN ||
  !process.env.FINISH_LINE_JOURNEY
)
  throw new Error(
    "Set FINISH_LINE_ORIGIN, FINISH_LINE_JOURNEY (JSON) and DEPLOYXA_PROJECT_ID, and pipe real deployment JSON into this script.",
  );
const origin = process.env.FINISH_LINE_ORIGIN;
const response = await fetch(
  `${origin}/api/deployxa/deployments/${encodeURIComponent(id)}/race`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      journey: JSON.parse(process.env.FINISH_LINE_JOURNEY),
    }),
  },
);
if (!response.ok) throw new Error(await response.text());
const created = await response.json();
let race;
const deadline = Date.now() + 180000;
do {
  await delay(2000);
  race = await (await fetch(`${origin}/api/races/${created.id}`)).json();
} while (["queued", "running"].includes(race.status) && Date.now() < deadline);
console.table(
  race.results?.map((r) => ({
    lane: r.lane,
    status: r.status,
    cost: `${r.cost.value} ${r.cost.unit}`,
    estimatedSeconds: r.estSeconds,
    reason: r.reasonCode ?? "",
  })) ?? [],
);
if (race.status !== "done")
  throw new Error(`Race did not complete: ${race.error ?? race.status}`);
const gate = await (
  await fetch(`${origin}/api/deployxa/gate/${race.id}`)
).json();
if (!gate.complete) throw new Error("Gate is incomplete");
if (gate.regressions.length) {
  console.error("Do not promote. Regressions:", gate.regressions.join(", "));
  process.exitCode = 1;
} else if (race.results.some((r) => r.status === "unknown")) {
  console.error("Measurement incomplete; human review required.");
  process.exitCode = 2;
}
