<template>
  <div class="modelSelect">
    <t-select
      v-model="selectValue"
      :options="optionsData"
      :popupProps="{ overlayClassName: 'tdesign-demo-select__overlay-option' }"
      placeholder="请选择模型"
      style="margin-top: 10px" />
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
interface ModelType {
  label: string;
  value: string;
}
const selectValue = defineModel({
  type: String,
  default: "",
});
const props = defineProps({
  type: {
    type: String,
    default: "",
  },
});
const optionsData = ref<ModelType[]>([]);
onMounted(() => {
  handleModelChange();
});
//获取模型选择API数据
function handleModelChange() {
  axios
    .post("/modelSelect/getModelList", { type: props.type })
    .then((response) => {
      optionsData.value = response.data;
    })
    .catch((error) => {
      console.error("获取模型数据失败:", error);
    });
}
</script>

<style lang="scss" scoped></style>
