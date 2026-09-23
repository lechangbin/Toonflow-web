import assert from "node:assert/strict";
import test from "node:test";

import { imageApprovalSummary, maySubmitApprovedImage, parseVendorModel, quoteMicros,
  type BillableImageApproval } from "../src/utils/billableImageApproval.ts";

const approval: BillableImageApproval = { id: "approval", runId: "run", runVersion: 2,
  status: "approved", runStatus: "waiting", allowedActions: ["inspect", "dispatch"],
  expiresAt: Date.now() + 60_000, scopeHash: "hash",
  preview: { assetId: 9, assetName: "角色", vendorId: "v", modelId: "m", resolution: "1K",
    estimatedMaxCostMicros: 200_000, currency: "USD", disclaimer: "仅为估算" }, vendorRequest: null };

test("billable approval controls never treat unknown or cancelled outcomes as retryable", () => {
  assert.equal(maySubmitApprovedImage(approval), true);
  assert.equal(maySubmitApprovedImage({ ...approval, expiresAt: 0 }), false);
  assert.equal(maySubmitApprovedImage({ ...approval, allowedActions: ["inspect"] }), false);
  const unknown = { ...approval, vendorRequest: { requestId: "request", status: "unknown",
    providerTaskId: null, artifactHash: null, pendingArtifactHash: null,
    cancellationRequested: false, imageId: 1 } };
  assert.equal(maySubmitApprovedImage(unknown), false);
  assert.match(imageApprovalSummary(unknown), /不能自动重发/);
  assert.match(imageApprovalSummary({ ...unknown, vendorRequest: { ...unknown.vendorRequest,
    pendingArtifactHash: "hash" } }), /不表示图片成功/);
  assert.match(imageApprovalSummary({ ...unknown, vendorRequest: { ...unknown.vendorRequest,
    status: "late_artifact_observed" } }), /不会自动作为成功/);
  assert.match(imageApprovalSummary({ ...unknown, vendorRequest: { ...unknown.vendorRequest,
    status: "cancelled" } }), /是否计费/);
});

test("model identity and local quote amount are normalized without floating-point billing drift", () => {
  assert.deepEqual(parseVendorModel("v:model:revision"), { vendorId: "v", modelId: "model:revision" });
  assert.deepEqual(parseVendorModel("v:series/model"), { vendorId: "v", modelId: "series/model" });
  assert.equal(parseVendorModel("missing"), null);
  assert.equal(quoteMicros("0.2"), 200_000);
  assert.equal(quoteMicros("0.000001"), 1);
  assert.equal(quoteMicros("1.0000001"), null);
  assert.equal(quoteMicros("0"), null);
});
