<template>
  <div class="uiConfig">
    <t-form labelAlign="top">
      <t-form-item label="颜色模式">
        <t-radio-group variant="default-filled" v-model="themeSetting.mode">
          <t-radio-button value="auto">自动</t-radio-button>
          <t-radio-button value="light">浅色</t-radio-button>
          <t-radio-button value="dark">深色</t-radio-button>
        </t-radio-group>
      </t-form-item>
    </t-form>
  </div>
</template>

<script setup lang="ts">
import settingStore from "@/stores/setting";
import { applyThemeMode, applyThemeColor, toggleThemeWithTransition } from "@/utils/theme";
const { themeSetting } = storeToRefs(settingStore());

watch(
  () => themeSetting.value.mode,
  (mode) => {
    toggleThemeWithTransition(undefined, () => {
      applyThemeMode(mode);
      applyThemeColor(themeSetting.value.primaryColor);
    });
  },
);
</script>

<style lang="scss" scoped></style>
