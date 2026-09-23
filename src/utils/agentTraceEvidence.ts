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
  events: AgentTraceEvent[];
}

const LABELS: Record<string, string> = {
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
