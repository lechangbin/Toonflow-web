<template>
  <div class="uploadNode">
    <Handle type="source" :position="Position.Right" />
    <div class="data">
      <div class="title ac">
        <i-pic theme="outline" size="16" fill="#000000" />
        <span style="margin-left: 5px; color: #4b4b4b">Image</span>
      </div>
      <div class="image">
        <t-image
          :src="currentImageUrl"
          fit="cover"
          :style="{
            width: '100%',
            height: '100%',
            borderRadius: '10px',
          }" />
        <div class="upload ac" @click="uploadFn">
          <i-upload theme="outline" size="18" fill="#fff" />
          <span style="margin-left: 5px; color: #fff">上传</span>
        </div>
      </div>
    </div>
  </div>
  <AssetsData v-model="assetsDataShow" @confirmSelection="confirmSelection" />
</template>

<script setup lang="ts">
import { Handle, Position, useVueFlow } from "@vue-flow/core";
import { onBeforeUnmount, ref, watch } from "vue";
import AssetsData from "./assetsData.vue";
const props = defineProps<{
  id: string;
  data: {
    image?: string;
  };
}>();

const currentImageUrl = ref(props.data?.image || "");
const currentObjectUrl = ref<string | null>(null);

watch(
  () => props.data?.image,
  (newUrl) => {
    currentImageUrl.value = newUrl || "";
  },
);

onBeforeUnmount(() => {
  if (currentObjectUrl.value) {
    URL.revokeObjectURL(currentObjectUrl.value);
  }
});
const assetsDataShow = ref(false);
function uploadFn() {
  assetsDataShow.value = true;
}
//确认选中
function confirmSelection(selectedAssets: string) {
  console.log("%c Line:60 🌽 selectedAssets", "background:#7f2b82", selectedAssets);
}
</script>

<style lang="scss" scoped>
.uploadNode {
  width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  .data {
    width: 100%;
    cursor: pointer;

    .title {
      height: 30px;
      padding: 5px;
    }
    .image {
      border: 1px solid #e5e5e5;
      height: 320px;
      width: 100%;
      position: relative;
      border-radius: 10px;
      .upload {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 9999;
        padding: 5px 10px;
        border-radius: 10px;
        background-color: rgba(0, 0, 0, 0.5);
      }
    }
  }
}
</style>
