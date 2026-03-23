<template>
  <t-card class="scriptPlan">
    <Handle :id="props.data.handleIds.target" type="target" :position="Position.Left" />
    <Handle :id="props.data.handleIds.source" type="source" :position="Position.Right" />
    <div class="titleBar dragHandle">
      <div class="title c">拍摄计划</div>
      <t-button size="small" variant="text" @click="openEdit">编辑</t-button>
    </div>
    <div class="content">
      <MdPreview v-model="content" :theme="'light'" />
    </div>
  </t-card>

  <t-dialog
    v-model:visible="dialogVisible"
    header="编辑拍摄计划"
    :width="'90vw'"
    :confirm-btn="'保存'"
    :cancel-btn="'取消'"
    @confirm="onConfirm"
    @cancel="onCancel"
    @close="onCancel"
    :close-on-overlay-click="false"
    placement="center"
    attach="body">
    <MdEditor
      v-model="editContent"
      :theme="'light'"
      :toolbars="toolbars"
      :footers="[]"
      style="height: 72vh"
      @onUploadImg="() => {}"
      @drop.prevent
      @paste="onPaste" />
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { MdEditor, MdPreview } from "md-editor-v3";
import type { ToolbarNames } from "md-editor-v3";
import "md-editor-v3/lib/style.css";

const props = defineProps<{
  id: string;
  data: {
    scriptPlan: string;
    handleIds: {
      target: string;
      source: string;
    };
  };
}>();

const emit = defineEmits<{
  (e: "update:scriptPlan", value: string): void;
}>();

const content = ref(props.data.scriptPlan);
const editContent = ref("");
const dialogVisible = ref(false);

watch(
  () => props.data.scriptPlan,
  (val) => {
    content.value = val;
  },
);

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

function openEdit() {
  editContent.value = content.value;
  dialogVisible.value = true;
}

function onConfirm() {
  content.value = editContent.value;
  emit("update:scriptPlan", editContent.value);
  dialogVisible.value = false;
}

function onCancel() {
  dialogVisible.value = false;
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/") || item.type.startsWith("video/")) {
      e.preventDefault();
      return;
    }
  }
}
</script>

<style lang="scss" scoped>
.scriptPlan {
  max-width: 40vw;
  width: fit-content;
  min-width: 200px;
  user-select: text;
  cursor: default;

  .titleBar {
    cursor: grab;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    background-color: #000;
    width: fit-content;
    padding: 5px 10px;
    color: #fff;
    border-radius: 8px 0;
    font-size: 16px;
  }

  .content {
    margin-top: 8px;

    :deep(.md-editor) {
      border: none;
    }
  }
}
</style>
