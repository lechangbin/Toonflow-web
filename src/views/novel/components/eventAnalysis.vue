<template>
  <div class="">
    <div v-if="!eventDatas.length">
      <t-empty title="请先分析事件">
        <template #action>
          <t-button @click="startEventAnalysis">开始分析</t-button>
        </template>
      </t-empty>
    </div>
    <div>
      <t-collapse>
        <t-collapse-panel v-for="item in novelIndexData" defaultExpandAll :key="item.id" :header="`第${item.index}章 - ${item.chapter}`">
          <template #headerRightContent v-if="!item?.compluted">
            <t-loading text="事件分析中" size="small"></t-loading>
          </template>
          <div>
            <div v-for="sub in item.eventData">
              {{ sub }}
            </div>
          </div>
        </t-collapse-panel>
      </t-collapse>
    </div>
    <div style="margin-top: 16px; text-align: right">
      <t-button variant="outline" @click="activeKey = 'To1'">上一步</t-button>
      <t-button variant="outline" @click="activeKey = 'To3'">下一步</t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import { ref } from "vue";
import projectStore from "@/stores/project";
const { project } = storeToRefs(projectStore());

const eventDatas = ref([]);
const activeKey = defineModel({
  default: "To3",
});
const novelIndexData = ref<
  {
    id: number;
    index: number;
    chapter: string;
    compluted?: boolean;
    eventData?: any[];
  }[]
>([]);
async function startEventAnalysis() {
  console.log("开始分析事件");
  await getNovelData();
  axios
    .post(
      "/novel/event/eventAnalysis",
      {
        projectId: project.value?.id!,
        novelIndexData: novelIndexData.value,
      },
      {
        responseType: "stream",
      },
    )
    .then((res) => {
      eventDatas.value = res.data;
    });
}
async function getNovelData() {
  console.log("获取小说章节");
  const { data } = await axios.post("/novel/getNovelIndex", {
    projectId: project.value?.id!,
  });
  novelIndexData.value = data;
}
</script>

<style lang="scss" scoped></style>
