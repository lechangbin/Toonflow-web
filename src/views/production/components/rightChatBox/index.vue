<template>
  <div class="rightChatBox" :style="{ width: boxWidth + 'px' }">
    <div ref="resizeHandleRef" class="resize-handle"></div>
    <div class="header f ac jb">
      <span class="text">{{ props.title }}</span>
      <div class="close">
        <i-click-to-fold size="18" @click.stop="emit('close')" />
      </div>
    </div>
    <div class="chatBox" v-loading="loadingHistory">
      <t-chat-list :clear-history="false">
        <t-chat-message
          v-for="message in messages"
          :key="message.id"
          :message="message"
          :placement="message.role === 'user' ? 'right' : 'left'"
          :variant="message.role === 'user' ? 'base' : 'outline'"
          :handleActions="message.role === 'user' ? {} : handleActions"
          allowContentSegmentCustom />
      </t-chat-list>
      <t-chat-sender
        class="inputBox"
        v-model="inputValue"
        placeholder="请输入内容"
        :loading="status === 'pending' || status === 'streaming'"
        @send="handleSend"
        @stop="handleStop">
        <template #footer-prefix>
          <t-popup trigger="click" placement="top-left">
            <t-button shape="square" variant="outline" size="small">
              <template #icon>
                <i-setting-config size="16" />
              </template>
            </t-button>
            <template #content>
              <div class="settingMenu">
                <div class="settingMenuItem" @click="handleSend('调整偏好模型')">
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
      </t-chat-sender>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import modelTendencies from "./modelTendencies.vue";
import { useAgentToolcall } from "@tdesign-vue-next/chat";
import type { ChatMessagesData, ToolcallComponentProps, ChatRequestParams, SSEChunkData } from "@tdesign-vue-next/chat";
import type { DefineComponent } from "vue";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";
import { useMousePressed, useMouse } from "@vueuse/core";
import projectStore from "@/stores/project";
import settingStore from "@/stores/setting";

const { baseUrl } = storeToRefs(settingStore());
const { project } = storeToRefs(projectStore());

const props = defineProps({
  title: { type: String, default: "" },
  episodesId: { type: Number, required: true },
});

const emit = defineEmits(["close"]);
const inputValue = ref("");

const welcomeMessage: ChatMessagesData = {
  id: "welcome",
  role: "assistant",
  content: [
    { type: "text", status: "complete", data: "你好！我是 Toonflow 智能助手，需要我开始为您制作视频吗？" },
    {
      type: "suggestion",
      status: "complete",
      data: [
        { title: "调整偏好模型", prompt: "调整偏好模型" },
        { title: "开始制作视频", prompt: "请开始制作视频" },
      ],
    },
  ],
};

const { chatEngine, messages, status } = useChat({
  defaultMessages: [welcomeMessage],
  chatServiceConfig: {
    endpoint: `${baseUrl.value}/agents/productionAgent`,
    protocol: "agui",
    stream: true,
    onRequest: (params: ChatRequestParams) => ({
      headers: { Authorization: localStorage.getItem("token") || "" },
      body: JSON.stringify({ ...params, projectId: project.value?.id, episodesId: props.episodesId }),
    }),
    onMessage: (chunk: SSEChunkData) => {
      const event = typeof chunk.data === "string" ? JSON.parse(chunk.data) : chunk.data;
      if (event?.type === "CUSTOM" && event.name === "systemMessage") {
        chatEngine.value.messageStore.setState((draft: any) => {
          const sysMsg = {
            id: `sys-${Date.now()}`,
            role: "system",
            content: [{ type: "text", data: event.value, status: "complete" }],
          };
          // AI 占位消息是最后一条，在它前面插入系统消息
          draft.messages.splice(-1, 0, sysMsg);
          draft.messageIds.splice(-1, 0, sysMsg.id);
        });
        return [] as any;
      }
      return null;
    },
  },
});

async function handleSend(text: string) {
  await chatEngine.value.sendUserMessage({ prompt: text });
  inputValue.value = "";
}

function handleStop() {
  chatEngine.value.abortChat();
}

const memoryTypeLabel: Record<string, string> = {
  message: "消息记忆",
  summary: "摘要记忆",
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
        type,
      });
      MessagePlugin.success(`${memoryTypeLabel[type]}已清空`);
      dialog.destroy();
      getHistory();
    },
  });
}

const handleActions = {
  suggestion: (data?: any) => handleSend(data?.content?.prompt),
};

useAgentToolcall([
  {
    name: "collect_user_preferences",
    description: "收集用户偏好",
    parameters: [{ name: "destination", type: "string", required: true }],
    component: modelTendencies as DefineComponent<ToolcallComponentProps>,
  },
]);

const loadingHistory = ref(false);
async function getHistory() {
  loadingHistory.value = true;
  chatEngine.value.setMessages([], "replace");
  const { data } = await axios.post(`/agents/getMemory`, {
    projectId: project.value?.id,
    episodesId: props.episodesId,
    agentType: "productionAgent",
  });
  chatEngine.value.setMessages(data?.history ? [welcomeMessage, ...data.history] : [welcomeMessage], "replace");
  loadingHistory.value = false;
}

// 拖拽调整宽度
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
    boxWidth.value = Math.max(MIN_WIDTH, dragStartWidth.value + (dragStartX.value - x.value));
  }
});

onMounted(getHistory);
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
  border: 1px solid #e0e0e0;
  background-color: #fff;
  overflow-y: auto;

  .resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 10;
    &:hover {
      background-color: rgba(0, 0, 0, 0.08);
    }
  }
  box-shadow: -4px 2px 10px rgba(53, 53, 53, 0.1);
  .chatBox {
    width: 100%;
    height: calc(100% - 50px);
    display: flex;
    flex-direction: column;
    padding-left: 0.5rem;
    .inputBox {
      padding-right: 0.5rem;
    }
  }
  :deep(.t-chat__list) {
    padding-right: 0.5rem;
  }
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
