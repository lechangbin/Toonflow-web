<template>
  <div class="storyboard">
    <t-dialog mode="full-screen" :footer="false" :header="false" :closeBtn="false" v-model:visible="addStoryboardShow" class="fullscreenDialog">
      <div class="closure" @click="addStoryboardShow = false">
        <i-close-small theme="outline" size="24" fill="#4a4a4a" />
      </div>
      <div class="data">
        <div class="open c" v-if="!openShowVisible && !isLeaving">
          <i-expand-text-input
            theme="outline"
            size="24"
            fill="#4a4a4a"
            @click="
              () => {
                openShowVisible = true;
              }
            " />
        </div>
        <transition name="slide" @before-leave="isLeaving = true" @after-leave="isLeaving = false">
          <floatingTaskBox v-model="openShowVisible" v-if="openShowVisible" />
        </transition>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import floatingTaskBox from "./components/floatingTaskBox.vue";
const addStoryboardShow = defineModel({
  type: Boolean,
  default: false,
});
const openShowVisible = ref(false);
const isLeaving = ref(false);
</script>

<style lang="scss" scoped>
.storyboard {
  .fullscreenDialog {
    width: 100%;
    height: 100%;
    .closure {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 9999;
      cursor: pointer;
    }
    .data {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      .open {
        position: absolute;
        top: 60px;
        right: 10px;
        z-index: 9999;
        width: 40px;
        height: 40px;
        background-color: #f0f0f0;
        border-radius: 10px;
        cursor: pointer;
      }
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
    .t-dialog__footer {
      display: none !important;
    }
  }
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease-out;
}
.slide-enter-from {
  transform: translateX(100%);
}
.slide-leave-to {
  transform: translateX(100%);
}
</style>
