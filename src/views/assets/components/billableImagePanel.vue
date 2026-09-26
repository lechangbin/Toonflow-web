<template>
  <div class="billablePanel">
    <div class="billableTitle">受控单资产生图 · 先审批后计费</div>
    <div class="billableHint">仅使用已保存且未过期的资产提示词、参考图和已配置的图片模型。旧批量生成不属于此审批。</div>
    <div v-if="target" class="billableQuote">
      <span>本地单次审批估算上限</span>
      <t-input v-model="amount" placeholder="例如 0.2" style="width: 110px" />
      <t-input v-model="currency" placeholder="USD" style="width: 72px" />
      <t-button size="small" variant="outline" :disabled="busy" @click="saveQuote">保存估算</t-button>
      <span v-if="quote">修订 {{ quote.revision }}</span>
    </div>
    <div class="billableHint">此数值由项目所有者维护，只限定本次批准的估算范围，不保证供应商最终价格或账单。</div>
    <div class="billableActions">
      <t-button theme="primary" :disabled="busy || !quote || !target" @click="propose">创建计费提案</t-button>
      <t-button variant="outline" :disabled="busy" @click="refresh">刷新状态</t-button>
    </div>
    <div v-for="approval in approvals" :key="approval.id" class="billableCard">
      <div>资产 #{{ approval.preview.assetId }} · {{ approval.preview.vendorId }}:{{ approval.preview.modelId }} · {{ approval.preview.resolution }}</div>
      <div>上限 {{ (approval.preview.estimatedMaxCostMicros / 1_000_000).toFixed(6) }} {{ approval.preview.currency }} · 最多一次调用</div>
      <div>{{ approval.preview.disclaimer }}</div>
      <div>范围摘要 {{ approval.scopeHash.slice(0, 12) }}… · 审批截止 {{ new Date(approval.expiresAt).toLocaleString() }}</div>
      <div class="billableStatus">{{ imageApprovalSummary(approval) }}</div>
      <div v-if="approval.vendorRequest">请求 {{ approval.vendorRequest.requestId }} · {{ approval.vendorRequest.status }}</div>
      <div class="billableActions">
        <t-button v-if="approval.status === 'pending' && approval.allowedActions.includes('approve')"
          size="small" theme="warning" :disabled="busy" @click="decide(approval, 'approve')">批准计费范围</t-button>
        <t-button v-if="approval.status === 'pending' && approval.allowedActions.includes('reject')"
          size="small" variant="outline" :disabled="busy" @click="decide(approval, 'reject')">拒绝</t-button>
        <t-button v-if="maySubmitApprovedImage(approval)" size="small" theme="primary"
          :disabled="busy" @click="execute(approval)">提交供应商一次</t-button>
        <t-button v-if="approval.vendorRequest && approval.allowedActions.includes('cancel')"
          size="small" theme="danger" variant="outline" :disabled="busy" @click="cancel(approval)">请求取消</t-button>
        <t-button v-if="approval.vendorRequest && approval.allowedActions.includes('commit_observed_artifact')"
          size="small" theme="primary" :disabled="busy" @click="commitObserved(approval)">提交已观察图片</t-button>
        <t-button v-if="approval.vendorRequest?.artifactHash || approval.vendorRequest?.pendingArtifactHash" size="small" variant="outline"
          :disabled="busy" @click="inspectArtifact(approval)">查看产物证据</t-button>
        <t-button v-if="approval.vendorRequest?.pendingArtifactHash" size="small" variant="outline"
          :disabled="busy" @click="recoverPending(approval)">核对本地待写入媒体</t-button>
        <t-button v-if="approval.vendorRequest && approval.allowedActions.includes('stop_without_replay')"
          size="small" variant="outline" :disabled="busy" @click="stopWithoutReplay(approval)">结束跟踪（不重发）</t-button>
        <t-button v-if="approval.vendorRequest && approval.allowedActions.includes('reconcile_manual')"
          size="small" variant="outline" :disabled="busy" @click="showManualReconciliation(approval)">人工核对指引</t-button>
        <t-button size="small" variant="outline" @click="openEvidence(approval)">查看 Trace 证据</t-button>
      </div>
    </div>
    <agentTraceEvidenceDrawer v-model:visible="evidenceVisible" :project-id="projectId" :run-id="evidenceRunId" />
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import agentTraceEvidenceDrawer from "./agentTraceEvidenceDrawer.vue";
import { imageApprovalSummary, maySubmitApprovedImage, parseVendorModel, quoteMicros,
  type BillableImageApproval, type BillableImageQuote } from "@/utils/billableImageApproval";

const props = defineProps<{ projectId: number; assetId: number; model: string; resolution: string; visible: boolean }>();
const emit = defineEmits<{ completed: [] }>();
const target = computed(() => {
  const model = parseVendorModel(props.model);
  if (!model || !Number.isSafeInteger(props.projectId) || !Number.isSafeInteger(props.assetId)
    || props.projectId <= 0 || props.assetId <= 0 || !props.resolution) return null;
  return { projectId: props.projectId, assetId: props.assetId, ...model, resolution: props.resolution };
});
const busy = ref(false);
const submittingVendorRequest = ref(false);
const quote = ref<BillableImageQuote | null>(null);
const amount = ref("");
const currency = ref("USD");
const approvals = ref<BillableImageApproval[]>([]);
const evidenceVisible = ref(false);
const evidenceRunId = ref("");
let loadedQuoteKey = "";

function openEvidence(approval: BillableImageApproval) {
  evidenceRunId.value = approval.runId;
  evidenceVisible.value = true;
}

async function refresh() {
  if (!props.visible || !props.projectId) return;
  try {
    const response = await axios.post("/agentRuns/billableImage/list", { projectId: props.projectId });
    approvals.value = ((response.data?.approvals ?? []) as BillableImageApproval[])
      .filter((item) => item.preview.assetId === props.assetId).slice(0, 3);
  } catch { approvals.value = []; }
  if (!target.value) { quote.value = null; return; }
  try {
    const { assetId: _assetId, ...quoteTarget } = target.value;
    const response = await axios.post("/agentRuns/billableImage/quote/get", quoteTarget);
    const fresh = (response.data?.quote ?? null) as BillableImageQuote | null;
    const freshKey = `${quoteTarget.projectId}:${quoteTarget.vendorId}:${quoteTarget.modelId}:${quoteTarget.resolution}:${fresh?.revision ?? 0}`;
    quote.value = fresh;
    if (fresh && freshKey !== loadedQuoteKey) {
      amount.value = (fresh.estimatedMaxCostMicros / 1_000_000).toString();
      currency.value = fresh.currency;
    }
    loadedQuoteKey = freshKey;
  } catch { quote.value = null; loadedQuoteKey = ""; }
}

async function saveQuote() {
  if (!target.value || busy.value) return;
  const estimatedMaxCostMicros = quoteMicros(amount.value);
  if (!estimatedMaxCostMicros || !/^[A-Z]{3}$/.test(currency.value)) {
    window.$message.warning("请输入正数金额（最多六位小数）和三位大写货币代码。"); return;
  }
  busy.value = true;
  try {
    const { assetId: _assetId, ...quoteTarget } = target.value;
    await axios.post("/agentRuns/billableImage/quote/set", { ...quoteTarget,
      estimatedMaxCostMicros, currency: currency.value, expectedRevision: quote.value?.revision ?? 0 });
    await refresh();
    window.$message.success("本地审批估算已保存；它并非供应商报价保证。");
  } catch { await refresh(); window.$message.warning("估算修订已变化或保存失败，请刷新后核对。"); }
  finally { busy.value = false; }
}

async function propose() {
  if (!target.value || !quote.value || busy.value) return;
  busy.value = true;
  try {
    await axios.post("/agentRuns/billableImage/propose", { ...target.value,
      clientRequestId: crypto.randomUUID(), operationId: crypto.randomUUID() });
    await refresh();
  } catch { window.$message.warning("无法创建提案。请核对已配置的图片模型、已保存的新鲜提示词和参考图。"); }
  finally { busy.value = false; }
}

async function decide(approval: BillableImageApproval, decision: "approve" | "reject") {
  if (busy.value || !approval.allowedActions.includes(decision)) return;
  const dialog = DialogPlugin.confirm({
    header: decision === "approve" ? "批准一次计费请求范围" : "拒绝计费请求",
    body: `${approval.preview.assetName}；${approval.preview.vendorId}:${approval.preview.modelId}；${approval.preview.resolution}；估算上限 ${(approval.preview.estimatedMaxCostMicros / 1_000_000).toFixed(6)} ${approval.preview.currency}。批准不会立即请求供应商，仍需单独提交。此估算不保证最终账单。`,
    theme: "warning", confirmBtn: decision === "approve" ? "批准范围" : "拒绝",
    onConfirm: async () => {
      busy.value = true;
      try {
        await axios.post("/agentRuns/billableImage/decide", { projectId: props.projectId,
          runId: approval.runId, approvalId: approval.id, clientCommandId: crypto.randomUUID(),
          expectedVersion: approval.runVersion, decision });
        await refresh();
      } catch { await refresh(); window.$message.warning("审批状态已变化，请核对后操作。"); }
      finally { busy.value = false; dialog.destroy(); }
    },
  });
}

function execute(approval: BillableImageApproval) {
  if (busy.value || !maySubmitApprovedImage(approval)) return;
  const dialog = DialogPlugin.confirm({
    header: "确认向供应商提交一次图片请求",
    body: `批准范围 ${approval.scopeHash.slice(0, 12)}…；最多一次调用。提交后超时或断线的结果可能已计费，系统不会自动重试。`,
    theme: "warning", confirmBtn: "提交一次",
    onConfirm: async () => {
      busy.value = true;
      submittingVendorRequest.value = true;
      try {
        // The vendor POST may block; keep the authoritative request state visible meanwhile.
        void refresh();
        const response = await axios.post("/agentRuns/billableImage/execute", {
          projectId: props.projectId, runId: approval.runId, approvalId: approval.id,
          expectedVersion: approval.runVersion });
        if (response.data?.result?.status === "succeeded") emit("completed");
      } catch { window.$message.warning("提交结果不确定；请查看请求状态，勿重新创建请求重试。"); }
      finally { submittingVendorRequest.value = false; busy.value = false; dialog.destroy(); await refresh(); }
    },
  });
}

function cancel(approval: BillableImageApproval) {
  if (!approval.vendorRequest || !approval.allowedActions.includes("cancel") || busy.value) return;
  const dialog = DialogPlugin.confirm({
    header: "请求取消计费图片",
    body: "取消仅记录本地意图，不能保证供应商已取消或退款；迟到图片会作为证据保留，不自动生效。",
    theme: "warning", confirmBtn: "请求取消",
    onConfirm: async () => {
      busy.value = true;
      try { await axios.post("/agentRuns/billableImage/cancel", { projectId: props.projectId,
        requestId: approval.vendorRequest?.requestId, expectedVersion: approval.runVersion }); }
      catch { window.$message.warning("取消状态可能已变化，请刷新核对。"); }
      finally { busy.value = false; dialog.destroy(); await refresh(); }
    },
  });
}

function commitObserved(approval: BillableImageApproval) {
  if (!approval.vendorRequest || !approval.allowedActions.includes("commit_observed_artifact") || busy.value) return;
  const dialog = DialogPlugin.confirm({
    header: "确认提交已观察的图片",
    body: `请求 ${approval.vendorRequest.requestId} 的产物已记录。系统会重新校验目标、审批和取消状态；不再调用供应商。`,
    theme: "warning", confirmBtn: "提交图片",
    onConfirm: async () => {
      busy.value = true;
      try {
        await axios.post("/agentRuns/billableImage/commit", { projectId: props.projectId,
          requestId: approval.vendorRequest?.requestId, expectedVersion: approval.runVersion });
        emit("completed");
      } catch { window.$message.warning("本地提交条件已变化，请刷新后核对；系统不会重发供应商请求。"); }
      finally { busy.value = false; dialog.destroy(); await refresh(); }
    },
  });
}

async function inspectArtifact(approval: BillableImageApproval) {
  if (!approval.vendorRequest || busy.value) return;
  try {
    const response = await axios.post("/agentRuns/billableImage/artifact", { projectId: props.projectId,
      requestId: approval.vendorRequest.requestId });
    const artifact = response.data?.artifact;
    if (!artifact) window.$message.warning("尚无可核对的产物证据。");
    else window.$message.info(`产物 ${artifact.status}；SHA-256 ${artifact.artifactHash.slice(0, 16)}…；媒体记录 ${artifact.mediaPath}。待写入不表示文件已存在。`);
  } catch { window.$message.warning("读取产物证据失败，请刷新后核对。"); }
}

async function recoverPending(approval: BillableImageApproval) {
  if (!approval.vendorRequest?.pendingArtifactHash || busy.value) return;
  busy.value = true;
  try {
    await axios.post("/agentRuns/billableImage/artifact/recover", { projectId: props.projectId,
      requestId: approval.vendorRequest.requestId });
    window.$message.success("本地媒体已按内容哈希核对；仍需检查是否可提交，不会重发供应商请求。");
  } catch { window.$message.warning("本地媒体不可读、哈希不符或状态已变化；未认定为成功，也未重新请求供应商。"); }
  finally { busy.value = false; await refresh(); }
}

function showManualReconciliation(approval: BillableImageApproval) {
  if (!approval.vendorRequest || !approval.allowedActions.includes("reconcile_manual")) return;
  DialogPlugin.alert({ header: "供应商结果待人工核对",
    body: `请求 ${approval.vendorRequest.requestId} 的提交结果未知。请使用供应商控制台或其支持渠道核对是否受理和计费；当前适配器没有可验证的任务 ID，系统不能自动轮询，也不能安全地重发此请求。可以请求取消并结束本地跟踪，但这不代表供应商已取消或退款。`,
    confirmBtn: "知道了" });
}

function stopWithoutReplay(approval: BillableImageApproval) {
  if (!approval.vendorRequest || !approval.allowedActions.includes("stop_without_replay") || busy.value) return;
  const dialog = DialogPlugin.confirm({ header: "结束本地跟踪，不重发",
    body: `请求 ${approval.vendorRequest.requestId} 的供应商效果和计费可能仍未知；结束仅关闭本地 Run，保留请求及迟到产物证据。`,
    theme: "warning", confirmBtn: "结束跟踪",
    onConfirm: async () => {
      busy.value = true;
      try { await axios.post("/agentRuns/billableImage/stop", { projectId: props.projectId,
        requestId: approval.vendorRequest?.requestId, expectedVersion: approval.runVersion }); }
      catch { window.$message.warning("状态已变化，请刷新后核对。"); }
      finally { busy.value = false; dialog.destroy(); await refresh(); }
    },
  });
}

let timer: ReturnType<typeof setInterval> | undefined;
watch(() => [props.visible, props.projectId, props.assetId, props.model, props.resolution], () => { void refresh(); }, { immediate: true });
onMounted(() => { timer = setInterval(() => {
  if (props.visible && (!busy.value || submittingVendorRequest.value)) void refresh();
}, 5000); });
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>

<style scoped>
.billablePanel { margin-top: 16px; border: 1px solid #d0d7e2; border-radius: 8px; padding: 12px; font-size: 12px; }
.billableTitle { font-weight: 700; font-size: 14px; }
.billableHint { margin-top: 6px; color: #646f82; line-height: 1.5; }
.billableQuote, .billableActions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.billableCard { margin-top: 10px; border-top: 1px solid #d0d7e2; padding-top: 8px; line-height: 1.6; overflow-wrap: anywhere; }
.billableStatus { font-weight: 600; }
</style>
