export interface DerivedAssetApproval {
  id: string;
  runId: string;
  operationId: string;
  toolName: "upsert_derived_asset";
  toolRevision: string;
  payloadHash: string;
  contractHash: string;
  status: "pending" | "approved" | "rejected" | "expired" | "conflicted" | "corrupt";
  expiresAt: number;
  preview: {
    effect: "create" | "update";
    parentAssetId: number;
    assetId: number | null;
    expectedVersion: number;
    name: string;
    dimensions: string[];
  };
  payload?: {
    parentAssetId: number;
    assetId: number | null;
    expectedVersion: number;
    scriptId: number;
    name: string;
    description: string;
    changeInstruction: { dimensions: string[]; evidence: string[];
      preserve: string[]; change: string[]; exclude: string[] };
  };
  runStatus: string;
  runVersion: number;
  allowedActions: string[];
  receiptStatus: string;
  receiptOutput?: { assetId: number; revision: number; effect: "created" | "updated" };
  attentionReason?: string;
}

export function mayDecide(approval: DerivedAssetApproval, decision: "approve" | "reject"): boolean {
  return approval.allowedActions.includes(decision);
}

export function visibleApprovals(approvals: readonly DerivedAssetApproval[]): DerivedAssetApproval[] {
  const scoped = approvals.filter((approval) => approval.toolName === "upsert_derived_asset");
  return [
    ...scoped.filter((approval) => mayDecide(approval, "approve") || mayDecide(approval, "reject")),
    ...scoped.filter((approval) => !mayDecide(approval, "approve") && !mayDecide(approval, "reject")),
  ].slice(0, 3);
}

export function approvalSummary(approval: DerivedAssetApproval): string {
  if (approval.status === "corrupt") return "审批证据不可用；此操作已停止。";
  if (approval.status === "conflicted") return "目标已变化；未写入资产，请重新发起提案。";
  if (approval.status === "expired") return "审批已过期；未写入资产。";
  if (approval.status === "rejected") return "已拒绝；未写入资产。";
  if (approval.status === "approved") return `已提交资产 #${approval.receiptOutput?.assetId ?? "?"}，版本 ${approval.receiptOutput?.revision ?? "?"}。`;
  return `待审批：${approval.preview.effect === "create" ? "新建" : "更新"}衍生资产，目标版本 ${approval.preview.expectedVersion}。`;
}
