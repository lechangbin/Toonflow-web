<template>
  <div class="rightChatBox">
    <div class="header f ac jb">
      <span class="text">{{ props.title }}</span>
      <div class="close">
        <i-click-to-fold size="18" @click.stop="emit('close')" />
      </div>
    </div>
    <chatBox v-loading="loadingHistory" ref="charBoxRef" v-model="inputValue" :config="config" :history="history" :handleActions="handleActions">
      <template #footer>
        <t-popup trigger="click" placement="top-left">
          <t-button shape="square" variant="outline" size="small">
            <template #icon>
              <i-setting-config size="16" />
            </template>
          </t-button>
          <template #content>
            <div class="settingMenu">
              <div class="settingMenuItem" @click="handleAdjustModel">
                <i-setting-config size="14" />
                <span>调整偏好模型</span>
              </div>
              <div class="settingMenuItem" @click="handleClearMemory('message')">
                <i-delete size="14" />
                <span>清空消息记忆</span>
              </div>
              <div class="settingMenuItem" @click="handleClearMemory('summary')">
                <i-close size="14" />
                <span>清空摘要记忆</span>
              </div>
              <div class="settingMenuItem danger" @click="handleClearMemory('all')">
                <i-delete-one size="14" />
                <span>清空全部记忆</span>
              </div>
            </div>
          </template>
        </t-popup>
      </template>
    </chatBox>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import modelTendencies from "./modelTendencies.vue";
import { useAgentToolcall } from "@tdesign-vue-next/chat";
import type { ChatMessagesData, AgentToolcallConfig, ToolcallComponentProps, ChatRequestParams, ChatServiceConfig } from "@tdesign-vue-next/chat";
import type { DefineComponent } from "vue";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";
import chatBox from "@/components/chatBox.vue";
import projectStore from "@/stores/project";
import settingStore from "@/stores/setting";
const { baseUrl } = storeToRefs(settingStore());
const { project } = storeToRefs(projectStore());

const props = defineProps({
  title: {
    type: String,
    default: "",
  },
  episodesId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["close"]);

const charBoxRef = ref<InstanceType<typeof chatBox> | null>(null);

const inputValue = ref<string>("");

const config = ref<ChatServiceConfig>({
  endpoint: `${baseUrl.value}/agents/productionAgent`,
  protocol: "agui", // 启用AG-UI协议
  stream: true,
  onRequest: (params: ChatRequestParams) => ({
    headers: { Authorization: localStorage.getItem("token") || "" },
    body: JSON.stringify({
      ...params,
      projectId: project.value?.id,
      episodesId: props.episodesId,
    }),
  }),
});

const history = ref<ChatMessagesData[]>([
  {
    id: "welcome",
    role: "assistant",
    content: [
      {
        type: "text",
        status: "complete",
        data: "你好！我是 Toonflow 智能助手，需要我开始为您制作视频吗？",
      },
      {
        type: "suggestion",
        status: "complete",
        data: [
          {
            title: "调整偏好模型",
            prompt: "调整偏好模型",
          },
          {
            title: "开始制作视频",
            prompt: "请开始制作视频",
          },
        ],
      },
    ],
  },
]);

function handleAdjustModel() {
  charBoxRef.value?.sendText("调整偏好模型");
}

const memoryTypeLabel: Record<string, string> = {
  long: "长期记忆",
  short: "短期记忆",
  all: "全部记忆",
};

function handleClearMemory(type: "message" | "summary" | "all") {
  const dialog = DialogPlugin.confirm({
    header: "确认清空",
    body: `确定要清空${memoryTypeLabel[type]}吗？此操作无法撤销。`,
    confirmBtn: "确认清空",
    cancelBtn: "取消",
    theme: "warning",
    onConfirm: async () => {
      await axios.post(`/agents/clearMemory`, {
        projectId: project.value?.id,
        episodesId: props.episodesId,
        type: type,
      });
      MessagePlugin.success(`${memoryTypeLabel[type]}已清空`);
      dialog.destroy();
      getHistory();
    },
  });
}

const handleActions = {
  suggestion: (data?: any) => {
    charBoxRef.value?.sendText(data?.content?.prompt);
  },
};

// 注册工具配置
const toolcallActions: AgentToolcallConfig[] = [
  {
    name: "collect_user_preferences",
    description: "收集用户偏好",
    parameters: [{ name: "destination", type: "string", required: true }],
    component: modelTendencies as DefineComponent<ToolcallComponentProps>,
  },
];

useAgentToolcall(toolcallActions);

const loadingHistory = ref(false);
async function getHistory() {
  loadingHistory.value = true;
  const { data } = await axios.post(`/agents/getMemory`, {
    projectId: project.value?.id,
    episodesId: props.episodesId,
    agentType: "productionAgent",
  });
  if (data && data.history) {
    history.value = [...history.value, ...data.history];
    charBoxRef.value?.setMessages(history.value, "replace");
  }
  loadingHistory.value = false;
}

onMounted(async () => {
  await getHistory();
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
  width: 400px;
  height: calc(100% - 20px);
  margin-right: 5px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  background-color: #fff;
  overflow-y: auto;
  box-shadow: -4px 2px 10px rgba(53, 53, 53, 0.1);
  .header {
    height: 40px;
    line-height: 40px;
    padding: 0 10px;
    flex-shrink: 0;
    .text {
      font-size: 18px;
    }
    .close {
      cursor: pointer;
      aspect-ratio: 1/1;
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
      background-color: #f3f3f3;
    }
    &.danger {
      color: #e34d59;
    }
  }
}
</style>
