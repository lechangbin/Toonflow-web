<template>
  <t-select v-model="selectValue" placeholder="请选择模型" @change="onChange">
    <t-option v-for="item in optionsData" :value="`${item.id}:${item.label}`" :key="item.id" :label="item.label">
      <div class="jb">
        <div>{{ item.label }}</div>
        <span>{{ item.type == "video" ? "视频模型" : item.type === "text" ? "文本模型" : "图片模型" }}</span>
      </div>
    </t-option>
  </t-select>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
interface ModelType {
  id: number;
  label: string;
  value: string;
  type: string;
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
function onChange(value: any, context: any) {
  selectValue.value = context.option.id.value;
}
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
