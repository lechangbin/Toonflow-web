<template>
  <div class="otherConfig">
    <t-form label-align="top">
      <t-form-item label="请求超时时间" name="axiosTimeOut">
        <t-input-number auto-width suffix="秒" :min="10" v-model="axiosTimeOutInSeconds" placeholder="请输入秒" />
      </t-form-item>
      <t-form-item label="资产生成并发数" name="assetsBatchGenereateSize">
        <t-input-number auto-width suffix="个" :min="1" v-model="otherSetting.assetsBatchGenereateSize" placeholder="请输入个数" />
      </t-form-item>
      <t-form-item name="chapterReg">
        <template #label>
          <span>章节拆分正则</span>
          <t-button style="margin-left: 15px" @click="setDefaultReg" size="small">恢复默认</t-button>
        </template>
        <t-textarea v-model="otherSetting.chapterReg" placeholder="请输入正则表达式" style="width: 400px" />
      </t-form-item>
    </t-form>
  </div>
</template>

<script setup lang="ts">
import settingStore from "@/stores/setting";
const { otherSetting } = storeToRefs(settingStore());

import { computed } from "vue";

// 将毫秒转换为秒显示，输入时转换回毫秒存储
const axiosTimeOutInSeconds = computed({
  get: () => {
    const ms = otherSetting.value.axiosTimeOut;
    if (ms == null || isNaN(ms)) return 600; // 默认600秒
    return Math.floor(ms / 1000);
  },
  set: (val: number | null | undefined) => {
    if (val == null || isNaN(val)) return;
    otherSetting.value.axiosTimeOut = val * 1000;
  },
});

function setDefaultReg() {
  otherSetting.value.chapterReg = "/第\s*([0-9０-９零一二三四五六七八九十百千万]+)\s*[章回节]\s*([^\n\r]*)/g";
}
</script>

<style lang="scss" scoped>
.otherConfig {
  width: 100%;
}
</style>
