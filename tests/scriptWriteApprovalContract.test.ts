import assert from "node:assert/strict";
import test from "node:test";

import { createScriptWriteApprovalClient, type ScriptWriteApproval } from
  "../src/utils/scriptWriteApprovalContract.ts";

test("Script write decisions bind exact approval version, without browser actor", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const approval: ScriptWriteApproval = { id: "approval-1", runId: "run-1",
    operationId: "op-1", kind: "script", status: "pending", runStatus: "waiting",
    expiresAt: 1000, preview: { target: "script-2", contentLength: 12 }, runVersion: 1 };
  const client = createScriptWriteApprovalClient(async <T>(path: string, body: unknown) => {
    calls.push({ path, body });
    return { data: (path.endsWith("/list") ? [approval] : approval) as T };
  });
  assert.equal((await client.list("7"))[0].id, approval.id);
  assert.equal((await client.decide("7", approval, "reject", "command-1")).id, approval.id);
  assert.deepEqual(calls[1], { path: "/agentRuns/scriptWriteApprovals/decide",
    body: { projectId: 7, runId: "run-1", approvalId: "approval-1",
      expectedVersion: 1, decision: "reject", clientCommandId: "command-1" } });
});

test("Settled approvals cannot be replayed from the client", async () => {
  const client = createScriptWriteApprovalClient(async <T>() => {
    throw new Error("network should not be called");
  });
  const settled: ScriptWriteApproval = { id: "approval-1", runId: "run-1",
    operationId: "op-1", kind: "script", status: "expired", runStatus: "waiting",
    expiresAt: 1000, preview: {}, runVersion: 2 };
  await assert.rejects(client.decide(7, settled, "approve", "command-1"), /no longer pending/);
});
