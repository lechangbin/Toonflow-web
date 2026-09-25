import assert from "node:assert/strict";
import test from "node:test";

import { createAgentTraceEvidenceClient } from
  "../src/utils/agentTraceEvidence.ts";

const evidence = { schemaVersion: "toonflow.agent-trace-export.v1",
  projectId: 7, runId: "run-1",
  redaction: { schemaVersion: "toonflow.trace-redaction-evidence.v1",
    result: "passed" },
  events: [{ id: "event-1", sequence: 1, eventType: "run.started",
    runStatus: "running", createdAt: 100 }] };

test("Trace drawer client uses Project/Run-scoped Owner HTTP evidence", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const inspect = createAgentTraceEvidenceClient(async <T>(path, body) => {
    calls.push({ path, body });
    return { data: { evidence } as T };
  });
  assert.equal((await inspect(7, "run-1")).events[0].eventType, "run.started");
  assert.deepEqual(calls, [{ path: "/agentRuns/traceEvidence",
    body: { projectId: 7, runId: "run-1" } }]);
});

test("Trace drawer client rejects mismatched or unredacted snapshots", async () => {
  const inspect = createAgentTraceEvidenceClient(async <T>() =>
    ({ data: { evidence: { ...evidence, runId: "other" } } as T }));
  await assert.rejects(inspect(7, "run-1"), /mismatched or unsafe/);
  const unsafe = createAgentTraceEvidenceClient(async <T>() =>
    ({ data: { evidence: { ...evidence, redaction: {
      ...evidence.redaction, result: "failed" } } } as T }));
  await assert.rejects(unsafe(7, "run-1"), /mismatched or unsafe/);
  await assert.rejects(inspect(0, "run-1"), /invalid/);
});
