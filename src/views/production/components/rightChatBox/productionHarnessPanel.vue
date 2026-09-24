<template>
  <section class="productionHarness" aria-label="生产 Agent 持久 Run">
    <div class="intro">受控生产指导（试用）：读取已授权的工作区；图片或派生资产候选只会创建待项目所有者审批的请求，不会由模型直接生成或写入。</div>
    <div class="grantCard">
      <div class="sectionTitle">项目授权（仅所有者）</div>
      <div v-if="!grants">授权状态尚未读取，请刷新。</div>
      <div v-for="item in grantOptions" :key="item.kind" class="grantRow">
        <span>{{ item.label }} · {{ grants?.[item.kind].active ? '已开启' : '未开启' }} · 版本 {{ grants?.[item.kind].version ?? 0 }}</span>
        <t-button size="small" variant="outline" :disabled="busy || !grants"
          @click="toggleGrant(item.kind)">{{ grants?.[item.kind].active ? '撤销' : '开启' }}</t-button>
      </div>
    </div>
    <t-textarea v-model="input" :disabled="busy" placeholder="描述要检查的拍摄计划、图片或派生资产候选" :maxlength="20000" />
    <div class="actions">
      <t-button size="small" theme="primary" :disabled="busy || !input.trim()" @click="start">创建 Run</t-button>
      <t-button size="small" variant="outline" :disabled="busy" @click="refresh">刷新服务端状态</t-button>
      <t-button v-if="selected?.allowedActions.includes('cancel')" size="small" variant="outline"
        :disabled="busy" @click="cancel">请求取消</t-button>
    </div>
    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <div v-if="selected" class="runCard">
      <div>Run {{ selected.id }} · {{ selected.status }} · 版本 {{ selected.version }}</div>
      <div v-if="selected.attentionReason">需要关注：{{ selected.attentionReason }}</div>
      <pre v-if="selected.outputs.length">{{ selected.outputs.at(-1)?.content }}</pre>
      <div class="sectionTitle">计费图片候选的持久效果</div>
      <div v-if="!effects.length">尚无图片候选或服务端未记录效果。</div>
      <div v-for="effect in effects" :key="effect.operationId" class="effectCard">
        <div>操作 {{ effect.operationId }} · {{ effect.status === 'denied' ? '授权拒绝' : '已建审批' }}</div>
        <template v-if="effect.approval">
          <div>资产 #{{ effect.approval.preview.assetId }} · {{ effect.approval.preview.assetName }}</div>
          <div>{{ imageApprovalSummary(effect.approval) }}</div>
          <div v-if="effect.approval.vendorRequest">请求 {{ effect.approval.vendorRequest.requestId }} · {{ effect.approval.vendorRequest.status }}</div>
          <div class="actions">
            <t-button v-if="effect.approval.status === 'pending' && effect.approval.allowedActions.includes('approve')"
              size="small" theme="warning" :disabled="busy" @click="decide(effect.approval, 'approve')">批准计费范围</t-button>
            <t-button v-if="effect.approval.status === 'pending' && effect.approval.allowedActions.includes('reject')"
              size="small" variant="outline" :disabled="busy" @click="decide(effect.approval, 'reject')">拒绝</t-button>
            <t-button v-if="maySubmitApprovedImage(effect.approval)" size="small" theme="primary"
              :disabled="busy" @click="execute(effect.approval)">提交供应商一次</t-button>
          </div>
        </template>
      </div>
      <div class="sectionTitle">派生资产候选的持久效果</div>
      <div v-if="!derivedEffects.length">尚无派生资产候选或服务端未记录效果。</div>
      <div v-for="effect in derivedEffects" :key="effect.operationId" class="effectCard">
        <div>操作 {{ effect.operationId }} · {{ effect.status === 'denied' ? '授权拒绝' : '已建审批' }}</div>
        <template v-if="effect.approval">
          <div>父资产 #{{ effect.approval.preview.parentAssetId }} · {{ effect.approval.preview.name }}</div>
          <div>{{ derivedApprovalSummary(effect.approval) }}</div>
          <pre v-if="effect.approval.payload">待审精确载荷：{{ JSON.stringify(effect.approval.payload, null, 2) }}</pre>
          <div v-else>精确载荷不可核对；请勿批准。</div>
          <div class="actions">
            <t-button v-if="effect.approval.status === 'pending' && effect.approval.payload && effect.approval.allowedActions.includes('approve')"
              size="small" theme="warning" :disabled="busy" @click="decideDerived(effect.approval, 'approve')">批准写入</t-button>
            <t-button v-if="effect.approval.status === 'pending' && effect.approval.allowedActions.includes('reject')"
              size="small" variant="outline" :disabled="busy" @click="decideDerived(effect.approval, 'reject')">拒绝</t-button>
          </div>
        </template>
      </div>
      <div class="hint">取消、产物修复与人工对账请在对应资产的“受控单资产生图”面板操作。此处只依据后端持久状态，不根据聊天回复判定图片成功。</div>
    </div>
    <div v-if="recent.length" class="recent">
      <div class="sectionTitle">近期 Run</div>
      <t-button v-for="run in recent" :key="run.id" size="small" variant="text"
        @click="select(run)">{{ run.id.slice(0, 10) }} · {{ run.status }}</t-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import { imageApprovalSummary, maySubmitApprovedImage,
  type BillableImageApproval } from "@/utils/billableImageApproval";
import { approvalSummary as derivedApprovalSummary,
  type DerivedAssetApproval } from "@/utils/derivedAssetApproval";
import { createProductionHarnessClient, type ProductionHarnessEffect,
  type ProductionHarnessDerivedEffect, type ProductionHarnessGrants,
  type ProductionHarnessRun } from "@/utils/productionHarnessContract";

const props = defineProps<{ projectId: number }>();
const input = ref("");
const selected = ref<ProductionHarnessRun | null>(null);
const recent = ref<ProductionHarnessRun[]>([]);
const effects = ref<ProductionHarnessEffect[]>([]);
const derivedEffects = ref<ProductionHarnessDerivedEffect[]>([]);
const grants = ref<ProductionHarnessGrants | null>(null);
const grantOptions: Array<{ kind: keyof ProductionHarnessGrants; label: string }> = [
  { kind: "workspace", label: "读取生产工作区" },
  { kind: "imageProposal", label: "提出计费图片候选" },
  { kind: "derivedProposal", label: "提出派生资产候选" },
];
const busy = ref(false);
const error = ref("");
let timer: ReturnType<typeof setInterval> | undefined;
let epoch = 0;
let refreshSequence = 0;

const client = createProductionHarnessClient(<T,>(path: string, body: unknown) =>
  axios.post(path, body) as unknown as Promise<{ data: T }>);

async function refresh() {
  const requestedEpoch = epoch;
  const requestedSequence = ++refreshSequence;
  if (!Number.isSafeInteger(props.projectId) || props.projectId <= 0) return;
  try {
    const [list, grantSnapshot] = await Promise.all([
      client.list(props.projectId), client.grants(props.projectId),
    ]);
    if (requestedEpoch !== epoch || requestedSequence !== refreshSequence) return;
    recent.value = list.recent;
    grants.value = grantSnapshot;
    const id = selected.value?.id ?? list.current?.id ?? list.recent[0]?.id;
    if (!id) { selected.value = null; effects.value = []; derivedEffects.value = []; return; }
    const run = await client.inspect(props.projectId, id);
    const childEffects = await client.effects(props.projectId, id);
    if (requestedEpoch !== epoch || requestedSequence !== refreshSequence) return;
    selected.value = run;
    effects.value = childEffects.effects;
    derivedEffects.value = childEffects.derivedEffects;
    error.value = "";
  } catch (reason) {
    if (requestedEpoch === epoch && requestedSequence === refreshSequence) error.value = reason instanceof Error
      ? reason.message : "无法读取持久 Run 状态，请稍后重试";
  }
}

async function toggleGrant(kind: keyof ProductionHarnessGrants) {
  const current = grants.value?.[kind];
  if (!current || busy.value) return;
  busy.value = true;
  try {
    await client.setGrant(props.projectId, kind, current, !current.active);
    await refresh();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "授权状态不确定，请刷新核对";
  } finally { busy.value = false; }
}

async function start() {
  const content = input.value.trim();
  if (!content || busy.value) return;
  busy.value = true;
  try {
    selected.value = await client.start(props.projectId, crypto.randomUUID(), content);
    input.value = "";
    await refresh();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "创建 Run 失败";
  } finally { busy.value = false; }
}

async function cancel() {
  if (!selected.value || busy.value || !selected.value.allowedActions.includes("cancel")) return;
  busy.value = true;
  try {
    selected.value = await client.cancel(props.projectId, selected.value, crypto.randomUUID());
    await refresh();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "取消状态不确定，请刷新核对";
  } finally { busy.value = false; }
}

function decide(approval: BillableImageApproval, decision: "approve" | "reject") {
  if (busy.value || approval.status !== "pending"
    || !approval.allowedActions.includes(decision)) return;
  const dialog = DialogPlugin.confirm({
    header: decision === "approve" ? "批准一次计费图片范围" : "拒绝图片请求",
    body: `资产 #${approval.preview.assetId}；模型 ${approval.preview.vendorId}:${approval.preview.modelId}；${approval.preview.resolution}；估算上限 ${(approval.preview.estimatedMaxCostMicros / 1_000_000).toFixed(6)} ${approval.preview.currency}。批准仅授权范围，不会立即请求供应商；估算并非最终账单。`,
    theme: "warning", confirmBtn: decision === "approve" ? "批准范围" : "拒绝",
    onConfirm: async () => {
      busy.value = true;
      let warning = "";
      try {
        await client.decideImage(props.projectId, approval, decision, crypto.randomUUID());
      } catch { warning = "审批状态可能已变化，请核对服务端状态；系统不会自动重试。"; }
      finally { busy.value = false; dialog.destroy(); await refresh(); if (warning) error.value = warning; }
    },
  });
}

function execute(approval: BillableImageApproval) {
  if (busy.value || !maySubmitApprovedImage(approval)) return;
  const dialog = DialogPlugin.confirm({
    header: "确认向供应商提交一次图片请求",
    body: `资产 #${approval.preview.assetId}；范围摘要 ${approval.scopeHash.slice(0, 12)}…；最多一次调用。提交后断线或超时可能已计费，系统不会自动重发。`,
    theme: "warning", confirmBtn: "提交一次",
    onConfirm: async () => {
      busy.value = true;
      let warning = "";
      try {
        await client.executeImage(props.projectId, approval);
      } catch { warning = "提交结果可能不确定，请核对请求账本；勿重新提案重试。"; }
      finally { busy.value = false; dialog.destroy(); await refresh(); if (warning) error.value = warning; }
    },
  });
}

function decideDerived(approval: DerivedAssetApproval, decision: "approve" | "reject") {
  if (busy.value || approval.status !== "pending"
    || (decision === "approve" && !approval.payload)
    || !approval.allowedActions.includes(decision)) return;
  const dialog = DialogPlugin.confirm({
    header: decision === "approve" ? "确认写入派生资产" : "拒绝派生资产候选",
    body: `父资产 #${approval.preview.parentAssetId}；${approval.preview.effect === "create" ? "新建" : "更新"}「${approval.preview.name}」；期望版本 ${approval.preview.expectedVersion}；载荷摘要 ${approval.payloadHash.slice(0, 12)}…。请核对上方精确载荷；批准后立即写入本地资产。`,
    theme: "warning", confirmBtn: decision === "approve" ? "批准写入" : "拒绝",
    onConfirm: async () => {
      busy.value = true;
      let warning = "";
      try {
        await client.decideDerived(props.projectId, approval, decision, crypto.randomUUID());
      } catch { warning = "派生资产审批状态可能已变化，请核对服务端状态；系统不会自动重试。"; }
      finally { busy.value = false; dialog.destroy(); await refresh(); if (warning) error.value = warning; }
    },
  });
}

function select(run: ProductionHarnessRun) {
  selected.value = run;
  effects.value = [];
  derivedEffects.value = [];
  void refresh();
}

watch(() => props.projectId, () => {
  epoch++;
  selected.value = null;
  recent.value = [];
  effects.value = [];
  derivedEffects.value = [];
  grants.value = null;
  void refresh();
});
onMounted(() => {
  void refresh();
  timer = setInterval(() => { if (!busy.value) void refresh(); }, 5000);
});
onUnmounted(() => { epoch++; if (timer) clearInterval(timer); });
</script>

<style scoped>
.productionHarness { padding: 10px; overflow-y: auto; flex: 1; font-size: 12px; }
.intro, .hint { line-height: 1.5; margin-bottom: 8px; }
.grantCard { border: 1px solid var(--td-border-level-1-color); border-radius: 6px; padding: 8px; margin: 6px 0; }
.grantRow { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 5px 0; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.error { color: var(--td-error-color); margin: 8px 0; }
.runCard, .effectCard { border: 1px solid var(--td-border-level-1-color); border-radius: 6px; padding: 8px; margin: 6px 0; }
.sectionTitle { font-weight: 600; margin: 10px 0 6px; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
.recent { display: flex; flex-wrap: wrap; gap: 4px; }
</style>
