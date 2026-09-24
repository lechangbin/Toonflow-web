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

export interface StoryboardWriteApproval {
  id: string;
  runId: string;
  operationId: string;
  status: "pending" | "approved" | "rejected" | "expired" | "conflicted";
  expiresAt: number;
  runStatus: string;
  runVersion: number;
  allowedActions: string[];
  payloadHash: string;
  targetStateHash: string;
  preview: { scriptId: number; trackId: number; duration: number;
    assetCount: number; payloadHash: string };
  payload: { scriptId: number; trackId: number; videoDesc: string;
    prompt: string | null; duration: number; shouldGenerateImage: boolean;
    associateAssetsIds: number[] };
  receiptOutput?: { storyboardId: number; assetCount: number };
  sourceRunId?: string;
  sourceOperationId?: string;
}

export interface ProductionHarnessStoryboardEffect {
  operationId: string;
  status: "denied" | "approval";
  approval: StoryboardWriteApproval | null;
}

export interface ProductionHarnessEffects {
  runId: string;
  effects: ProductionHarnessEffect[];
  derivedEffects: ProductionHarnessDerivedEffect[];
  storyboardEffects: ProductionHarnessStoryboardEffect[];
}

export interface ProductionHarnessGrants {
  workspace: { active: boolean; version: number };
  imageProposal: { active: boolean; version: number };
  derivedProposal: { active: boolean; version: number };
  storyboardProposal: { active: boolean; version: number };
}

const grantPaths = {
  workspace: "/agentRuns/setReadProductionWorkspaceGrant",
  imageProposal: "/agentRuns/setProposeBillableImageGrant",
  derivedProposal: "/agentRuns/setProposeDerivedAssetGrant",
  storyboardProposal: "/agentRuns/setProposeStoryboardGrant",
} as const;

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
    async grants(projectId: number | string) {
      const result = await post<ProductionHarnessGrants>(
        "/agentRuns/getProductionGrants", { projectId: productionProjectId(projectId) });
      return result.data;
    },
    async setGrant(projectId: number | string, kind: keyof ProductionHarnessGrants,
      current: ProductionHarnessGrants[keyof ProductionHarnessGrants], active: boolean) {
      if (current.active === active || !Number.isSafeInteger(current.version)
        || current.version < 0) throw new TypeError("Production grant command is stale or unchanged");
      const result = await post<{ active?: boolean; state: "active" | "revoked";
        version: number }>(grantPaths[kind], { projectId: productionProjectId(projectId),
          expectedVersion: current.version, active });
      return { active: result.data.state === "active", version: result.data.version };
    },
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
    async decideStoryboard(projectId: number | string, approval: StoryboardWriteApproval,
      decision: "approve" | "reject", clientCommandId: string) {
      if (approval.status !== "pending" || !approval.allowedActions.includes(decision)
        || (decision === "approve" && !approval.payload)) {
        throw new TypeError("Production Storyboard approval cannot be decided in its current state");
      }
      const result = await post<{ approval: StoryboardWriteApproval }>(
        "/agentRuns/storyboardWriteApproval/decide", {
          projectId: productionProjectId(projectId), runId: approval.runId,
          approvalId: approval.id, clientCommandId,
          expectedVersion: approval.runVersion, decision,
        });
      return result.data.approval;
    },
  };
}
