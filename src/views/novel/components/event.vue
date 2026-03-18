<template>
  <div class="event">
    <t-button v-if="eventData.length > 0" theme="primary" @click="regenerateEvents">
      <template #icon>
        <i-flash-payment theme="outline" />
      </template>
      重新生成事件
    </t-button>
    <div class="data">
      <t-table
        style="margin-top: 10px"
        :columns="columns"
        :data="eventData"
        :max-height="600"
        row-key="id"
        hover
        stripe
        size="small"
        :pagination="pagination"
        :loading="loading"
        lazy-load
        table-layout="fixed"
        @page-change="handlePageChange">
        <template #empty>
          <div class="empty c" style="flex-direction: column; gap: 12px">
            <span>暂无事件数据，点击开始生成</span>
            <t-button v-if="!isGenerating" theme="primary" @click="generateEvent">
              <template #icon>
                <i-flash-payment theme="outline" />
              </template>
              生成事件
            </t-button>
          </div>
        </template>
        <template #loading>
          <div class="t-table--loading-message">
            <span v-if="isGenerating">🎬 事件生成中，请稍候...</span>
            <span v-else>加载中...</span>
          </div>
        </template>
        <template #startTime="{ row }">
          <span>{{ dayjs(row.startTime).format("YYYY-MM-DD HH:mm:ss") }}</span>
        </template>
        <template #operation="{ row }">
          <t-space :size="0">
            <t-button theme="danger" variant="text" @click="handleDelete(row)">
              <template #icon>
                <t-icon name="delete" />
              </template>
              删除
            </t-button>
          </t-space>
        </template>
      </t-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import dayjs from "dayjs";
import projectStore from "@/stores/project";
const { project } = storeToRefs(projectStore());
// 分页信息
const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
});
// 加载状态
const loading = ref(false);
// 处理分页变化
function handlePageChange(pageInfo: { current: number; pageSize: number }) {
  pagination.value.page = pageInfo.current;
  pagination.value.pageSize = pageInfo.pageSize;
  getEvents();
}
// 获取小说事件列表
async function getEvents() {
  loading.value = true;
  try {
    const { data } = await axios.post("/novel/event/getEvent", {
      projectId: project.value?.id,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    });
    eventData.value = data.records;
    pagination.value.total = data.total;
  } catch (e) {
    console.error("获取小说原文列表失败:", e);
  } finally {
    loading.value = false;
  }
}
// 处理删除事件
function handleDelete(row: Record<string, unknown>) {
  const dialog = DialogPlugin.confirm({
    header: "删除事件",
    body: `确定要删除这个事件吗？`,
    onConfirm: () => {
      MessagePlugin.success("批量删除成功");
      dialog.destroy();
    },
  });
}
// 事件数据
const eventData = ref<{ id: number; name: string; chapter: string; process: string; startTime: number }[]>([]);
//表格表头
const columns = ref<Record<string, unknown>[]>([
  { colKey: "id", title: "事件ID", width: 50, align: "center" },
  { colKey: "name", title: "事件名称", width: 150, align: "center" },
  { colKey: "chapter", title: "来源章节", width: 150, align: "center" },
  { colKey: "process", title: "事件过程", width: 400 },
  { colKey: "startTime", title: "开始时间", width: 200, align: "center" },
  { colKey: "operation", title: "操作", width: 150, align: "center" },
]);
// 生成状态
const isGenerating = ref(false);

// 开始生成事件
function generateEvent() {
  isGenerating.value = true;
  loading.value = true;
  console.log("开始生成事件");
  // setTimeout(() => {
  //   eventData.value = [
  //     {
  //       id: 1,
  //       name: "事件一",
  //       chapter: "第一章",
  //       process: "这是事件一的描述",
  //       startTime: new Date().getTime(),
  //     },
  //     {
  //       id: 2,
  //       name: "事件二",
  //       chapter: "第二章",
  //       process: "这是事件二的描述",
  //       startTime: new Date().getTime(),
  //     },
  //   ];
  //   pagination.value.total = eventData.value.length;
  //   isGenerating.value = false;
  //   loading.value = false;
  // }, 2000);
  // // 实际使用时的代码示例：
  axios
    .post("/novel/event/generateEvents", {
      projectId: project.value?.id,
    })
    .then((response) => {
      eventData.value = response.data.records;
      pagination.value.total = response.data.total;
      MessagePlugin.success("事件生成成功");
    })
    .catch((e) => {
      MessagePlugin.error((e as Error).message);
    })
    .finally(() => {
      isGenerating.value = false;
      loading.value = false;
    });
}
// 重新生成事件
function regenerateEvents() {
  console.log("重新生成事件");
  eventData.value = [];
  generateEvent();
}
</script>

<style lang="scss" scoped>
.event {
  margin-top: 20px;
  .data {
    margin-top: 10px;
  }
}
</style>
