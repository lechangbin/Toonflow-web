<template>
  <div class="migrateShow">
    <t-dialog
      :visible.sync="visible"
      header="迁移数据"
      width="500px"
      :onClose="() => (visible = false)"
      @confirm="onConfirm"
      @cancel="() => (visible = false)">
      <div class="taskList">
        <div class="item">
          <span>检测到您有旧版本的数据，是否需要迁移？</span>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import axios from "@/utils/axios";
const visible = ref(true);
function onConfirm() {
  axios
    .post("/migrate/migrateData")
    .then(() => {
      MessagePlugin.success("数据迁移成功");
    })
    .catch(() => {
      MessagePlugin.error("数据迁移失败");
    })
    .finally(() => {
    //   visible.value = false; // 关闭对话框
    });
}
</script>

<style lang="scss" scoped></style>
