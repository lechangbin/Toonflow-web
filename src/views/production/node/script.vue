<template>
  <t-card class="script">
    <Handle :id="props.data.handleIds.source" type="source" :position="Position.Right" />
    <div class="titleBar dragHandle">
      <div class="title c">剧本</div>
    </div>
    <div class="content" @wheel.stop>
      <t-textarea :model-value="props.data.script" class="scriptInput" readonly :autosize="{ minRows: 25, maxRows: 25 }" />
    </div>
    <Handle :id="props.data.handleIds.assets" type="source" :position="Position.Bottom" />
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";

const props = defineProps<{
  id: string;
  data: {
    script: string;
    handleIds: {
      assets: string;
      source: string;
    };
  };
}>();
</script>

<style lang="scss" scoped>
.script {
  min-width: 500px;
  width: fit-content;
  user-select: text;
  cursor: default;
  .titleBar {
    cursor: grab;
    user-select: none;
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
    margin-top: 1rem;
    min-width: 300px;
  }
  .scriptInput {
    width: 100%;
    :deep(.t-textarea__inner) {
      white-space: pre-wrap;
      border-radius: 8px;
      resize: none;
    }
  }
}
</style>
