export const SCRIPT_HARNESS_SCOPE = "script-harness-guidance-v1" as const;
export const SCRIPT_HARNESS_START_VERSION = "toonflow.agent-run.start.v1" as const;

export type ScriptHarnessStatus = "queued" | "running" | "waiting"
  | "succeeded" | "failed" | "cancelled";

export interface ScriptHarnessRun {
  id: string;
  projectId: number;
  role: "scriptAgent";
  scope: typeof SCRIPT_HARNESS_SCOPE;
  status: ScriptHarnessStatus;
  version: number;
  allowedActions: string[];
  outputs: Array<{ id: string; content: string }>;
  attentionReason?: string;
}

export interface ScriptHarnessList {
  current: ScriptHarnessRun | null;
  recent: ScriptHarnessRun[];
}

export function canonicalProjectId(value: number | string): number {
  const normalized = typeof value === "number" ? value
    : /^[1-9]\d*$/u.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new TypeError("Script Harness Project ID is invalid");
  }
  return normalized;
}

export function isScriptHarnessTerminal(status: ScriptHarnessStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

type Post = <T>(path: string, body: unknown) => Promise<{ data: T }>;

/** Versioned HTTP adapter; never falls back to the legacy Socket on failure. */
export function createScriptHarnessClient(post: Post) {
  return {
    async start(projectId: number | string, clientRequestId: string, content: string) {
      const result = await post<{ run: ScriptHarnessRun }>("/agentRuns/startScriptHarness", {
        schemaVersion: SCRIPT_HARNESS_START_VERSION,
        projectId: canonicalProjectId(projectId), role: "scriptAgent",
        scope: SCRIPT_HARNESS_SCOPE, clientRequestId, content,
      });
      return result.data.run;
    },
    async inspect(projectId: number | string, runId: string) {
      const result = await post<{ run: ScriptHarnessRun }>(
        "/agentRuns/scriptHarnessControls/inspect",
        { projectId: canonicalProjectId(projectId), runId });
      return result.data.run;
    },
    async list(projectId: number | string): Promise<ScriptHarnessList> {
      const result = await post<ScriptHarnessList>(
        "/agentRuns/scriptHarnessControls/list",
        { projectId: canonicalProjectId(projectId), role: "scriptAgent",
          scope: SCRIPT_HARNESS_SCOPE });
      return result.data;
    },
    async cancel(projectId: number | string, run: ScriptHarnessRun,
      clientCommandId: string) {
      if (!run.allowedActions.includes("cancel")) {
        throw new TypeError("Script Harness Run cannot be cancelled in its current state");
      }
      const result = await post<{ run: ScriptHarnessRun }>(
        "/agentRuns/scriptHarnessControls/cancel",
        { projectId: canonicalProjectId(projectId), runId: run.id,
          clientCommandId, expectedVersion: run.version });
      return result.data.run;
    },
  };
}
