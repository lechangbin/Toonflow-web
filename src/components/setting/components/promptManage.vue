<template>
  <div class="promptManage">
    <div v-for="entry in entries" :key="entry.key" style="cursor: pointer" @click="openShow(entry)">
      <t-card bordered>
        <div class="data">
          <div class="jb">
            <div class="name">{{ entry.name }}</div>
            <div class="type">{{ categoryLabel(entry.category) }}</div>
          </div>
          <div class="data">
            <t-tag v-if="entry.customized" size="small" theme="warning" variant="light">{{ $t("promptManage.customized") }}</t-tag>
            {{ entry.source }}
          </div>
        </div>
      </t-card>
    </div>
    <t-empty v-if="!catalogLoading && !entries.length" :description="$t('promptManage.empty')" />
    <div class="show">
      <t-dialog
        v-model:visible="visible"
        :header="activeEntry?.name || $t('promptManage.prompt')"
        width="70%"
        :close-on-overlay-click="false"
        :confirm-btn="{ content: $t('promptManage.save'), theme: 'primary', loading: saving, disabled: !draft.trim() }"
        :cancel-btn="$t('promptManage.cancel')"
        top="9vh"
        @confirm="onConfirm">
        <div v-if="activeEntry" class="detailMeta">
          <t-tag variant="light">{{ categoryLabel(activeEntry.category) }}</t-tag>
          <span class="source">{{ activeEntry.source }}</span>
          <t-button
            v-if="activeEntry.resettable"
            size="small"
            variant="outline"
            :disabled="!activeEntry.customized"
            :loading="resetting"
            @click="confirmReset">
            {{ $t("promptManage.restoreDefault") }}
          </t-button>
        </div>
        <t-alert v-if="activeEntry?.kind === 'video-profile'" theme="warning" class="profileNotice">
          {{ $t("promptManage.profileNotice") }}
        </t-alert>
        <t-loading v-if="contentLoading" loading size="small" class="editorLoading" />
        <MdEditor
          v-else
          v-model="draft"
          :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode"
          :toolbars="promptToolbars"
          :footers="[]"
          style="height: 60vh"
          :placeholder="$t('promptManage.editorPlaceholder')"
          @onUploadImg="() => {}" />
      </t-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { MdEditor } from "md-editor-v3";
import type { ToolbarNames } from "md-editor-v3";
import { DialogPlugin } from "tdesign-vue-next";
import settingStore from "@/stores/setting";
import axios from "@/utils/axios";
import {
  closePromptDetail,
  detailEntryKey,
  manageableCatalogEntries,
  openPromptDetail,
  type PromptCatalogEntry,
  type PromptManageView,
} from "@/utils/promptManageNavigation";

const { themeSetting } = storeToRefs(settingStore());
const entries = ref<PromptCatalogEntry[]>([]);
const view = ref<PromptManageView>({ view: "list" });
const draft = ref("");
const catalogLoading = ref(false);
const contentLoading = ref(false);
const saving = ref(false);
const resetting = ref(false);
const promptToolbars: ToolbarNames[] = [
  "bold",
  "italic",
  "strikeThrough",
  "-",
  "title",
  "quote",
  "unorderedList",
  "orderedList",
  "table",
  "code",
  "-",
  "revoke",
  "next",
  "=",
  "preview",
];

const categoryLabels: Record<string, string> = {
  system: "promptManage.categories.system",
  "script-agent": "promptManage.categories.scriptAgent",
  "production-agent": "promptManage.categories.productionAgent",
  "agent-skill": "promptManage.categories.agentSkill",
  "visual-skill": "promptManage.categories.visualSkill",
  "story-skill": "promptManage.categories.storySkill",
  "video-profile": "promptManage.categories.videoProfile",
  "model-prompt": "promptManage.categories.modelPrompt",
};

const activeKey = computed(() => detailEntryKey(view.value));
const activeEntry = computed(() => entries.value.find((entry) => entry.key === activeKey.value));
const visible = computed({
  get: () => view.value.view === "detail",
  set: (value: boolean) => {
    if (!value) view.value = closePromptDetail();
  },
});

function categoryLabel(category: string) {
  return $t(categoryLabels[category] || category);
}
function errorMessage(error: any) {
  return error?.message || error?.data?.message || String(error);
}

async function loadCatalog() {
  catalogLoading.value = true;
  try {
    const response = await axios.post("/setting/promptManage/getCatalog");
    entries.value = manageableCatalogEntries(Array.isArray(response.data) ? response.data : []);
  } catch (error) {
    window.$message.error(`${$t("promptManage.loadFailed")}：${errorMessage(error)}`);
  } finally {
    catalogLoading.value = false;
  }
}

async function openShow(entry: PromptCatalogEntry) {
  view.value = openPromptDetail(entry.key);
  contentLoading.value = true;
  draft.value = "";
  try {
    const response = await axios.post("/setting/promptManage/getContent", { key: entry.key });
    if (activeKey.value !== entry.key) return;
    draft.value = typeof response.data === "string" ? response.data : "";
  } catch (error) {
    if (activeKey.value !== entry.key) return;
    window.$message.error(`${$t("promptManage.loadFailed")}：${errorMessage(error)}`);
  } finally {
    if (activeKey.value === entry.key) contentLoading.value = false;
  }
}

async function onConfirm() {
  if (!activeEntry.value || !draft.value.trim()) return;
  saving.value = true;
  try {
    await axios.post("/setting/promptManage/updateContent", { key: activeEntry.value.key, content: draft.value });
    window.$message.success($t("promptManage.saveSuccess"));
    view.value = closePromptDetail();
    await loadCatalog();
  } catch (error) {
    window.$message.error(`${$t("promptManage.saveFailed")}：${errorMessage(error)}`);
  } finally {
    saving.value = false;
  }
}

function confirmReset() {
  if (!activeEntry.value?.resettable) return;
  const dialog = DialogPlugin.confirm({
    header: $t("promptManage.restoreDefault"),
    body: $t("promptManage.restoreConfirm"),
    confirmBtn: $t("promptManage.restoreDefault"),
    cancelBtn: $t("promptManage.cancel"),
    onConfirm: async () => {
      await resetPrompt();
      dialog.hide();
    },
  });
}

async function resetPrompt() {
  if (!activeEntry.value) return;
  resetting.value = true;
  try {
    await axios.post("/setting/promptManage/resetContent", { key: activeEntry.value.key });
    activeEntry.value.customized = false;
    const response = await axios.post("/setting/promptManage/getContent", { key: activeEntry.value.key });
    draft.value = typeof response.data === "string" ? response.data : "";
    window.$message.success($t("promptManage.restoreSuccess"));
  } catch (error) {
    window.$message.error(`${$t("promptManage.restoreFailed")}：${errorMessage(error)}`);
  } finally {
    resetting.value = false;
  }
}

onMounted(loadCatalog);
</script>

<style lang="scss" scoped>
.promptManage {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  .data {
    .name {
      font-size: 15px;
      font-weight: 900;
    }
    .type {
      font-size: 14px;
      color: #999;
    }
    .data {
      margin-top: 10px;
      font-size: 14px;
      color: #666;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }
  }
}
.detailMeta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  .source {
    flex: 1;
    color: var(--td-text-color-secondary);
    font-size: 12px;
    word-break: break-all;
  }
}
.profileNotice {
  margin-bottom: 10px;
}
.editorLoading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
</style>
