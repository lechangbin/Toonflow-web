<template>
  <div class="traceEvidence">
    <t-button size="small" variant="outline" :disabled="loading || !runId" @click="load">
      {{ loading ? '读取中' : '查看服务端因果证据' }}
    </t-button>
    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <div v-if="evidence" class="drawer">
      <div>Run {{ evidence.runId }} · 已校验脱敏 · 共 {{ evidence.events.length }} 条事件</div>
      <div v-if="evidence.events.length > visible.length">仅展示最近 {{ visible.length }} 条；完整证据保留在服务端。</div>
      <ol>
        <li v-for="event in visible" :key="event.id">
          #{{ event.sequence }} · {{ event.eventType }}
          <span v-if="event.runStatus"> · Run {{ event.runStatus }}</span>
          <span v-if="event.stepStatus"> · Step {{ event.stepStatus }}</span>
          <span v-if="event.videoVendorRequestId"> · Video 请求 {{ event.videoVendorRequestId }}</span>
          <span v-if="event.videoArtifactId"> · Video 媒体 {{ event.videoArtifactId }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import { createAgentTraceEvidenceClient,
  type AgentTraceEvidence } from "@/utils/agentTraceEvidence";

const props = defineProps<{ projectId: number; runId: string | null }>();
const evidence = ref<AgentTraceEvidence | null>(null);
const loading = ref(false);
const error = ref("");
let requestEpoch = 0;
const visible = computed(() => evidence.value?.events.slice(-100) ?? []);
const inspect = createAgentTraceEvidenceClient(<T,>(path: string, body: unknown) =>
  axios.post(path, body) as unknown as Promise<{ data: T }>);

async function load() {
  if (loading.value || !props.runId) return;
  const epoch = ++requestEpoch;
  const projectId = props.projectId;
  const runId = props.runId;
  loading.value = true;
  try {
    const result = await inspect(projectId, runId);
    if (epoch !== requestEpoch || props.projectId !== projectId
      || props.runId !== runId) return;
    evidence.value = result;
    error.value = "";
  } catch {
    if (epoch === requestEpoch) {
      evidence.value = null;
      error.value = "证据不可用或状态已变化，请刷新后重试";
    }
  } finally { if (epoch === requestEpoch) loading.value = false; }
}

watch(() => [props.projectId, props.runId], () => {
  requestEpoch++;
  evidence.value = null;
  error.value = "";
  loading.value = false;
});
onUnmounted(() => { requestEpoch++; });
</script>

<style scoped>
.traceEvidence { margin: 8px 0; font-size: 12px; }
.drawer { max-height: 240px; overflow: auto; border: 1px solid var(--td-border-level-1-color); padding: 8px; }
.error { color: var(--td-error-color); }
ol { padding-left: 24px; }
li { overflow-wrap: anywhere; margin: 3px 0; }
</style>
