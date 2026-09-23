export interface BillableImageApproval {
  id: string;
  runId: string;
  runVersion: number;
  status: "pending" | "approved" | "rejected" | "expired" | "conflicted";
  runStatus: string;
  allowedActions: string[];
  expiresAt: number;
  scopeHash: string;
  preview: { assetId: number; assetName: string; vendorId: string; modelId: string;
    resolution: string; estimatedMaxCostMicros: number; currency: string; disclaimer: string };
  vendorRequest: null | { requestId: string; status: string; providerTaskId: string | null;
    artifactHash: string | null; pendingArtifactHash: string | null;
    cancellationRequested: boolean; imageId: number };
}

export interface BillableImageQuote {
  projectId: number;
  vendorId: string;
  modelId: string;
  resolution: string;
  estimatedMaxCostMicros: number;
  currency: string;
  revision: number;
}

export function parseVendorModel(value: string): { vendorId: string; modelId: string } | null {
  const separator = value.indexOf(":");
  if (separator <= 0 || separator >= value.length - 1) return null;
  const vendorId = value.slice(0, separator);
  const modelId = value.slice(separator + 1);
  if ([vendorId, modelId].some((part) => part !== part.trim()
    || !/^[^\u0000-\u001f\u007f]{1,100}$/.test(part))) return null;
  return { vendorId, modelId };
}

export function quoteMicros(decimal: string): number | null {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,6})?$/.test(decimal)) return null;
  const [whole, fraction = ""] = decimal.split(".");
  const result = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, "0"));
  return Number.isSafeInteger(result) && result > 0 && result <= 1_000_000_000 ? result : null;
}

export function imageApprovalSummary(approval: BillableImageApproval): string {
  const request = approval.vendorRequest;
  if (request?.pendingArtifactHash) return "媒体写入尚未完成；已保留待写入证据，不表示图片成功，也不会重新请求供应商。";
  if (request?.status === "succeeded") return `已完成，图片 #${request.imageId}。`;
  if (request?.status === "unknown" || request?.status === "dispatch_recorded")
    return `结果未知，不能自动重发；请求 ${request.requestId} 需人工核对供应商记录。`;
  if (request?.status === "late_artifact_observed") return "取消后收到迟到产物；证据已保留，不会自动作为成功图片。";
  if (request?.status === "artifact_observed") return "已收到图片证据，等待本地提交或人工核对。";
  if (request?.status === "cancelled") return "已请求取消；供应商是否计费及是否仍会返回图片尚未确认。";
  if (request?.status === "failed_no_effect") return "已核实供应商未产生效果；如需重试，须重新提案审批。";
  if (approval.status === "pending") return "待审批；外部计费请求尚未发出。";
  if (approval.status === "approved") return "已批准，尚未提交供应商。";
  if (approval.status === "rejected") return "已拒绝；未提交供应商。";
  if (approval.status === "expired") return "审批已过期；未提交供应商。";
  return "目标状态已变化；请核对后重新提案。";
}

export function maySubmitApprovedImage(approval: BillableImageApproval): boolean {
  return approval.status === "approved" && approval.vendorRequest === null
    && approval.allowedActions.includes("dispatch") && approval.expiresAt > Date.now();
}
