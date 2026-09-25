<template>
  <section class="productionHarness" aria-label="生产 Agent 持久 Run">
    <div class="intro">受控生产指导（试用）：读取已授权的工作区；图片、派生资产、单条分镜和文生视频候选只会创建待项目所有者审批的请求，不会由模型直接生成或写入。</div>
    <div class="grantCard">
      <div class="sectionTitle">项目授权（仅所有者）</div>
      <div v-if="!grants">授权状态尚未读取，请刷新。</div>
      <div v-for="item in grantOptions" :key="item.kind" class="grantRow">
        <span>{{ item.label }} · {{ grants?.[item.kind].active ? '已开启' : '未开启' }} · 版本 {{ grants?.[item.kind].version ?? 0 }}</span>
        <t-button size="small" variant="outline" :disabled="busy || !grants"
          @click="toggleGrant(item.kind)">{{ grants?.[item.kind].active ? '撤销' : '开启' }}</t-button>
      </div>
    </div>
    <t-textarea v-model="input" :disabled="busy" placeholder="描述要检查的拍摄计划、图片、派生资产、分镜或视频候选" :maxlength="20000" />
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
      <div class="sectionTitle">单条分镜候选的持久效果</div>
      <div v-if="!storyboardEffects.length">尚无分镜候选或服务端未记录效果。</div>
      <div v-for="effect in storyboardEffects" :key="effect.operationId" class="effectCard">
        <div>操作 {{ effect.operationId }} · {{ effect.status === 'denied' ? '授权拒绝' : '已建审批' }}</div>
        <template v-if="effect.approval">
          <div>剧本 #{{ effect.approval.preview.scriptId }} · 轨道 #{{ effect.approval.preview.trackId }} · {{ effect.approval.status }}</div>
          <div>时长 {{ effect.approval.preview.duration }} 秒 · 关联资产 {{ effect.approval.preview.assetCount }} 个</div>
          <div v-if="effect.approval.receiptOutput">已提交分镜 #{{ effect.approval.receiptOutput.storyboardId }}</div>
          <pre v-if="effect.approval.payload">待审精确载荷：{{ JSON.stringify(effect.approval.payload, null, 2) }}</pre>
          <div v-else>精确载荷不可核对；请勿批准。</div>
          <div class="actions">
            <t-button v-if="effect.approval.status === 'pending' && effect.approval.payload && effect.approval.allowedActions.includes('approve')"
              size="small" theme="warning" :disabled="busy" @click="decideStoryboard(effect.approval, 'approve')">批准写入分镜</t-button>
            <t-button v-if="effect.approval.status === 'pending' && effect.approval.allowedActions.includes('reject')"
              size="small" variant="outline" :disabled="busy" @click="decideStoryboard(effect.approval, 'reject')">拒绝</t-button>
          </div>
        </template>
      </div>
      <div class="sectionTitle">单轨道文生视频候选的持久效果</div>
      <div v-if="!videoEffects.length">尚无视频候选或服务端未记录效果。</div>
      <div v-for="effect in videoEffects" :key="effect.operationId" class="effectCard">
        <div>操作 {{ effect.operationId }} · {{ effect.status === 'denied' ? '授权拒绝' : '已建审批' }}</div>
        <template v-if="effect.approval">
          <div>剧本 #{{ effect.approval.preview.scriptId }} · 轨道 #{{ effect.approval.preview.trackId }} · {{ effect.approval.status }}</div>
          <div>{{ effect.approval.preview.vendorId }}:{{ effect.approval.preview.modelId }} · {{ effect.approval.preview.duration }} 秒</div>
          <div>本地估算上限 {{ (effect.approval.preview.estimatedMaxCostMicros / 1_000_000).toFixed(6) }} {{ effect.approval.preview.currency }} · 报价版本 {{ effect.approval.preview.quoteRevision }}；非实际账单</div>
          <pre>待审精确载荷：{{ JSON.stringify(effect.approval.payload, null, 2) }}</pre>
          <div v-if="effect.approval.vendorRequest">原请求 {{ effect.approval.vendorRequest.requestId }} · {{ effect.approval.vendorRequest.status }} · 媒体 {{ effect.approval.vendorRequest.artifactStatus ?? '未观察' }}</div>
          <div v-else-if="effect.approval.status === 'approved'">仅批准范围；供应商尚未提交。</div>
          <div class="actions">
            <t-button v-if="effect.approval.status === 'pending' && effect.approval.allowedActions.includes('approve')"
              size="small" theme="warning" :disabled="busy" @click="decideVideo(effect.approval, 'approve')">批准视频计费范围</t-button>
            <t-button v-if="effect.approval.status === 'pending' && effect.approval.allowedActions.includes('reject')"
              size="small" variant="outline" :disabled="busy" @click="decideVideo(effect.approval, 'reject')">拒绝</t-button>
            <t-button v-if="mayExecuteVideo(effect.approval)" size="small" theme="primary"
              :disabled="busy" @click="executeVideo(effect.approval)">明确提交一次视频请求</t-button>
            <t-button v-if="mayCancelVideo(effect.approval)" size="small" variant="outline"
              :disabled="busy" @click="videoRequestAction(effect.approval, 'cancel')">记录本地取消意图</t-button>
            <t-button v-if="mayStopVideo(effect.approval)" size="small" variant="outline"
              :disabled="busy" @click="videoRequestAction(effect.approval, 'stop')">停止本地追踪且不重发</t-button>
            <t-button v-if="effect.approval.vendorRequest?.artifactStatus === 'write_pending'" size="small" variant="outline"
              :disabled="busy" @click="videoRequestAction(effect.approval, 'recover')">检查本地待写媒体</t-button>
            <t-button v-if="mayCommitVideo(effect.approval)" size="small" theme="warning"
              :disabled="busy" @click="videoRequestAction(effect.approval, 'commit')">采纳已核验媒体</t-button>
          </div>
        </template>
      </div>
      <div class="hint">图片取消与产物修复请在对应资产的“受控单资产生图”面板操作。视频异常或结果未知时先核对原请求；本面板不自动重试。此处只依据后端持久状态，不根据聊天回复判定生成成功。</div>
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
import { chooseHarnessRecentRun } from "@/utils/harnessRecentRuns";
import { createProductionHarnessClient, type ProductionHarnessEffect,
  type ProductionHarnessDerivedEffect, type ProductionHarnessGrants,
  type ProductionHarnessRun, type ProductionHarnessStoryboardEffect,
  type StoryboardWriteApproval, type ProductionHarnessVideoEffect,
  type VideoGenerationApproval } from "@/utils/productionHarnessContract";

const props = defineProps<{ projectId: number }>();
const input = ref("");
const selected = ref<ProductionHarnessRun | null>(null);
const recent = ref<ProductionHarnessRun[]>([]);
const effects = ref<ProductionHarnessEffect[]>([]);
const derivedEffects = ref<ProductionHarnessDerivedEffect[]>([]);
const storyboardEffects = ref<ProductionHarnessStoryboardEffect[]>([]);
const videoEffects = ref<ProductionHarnessVideoEffect[]>([]);
const grants = ref<ProductionHarnessGrants | null>(null);
const grantOptions: Array<{ kind: keyof ProductionHarnessGrants; label: string }> = [
  { kind: "workspace", label: "读取生产工作区" },
  { kind: "imageProposal", label: "提出计费图片候选" },
  { kind: "derivedProposal", label: "提出派生资产候选" },
  { kind: "storyboardProposal", label: "提出单条分镜候选" },
  { kind: "videoProposal", label: "提出单轨道文生视频候选" },
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
    const selection = chooseHarnessRecentRun({ selectedId: selected.value?.id,
      current: list.current, recent: list.recent });
    recent.value = selection.recent;
    grants.value = grantSnapshot;
    const id = selection.selectedId;
    if (!id) { selected.value = null; effects.value = []; derivedEffects.value = [];
      storyboardEffects.value = []; videoEffects.value = []; return; }
    const run = await client.inspect(props.projectId, id);
    const childEffects = await client.effects(props.projectId, id);
    if (requestedEpoch !== epoch || requestedSequence !== refreshSequence) return;
    selected.value = run;
    effects.value = childEffects.effects;
    derivedEffects.value = childEffects.derivedEffects;
    storyboardEffects.value = childEffects.storyboardEffects;
    videoEffects.value = childEffects.videoEffects;
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

function decideStoryboard(approval: StoryboardWriteApproval, decision: "approve" | "reject") {
  if (busy.value || approval.status !== "pending"
    || (decision === "approve" && !approval.payload)
    || !approval.allowedActions.includes(decision)) return;
  const dialog = DialogPlugin.confirm({
    header: decision === "approve" ? "确认写入一条分镜" : "拒绝分镜候选",
    body: `剧本 #${approval.preview.scriptId}；已有轨道 #${approval.preview.trackId}；时长 ${approval.preview.duration} 秒；关联资产 ${approval.preview.assetCount} 个；载荷摘要 ${approval.payloadHash.slice(0, 12)}…。请核对上方精确载荷；批准后立即写入本地分镜，不会生成图片或视频。`,
    theme: "warning", confirmBtn: decision === "approve" ? "批准写入" : "拒绝",
    onConfirm: async () => {
      busy.value = true;
      let warning = "";
      try {
        await client.decideStoryboard(props.projectId, approval, decision, crypto.randomUUID());
      } catch { warning = "分镜审批状态可能已变化，请核对服务端状态；系统不会自动重试。"; }
      finally { busy.value = false; dialog.destroy(); await refresh(); if (warning) error.value = warning; }
    },
  });
}

function mayExecuteVideo(approval: VideoGenerationApproval): boolean {
  return approval.status === "approved" && approval.vendorRequest === null
    && approval.expiresAt > Date.now();
}

function mayCancelVideo(approval: VideoGenerationApproval): boolean {
  return approval.runStatus === "waiting" && !!approval.vendorRequest
    && ["dispatch_recorded", "unknown", "submitted", "artifact_observed"]
      .includes(approval.vendorRequest.status);
}

function mayStopVideo(approval: VideoGenerationApproval): boolean {
  return approval.runStatus === "waiting" && !!approval.vendorRequest
    && ["cancellation_requested", "unknown", "late_artifact_observed"]
      .includes(approval.vendorRequest.status);
}

function mayCommitVideo(approval: VideoGenerationApproval): boolean {
  return approval.runStatus === "waiting"
    && approval.vendorRequest?.status === "artifact_observed"
    && approval.vendorRequest.artifactStatus === "observed";
}

function videoRequestAction(approval: VideoGenerationApproval,
  action: "cancel" | "stop" | "recover" | "commit") {
  const request = approval.vendorRequest;
  if (busy.value || !request || action === "cancel" && !mayCancelVideo(approval)
    || action === "stop" && !mayStopVideo(approval)
    || action === "commit" && !mayCommitVideo(approval)
    || action === "recover" && request.artifactStatus !== "write_pending") return;
  const descriptions = {
    cancel: "仅记录本地取消意图，不证明供应商已经停止或免计费。",
    stop: "关闭本地追踪，不重发原请求，也不证明供应商没有产生费用或迟到结果。",
    recover: "只检查原请求已记录的本地媒体路径，不重新调用供应商。",
    commit: "仅在服务端再次验证目标、审批和媒体证据后采纳到 Project；冲突时保留原证据。",
  };
  const dialog = DialogPlugin.confirm({
    header: `视频原请求 · ${action}`,
    body: `请求 ${request.requestId}；当前状态 ${request.status}。${descriptions[action]}`,
    theme: "warning", confirmBtn: "确认操作",
    onConfirm: async () => {
      busy.value = true;
      let warning = "";
      try {
        if (action === "cancel") await client.cancelVideo(props.projectId, approval);
        else if (action === "stop") await client.stopVideo(props.projectId, approval);
        else if (action === "recover") await client.recoverVideo(props.projectId, approval);
        else await client.commitVideo(props.projectId, approval);
      } catch { warning = "原请求状态可能已变化，请刷新并核对服务端证据；系统不会自动重试。"; }
      finally { busy.value = false; dialog.destroy(); await refresh(); if (warning) error.value = warning; }
    },
  });
}

function decideVideo(approval: VideoGenerationApproval, decision: "approve" | "reject") {
  if (busy.value || approval.status !== "pending"
    || !approval.allowedActions.includes(decision)) return;
  const dialog = DialogPlugin.confirm({
    header: decision === "approve" ? "批准一次视频计费范围" : "拒绝视频候选",
    body: `剧本 #${approval.preview.scriptId}；轨道 #${approval.preview.trackId}；${approval.preview.vendorId}:${approval.preview.modelId}；本地估算上限 ${(approval.preview.estimatedMaxCostMicros / 1_000_000).toFixed(6)} ${approval.preview.currency}；范围 ${approval.scopeHash.slice(0, 12)}…。批准不会提交供应商；请先核对精确载荷。`,
    theme: "warning", confirmBtn: decision === "approve" ? "批准范围" : "拒绝",
    onConfirm: async () => {
      busy.value = true;
      let warning = "";
      try { await client.decideVideo(props.projectId, approval, decision, crypto.randomUUID()); }
      catch { warning = "视频审批状态可能已变化，请刷新核对；系统不会自动重试。"; }
      finally { busy.value = false; dialog.destroy(); await refresh(); if (warning) error.value = warning; }
    },
  });
}

function executeVideo(approval: VideoGenerationApproval) {
  if (busy.value || !mayExecuteVideo(approval)) return;
  const dialog = DialogPlugin.confirm({
    header: "确认向供应商提交一次视频请求",
    body: `剧本 #${approval.preview.scriptId}；轨道 #${approval.preview.trackId}；范围 ${approval.scopeHash.slice(0, 12)}…。这可能产生费用；断线或超时也可能已经提交，不会自动重发。服务端默认关闭此执行入口，需操作员显式启用。`,
    theme: "warning", confirmBtn: "提交一次",
    onConfirm: async () => {
      busy.value = true;
      let warning = "";
      try { await client.executeVideo(props.projectId, approval); }
      catch { warning = "视频请求可能未开放或提交结果不确定，请核对原请求账本；勿重新提案重试。"; }
      finally { busy.value = false; dialog.destroy(); await refresh(); if (warning) error.value = warning; }
    },
  });
}

function select(run: ProductionHarnessRun) {
  selected.value = run;
  effects.value = [];
  derivedEffects.value = [];
  storyboardEffects.value = [];
  videoEffects.value = [];
  void refresh();
}

watch(() => props.projectId, () => {
  epoch++;
  selected.value = null;
  recent.value = [];
  effects.value = [];
  derivedEffects.value = [];
  storyboardEffects.value = [];
  videoEffects.value = [];
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
