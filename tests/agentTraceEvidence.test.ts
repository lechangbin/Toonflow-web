import assert from "node:assert/strict";
import test from "node:test";

import { createAgentTraceEvidenceClient, traceEventLabel, traceLinkageSummary,
  traceFailureClassificationSummary, type AgentTraceEvidence } from
  "../src/utils/agentTraceEvidence.ts";

const evidence = { schemaVersion: "toonflow.agent-trace-export.v1",
  projectId: 7, runId: "run-1",
  redaction: { schemaVersion: "toonflow.trace-redaction-evidence.v1",
    result: "passed" },
  events: [{ id: "event-1", sequence: 1, eventType: "run.started",
    runStatus: "running", videoVendorRequestId: "video-request-1",
    videoArtifactId: "video-artifact-1", createdAt: 100 }] };

test("Trace drawer client uses Project/Run-scoped Owner HTTP evidence", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const inspect = createAgentTraceEvidenceClient(async <T>(path, body) => {
    calls.push({ path, body });
    return { data: { evidence } as T };
  });
  const result = await inspect(7, "run-1");
  assert.equal(result.events[0].eventType, "run.started");
  assert.equal(result.events[0].videoArtifactId, "video-artifact-1");
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
  const forgedId = createAgentTraceEvidenceClient(async <T>() =>
    ({ data: { evidence: { ...evidence, events: [{ ...evidence.events[0],
      videoArtifactId: "https://unsafe.example" }] } } as T }));
  await assert.rejects(forgedId(7, "run-1"), /mismatched or unsafe/);
  await assert.rejects(inspect(0, "run-1"), /invalid/);
});

test("Trace labels distinguish approval, cancellation, recovery and late results", () => {
  assert.match(traceEventLabel("tool.billing-approval.approve"), /批准/);
  assert.match(traceEventLabel("vendor.request.cancellation-requested"), /取消/);
  assert.match(traceEventLabel("vendor.request.unknown-on-recovery"), /重启/);
  assert.match(traceEventLabel("artifact.late-observed"), /迟到/);
  assert.match(traceEventLabel("run.created"), /创建/);
  assert.match(traceEventLabel("interrupted-before-model-call"), /后继尝试/);
  assert.match(traceEventLabel("tool.approval.conflicted"), /冲突/);
  assert.equal(traceEventLabel("unknown.future-event"), "unknown.future-event");
});

test("legacy timeline does not claim a reconstructed causal chain or Provider refund", () => {
  const evidence: AgentTraceEvidence = { schemaVersion: "toonflow.agent-trace-export.v1", projectId: 7,
    runId: "run-1", timeline: { schemaVersion: "toonflow.trace-timeline-evidence.v1",
      ordering: "durable-sequence", linkage: "legacy-unlinked", eventCount: 0 },
    failureClassification: { schemaVersion: "toonflow.trace-failure-classification.v1",
      coverage: "legacy-unclassified", knownFailureEventCount: 1, classifiedFailureEventCount: 0 },
    retention: { schemaVersion: "toonflow.agent-evidence-retention.v1",
      databaseRetention: "project-lifetime", databaseDeletion: "project-delete-transaction",
      mediaDeletion: "project-directory-after-db-commit", redactedExportRetention: "not-persisted" },
    redaction: { schemaVersion: "toonflow.trace-redaction-evidence.v1", result: "passed" }, events: [] };
  assert.match(traceLinkageSummary(evidence), /不推断/);
  assert.match(traceFailureClassificationSummary(evidence), /不能推断/);
  assert.match(traceFailureClassificationSummary({ ...evidence, failureClassification: {
    ...evidence.failureClassification, coverage: "complete", classifiedFailureEventCount: 1 } }), /不代表旧路径/);
  assert.match(traceLinkageSummary({ ...evidence, timeline: { ...evidence.timeline, linkage: "linked" } }), /不代表供应商/);
});
