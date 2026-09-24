import assert from "node:assert/strict";
import test from "node:test";

import { createScriptWriteApprovalClient, type ScriptWriteApproval } from
  "../src/utils/scriptWriteApprovalContract.ts";

test("Script write decisions bind exact approval version, without browser actor", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const approval: ScriptWriteApproval = { id: "approval-1", runId: "run-1",
    operationId: "op-1", kind: "script", status: "pending", runStatus: "waiting",
    expiresAt: 1000, payloadHash: "hash-1",
    preview: { target: "script-2", contentLength: 12 }, runVersion: 1 };
  const client = createScriptWriteApprovalClient(async <T>(path: string, body: unknown) => {
    calls.push({ path, body });
    return { data: (path.endsWith("/list") ? [approval]
      : path.endsWith("/review") ? { approval, payload: { effect: "update",
        scriptId: 2, name: "第二集", content: "完整剧本" } } : approval) as T };
  });
  assert.equal((await client.list("7"))[0].id, approval.id);
  assert.equal((await client.review("7", approval)).payload.content, "完整剧本");
  assert.equal((await client.decide("7", approval, "reject", "command-1")).id, approval.id);
  assert.deepEqual(calls[1], { path: "/agentRuns/scriptWriteApprovals/review",
    body: { projectId: 7, runId: "run-1", approvalId: "approval-1" } });
  assert.deepEqual(calls[2], { path: "/agentRuns/scriptWriteApprovals/decide",
    body: { projectId: 7, runId: "run-1", approvalId: "approval-1",
      expectedVersion: 1, decision: "reject", clientCommandId: "command-1" } });
});

test("Settled approvals cannot be replayed from the client", async () => {
  const client = createScriptWriteApprovalClient(async <T>() => {
    throw new Error("network should not be called");
  });
  const settled: ScriptWriteApproval = { id: "approval-1", runId: "run-1",
    operationId: "op-1", kind: "script", status: "expired", runStatus: "waiting",
    expiresAt: 1000, payloadHash: "hash-1", preview: {}, runVersion: 2 };
  await assert.rejects(client.decide(7, settled, "approve", "command-1"), /no longer pending/);
});

test("Full-text review refuses a changed proposal version", async () => {
  const approval: ScriptWriteApproval = { id: "approval-1", runId: "run-1",
    operationId: "op-1", kind: "workspace", status: "pending", runStatus: "waiting",
    expiresAt: 1000, payloadHash: "hash-1", preview: {}, runVersion: 1 };
  const client = createScriptWriteApprovalClient(async <T>() => ({ data: {
    approval: { ...approval, runVersion: 2 },
    payload: { key: "storySkeleton", content: "替换文本" },
  } as T }));
  await assert.rejects(client.review(7, approval), /no longer matches/);
});

test("Model proposal grant uses the current backend version and no browser actor", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const grants = { workspace: { active: false, version: 2 },
    script: { active: true, version: 4 } };
  const client = createScriptWriteApprovalClient(async <T>(path: string, body: unknown) => {
    calls.push({ path, body });
    return { data: grants as T };
  });
  const current = await client.grants("7");
  await client.setGrant("7", "workspace", current, true);
  assert.deepEqual(calls, [
    { path: "/agentRuns/getScriptProposalGrants", body: { projectId: 7 } },
    { path: "/agentRuns/setScriptProposalGrant", body: { projectId: 7,
      kind: "workspace", expectedVersion: 2, active: true } },
  ]);
});
