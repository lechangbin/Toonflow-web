import type { BillableImageApproval } from "./billableImageApproval";
import type { DerivedAssetApproval } from "./derivedAssetApproval";

export const PRODUCTION_HARNESS_SCOPE = "production-harness-v1" as const;
export const PRODUCTION_HARNESS_START_VERSION = "toonflow.agent-run.start.v1" as const;

export interface ProductionHarnessRun {
  id: string;
  projectId: number;
  role: "productionAgent";
  scope: typeof PRODUCTION_HARNESS_SCOPE;
  status: "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";
  version: number;
  allowedActions: string[];
  outputs: Array<{ id: string; content: string }>;
  attentionReason?: string;
}

export interface ProductionHarnessEffect {
  operationId: string;
  status: "denied" | "approval";
  approval: (BillableImageApproval & { sourceRunId?: string;
    sourceOperationId?: string }) | null;
}

export interface ProductionHarnessDerivedEffect {
  operationId: string;
  status: "denied" | "approval";
  approval: (DerivedAssetApproval & { sourceRunId?: string;
    sourceOperationId?: string }) | null;
}

export interface ProductionHarnessEffects {
  runId: string;
  effects: ProductionHarnessEffect[];
  derivedEffects: ProductionHarnessDerivedEffect[];
}

export function productionProjectId(value: number | string): number {
  const id = typeof value === "number" ? value
    : /^[1-9]\d*$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError("Production Project ID is invalid");
  return id;
}

type Post = <T>(path: string, body: unknown) => Promise<{ data: T }>;

/** HTTP snapshots own status; legacy Socket remains a separate compatibility path. */
export function createProductionHarnessClient(post: Post) {
  return {
    async start(projectId: number | string, clientRequestId: string, content: string) {
      const result = await post<{ run: ProductionHarnessRun }>(
        "/agentRuns/productionHarness/start", {
          schemaVersion: PRODUCTION_HARNESS_START_VERSION,
          projectId: productionProjectId(projectId), role: "productionAgent",
          scope: PRODUCTION_HARNESS_SCOPE, clientRequestId, content,
        });
      return result.data.run;
    },
    async inspect(projectId: number | string, runId: string) {
      const result = await post<{ run: ProductionHarnessRun }>(
        "/agentRuns/productionHarness/inspect",
        { projectId: productionProjectId(projectId), runId });
      return result.data.run;
    },
    async list(projectId: number | string) {
      const result = await post<{ current: ProductionHarnessRun | null;
        recent: ProductionHarnessRun[] }>("/agentRuns/productionHarness/list", {
          projectId: productionProjectId(projectId), role: "productionAgent",
          scope: PRODUCTION_HARNESS_SCOPE,
        });
      return result.data;
    },
    async effects(projectId: number | string, runId: string) {
      const result = await post<ProductionHarnessEffects>(
        "/agentRuns/productionHarness/effects",
        { projectId: productionProjectId(projectId), runId });
      if (result.data.runId !== runId) throw new TypeError("Production effects Run ID mismatch");
      return result.data;
    },
    async cancel(projectId: number | string, run: ProductionHarnessRun,
      clientCommandId: string) {
      if (!run.allowedActions.includes("cancel")) {
        throw new TypeError("Production Run cannot be cancelled in its current state");
      }
      const result = await post<{ run: ProductionHarnessRun }>(
        "/agentRuns/productionHarness/cancel", {
          projectId: productionProjectId(projectId), runId: run.id,
          clientCommandId, expectedVersion: run.version,
        });
      return result.data.run;
    },
    async decideImage(projectId: number | string, approval: BillableImageApproval,
      decision: "approve" | "reject", clientCommandId: string) {
      if (approval.status !== "pending" || !approval.allowedActions.includes(decision)) {
        throw new TypeError("Production image approval cannot be decided in its current state");
      }
      const result = await post<{ approval: BillableImageApproval }>(
        "/agentRuns/billableImage/decide", { projectId: productionProjectId(projectId),
          runId: approval.runId, approvalId: approval.id, clientCommandId,
          expectedVersion: approval.runVersion, decision });
      return result.data.approval;
    },
    async executeImage(projectId: number | string, approval: BillableImageApproval) {
      if (approval.status !== "approved" || approval.vendorRequest !== null
        || !approval.allowedActions.includes("dispatch") || approval.expiresAt <= Date.now()) {
        throw new TypeError("Production image approval cannot submit Vendor request");
      }
      const result = await post<{ result: { status: string } }>(
        "/agentRuns/billableImage/execute", { projectId: productionProjectId(projectId),
          runId: approval.runId, approvalId: approval.id,
          expectedVersion: approval.runVersion });
      return result.data.result;
    },
    async decideDerived(projectId: number | string, approval: DerivedAssetApproval,
      decision: "approve" | "reject", clientCommandId: string) {
      if (approval.status !== "pending" || !approval.allowedActions.includes(decision)
        || (decision === "approve" && !approval.payload)) {
        throw new TypeError("Production derived Asset approval cannot be decided in its current state");
      }
      const result = await post<{ approval: DerivedAssetApproval }>(
        "/agentRuns/derivedAssetApproval/decide", {
          projectId: productionProjectId(projectId), runId: approval.runId,
          approvalId: approval.id, clientCommandId,
          expectedVersion: approval.runVersion, decision,
        });
      return result.data.approval;
    },
  };
}
