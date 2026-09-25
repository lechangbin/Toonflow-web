<template>
  <div class="scriptAgent">
    <Splitpanes class="default-theme data f">
      <Pane :size="30" :min-size="15" class="operate">
        <div class="box pr">
          <t-chat-list v-if="!harnessMode" :clear-history="false">
            <t-chat-message
              v-for="message in messages"
              :key="message.id"
              :message="message"
              :name="(message as any).name"
              :placement="message.role === 'user' ? 'right' : 'left'"
              :variant="message.role === 'user' ? 'base' : 'outline'"
              :handleActions="message.role === 'user' ? {} : handleActions"
              :status="message.status"
              allowContentSegmentCustom></t-chat-message>
          </t-chat-list>
          <t-chat-sender
            class="inputBox"
            :disabled="harnessMode ? harnessBusy : status === 'pending' || status === 'streaming'"
            v-model="inputValue"
            :loading="harnessMode ? harnessBusy || harnessActive : status === 'pending' || status === 'streaming'"
            placeholder="$t('workbench.scriptAgent.inputPlaceholder')"
            @send="handleSend"
            @stop="handleStop">
            <template #footer-prefix>
              <t-button size="small" variant="outline" :disabled="harnessBusy || (!harnessMode && (status === 'pending' || status === 'streaming'))"
                @click="toggleHarnessMode">
                {{ harnessMode ? "退出监督 Harness" : "试用监督 Harness" }}
              </t-button>
              <t-popup v-if="!harnessMode" trigger="click" placement="top-left">
                <t-button shape="square" variant="outline" size="small" :disabled="status === 'pending' || status === 'streaming'">
                  <template #icon>
                    <i-setting-config size="16" />
                  </template>
                </t-button>
                <template #content>
                  <div class="settingMenu">
                    <div class="settingMenuItem" @click="handleReconnect()">
                      <i-api size="14" />
                      <span>{{ $t("workbench.scriptAgent.reconnect") }}</span>
                    </div>
                    <div class="settingMenuItem" @click="handleClearMemory('message')">
                      <i-delete size="14" />
                      <span>{{ $t("workbench.scriptAgent.clearMessageMemory") }}</span>
                    </div>
                    <div class="settingMenuItem" @click="handleClearMemory('summary')">
                      <i-close size="14" />
                      <span>{{ $t("workbench.scriptAgent.clearSummaryMemory") }}</span>
                    </div>
                    <div class="settingMenuItem danger" @click="handleClearMemory('all')">
                      <i-delete-one size="14" />
                      <span>{{ $t("workbench.scriptAgent.clearAllMemory") }}</span>
                    </div>
                  </div>
                </template>
              </t-popup>
              <t-popup trigger="click" placement="top" v-if="showThink && !harnessMode">
                <t-button
                  size="small"
                  variant="outline"
                  :theme="(['default', 'success', 'warning', 'danger'] as const)[thinkLevel] || 'default'"
                  style="margin-left: 8px">
                  <template #icon>
                    <i-tips size="16" />
                  </template>
                  {{ thinkLevelOptions[thinkLevel]?.label }}
                </t-button>
                <template #content>
                  <div class="settingMenu">
                    <div
                      v-for="opt in thinkLevelOptions"
                      :key="opt.value"
                      class="settingMenuItem"
                      :class="{ active: thinkLevel === opt.value }"
                      @click="scriptAgentStore().updateThinkConfig(opt.value)">
                      <span>{{ opt.label }}</span>
                    </div>
                  </div>
                </template>
              </t-popup>
            </template>
          </t-chat-sender>
          <div v-if="harnessMode" class="harnessStatus">
            <div>模型只能提出候选，不能直接写入；下方独立提案经批准后才会修改项目。</div>
            <div v-if="harnessRun">Run {{ harnessRun.id }} · {{ harnessRun.status }}</div>
            <div v-if="harnessRecent.length" class="harnessApprovalTitle">服务端最近 Run（最多 20 条）</div>
            <div v-if="harnessRecent.length" class="harnessRecent">
              <t-button v-for="run in harnessRecent" :key="run.id" size="small"
                :variant="harnessRun?.id === run.id ? 'outline' : 'text'"
                :disabled="harnessBusy" @click="selectHarnessRun(run)">
                {{ run.id.slice(0, 10) }} · {{ run.status }}
              </t-button>
            </div>
            <div v-if="harnessRun?.attentionReason">需处理：{{ harnessRun.attentionReason }}</div>
            <div v-if="harnessError" class="harnessError">{{ harnessError }}</div>
            <pre v-if="harnessRun?.outputs?.length">{{ harnessRun.outputs.at(-1)?.content }}</pre>
            <t-button size="small" variant="text" :disabled="harnessBusy" @click="refreshHarnessRun">刷新状态</t-button>
            <div class="harnessApprovalTitle">模型提案授权（需已发布 Skill 声明对应 Tool）</div>
            <div v-if="grantError" class="harnessError">{{ grantError }}</div>
            <div v-if="proposalGrants" class="harnessGrantControls">
              <t-button size="small" variant="outline" :disabled="grantBusy" @click="confirmProposalGrant('workspace')">
                规划候选：{{ proposalGrants.workspace.active ? "已允许" : "未允许" }}
              </t-button>
              <t-button size="small" variant="outline" :disabled="grantBusy" @click="confirmProposalGrant('script')">
                剧本候选：{{ proposalGrants.script.active ? "已允许" : "未允许" }}
              </t-button>
            </div>
            <div class="harnessApprovalTitle">待审批写入候选（批准后才会修改项目）</div>
            <div v-if="approvalError" class="harnessError">{{ approvalError }}</div>
            <div v-for="approval in writeApprovals" :key="approval.id" class="harnessApproval">
              <div>{{ approval.kind }} · {{ approval.status }} · {{ approval.runId }}</div>
              <div v-if="approval.sourceRunId">来自模型 Run {{ approval.sourceRunId }}</div>
              <pre>{{ JSON.stringify(approval.preview, null, 2) }}</pre>
              <div v-if="approval.status === 'pending'">
                <t-button size="small" variant="outline" :disabled="approvalBusy" @click="reviewScriptWrite(approval)">查看待写入全文</t-button>
                <pre v-if="reviewedApproval?.approval.id === approval.id && reviewedApproval.approval.runVersion === approval.runVersion">
{{ reviewedApproval.payload.content }}</pre>
                <t-button size="small" theme="primary" :disabled="approvalBusy || !isReviewed(approval)" @click="confirmScriptWrite(approval, 'approve')">批准</t-button>
                <t-button size="small" variant="outline" :disabled="approvalBusy" @click="confirmScriptWrite(approval, 'reject')">拒绝</t-button>
              </div>
            </div>
            <t-button size="small" variant="text" :disabled="approvalBusy" @click="refreshWriteApprovals">刷新写入提案</t-button>
          </div>
          <i-dot class="dot" theme="outline" :fill="harnessMode ? 'blue' : connected ? 'green' : 'red'" />
          <transition name="fade">
            <div v-if="forceGenerateVisible" class="forceGenerateMask">
              <div class="forceGenerateCard">
                <div class="forceGenerateDesc">{{ $t("workbench.scriptAgent.forceGenerate.desc") }}</div>
                <div class="forceGenerateActions">
                  <t-button @click="forceGenerateVisible = false">{{ $t("workbench.scriptAgent.forceGenerate.confirm") }}</t-button>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </Pane>
      <Pane :size="70" :min-size="30" class="data">
        <div class="tabsWrapper">
          <t-tabs v-model="currentTable">
            <template #action>
              <div class="ac" v-if="currentTable == 1">
                <t-button @click="editMdPreview">{{ $t("workbench.scriptAgent.edit") }}</t-button>
              </div>
              <div class="ac" v-else-if="currentTable == 2">
                <t-button @click="editMdPreview">{{ $t("workbench.scriptAgent.edit") }}</t-button>
              </div>
            </template>
            <!-- <t-tab-panel :value="1" :label="$t('workbench.scriptAgent.chapterEvents')">
              <pre>{{ planData.event }}</pre>
            </t-tab-panel> -->
            <t-tab-panel :value="1" :label="$t('workbench.scriptAgent.storySkeleton')">
              <div class="panelContent">
                <MdPreview
                  v-if="planData.storySkeleton"
                  :modelValue="planData.storySkeleton"
                  :theme="themeSetting.mode === 'auto' ? undefined : themeSetting.mode" />
                <t-empty v-else :title="$t('workbench.scriptAgent.noContent')" />
              </div>
            </t-tab-panel>
            <t-tab-panel :value="2" :label="$t('workbench.scriptAgent.adaptationStrategy')">
              <div class="panelContent">
                <MdPreview
                  v-if="planData.adaptationStrategy"
                  :modelValue="planData.adaptationStrategy"
                  :theme="themeSetting.mode === 'auto' ? undefined : themeSetting.mode" />
                <t-empty v-else :title="$t('workbench.scriptAgent.noContent')" />
              </div>
            </t-tab-panel>
            <t-tab-panel :value="3" :label="$t('workbench.scriptAgent.script')">
              <div class="panelContent">
                <t-empty v-if="!planData.script?.length" :title="$t('workbench.scriptAgent.noContent')" />
                <div v-else class="scriptList">
                  <div
                    v-for="(item, index) in planData.script"
                    :key="getScriptCardKey(item, index)"
                    class="scriptCard"
                    :class="{ collapsed: isCardCollapsed(item, index) }">
                    <div class="scriptCardHeader">
                      <div class="scriptCardHeaderLeft">
                        <span class="scriptIndex">#{{ index + 1 }}</span>
                        <span class="scriptTitle">{{ item.name }}</span>
                      </div>
                      <div class="scriptCardActions">
                        <t-button size="small" variant="outline" @click="toggleCardCollapse(item, index)">
                          <template #icon>
                            <i-down v-if="!isCardCollapsed(item, index)" size="14" />
                            <i-right v-else size="14" />
                          </template>
                        </t-button>
                        <t-button size="small" @click="editScript(index)">
                          <template #icon><i-edit size="14" /></template>
                        </t-button>
                        <t-button theme="danger" variant="outline" size="small" @click="delScript(index)">
                          <template #icon><i-delete size="14" /></template>
                        </t-button>
                      </div>
                    </div>
                    <div class="scriptCardBody" v-if="!isCardCollapsed(item, index)">
                      <pre v-if="item.content">{{ item.content }}</pre>
                      <span v-else class="emptyContent">{{ $t("workbench.scriptAgent.noContent") }}</span>
                    </div>
                  </div>
                </div>
                <!-- 悬浮折叠按钮 -->
                <div class="floatCollapseBtn" v-if="planData.script?.length">
                  <t-button shape="circle" size="large" theme="primary" @click="toggleAllCards">
                    <template #icon>
                      <i-right v-if="isAllCollapsed" title="" size="18" />
                      <i-down v-else size="18" />
                    </template>
                  </t-button>
                </div>
              </div>
            </t-tab-panel>
          </t-tabs>
        </div>
      </Pane>
    </Splitpanes>
    <editMdPreivew v-model="dialogVisible" @save="onConfirm" :content="editContent" />

    <!-- 剧本编辑对话框 -->
    <t-dialog
      v-model:visible="scriptEditVisible"
      :header="$t('workbench.scriptAgent.editScript')"
      width="80%"
      top="10vh"
      placement="center"
      :confirm-btn="{ content: $t('workbench.scriptAgent.save'), theme: 'primary' }"
      @confirm="saveScript"
      @close="scriptEditVisible = false">
      <div class="scriptEditForm">
        <div class="scriptEditField">
          <strong>{{ scriptEditData.name }}</strong>
        </div>
        <div class="scriptEditField">
          <label>{{ $t("workbench.scriptAgent.content") }}</label>
          <MdEditor
            v-model="scriptEditData.content"
            :theme="themeSetting.mode === 'auto' ? undefined : themeSetting.mode"
            :toolbars="toolbars"
            :footers="[]"
            style="height: 50vh"
            @onUploadImg="() => {}"
            @drop.prevent />
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { MdEditor } from "md-editor-v3";
import type { ToolbarNames } from "md-editor-v3";
import { MdPreview } from "md-editor-v3";
import settingStore from "@/stores/setting";
const { themeSetting } = storeToRefs(settingStore());
import { Splitpanes, Pane } from "splitpanes";
import axios from "@/utils/axios";
import { v4 as uuid } from "uuid";
import { createScriptHarnessClient, isScriptHarnessTerminal, type ScriptHarnessRun } from "@/utils/scriptHarnessContract";
import { chooseHarnessRecentRun } from "@/utils/harnessRecentRuns";
import { createScriptWriteApprovalClient, type ScriptProposalGrants, type ScriptWriteApproval, type ScriptWriteApprovalReview } from "@/utils/scriptWriteApprovalContract";
import type { ChatMessagesData } from "@tdesign-vue-next/chat";
import projectStore from "@/stores/project";
const { project } = storeToRefs(projectStore());
import editMdPreivew from "@/components/editMdPreivew.vue";
import scriptAgentStore from "@/stores/scriptAgent";
const { connected, messages, status, planData, thinkLevel } = storeToRefs(scriptAgentStore());
const harnessMode = ref(false);
const harnessRun = ref<ScriptHarnessRun | null>(null);
const harnessCurrent = ref<ScriptHarnessRun | null>(null);
const harnessRecent = ref<ScriptHarnessRun[]>([]);
const harnessBusy = ref(false);
const harnessError = ref("");
const harnessActive = computed(() => harnessCurrent.value?.status === "queued"
  || harnessCurrent.value?.status === "running");
const harnessClient = createScriptHarnessClient(<T,>(path: string, body: unknown) =>
  axios.post(path, body) as unknown as Promise<{ data: T }>);
const approvalClient = createScriptWriteApprovalClient(<T,>(path: string, body: unknown) =>
  axios.post(path, body) as unknown as Promise<{ data: T }>);
const writeApprovals = ref<ScriptWriteApproval[]>([]);
const proposalGrants = ref<ScriptProposalGrants | null>(null);
const grantBusy = ref(false);
const grantError = ref("");
const reviewedApproval = ref<ScriptWriteApprovalReview | null>(null);
const approvalBusy = ref(false);
const approvalError = ref("");
let harnessTimer: ReturnType<typeof setTimeout> | undefined;
let harnessEpoch = 0;
let harnessRefreshSequence = 0;

function clearHarnessTimer() {
  if (harnessTimer) clearTimeout(harnessTimer);
  harnessTimer = undefined;
}
function showHarnessError(error: unknown) {
  harnessError.value = error instanceof Error ? error.message : "Harness 请求失败，请刷新状态后重试";
}
function acceptHarnessRun(run: ScriptHarnessRun, epoch: number) {
  if (!harnessMode.value || epoch !== harnessEpoch) return;
  const wasActive = harnessActive.value;
  harnessRun.value = run;
  if (harnessCurrent.value?.id === run.id) {
    harnessCurrent.value = run;
  }
  harnessRecent.value = [run, ...harnessRecent.value.filter((entry) => entry.id !== run.id)]
    .slice(0, 20);
  clearHarnessTimer();
  if (wasActive && isScriptHarnessTerminal(run.status)) {
    void refreshWriteApprovals();
  }
  if (harnessActive.value || !isScriptHarnessTerminal(run.status) && run.status !== "waiting") {
    harnessTimer = setTimeout(() => { void refreshHarnessRun(); }, 3000);
  }
}
async function refreshHarnessRun() {
  if (!harnessMode.value || !project.value?.id) return;
  const epoch = harnessEpoch;
  const sequence = ++harnessRefreshSequence;
  try {
    const list = await harnessClient.list(project.value.id);
    if (epoch !== harnessEpoch || sequence !== harnessRefreshSequence || !harnessMode.value) return;
    const selection = chooseHarnessRecentRun({ selectedId: harnessRun.value?.id,
      current: list.current, recent: list.recent });
    const run = selection.selectedId
      ? await harnessClient.inspect(project.value.id, selection.selectedId) : null;
    if (epoch !== harnessEpoch || sequence !== harnessRefreshSequence || !harnessMode.value) return;
    harnessCurrent.value = list.current;
    harnessRecent.value = selection.recent;
    harnessError.value = "";
    if (run) acceptHarnessRun(run, epoch);
    else harnessRun.value = null;
  } catch (error) {
    if (epoch === harnessEpoch) showHarnessError(error);
  }
}
function selectHarnessRun(run: ScriptHarnessRun) {
  if (!harnessMode.value || harnessBusy.value) return;
  harnessRun.value = run;
  void refreshHarnessRun();
}
async function toggleHarnessMode() {
  if (harnessBusy.value) return;
  clearHarnessTimer();
  harnessEpoch += 1;
  harnessError.value = "";
  harnessRun.value = null;
  harnessCurrent.value = null;
  harnessRecent.value = [];
  if (harnessMode.value) {
    harnessMode.value = false;
    writeApprovals.value = [];
    proposalGrants.value = null;
    reviewedApproval.value = null;
    scriptAgentStore().connect();
    return;
  }
  scriptAgentStore().disconnect();
  harnessMode.value = true;
  await Promise.all([refreshHarnessRun(), refreshWriteApprovals(), refreshProposalGrants()]);
}
onUnmounted(() => { clearHarnessTimer(); harnessEpoch += 1; });
watch(() => project.value?.id, () => {
  if (!harnessMode.value) return;
  clearHarnessTimer();
  harnessEpoch += 1;
  harnessRun.value = null;
  harnessCurrent.value = null;
  harnessRecent.value = [];
  writeApprovals.value = [];
  proposalGrants.value = null;
  reviewedApproval.value = null;
  void Promise.all([refreshHarnessRun(), refreshWriteApprovals(), refreshProposalGrants()]);
});

async function refreshProposalGrants() {
  if (!harnessMode.value || !project.value?.id) return;
  const epoch = harnessEpoch;
  try {
    const grants = await approvalClient.grants(project.value.id);
    if (epoch !== harnessEpoch) return;
    proposalGrants.value = grants;
    grantError.value = "";
  } catch (error) {
    if (epoch === harnessEpoch) grantError.value = error instanceof Error
      ? error.message : "模型提案授权读取失败";
  }
}
function confirmProposalGrant(kind: "workspace" | "script") {
  if (!harnessMode.value || !proposalGrants.value || grantBusy.value) return;
  const active = !proposalGrants.value[kind].active;
  const dialog = DialogPlugin.confirm({
    header: active ? "允许模型提出此类候选？" : "撤销此类候选授权？",
    body: active
      ? "这只允许已授权 Skill 提出待审批候选，不会自动修改项目；每项写入仍需您查看全文并批准。"
      : "撤销阻止后续模型提案，不会删除已有独立审批候选。",
    confirmBtn: active ? "允许提出候选" : "撤销授权",
    cancelBtn: "取消", theme: "warning",
    onConfirm: async () => {
      if (!project.value?.id || !proposalGrants.value) return;
      const epoch = harnessEpoch;
      grantBusy.value = true;
      try {
        await approvalClient.setGrant(project.value.id, kind, proposalGrants.value, active);
        if (epoch === harnessEpoch) await refreshProposalGrants();
        dialog.destroy();
      } catch (error) {
        if (epoch === harnessEpoch) {
          await refreshProposalGrants();
          grantError.value = error instanceof Error ? error.message : "授权更新失败，请刷新后重试";
        }
      } finally {
        if (epoch === harnessEpoch) grantBusy.value = false;
      }
    },
  });
}

async function refreshWriteApprovals() {
  if (!harnessMode.value || !project.value?.id) return;
  const epoch = harnessEpoch;
  try {
    const approvals = await approvalClient.list(project.value.id);
    if (epoch !== harnessEpoch) return;
    writeApprovals.value = approvals;
    if (reviewedApproval.value && !approvals.some((item) => isReviewed(item))) {
      reviewedApproval.value = null;
    }
    approvalError.value = "";
  } catch (error) {
    if (epoch === harnessEpoch) approvalError.value = error instanceof Error
      ? error.message : "写入提案读取失败";
  }
}
function isReviewed(approval: ScriptWriteApproval): boolean {
  return reviewedApproval.value?.approval.id === approval.id
    && reviewedApproval.value.approval.runId === approval.runId
    && reviewedApproval.value.approval.runVersion === approval.runVersion
    && reviewedApproval.value.approval.payloadHash === approval.payloadHash
    && approval.status === "pending";
}
async function reviewScriptWrite(approval: ScriptWriteApproval) {
  if (!harnessMode.value || !project.value?.id || approvalBusy.value) return;
  const epoch = harnessEpoch;
  reviewedApproval.value = null;
  approvalBusy.value = true;
  try {
    const review = await approvalClient.review(project.value.id, approval);
    if (epoch === harnessEpoch) { reviewedApproval.value = review; approvalError.value = ""; }
  } catch (error) {
    if (epoch === harnessEpoch) approvalError.value = error instanceof Error
      ? error.message : "待写入正文读取失败";
  } finally {
    if (epoch === harnessEpoch) approvalBusy.value = false;
  }
}
function confirmScriptWrite(approval: ScriptWriteApproval, decision: "approve" | "reject") {
  if (!harnessMode.value || approvalBusy.value || approval.status !== "pending" || !project.value?.id) return;
  if (decision === "approve" && !isReviewed(approval)) return;
  const dialog = DialogPlugin.confirm({
    header: decision === "approve" ? "确认批准此单项写入？" : "确认拒绝此写入？",
    body: `Run ${approval.runId}；操作 ${approval.operationId}；目标摘要 ${JSON.stringify(approval.preview)}`,
    confirmBtn: decision === "approve" ? "批准精确目标" : "拒绝",
    cancelBtn: "取消",
    theme: decision === "approve" ? "warning" : "default",
    onConfirm: async () => {
      if (!project.value?.id) return;
      const epoch = harnessEpoch;
      approvalBusy.value = true;
      try {
        await approvalClient.decide(project.value.id, approval, decision, uuid());
        reviewedApproval.value = null;
        if (epoch === harnessEpoch) await refreshWriteApprovals();
        dialog.destroy();
      } catch (error) {
        if (epoch === harnessEpoch) {
          await refreshWriteApprovals();
          approvalError.value = error instanceof Error ? error.message : "写入决策失败，请刷新后重试";
        }
      } finally {
        if (epoch === harnessEpoch) approvalBusy.value = false;
      }
    },
  });
}
const thinkLevelOptions = [
  { label: $t("workbench.scriptAgent.thinkLevel.off"), value: 0 },
  { label: $t("workbench.scriptAgent.thinkLevel.light"), value: 1 },
  { label: $t("workbench.scriptAgent.thinkLevel.deep"), value: 2 },
  { label: $t("workbench.scriptAgent.thinkLevel.extreme"), value: 3 },
];
import productionAgentStore from "@/stores/productionAgent";
const currentTable = ref(1);
const inputValue = ref("");
const toolbars: ToolbarNames[] = [
  "bold",
  "underline",
  "italic",
  "strikeThrough",
  "-",
  "title",
  "sub",
  "sup",
  "quote",
  "unorderedList",
  "orderedList",
  "task",
  "-",
  "codeRow",
  "code",
  "table",
  "-",
  "revoke",
  "next",
  "=",
  "preview",
];
const defMsg: ChatMessagesData[] = [
  {
    id: "welcome",
    role: "assistant",
    content: [
      { type: "text", status: "complete", data: $t("workbench.scriptAgent.welcomeMsg") },
      {
        type: "suggestion",
        status: "complete",
        data: [{ title: $t("workbench.scriptAgent.start"), prompt: $t("workbench.scriptAgent.start") }],
      },
    ],
  },
];

onMounted(() => {
  if (messages.value.length <= 0) messages.value = [...defMsg, ...messages.value];
  getPlanData();
  getNovel();
  scriptAgentStore().connect();

  if (messages.value.length <= 1) getHistory();
});
const agentWorkDataId = ref<number>();
async function getPlanData() {
  const { data } = await axios.post("/scriptAgent/getPlanData", { projectId: project.value?.id, agentType: "scriptAgent" });
  planData.value.storySkeleton = data.data.storySkeleton;
  planData.value.adaptationStrategy = data.data.adaptationStrategy;
  planData.value.script = data.data.script || [];
  agentWorkDataId.value = data.id;
}

//快捷发送
const handleActions = {
  suggestion: (data?: any) => {
    handleSend(data?.content?.prompt ?? "");
  },
};

async function handleSend(text: string) {
  if (!text.trim()) return;
  if (!harnessMode.value) {
    scriptAgentStore().chat(text);
    inputValue.value = "";
    return;
  }
  if (harnessBusy.value || harnessActive.value || !project.value?.id) return;
  const epoch = harnessEpoch;
  harnessBusy.value = true;
  harnessError.value = "";
  try {
    const run = await harnessClient.start(project.value.id, uuid(), text);
    if (epoch === harnessEpoch && harnessMode.value) {
      inputValue.value = "";
      harnessCurrent.value = run;
      acceptHarnessRun(run, epoch);
    }
  } catch (error) {
    if (epoch === harnessEpoch) showHarnessError(error);
  } finally {
    if (epoch === harnessEpoch) harnessBusy.value = false;
  }
}
async function handleStop() {
  if (!harnessMode.value) { scriptAgentStore().stopGenerate(); return; }
  if (!harnessRun.value?.allowedActions.includes("cancel") || !project.value?.id || harnessBusy.value) return;
  const epoch = harnessEpoch;
  harnessBusy.value = true;
  try {
    acceptHarnessRun(await harnessClient.cancel(project.value.id, harnessRun.value, uuid()), epoch);
  } catch (error) {
    if (epoch === harnessEpoch) { await refreshHarnessRun(); showHarnessError(error); }
  } finally {
    if (epoch === harnessEpoch) harnessBusy.value = false;
  }
}

const memoryTypeLabel: Record<string, string> = {
  message: $t("workbench.scriptAgent.memoryType.message"),
  summary: $t("workbench.scriptAgent.memoryType.summary"),
  all: $t("workbench.scriptAgent.memoryType.all"),
};
function handleClearMemory(type: "message" | "summary" | "all" | "reconnect") {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.scriptAgent.msg.clearConfirm"),
    body: $t("workbench.scriptAgent.msg.clearBody", { type: memoryTypeLabel[type] }),
    confirmBtn: $t("workbench.scriptAgent.msg.confirmClear"),
    cancelBtn: $t("workbench.scriptAgent.msg.cancel"),
    theme: "warning",
    onConfirm: async () => {
      await axios.post(`/agents/clearMemory`, { projectId: project.value?.id, agentType: "scriptAgent", type });
      window.$message.success($t("workbench.scriptAgent.msg.memoryCleared", { type: memoryTypeLabel[type] }));
      dialog.destroy();
      getHistory();
    },
  });
}
function handleReconnect() {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.scriptAgent.msg.reconnect"),
    body: $t("workbench.scriptAgent.msg.notReconnect"),
    confirmBtn: $t("workbench.scriptAgent.msg.keepReconnect"),
    cancelBtn: $t("workbench.scriptAgent.msg.cancel"),
    theme: "warning",
    onConfirm: async () => {
      productionAgentStore().reconnect();
      dialog.destroy();
    },
  });
}

const loadingHistory = ref(false);
async function getHistory() {
  loadingHistory.value = true;
  const { data } = await axios.post(`/agents/getMemory`, {
    projectId: project.value?.id,
    agentType: "scriptAgent",
  });
  messages.value = [...defMsg, ...data];
  loadingHistory.value = false;
}

// 强制生成蒙层
const forceGenerateVisible = ref(false);
const novelData = ref([]);

function getNovel() {
  axios.post("/novel/getNovelData", { projectId: project.value?.id }).then(({ data }: any) => {
    novelData.value = data;
    const hasUnfinished = (novelData.value as any[]).some((item: any) => item.eventState === 0);
    if (hasUnfinished && !forceGenerateVisible.value) {
      forceGenerateVisible.value = true;
    }
  });
}

const dialogVisible = ref(false);
const editContent = ref("");
//编辑markdown
function editMdPreview() {
  if (currentTable.value == 1) editContent.value = planData.value.storySkeleton;
  else if (currentTable.value == 2) editContent.value = planData.value.adaptationStrategy;
  dialogVisible.value = true;
}

const scriptEditIndex = ref(-1);
const scriptEditData = ref({
  name: "",
  content: "",
});
const scriptEditVisible = ref(false);

function editScript(index: number) {
  const item = planData.value.script[index];
  scriptEditIndex.value = index;
  scriptEditData.value = {
    name: item.name,
    content: item.content,
  };
  scriptEditVisible.value = true;
}

async function saveScript() {
  if (scriptEditIndex.value < 0) return;
  planData.value.script[scriptEditIndex.value] = { ...scriptEditData.value };
  await scriptAgentStore().setPlanData();
  await getPlanData();
  window.$message.success($t("workbench.scriptAgent.msg.scriptUpdated"));
  scriptEditVisible.value = false;
}
async function delScript(index: number) {
  const item = planData.value.script[index];
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.scriptAgent.msg.deleteConfirm"),
    body: $t("workbench.scriptAgent.msg.deleteBody"),
    confirmBtn: $t("workbench.scriptAgent.msg.confirmDelete"),
    cancelBtn: $t("workbench.scriptAgent.msg.cancel"),
    theme: "danger",
    onConfirm: async () => {
      if (item.id) {
        await axios.post("/script/delScript", { ids: [item.id] });
        planData.value.script.splice(index, 1);
      } else {
        planData.value.script.splice(index, 1);
      }
      await scriptAgentStore().setPlanData();
      await getPlanData();
      window.$message.success($t("workbench.scriptAgent.msg.scriptDeleted"));
      dialog.destroy();
    },
  });
}
function onConfirm(value: string) {
  axios
    .post("/scriptAgent/updateData", {
      id: agentWorkDataId.value,
      data: {
        storySkeleton: currentTable.value == 1 ? value : planData.value.storySkeleton,
        adaptationStrategy: currentTable.value == 2 ? value : planData.value.adaptationStrategy,
        script: planData.value.script,
      },
    })
    .then(() => {
      window.$message.success($t("workbench.scriptAgent.msg.updated"));
      getPlanData();
    })
    .catch((err) => {
      window.$message.error(err?.message ?? $t("workbench.scriptAgent.msg.error"));
    });
}

const showThink = ref(false);
onMounted(async () => {
  const { data } = await axios.post(`/project/getModelDetails`, { key: "scriptAgent" });
  if (data && data.think) {
    showThink.value = true;
  }
});

type ScriptCardItem = {
  id?: number;
  name: string;
  content: string;
};

// 剧本卡片折叠状态
const collapsedCards = ref<Record<string, boolean>>({});

function getScriptCardKey(item: ScriptCardItem, index: number) {
  if (item.id !== undefined && item.id !== null) {
    return `id:${item.id}`;
  }
  return `index:${index}`;
}

function isCardCollapsed(item: ScriptCardItem, index: number) {
  return Boolean(collapsedCards.value[getScriptCardKey(item, index)]);
}

watch(
  () => planData.value.script?.map((item, index) => getScriptCardKey(item, index)) || [],
  (keys) => {
    const nextCollapsedCards: Record<string, boolean> = {};
    keys.forEach((key) => {
      if (collapsedCards.value[key]) {
        nextCollapsedCards[key] = true;
      }
    });
    collapsedCards.value = nextCollapsedCards;
  },
  { immediate: true },
);

// 是否全部折叠
const isAllCollapsed = computed(() => {
  if (!planData.value.script?.length) return false;
  return planData.value.script.every((item, index) => isCardCollapsed(item, index));
});

// 切换单个卡片折叠状态
function toggleCardCollapse(item: ScriptCardItem, index: number) {
  const key = getScriptCardKey(item, index);
  collapsedCards.value[key] = !collapsedCards.value[key];
}

// 一键折叠/展开所有卡片
function toggleAllCards() {
  const nextCollapsed = !isAllCollapsed.value;
  const nextCollapsedCards = { ...collapsedCards.value };
  planData.value.script?.forEach((item, index) => {
    nextCollapsedCards[getScriptCardKey(item, index)] = nextCollapsed;
  });
  collapsedCards.value = nextCollapsedCards;
}
</script>

<style lang="scss" scoped>
.scriptAgent {
  height: calc(100% - 16px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  :deep(.splitpanes__pane) {
    background-color: transparent !important;
  }
  :deep(.splitpanes__splitter) {
    border-left: none;
    margin-left: 1px;
  }
  .data {
    flex: 1;
    overflow: hidden;
    :deep(.operate) {
      display: flex;
      flex-direction: column;
      min-height: 0;
      min-width: 250px;
      height: 100%;
      .box {
        padding-top: 8px;
        flex: 1;
        display: flex;
        flex-direction: column;
        border-radius: 10px;
        border: 1px solid var(--td-border-level-1-color);
        background-color: var(--td-bg-color-container);
        overflow: hidden;
        position: relative;
        width: 100%;
        height: 100%;
        padding-left: 8px;
        .inputBox {
          padding-right: 8px;
          padding-bottom: 8px;
        }
        .dot {
          position: absolute;
          top: 10px;
          left: 10px;
        }
      }
      .t-chat__list {
        padding-right: 8px;
      }
    }
    :deep(.data) {
      display: flex;
      flex-direction: column;
      height: 100%;
      position: relative;
      .tabsWrapper {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: padding-bottom 0.3s ease;
        .t-tabs {
          display: flex;
          flex-direction: column;
          height: 100%;
          .t-tabs__header {
            flex-shrink: 0;
          }
          .t-tabs__content {
            flex: 1;
            overflow: hidden;
          }
          .t-tab-panel {
            height: 100%;
          }
        }
      }
    }
  }
}

.harnessStatus {
  margin: 0 8px 8px 0;
  padding: 10px;
  border: 1px solid var(--td-border-level-2-color);
  border-radius: 8px;
  overflow: auto;
  max-height: 50%;
  overflow-wrap: anywhere;
  > div { margin-bottom: 6px; }
  pre { white-space: pre-wrap; font: inherit; }
}
.harnessError { color: var(--td-error-color); }
.harnessApprovalTitle { border-top: 1px solid var(--td-border-level-2-color); padding-top: 8px; }
.harnessApproval { padding: 8px; border: 1px solid var(--td-border-level-2-color); border-radius: 6px; }
.harnessApproval button + button { margin-left: 8px; }
.harnessGrantControls { display: flex; flex-wrap: wrap; gap: 8px; }
.harnessRecent { display: flex; flex-wrap: wrap; gap: 4px; }

.panelContent {
  height: 100%;
  overflow-y: auto;
  padding: 12px 16px;
  box-sizing: border-box;
  position: relative;

  &::-webkit-scrollbar-thumb {
    background-color: var(--td-border-level-2-color);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-track {
    background-color: var(--td-bg-color-secondarycontainer);
  }
}

.scriptList {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.scriptCard {
  border: 1px solid var(--td-border-level-2-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--td-bg-color-container);
  display: flex;
  flex-direction: column;
  align-self: start;
  transition: box-shadow 0.2s ease;
  .scriptCardHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background-color: var(--td-bg-color-secondarycontainer);
    border-bottom: 1px solid var(--td-border-level-2-color);
    .scriptCardHeaderLeft {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .scriptCardActions {
      flex-shrink: 0;
      display: flex;
      gap: 4px;
    }
    .scriptIndex {
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
      background: var(--td-bg-color-component);
      padding: 1px 6px;
      border-radius: 4px;
    }
    .scriptTitle {
      font-size: 14px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .scriptCardBody {
    font-size: 13px;
    line-height: 1.7;
    padding: 10px 12px;
    max-height: 300px;
    overflow-y: auto;
    &::-webkit-scrollbar-thumb {
      background-color: var(--td-border-level-2-color);
      border-radius: 4px;
    }
    &::-webkit-scrollbar-track {
      background-color: var(--td-bg-color-secondarycontainer);
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
      font-family: inherit;
    }
    .emptyContent {
      display: block;
      font-size: 13px;
    }
    :deep(.md-editor-preview-wrapper) {
      padding: 0;
    }
  }
  .scriptCardFooter {
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--td-border-level-1-color);
    background-color: var(--td-bg-color-secondarycontainer);
    .assetsLabel {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 12px;
      white-space: nowrap;
      margin-top: 2px;
      flex-shrink: 0;
    }
    .assetsTags {
      display: flex;
      flex-wrap: wrap;
      gap: 5.6px;
    }
  }
}

.scriptEditForm {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
  .scriptEditField {
    display: flex;
    flex-direction: column;
    gap: 6px;
    label {
      font-size: 13px;
      font-weight: 500;
    }
    .assets-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 10px;
    }
  }
  .assetsEditor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-radius: 6px;
    padding: 8px 12px;
    background: var(--td-bg-color-secondarycontainer);
    .assetsTagList {
      display: flex;
      flex-wrap: wrap;
      gap: 5.6px;
      min-height: 24px;
    }
    .assetsInputRow {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }
}

.forceGenerateMask {
  position: absolute;
  inset: 0;
  background: var(--td-mask-active);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 10px;
  .forceGenerateCard {
    background: var(--td-bg-color-container);
    border-radius: 12px;
    padding: 28px 32px 24px;
    max-width: 300px;
    width: 90%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    .forceGenerateActions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      width: 100%;
      justify-content: center;
    }
  }
}
.settingMenu {
  padding: 4px 0;
  .settingMenuItem {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
    &.danger {
      color: var(--td-error-color);
    }
  }
}
:deep(.t-tabs__operations--right) {
  top: 0;
  bottom: 0;
}
:deep(.t-tabs__btn--right) {
  display: none;
}

// 悬浮折叠按钮样式
.floatCollapseBtn {
  position: fixed;
  right: 40px;
  bottom: 40px;
  z-index: 100;
  .t-button {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
  }
}

// 折叠状态样式
.scriptCard {
  &.collapsed {
    .scriptCardHeader {
      border-bottom: none;
    }
  }
}
</style>
