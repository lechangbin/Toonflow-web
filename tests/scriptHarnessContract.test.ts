import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalProjectId, createScriptHarnessClient,
  isScriptHarnessTerminal, type ScriptHarnessRun,
} from "../src/utils/scriptHarnessContract.ts";

test("Script Harness client sends versioned Project-scoped requests without Socket fallback", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const run: ScriptHarnessRun = { id: "run-1", projectId: 7,
    role: "scriptAgent", scope: "script-harness-guidance-v1",
    status: "queued", version: 1, allowedActions: ["inspect", "cancel"], outputs: [] };
  const client = createScriptHarnessClient(async <T>(path: string, body: unknown) => {
    calls.push({ path, body });
    return { data: (path.endsWith("/list")
      ? { current: run, recent: [run] } : { run }) as T };
  });
  assert.equal((await client.start("7", "request-1", "分析章节")).id, run.id);
  assert.equal((await client.inspect("7", run.id)).id, run.id);
  assert.equal((await client.list("7")).current?.id, run.id);
  assert.equal((await client.cancel("7", run, "stop-1")).id, run.id);
  assert.deepEqual(calls.map((entry) => entry.path), [
    "/agentRuns/startScriptHarness", "/agentRuns/scriptHarnessControls/inspect",
    "/agentRuns/scriptHarnessControls/list", "/agentRuns/scriptHarnessControls/cancel",
  ]);
  assert.deepEqual(calls[0].body, { schemaVersion: "toonflow.agent-run.start.v1",
    projectId: 7, role: "scriptAgent", scope: "script-harness-guidance-v1",
    clientRequestId: "request-1", content: "分析章节" });
  assert.deepEqual(calls[3].body, { projectId: 7, runId: "run-1",
    clientCommandId: "stop-1", expectedVersion: 1 });
});

test("Script Harness client rejects non-canonical IDs and stale cancellation affordances", async () => {
  assert.equal(canonicalProjectId("7"), 7);
  for (const value of ["07", "7x", "-1", 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => canonicalProjectId(value));
  }
  const client = createScriptHarnessClient(async <T>() => {
    throw new Error("network should not be called");
  });
  await assert.rejects(client.cancel(7, { id: "run-1", projectId: 7,
    role: "scriptAgent", scope: "script-harness-guidance-v1", status: "succeeded",
    version: 2, allowedActions: ["inspect"], outputs: [] }, "stop-1"),
  /cannot be cancelled/);
  assert.equal(isScriptHarnessTerminal("waiting"), false);
  assert.equal(isScriptHarnessTerminal("succeeded"), true);
});
