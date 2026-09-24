function canonicalProjectId(value: number | string): number {
  const normalized = typeof value === "number" ? value
    : /^[1-9]\d*$/u.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new TypeError("Script write Project ID is invalid");
  }
  return normalized;
}

export interface ScriptWriteApproval {
  id: string;
  runId: string;
  operationId: string;
  kind: "workspace" | "script";
  status: "pending" | "approved" | "rejected" | "expired" | "conflicted" | "corrupt";
  expiresAt: number;
  preview: unknown;
  runVersion: number;
  runStatus: string;
}

type Post = <T>(path: string, body: unknown) => Promise<{ data: T }>;

/** Owner authority is supplied by App authentication, never by a browser actor ID. */
export function createScriptWriteApprovalClient(post: Post) {
  return {
    async list(projectId: number | string): Promise<ScriptWriteApproval[]> {
      const result = await post<ScriptWriteApproval[]>(
        "/agentRuns/scriptWriteApprovals/list", { projectId: canonicalProjectId(projectId) });
      return result.data;
    },
    async decide(projectId: number | string, approval: ScriptWriteApproval,
      decision: "approve" | "reject", clientCommandId: string): Promise<ScriptWriteApproval> {
      if (approval.status !== "pending" || approval.runStatus !== "waiting") {
        throw new TypeError("Script write approval is no longer pending");
      }
      const result = await post<ScriptWriteApproval>(
        "/agentRuns/scriptWriteApprovals/decide",
        { projectId: canonicalProjectId(projectId), runId: approval.runId,
          approvalId: approval.id, expectedVersion: approval.runVersion,
          decision, clientCommandId });
      return result.data;
    },
  };
}
