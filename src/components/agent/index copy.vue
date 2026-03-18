<template>
  <div class="agent">
    <div class="head jb ac" v-if="$slots.header">
      <slot name="header"></slot>
    </div>
    <div class="caht">
      <div v-for="(item, index) in messageList" :key="item.id || index" class="item" :class="item.role === 'system' ? 'notice' : item.role">
        <div class="noticeRow" v-if="item.role === 'system'">
          <t-tag shape="round">{{ getTextContent(item) }}</t-tag>
        </div>
        <div class="user frr" v-else-if="item.role === 'user'">
          {{ getTextContent(item) }}
        </div>
        <div v-else class="assistantWrapper">
          <div class="assistant">
            <div class="ai fr">
              <div class="identity c">
                <span>{{ getIdentity(item) }}</span>
              </div>
              {{ getTextContent(item) }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <t-chat-sender v-model="needData" :placeholder="props.placeholder" @send="handleSend">
      <template v-if="$slots.toolList" #footer-prefix>
        <slot name="toolList"></slot>
      </template>
      <template #suffix="{ renderPresets }">
        <component :is="renderPresets([])" />
      </template>
    </t-chat-sender>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ChatMessagesData } from "@tdesign-vue-next/chat";

const modelValue = defineModel<ChatMessagesData[] | boolean>({
  default: () => [],
});

const needData = ref("");
const props = defineProps({
  chatList: {
    type: Array as () => ChatMessagesData[],
    default: () => [],
  },
  placeholder: {
    type: String,
    default: "请输文本与Agent进行对话",
  },
});

const messageList = computed<ChatMessagesData[]>(() => {
  if (Array.isArray(modelValue.value)) {
    return modelValue.value;
  }
  return props.chatList;
});

const emit = defineEmits(["sendData"]);

function getTextContent(item: ChatMessagesData): string {
  if (!item.content || !Array.isArray(item.content)) return "";
  const textItem = item.content.find((c) => c.type === "text" || c.type === "markdown");
  return textItem ? String(textItem.data) : "";
}

function getIdentity(item: ChatMessagesData): string {
  const identity = item.ext?.identity;
  if (!identity) return "助手";
  return Array.isArray(identity) ? identity.join(" · ") : identity;
}

function handleSend(value: string) {
  emit("sendData", value);
  needData.value = "";
}
</script>

<style lang="scss" scoped>
.agent {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;

  .head {
    height: 40px;
    line-height: 40px;
    padding: 0 10px;
    flex-shrink: 0;
    .text {
      font-size: 30px;
      font-weight: 900;
    }
  }

  .caht {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    padding: 10px;
    .item {
      display: flex;
      &.notice {
        justify-content: center;
        .noticeRow {
          display: flex;
          justify-content: center;
        }
      }
      &.user {
        justify-content: flex-end;
        .user {
          background-color: #000;
          color: #fff;
          padding: 12px 16px;
          border-radius: 16px 16px 4px 16px;
          min-width: 10%;
          word-wrap: break-word;
        }
      }
      .assistantWrapper {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        .assistant {
          width: 100%;
          display: flex;
          justify-content: flex-start;
          .ai {
            margin-top: 5px;
            background-color: #ececec;
            color: #000;
            padding: 24px 16px 16px;
            border-radius: 16px 16px 16px 4px;
            min-width: 150px;
            word-wrap: break-word;
            position: relative;
            .identity {
              padding: 5px 10px;
              position: absolute;
              top: -10px;
              left: 12px;
              color: #fff;
              font-size: 12px;
              border-radius: 25px;
              background-color: #000;
            }
          }
        }
      }
    }
  }
}
</style>
