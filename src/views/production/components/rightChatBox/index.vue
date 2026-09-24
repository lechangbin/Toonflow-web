<template>
  <div class="rightChatBox" :style="{ width: boxWidth + 'px' }">
    <div ref="resizeHandleRef" class="resizeHandle"></div>
    <div class="header f ac jb">
      <span class="text">
        <i-dot theme="outline" :fill="connected ? 'green' : 'red'" />
        {{ props.title }}
      </span>
      <t-button size="small" variant="text" @click="harnessMode = !harnessMode">
        {{ harnessMode ? '旧生产聊天' : '受控 Run（试用）' }}
      </t-button>
      <div class="close">
        <i-click-to-fold size="18" @click.stop="emit('close')" />
      </div>
    </div>
    <productionHarnessPanel v-if="harnessMode && project?.id" :project-id="Number(project.id)" />
    <div v-if="!harnessMode && approvalCards.length" class="approvalCards" aria-label="衍生资产审批">
      <div v-for="approval in approvalCards" :key="approval.id" class="approvalCard">
        <div class="approvalTitle">衍生资产写入 · {{ approval.preview.name }}</div>
        <div class="approvalSummary">{{ approvalSummary(approval) }}</div>
        <div v-if="approval.status === 'pending'" class="approvalDetails">
          父资产 #{{ approval.preview.parentAssetId }} ·
          {{ approval.preview.effect === 'create' ? '新建' : `目标 #${approval.preview.assetId}` }} ·
          变化维度 {{ approval.preview.dimensions.join('、') }}<br />
          工具修订 {{ approval.toolRevision }} · 载荷 {{ approval.payloadHash.slice(0, 12) }}…<br />
          截止 {{ new Date(approval.expiresAt).toLocaleString() }}
        </div>
        <div v-if="mayDecide(approval, 'approve') || mayDecide(approval, 'reject')" class="approvalActions">
          <t-button size="small" theme="primary" :disabled="approvalBusy" @click="confirmApproval(approval, 'approve')">批准写入</t-button>
          <t-button size="small" variant="outline" :disabled="approvalBusy" @click="confirmApproval(approval, 'reject')">拒绝</t-button>
        </div>
      </div>
    </div>
    <div v-if="!harnessMode" class="chatBox" v-loading="loadingHistory">
      <t-chat-list :clear-history="false">
        <t-chat-message
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :name="(message as any).name"
          :placement="message.role === 'user' ? 'right' : 'left'"
          :variant="message.role === 'user' ? 'base' : 'outline'"
          :handleActions="message.role === 'user' ? {} : handleActions"
          :status="message.status"
          allowContentSegmentCustom>
          <!-- <template #actionbar>
            <t-chat-actionbar :action-bar="['replay', 'copy']" />
          </template> -->
        </t-chat-message>
      </t-chat-list>
      <t-chat-sender
        class="inputBox"
        :disabled="status === 'pending' || status === 'streaming' || !connected"
        v-model="inputValue"
        :loading="status === 'pending' || status === 'streaming'"
        :placeholder="$t('workbench.production.chatBox.inputPlaceholder')"
        @send="handleSend"
        @stop="handleStop">
        <template #footer-prefix>
          <div class="ac" style="gap: 5px">
            <t-popup trigger="click" placement="top-left">
              <t-button shape="square" variant="outline" size="small">
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
                    <span>{{ $t("workbench.production.chatBox.clearMessageMemory") }}</span>
                  </div>
                  <div class="settingMenuItem" @click="handleClearMemory('summary')">
                    <i-close size="14" />
                    <span>{{ $t("workbench.production.chatBox.clearSummaryMemory") }}</span>
                  </div>
                  <div class="settingMenuItem danger" @click="handleClearMemory('all')">
                    <i-delete-one size="14" />
                    <span>{{ $t("workbench.production.chatBox.clearAllMemory") }}</span>
                  </div>
                </div>
              </template>
            </t-popup>
            <t-popup trigger="click" placement="top" v-if="showThink">
              <t-button size="small" variant="outline" :theme="thinkLevelThemes[thinkLevel] || 'default'">
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
                    @click="productionAgentStore().updateThinkConfig(opt.value)">
                    <span>{{ opt.label }}</span>
                  </div>
                </div>
              </template>
            </t-popup>
          </div>
        </template>
      </t-chat-sender>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMousePressed, useMouse } from "@vueuse/core";
import _ from "lodash";
import axios from "@/utils/axios";
import { approvalSummary, mayDecide, visibleApprovals, type DerivedAssetApproval } from "@/utils/derivedAssetApproval";
import productionAgentStore from "@/stores/productionAgent";
import projectStore from "@/stores/project";
import productionHarnessPanel from "./productionHarnessPanel.vue";
const { project } = storeToRefs(projectStore());
const { connected, messages, status, episodesId, loadingHistory, thinkLevel } = storeToRefs(productionAgentStore());
const thinkLevelOptions = [
  { label: $t("workbench.scriptAgent.thinkLevel.off"), value: 0 },
  { label: $t("workbench.scriptAgent.thinkLevel.light"), value: 1 },
  { label: $t("workbench.scriptAgent.thinkLevel.deep"), value: 2 },
  { label: $t("workbench.scriptAgent.thinkLevel.extreme"), value: 3 },
];
const thinkLevelThemes: Array<"default" | "success" | "warning" | "danger"> = ["default", "success", "warning", "danger"];

const props = defineProps({ title: String });

const emit = defineEmits(["close"]);

const inputValue = ref("");
const harnessMode = ref(false);
const approvals = ref<DerivedAssetApproval[]>([]);
const approvalCards = computed(() => visibleApprovals(approvals.value));
const approvalBusy = ref(false);
let approvalRefreshTimer: ReturnType<typeof setInterval> | undefined;

async function refreshApprovals() {
  const projectId = project.value?.id;
  if (!projectId) { approvals.value = []; return; }
  try {
    const response = await axios.post("/agentRuns/derivedAssetApproval/list", { projectId });
    approvals.value = response.data?.approvals ?? [];
  } catch {
    approvals.value = [];
  }
}

function confirmApproval(approval: DerivedAssetApproval, decision: "approve" | "reject") {
  if (!mayDecide(approval, decision) || approvalBusy.value) return;
  const dialog = DialogPlugin.confirm({
    header: decision === "approve" ? "确认写入衍生资产" : "确认拒绝写入",
    body: `目标资产 ${approval.preview.assetId ?? "新建"}；期望版本 ${approval.preview.expectedVersion}；操作载荷 ${approval.payloadHash.slice(0, 12)}…。${decision === "approve" ? "确认后将立即写入当前项目。" : "拒绝后不会写入。"}`,
    theme: decision === "approve" ? "warning" : "default",
    confirmBtn: decision === "approve" ? "批准写入" : "拒绝",
    onConfirm: async () => {
      approvalBusy.value = true;
      try {
        await axios.post("/agentRuns/derivedAssetApproval/decide", {
          projectId: project.value?.id, runId: approval.runId, approvalId: approval.id,
          clientCommandId: crypto.randomUUID(), expectedVersion: approval.runVersion, decision,
        });
        await refreshApprovals();
        dialog.destroy();
      } catch {
        await refreshApprovals();
        dialog.destroy();
        window.$message.warning("审批状态已变化或操作失败，请核对最新状态；系统不会自动重试写入。");
      } finally { approvalBusy.value = false; }
    },
  });
}

function handleSend(text: string) {
  productionAgentStore().chat(text);
  inputValue.value = "";
}
function handleStop() {
  productionAgentStore().stopGenerate();
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

//快捷发送
const handleActions = {
  suggestion: (data?: any) => {
    productionAgentStore().chat(data?.content?.prompt);
  },
};

const memoryTypeLabel: Record<string, string> = {
  message: $t("workbench.production.chatBox.messageMemory"),
  summary: $t("workbench.production.chatBox.summaryMemory"),
  all: $t("workbench.production.chatBox.allMemory"),
};
function handleClearMemory(type: "message" | "summary" | "all") {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.production.chatBox.confirmClear"),
    body: $t("workbench.production.chatBox.confirmClearBody", { type: memoryTypeLabel[type] }),
    confirmBtn: $t("workbench.production.chatBox.confirmClearBtn"),
    cancelBtn: $t("workbench.production.cancel"),
    theme: "warning",
    onConfirm: async () => {
      await axios.post(`/agents/clearMemory`, { projectId: project.value?.id, agentType: "productionAgent", episodesId: episodesId.value, type });
      window.$message.success($t("workbench.production.chatBox.memoryCleared", { type: memoryTypeLabel[type] }));
      dialog.destroy();
      productionAgentStore().getHistory();
    },
  });
}

const resizeHandleRef = ref<HTMLElement | null>(null);
const boxWidth = ref(400);
const MIN_WIDTH = 400;
const { pressed } = useMousePressed({ target: resizeHandleRef });
const { x } = useMouse();
const dragStartX = ref(0);
const dragStartWidth = ref(400);
watch(pressed, (isPressed) => {
  if (isPressed) {
    dragStartX.value = x.value;
    dragStartWidth.value = boxWidth.value;
  }
});
watchEffect(() => {
  if (pressed.value) {
    const maxWidth = window.innerWidth * 0.8;
    boxWidth.value = Math.min(maxWidth, Math.max(MIN_WIDTH, dragStartWidth.value + (dragStartX.value - x.value)));
  }
});

const showThink = ref(false);
onMounted(async () => {
  await refreshApprovals();
  approvalRefreshTimer = setInterval(() => { void refreshApprovals(); }, 5000);
  const { data } = await axios.post(`/project/getModelDetails`, { key: "productionAgent" });
  if (data && data.think) {
    showThink.value = true;
  }
});
onUnmounted(() => { if (approvalRefreshTimer) clearInterval(approvalRefreshTimer); });
watch(() => project.value?.id, () => { void refreshApprovals(); });
watch(connected, (newVal) => {
  if (newVal) void refreshApprovals();
  if (status.value != "idle" && newVal) {
    status.value = "idle";
  }
});
</script>

<style lang="scss" scoped>
.rightChatBox {
  position: absolute;
  top: 10px;
  right: 0;
  bottom: 10px;
  display: flex;
  flex-direction: column;
  z-index: 9999;
  min-width: 400px;
  height: calc(100% - 20px);
  margin-right: 5px;
  border-radius: 10px;
  border: 1px solid var(--td-border-level-1-color);
  background-color: var(--td-bg-color-container);
  overflow-y: auto;

  .resizeHandle {
    user-select: none;
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 10;
    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }
  box-shadow: -4px 2px 10px var(--td-shadow-1);
  .chatBox {
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding-left: 8px;
    .inputBox {
      padding-right: 8px;
    }
  }
  :deep(.t-chat__list) {
    padding-right: 8px;
  }
  .header {
    height: 40px;
    line-height: 40px;
    padding: 0 10px;
    flex-shrink: 0;
    .text {
      font-size: 18px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
    }
    .close {
      cursor: pointer;
      aspect-ratio: 1/1;
    }
  }
}

.approvalCards {
  max-height: 35%;
  overflow-y: auto;
  padding: 6px 10px;
  border-bottom: 1px solid var(--td-border-level-1-color);
}
.approvalCard {
  padding: 8px;
  margin-bottom: 6px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  font-size: 12px;
}
.approvalTitle { font-weight: 600; }
.approvalSummary { margin-top: 4px; }
.approvalDetails { margin-top: 5px; line-height: 1.5; overflow-wrap: anywhere; }
.approvalActions { display: flex; gap: 6px; margin-top: 8px; }

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
.modelSelCls {
  gap: 5px;
  .paramSelect {
    max-width: 80px;
  }
}
</style>
