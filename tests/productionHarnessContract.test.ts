import assert from "node:assert/strict";
import test from "node:test";

import { createProductionHarnessClient, productionProjectId,
  type ProductionHarnessRun } from "../src/utils/productionHarnessContract.ts";

test("Production client uses owner-scoped HTTP state and separates child effects", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const run: ProductionHarnessRun = { id: "production-1", projectId: 7,
    role: "productionAgent", scope: "production-harness-v1", status: "waiting",
    version: 3, allowedActions: ["inspect", "cancel"], outputs: [] };
  const client = createProductionHarnessClient(async <T>(path, body) => {
    calls.push({ path, body });
    const data = path.endsWith("/list") ? { current: run, recent: [run] }
      : path.endsWith("/effects") ? { runId: run.id,
        effects: [{ operationId: "image-1", status: "denied", approval: null }] }
      : { run };
    return { data: data as T };
  });
  assert.equal((await client.start("7", "request-1", "检查拍摄计划")).id, run.id);
  assert.equal((await client.inspect(7, run.id)).id, run.id);
  assert.equal((await client.list(7)).current?.id, run.id);
  assert.equal((await client.effects(7, run.id))[0].status, "denied");
  assert.equal((await client.cancel(7, run, "stop-1")).id, run.id);
  assert.deepEqual(calls.map((entry) => entry.path), [
    "/agentRuns/productionHarness/start", "/agentRuns/productionHarness/inspect",
    "/agentRuns/productionHarness/list", "/agentRuns/productionHarness/effects",
    "/agentRuns/productionHarness/cancel",
  ]);
  assert.deepEqual(calls[0].body, { schemaVersion: "toonflow.agent-run.start.v1",
    projectId: 7, role: "productionAgent", scope: "production-harness-v1",
    clientRequestId: "request-1", content: "检查拍摄计划" });
  assert.deepEqual(calls[4].body, { projectId: 7, runId: run.id,
    clientCommandId: "stop-1", expectedVersion: 3 });
});

test("Production client rejects malformed Project IDs and unauthorized cancellation", async () => {
  assert.equal(productionProjectId("7"), 7);
  for (const value of ["07", "7x", 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => productionProjectId(value));
  }
  const client = createProductionHarnessClient(async <T>() => {
    throw new Error("network should not be called");
  });
  await assert.rejects(client.cancel(7, { id: "production-1", projectId: 7,
    role: "productionAgent", scope: "production-harness-v1", status: "succeeded",
    version: 2, allowedActions: ["inspect"], outputs: [] }, "stop-1"),
  /cannot be cancelled/);
});
