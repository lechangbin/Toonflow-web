export interface AgentTraceEvidence {
  schemaVersion: "toonflow.agent-trace-export.v1";
  projectId: number;
  runId: string;
  redaction: { schemaVersion: "toonflow.trace-redaction-evidence.v1";
    result: "passed" };
  events: Array<{ id: string; sequence: number; eventType: string;
    runStatus?: string; stepStatus?: string; createdAt: number }>;
}

type Post = <T>(path: string, body: unknown) => Promise<{ data: T }>;

/** Read-only Owner evidence; reject a mismatched or unredacted server response. */
export function createAgentTraceEvidenceClient(post: Post) {
  return async (projectId: number, runId: string): Promise<AgentTraceEvidence> => {
    if (!Number.isSafeInteger(projectId) || projectId <= 0
      || !/^[A-Za-z0-9._:-]{1,128}$/u.test(runId)) {
      throw new TypeError("Agent evidence target is invalid");
    }
    const response = await post<{ evidence: AgentTraceEvidence }>(
      "/agentRuns/traceEvidence", { projectId, runId });
    const evidence = response.data.evidence;
    if (!evidence || evidence.schemaVersion !== "toonflow.agent-trace-export.v1"
      || evidence.projectId !== projectId || evidence.runId !== runId
      || evidence.redaction?.schemaVersion !== "toonflow.trace-redaction-evidence.v1"
      || evidence.redaction.result !== "passed"
      || !Array.isArray(evidence.events) || evidence.events.length > 5000
      || evidence.events.some((event) => !Number.isSafeInteger(event.sequence)
        || !/^[a-z][a-z0-9.-]{0,95}$/u.test(event.eventType))) {
      throw new TypeError("Agent evidence response is mismatched or unsafe");
    }
    return evidence;
  };
}
