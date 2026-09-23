import assert from "node:assert/strict";
import test from "node:test";

import { approvalSummary, mayDecide, visibleApprovals, type DerivedAssetApproval } from "../src/utils/derivedAssetApproval.ts";

const approval: DerivedAssetApproval = {
  id: "approval-1", runId: "run-1", operationId: "operation-1", toolName: "upsert_derived_asset",
  toolRevision: "v1", payloadHash: "a", contractHash: "b", status: "pending", expiresAt: 200,
  preview: { effect: "update", parentAssetId: 7, assetId: 8, expectedVersion: 2,
    name: "角色换装", dimensions: ["wardrobe"] },
  runStatus: "waiting", runVersion: 1, allowedActions: ["inspect", "approve", "reject"], receiptStatus: "pending",
};

test("approval controls follow backend allowedActions rather than a local status guess", () => {
  assert.equal(mayDecide(approval, "approve"), true);
  assert.equal(mayDecide({ ...approval, allowedActions: ["inspect"] }, "approve"), false);
  assert.equal(mayDecide({ ...approval, status: "approved", allowedActions: ["inspect"] }, "reject"), false);
  assert.equal(approvalSummary(approval).includes("目标版本 2"), true);
});

test("the compact card list is bounded and never suggests retry on stale or unsafe evidence", () => {
  assert.equal(visibleApprovals(Array.from({ length: 7 }, (_, index) => ({ ...approval, id: `approval-${index}` }))).length, 3);
  const prioritized = visibleApprovals([
    { ...approval, id: "complete-1", allowedActions: ["inspect"] },
    { ...approval, id: "complete-2", allowedActions: ["inspect"] },
    { ...approval, id: "complete-3", allowedActions: ["inspect"] },
    approval,
  ]);
  assert.equal(prioritized[0].id, approval.id);
  assert.match(approvalSummary({ ...approval, status: "conflicted", allowedActions: ["inspect"] }), /未写入/);
  assert.match(approvalSummary({ ...approval, status: "corrupt", allowedActions: ["inspect"] }), /停止/);
});
