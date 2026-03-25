<template>
  <div class="test">
    <t-button theme="primary" @click="test">测试按钮</t-button>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
function test() {
  axios.get("/test/test").then((res) => {
    console.log("test res:", res);
  });
}
</script>

<style lang="scss" scoped></style>
