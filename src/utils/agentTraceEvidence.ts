export interface AgentTraceEvent {
  id: string;
  sequence: number;
  predecessorTraceId?: string;
  stepId?: string;
  attemptId?: string;
  toolReceiptId?: string;
  toolCallId?: string;
  vendorRequestId?: string;
  imageArtifactId?: string;
  eventType: string;
  runStatus?: string;
  stepStatus?: string;
  diagnostic?: { failureClass: string; stage: string; certainty: string; retryDisposition: string };
  createdAt: number;
}

export interface AgentTraceEvidence {
  schemaVersion: "toonflow.agent-trace-export.v1";
  projectId: number;
  runId: string;
  timeline: { schemaVersion: "toonflow.trace-timeline-evidence.v1";
    ordering: "durable-sequence"; linkage: "linked" | "legacy-unlinked"; eventCount: number };
  retention: { schemaVersion: "toonflow.agent-evidence-retention.v1";
    databaseRetention: "project-lifetime"; databaseDeletion: "project-delete-transaction";
    mediaDeletion: "project-directory-after-db-commit"; redactedExportRetention: "not-persisted" };
  redaction: { schemaVersion: "toonflow.trace-redaction-evidence.v1"; result: "passed" };
  events: AgentTraceEvent[];
}

const LABELS: Record<string, string> = {
  "run.created": "创建运行",
  "run.started": "开始模型尝试",
  "run.succeeded": "运行完成",
  "run.failed": "运行失败",
  "run.needs-attention": "运行等待人工核对",
  "run.cancellation-requested": "记录运行取消意图",
  "run.cancelled": "运行已取消",
  "interrupted-before-model-call": "模型调用前中断，检查后继尝试",
  "interrupted-model-call": "模型调用可能受外部影响，等待核对",
  "agent-checkpoint-corrupt": "检查点证据损坏",
  "agent-checkpoint-incompatible": "检查点版本不兼容",
  "tool.started": "受控工具开始",
  "tool.succeeded": "受控工具完成",
  "tool.failed": "受控工具失败",
  "tool.denied": "受控工具授权失败",
  "tool.interrupted": "受控工具中断",
  "tool.approval.requested": "创建资产写入审批",
  "tool.approval.committed": "批准并提交资产写入",
  "tool.approval.rejected": "拒绝资产写入审批",
  "tool.approval.expired": "资产写入审批过期",
  "tool.approval.conflicted": "资产写入审批发生冲突",
  "tool.approval.corrupt": "资产写入审批证据损坏",
  "tool.billing-approval.requested": "创建计费审批",
  "tool.billing-approval.approve": "批准计费范围",
  "tool.billing-approval.reject": "拒绝计费范围",
  "tool.billing-approval.expired": "审批过期",
  "vendor.request.intent-recorded": "记录供应商请求意图",
  "vendor.task.observed": "观察到供应商任务",
  "vendor.request.submission-unknown": "供应商提交结果未知",
  "vendor.request.unknown-on-recovery": "重启后等待人工核对",
  "vendor.request.cancellation-requested": "记录取消意图",
  "vendor.request.stopped-without-replay": "结束本地跟踪，不重发",
  "artifact.observed": "观察到图片产物",
  "artifact.late-observed": "取消后观察到迟到产物",
  "tool.billable-image.committed": "本地提交图片",
};

export function traceEventLabel(eventType: string): string {
  return LABELS[eventType] ?? eventType;
}

export function traceLinkageSummary(evidence: AgentTraceEvidence): string {
  return evidence.timeline.linkage === "linked"
    ? "前驱链已按持久化序号连接；不代表供应商已确认计费或取消。"
    : "包含旧版未补链事件；只按持久化序号展示，不推断缺失的因果关系。";
}
