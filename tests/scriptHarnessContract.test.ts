import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalProjectId, createScriptHarnessClient, SCRIPT_HARNESS_SCOPE,
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

test("Script Harness stop refreshes one stale version and reuses the same command identity", async () => {
  const queued: ScriptHarnessRun = { id: "run-1", projectId: 7,
    role: "scriptAgent", scope: SCRIPT_HARNESS_SCOPE, status: "queued",
    version: 1, allowedActions: ["inspect", "cancel"], outputs: [] };
  const running = { ...queued, status: "running" as const, version: 2 };
  const calls: Array<{ path: string; body: any }> = [];
  const client = createScriptHarnessClient(async <T>(path: string, body: unknown) => {
    calls.push({ path, body });
    if (path.endsWith("/cancel") && calls.length === 1) {
      throw { status: 409, message: "Run version changed" };
    }
    return { data: { run: path.endsWith("/inspect") ? running
      : { ...running, version: 3 } } as T };
  });
  assert.equal((await client.cancel(7, queued, "stop-1")).version, 3);
  assert.deepEqual(calls.map((entry) => entry.path), [
    "/agentRuns/scriptHarnessControls/cancel",
    "/agentRuns/scriptHarnessControls/inspect",
    "/agentRuns/scriptHarnessControls/cancel",
  ]);
  assert.equal(calls[0].body.expectedVersion, 1);
  assert.equal(calls[2].body.expectedVersion, 2);
  assert.equal(calls[0].body.clientCommandId, calls[2].body.clientCommandId);
});

test("Script Harness stop never retries a terminal Run or an uncertain network failure", async () => {
  const queued: ScriptHarnessRun = { id: "run-1", projectId: 7,
    role: "scriptAgent", scope: SCRIPT_HARNESS_SCOPE, status: "queued",
    version: 1, allowedActions: ["inspect", "cancel"], outputs: [] };
  const calls: string[] = [];
  const terminal = createScriptHarnessClient(async <T>(path: string) => {
    calls.push(path);
    if (path.endsWith("/cancel")) throw { response: { status: 409 } };
    return { data: { run: { ...queued, status: "succeeded", version: 2,
      allowedActions: ["inspect"] } } as T };
  });
  assert.equal((await terminal.cancel(7, queued, "stop-1")).status, "succeeded");
  assert.equal(calls.length, 2);
  let requests = 0;
  const uncertain = createScriptHarnessClient(async <T>() => {
    requests++;
    throw new Error("connection dropped");
  });
  await assert.rejects(uncertain.cancel(7, queued, "stop-1"), /connection dropped/u);
  assert.equal(requests, 1);
});
