<template>
  <div class="languageConfig">
    <p class="section-desc">{{ $t("settings.language.desc") }}</p>
    <div class="lang-grid">
      <div
        v-for="item in languageList"
        :key="item.value"
        class="lang-card"
        :class="{ active: selectedLang === item.value }"
        @click="selectLang(item.value)">
        <div class="lang-info">
          <div class="lang-name">{{ item.label }}</div>
          <div class="lang-native">{{ item.tips }}</div>
        </div>
        <t-icon v-if="selectedLang === item.value" name="check-circle-filled" class="check-icon" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { languageList, cachedLocale } from "@/locales";

const selectedLang = ref<string>(cachedLocale.value ?? "zh-CN");

const { locale } = useI18n();

function selectLang(val: string) {
  locale.value = val;
  selectedLang.value = val;
  cachedLocale.value = val;
  window.$message?.success($t("settings.language.msg.saved"));
}
</script>

<style lang="scss" scoped>
.languageConfig {
  width: 100%;

  .section-desc {
    font-size: 13px;
    margin-bottom: 16px;
  }

  .lang-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    max-width: 520px;
  }

  .lang-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 1.5px solid #b7b9bb;
    border-radius: 8px;
    cursor: pointer;
    position: relative;
    transition: all 0.2s;

    &:hover {
      border-color: #dadcdd;
      background: #e0e1e2;
    }

    &.active {
      border-color: #b7b9bb;
    }

    .lang-info {
      flex: 1;
      min-width: 0;

      .lang-name {
        font-size: 14px;
        font-weight: 600;
      }

      .lang-native {
        font-size: 12px;
        margin-top: 2px;
      }
    }

    .check-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
  }

  .tip-alert {
    margin-top: 20px;
    max-width: 520px;
  }
}
</style>
