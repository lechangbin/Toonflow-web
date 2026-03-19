<template>
  <div class="chatBox">
    <t-chat-list :clear-history="false">
      <t-chat-message
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :placement="message.role === 'user' ? 'right' : 'left'"
        :variant="message.role === 'user' ? 'base' : 'outline'"
        :handleActions="message.role === 'user' ? {} : props.handleActions"
        allowContentSegmentCustom />
    </t-chat-list>
    <t-chat-sender
      class="inputBox"
      v-model="inputValue"
      placeholder="请输入内容"
      :loading="status === 'pending' || status === 'streaming'"
      @send="sendText"
      @stop="stopRes">
      <template #footer-prefix>
        <slot name="footer"></slot>
      </template>
    </t-chat-sender>
  </div>
</template>

<script setup lang="ts">
import type { ChatServiceConfig, ChatMessagesData, ChatMessageSetterMode } from "@tdesign-vue-next/chat";

const props = defineProps({
  config: {
    type: Object as () => ChatServiceConfig,
    required: true,
  },
  handleActions: {
    type: Object,
    default: () => () => {},
  },
  history: {
    type: Array as () => ChatMessagesData[],
    default: () => [],
  },
});

const inputValue = defineModel<string>({
  default: () => "",
});

// 使用 useChat Hook 创建聊天引擎
const { chatEngine, messages, status } = useChat({
  defaultMessages: props.history,
  chatServiceConfig: props.config,
});

// 发送消息
const sendText = async (params: string) => {
  await chatEngine.value?.sendUserMessage({ prompt: params });
  inputValue.value = "";
};

// 停止生成
const stopRes = () => {
  chatEngine.value?.abortChat();
};
defineExpose({
  sendText,
  stopRes,
  setMessages: (messages: ChatMessagesData[], mode?: ChatMessageSetterMode) => chatEngine.value?.setMessages(messages, mode),
});
</script>

<style lang="scss" scoped>
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
</style>
