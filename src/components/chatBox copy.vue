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
      @send="handleSend"
      @stop="emit('stop')">
      <template #footer-prefix>
        <slot name="footer"></slot>
      </template>
    </t-chat-sender>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessagesData } from "@tdesign-vue-next/chat";

const props = defineProps({
  messages: {
    type: Array as () => ChatMessagesData[],
    default: () => [],
  },
  status: {
    type: String,
    default: "idle",
  },
  handleActions: {
    type: Object,
    default: () => () => {},
  },
});

const emit = defineEmits<{
  send: [text: string];
  stop: [];
}>();

const inputValue = defineModel<string>({
  default: () => "",
});

const handleSend = (text: string) => {
  emit("send", text);
  inputValue.value = "";
};
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
