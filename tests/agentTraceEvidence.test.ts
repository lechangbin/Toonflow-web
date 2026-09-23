import assert from "node:assert/strict";
import test from "node:test";

import { traceEventLabel, traceLinkageSummary, type AgentTraceEvidence } from "../src/utils/agentTraceEvidence.ts";

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
    retention: { schemaVersion: "toonflow.agent-evidence-retention.v1",
      databaseRetention: "project-lifetime", databaseDeletion: "project-delete-transaction",
      mediaDeletion: "project-directory-after-db-commit", redactedExportRetention: "not-persisted" },
    redaction: { schemaVersion: "toonflow.trace-redaction-evidence.v1", result: "passed" }, events: [] };
  assert.match(traceLinkageSummary(evidence), /不推断/);
  assert.match(traceLinkageSummary({ ...evidence, timeline: { ...evidence.timeline, linkage: "linked" } }), /不代表供应商/);
});
