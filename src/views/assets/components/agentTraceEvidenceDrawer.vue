<template>
  <t-drawer v-model:visible="visible" header="Agent Trace 证据" size="520px" :footer="false">
    <div v-if="loading" class="traceHint">正在读取持久化证据…</div>
    <div v-else-if="error" class="traceError">{{ error }}</div>
    <template v-else-if="evidence">
      <div class="traceHint">Run {{ evidence.runId }} · {{ evidence.timeline.eventCount }} 条事件</div>
      <div class="traceHint">{{ traceLinkageSummary(evidence) }}</div>
      <div class="traceHint">{{ traceFailureClassificationSummary(evidence) }}</div>
      <div class="traceHint">脱敏校验：{{ evidence.redaction.result }}。结构化证据随项目保留；下载文件由浏览器保存，应用不另存导出副本。</div>
      <div class="traceActions">
        <t-button size="small" variant="outline" @click="download">下载脱敏 JSON</t-button>
        <t-button size="small" variant="outline" @click="refresh">刷新证据</t-button>
      </div>
      <ol class="traceList">
        <li v-for="event in evidence.events" :key="event.id" class="traceEvent">
          <div class="traceTitle">#{{ event.sequence }} {{ traceEventLabel(event.eventType) }}</div>
          <div>{{ new Date(event.createdAt).toLocaleString() }} · {{ event.eventType }}</div>
          <div v-if="event.predecessorTraceId">前驱 {{ event.predecessorTraceId }}</div>
          <div v-if="event.attemptId">Attempt {{ event.attemptId }}</div>
          <div v-if="event.toolCallId">ToolCall {{ event.toolCallId }}</div>
          <div v-if="event.vendorRequestId">VendorRequest {{ event.vendorRequestId }}</div>
          <div v-if="event.imageArtifactId">Artifact {{ event.imageArtifactId }}</div>
          <div v-if="event.diagnostic" class="traceDiagnostic">
            {{ event.diagnostic.failureClass }} / {{ event.diagnostic.stage }} ·
            {{ event.diagnostic.certainty }} · {{ event.diagnostic.retryDisposition }}
          </div>
        </li>
      </ol>
    </template>
  </t-drawer>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import { traceEventLabel, traceLinkageSummary, traceFailureClassificationSummary,
  type AgentTraceEvidence } from "@/utils/agentTraceEvidence";

const props = defineProps<{ projectId: number; runId: string }>();
const visible = defineModel<boolean>("visible", { required: true });
const evidence = ref<AgentTraceEvidence | null>(null);
const loading = ref(false);
const error = ref("");
let revision = 0;

async function refresh() {
  if (!visible.value || !props.projectId || !props.runId) return;
  const current = ++revision;
  loading.value = true;
  error.value = "";
  evidence.value = null;
  try {
    const response = await axios.post("/agentRuns/traceEvidence", { projectId: props.projectId, runId: props.runId });
    if (current !== revision) return;
    evidence.value = (response.data?.evidence ?? null) as AgentTraceEvidence | null;
    if (!evidence.value) error.value = "未找到可导出的 Trace 证据。";
  } catch {
    if (current === revision) error.value = "证据不可用：权限、持久化记录或脱敏校验未通过。";
  } finally { if (current === revision) loading.value = false; }
}

function download() {
  if (!evidence.value || evidence.value.redaction.result !== "passed") return;
  const blob = new Blob([JSON.stringify(evidence.value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `toonflow-trace-${evidence.value.runId}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

watch(() => [visible.value, props.projectId, props.runId], () => {
  if (visible.value) void refresh();
  else { revision++; evidence.value = null; error.value = ""; }
}, { immediate: true });
</script>

<style scoped>
.traceHint { color: #5c6575; line-height: 1.5; margin-bottom: 8px; overflow-wrap: anywhere; }
.traceError { color: #c83232; line-height: 1.5; }
.traceActions { display: flex; gap: 8px; margin: 12px 0; }
.traceList { padding-left: 24px; }
.traceEvent { border-left: 2px solid #cdd7e3; padding: 0 0 14px 12px; margin-bottom: 8px; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.traceTitle { font-weight: 700; font-size: 13px; }
.traceDiagnostic { color: #a34b15; }
</style>
