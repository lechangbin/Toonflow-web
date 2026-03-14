<template>
  <div class="storyboard">
    <t-dialog mode="full-screen" :footer="false" :header="false" :closeBtn="false" v-model:visible="addStoryboardShow" class="fullscreenDialog">
      <div class="closure">
        <i-close-small theme="outline" size="24" fill="#4a4a4a" @click="addStoryboardShow = false" />
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
const addStoryboardShow = defineModel({
  type: Boolean,
  default: false,
});
</script>

<style lang="scss" scoped>
.storyboard {
  .fullscreenDialog {
    .closure {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 9999;
      cursor: pointer;
    }
  }
  :deep(.fullscreenDialog) {
    .t-dialog__header {
      display: none !important;
    }
    .t-dialog__body {
      padding: 0 !important;
    }
    .t-dialog__wrap {
      padding: 0 !important;
    }
  }
}
</style>
