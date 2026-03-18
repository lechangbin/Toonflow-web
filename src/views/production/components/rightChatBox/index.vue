<template>
  <div class="rightChatBox">
    <div class="header f ac jb">
      <span class="text">{{ props.title }}</span>
      <div class="close">
        <i-click-to-fold size="18" @click.stop="emit('close')" />
      </div>
    </div>
    <chatBox ref="charBoxRef" v-model="inputValue" :config="config" :history="history" :handleActions="handleActions">
      <template #footer>
        <t-button shape="square" variant="outline" size="small">
          <template #icon>
            <i-setting-config size="16" />
          </template>
        </t-button>
      </template>
    </chatBox>
  </div>
</template>

<script setup lang="ts">
import modelTendencies from "./modelTendencies.vue";
import { useAgentToolcall } from "@tdesign-vue-next/chat";
import type { ChatMessagesData, AgentToolcallConfig, ToolcallComponentProps, ChatRequestParams, ChatServiceConfig } from "@tdesign-vue-next/chat";
import type { DefineComponent } from "vue";
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
  endpoint: `${baseUrl.value}/agents/scriptAgent`,
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
</style>
