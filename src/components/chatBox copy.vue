<template>
  <t-chatbot ref="chatRef" :default-messages="defaultMessages" :message-props="messageProps" :chat-service-config="chatServiceConfig" />
</template>

<script setup lang="ts">
import settingStore from "@/stores/setting";
const { baseUrl } = storeToRefs(settingStore());
import type { ChatRequestParams, ChatMessagesData, ChatServiceConfig, TdChatbotApi, SuggestionItem } from "@tdesign-vue-next/chat";

const chatRef = ref<TdChatbotApi | null>(null);
const hasHistory = ref(false);

// 初始化消息
const defaultMessages: ChatMessagesData[] = [
  {
    id: "welcome",
    role: "assistant",
    content: [
      {
        type: "text",
        status: "complete",
        data: "你好！我是 Tonnflow 智能助手，有什么可以帮助你的吗？",
      },
      {
        type: "suggestion",
        status: "complete",
        data: [
          {
            title: "开始制作流程",
            prompt: "请介绍一下 Tonnflow 设计体系",
          },
        ],
      },
    ],
  },
];

// 模拟历史消息数据（通常从后端接口获取）
const historyMessages: ChatMessagesData[] = [
  {
    id: "history-1",
    role: "user",
    datetime: "2024-01-01 10:00:00",
    content: [
      {
        type: "text",
        data: "TDesign 支持哪些框架？",
      },
    ],
  },
  {
    id: "history-2",
    role: "assistant",
    datetime: "2024-01-01 10:00:05",
    status: "complete",
    content: [
      {
        type: "markdown",
        data: "TDesign 目前支持以下框架：\n\n- **React**\n- **Vue 2/3**\n- **Flutter**\n- **小程序**",
      },
    ],
  },
  {
    id: "history-3",
    role: "user",
    datetime: "2024-01-01 10:01:00",
    content: [
      {
        type: "text",
        data: "如何安装 TDesign React？",
      },
    ],
  },
  {
    id: "history-4",
    role: "assistant",
    datetime: "2024-01-01 10:01:03",
    status: "complete",
    content: [
      {
        type: "markdown",
        data: "安装 TDesign React 非常简单：\n\n```bash\nnpm install tdesign-react\n```",
      },
    ],
  },
];

onMounted(() => {
  loadHistory();
});

// 加载历史消息
const loadHistory = () => {
  chatRef.value?.setMessages(historyMessages, "replace");
  hasHistory.value = true;
};

// 清空消息
const clearMessages = () => {
  chatRef.value?.clearMessages();
  hasHistory.value = false;
};

// 聊天服务配置
const chatServiceConfig: ChatServiceConfig = {
  endpoint: `${baseUrl.value}/agents/scriptAgent`,
  protocol: "agui", // 启用AG-UI协议
  stream: true,
  onRequest: (params: ChatRequestParams) => ({
    headers: { Authorization: localStorage.getItem("token") || "" },
    body: JSON.stringify(params),
  }),
};

// 消息配置：处理建议问题点击
const messageProps = {
  assistant: {
    handleActions: {
      // 点击建议问题时，填充到输入框
      suggestion: ({ content }: { content: SuggestionItem }) => {
        chatRef.value?.addPrompt(content.prompt!);
      },
    },
  },
};
</script>

<style scoped lang="scss">
.quick-actions {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 4px;

  .actions-title {
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
  }

  .actions-buttons {
    display: flex;
    gap: 8px;
  }
}
</style>
