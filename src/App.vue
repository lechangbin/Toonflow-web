<template>
  <titleBar v-if="isElectron" />
  <t-config-provider :global-config="globalConfig">
    <router-view></router-view>
  </t-config-provider>
</template>

<script setup lang="ts">
import settingStore from "@/stores/setting";
import { merge } from "lodash-es";
import zhConfig from "tdesign-vue-next/es/locale/zh_CN";
import enConfig from "tdesign-vue-next/es/locale/en_US";
import { cachedLocale } from "@/locales";
import { initTheme } from "@/utils/theme";
import { type GlobalConfigProvider } from "tdesign-vue-next";
const { baseUrl, isElectron } = storeToRefs(settingStore());

watch(
  () => isElectron.value,
  (newVal) => {
    if (newVal) {
      document.body.classList.add("is-electron");
    } else {
      document.body.classList.remove("is-electron");
    }
  },
  { immediate: true },
);

onBeforeMount(() => {
  document.addEventListener("keydown", function (event) {
    if (event.key === "F8") {
      event.preventDefault();
      debugger;
    }
  });
  getPort();
});

async function getPort() {
  try {
    const res = await fetch("toonflow://getPort");
    const data = await res.json();
    if (data?.port) {
      baseUrl.value = `http://localhost:${data.port}/api`;
      isElectron.value = true;
    }
  } catch (error) {}
}

// 初始化主题
onMounted(() => {
  initTheme();
});

const tdesignLocaleMap: Record<string, object> = {
  "zh-CN": zhConfig,
  en: enConfig,
};

const customConfig: GlobalConfigProvider = {
  calendar: {},
  table: {},
  pagination: {},
};
const globalConfig = computed<GlobalConfigProvider>(() => merge({}, tdesignLocaleMap[cachedLocale.value] || zhConfig, customConfig));

onBeforeMount(() => {
  document.documentElement.setAttribute("theme-mode", "light");
  document.documentElement.setAttribute("data-theme", "light");
});
</script>

<style lang="scss"></style>
