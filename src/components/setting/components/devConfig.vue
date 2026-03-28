<template>
  <div class="otherConfig">
    <t-form label-align="top">
      <t-alert theme="warning">以下为开发者工具，谨慎操作！</t-alert>
      <t-form-item :label="$t('settings.dev.devtool')" name="showTitleBar">
        <t-button theme="primary" @click="openDevTool">打开</t-button>
      </t-form-item>
      <t-form-item :label="$t('settings.dev.aiDevtool')" name="showTitleBar">
        <t-switch v-model="isElectron" @change="getSwitchAiDevTool"/>
      </t-form-item>
      <t-form-item v-if="isElectron" :label="$t('settings.dev.switchAiDevTool')" name="showTitleBar">
        <t-switch :customValue="['1', '0']" v-model="switchAiDevTool" @change="updateSwitchAiDevTool" />
        <template #tips>
          <p>文档地址：https://ai-sdk.dev/docs/ai-sdk-core/devtools</p>
          <p>开启后会在Toonflow安装目录创建.devtools文件夹，请确保Toonflow有写入权限（管理员身份运行）。</p>
          <p>在该目录运行 npx @ai-sdk/devtools 开启遥测调试</p>
        </template>
      </t-form-item>
    </t-form>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import settingStore from "@/stores/setting";
const { isElectron } = storeToRefs(settingStore());

const switchAiDevTool = ref("0");

function openDevTool() {
  if (isElectron.value) {
    try {
      fetch("toonflow://openDevTool");
    } catch (error) {
      window.$message?.warning("打开开发者工具失败，请确保已安装Toonflow桌面端");
    }
  } else {
    window.$message?.warning("WEB环境请手动打开浏览器控制台");
  }
}

async function getSwitchAiDevTool() {
  const { data } = await axios.get("/setting/dev/getSwitchAiDevTool");
  switchAiDevTool.value = data?.switchAiDevTool || "0";
}

function updateSwitchAiDevTool() {
  axios.post("/setting/dev/updateSwitchAiDevTool", { switchAiDevTool: switchAiDevTool.value });
}
onMounted(() => {
  getSwitchAiDevTool();
});
</script>

<style lang="scss" scoped>
.otherConfig {
  width: 100%;
}
</style>
