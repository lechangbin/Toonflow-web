<template>
  <div class="promptManagement">
    <aside class="catalogPanel">
      <div class="catalogToolbar">
        <t-input v-model="keyword" clearable :placeholder="$t('promptManage.searchPlaceholder')">
          <template #prefix-icon><t-icon name="search" /></template>
        </t-input>
        <t-select v-model="selectedCategory" :options="categoryOptions" />
      </div>
      <div class="catalogSummary">
        <span>{{ $t("promptManage.promptCount", { count: filteredEntries.length }) }}</span>
        <t-button variant="text" size="small" :loading="catalogLoading" @click="loadCatalog">
          <template #icon><t-icon name="refresh" /></template>{{ $t("promptManage.refresh") }}
        </t-button>
      </div>
      <div class="catalogList" role="listbox" :aria-label="$t('promptManage.catalogAriaLabel')">
        <button
          v-for="entry in filteredEntries"
          :key="entry.key"
          type="button"
          role="option"
          class="catalogItem"
          :class="{ active: entry.key === activeKey }"
          :aria-selected="entry.key === activeKey"
          @click="selectEntry(entry)">
          <span class="itemName">{{ entry.name }}</span>
          <span class="itemMeta">
            <t-tag size="small" variant="light">{{ categoryLabel(entry.category) }}</t-tag>
            <t-tag v-if="entry.customized" size="small" theme="warning" variant="light">{{ $t("promptManage.customized") }}</t-tag>
          </span>
          <span class="itemSource">{{ entry.source }}</span>
        </button>
        <t-empty v-if="!catalogLoading && !filteredEntries.length" :description="$t('promptManage.empty')" />
      </div>
    </aside>

    <section class="editorPanel">
      <template v-if="activeEntry">
        <header class="editorHeader">
          <div class="editorIdentity">
            <div class="titleLine">
              <h3>{{ activeEntry.name }}</h3>
              <t-tag variant="light">{{ categoryLabel(activeEntry.category) }}</t-tag>
              <t-tag v-if="dirty" theme="warning" variant="light">{{ $t("promptManage.unsaved") }}</t-tag>
            </div>
            <p>{{ activeEntry.source }}</p>
          </div>
          <t-space>
            <t-button
              v-if="activeEntry.resettable"
              variant="outline"
              :disabled="!activeEntry.customized"
              :loading="resetting"
              @click="confirmReset">
              {{ $t("promptManage.restoreDefault") }}
            </t-button>
            <t-button theme="primary" :disabled="!dirty || !draft.trim()" :loading="saving" @click="savePrompt">
              <template #icon><t-icon name="save" /></template>{{ $t("promptManage.save") }}
            </t-button>
          </t-space>
        </header>
        <t-alert v-if="activeEntry.kind === 'video-profile'" theme="warning" class="profileNotice">
          {{ $t("promptManage.profileNotice") }}
        </t-alert>
        <div class="editorWrap" :aria-busy="contentLoading">
          <t-loading v-if="contentLoading" loading size="small" />
          <MdEditor
            v-else
            v-model="draft"
            :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode"
            :toolbars="promptToolbars"
            :footers="[]"
            preview-theme="github"
            code-theme="atom"
            :placeholder="$t('promptManage.editorPlaceholder')"
            @onUploadImg="() => {}" />
        </div>
      </template>
      <t-empty v-else :description="$t('promptManage.selectPrompt')" />
    </section>
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

interface PromptCatalogEntry {
  key: string;
  name: string;
  category: string;
  kind: "system" | "skill" | "video-profile" | "model-prompt";
  source: string;
  customized: boolean;
  resettable: boolean;
}

const { themeSetting } = storeToRefs(settingStore());
const entries = ref<PromptCatalogEntry[]>([]);
const activeKey = ref("");
const keyword = ref("");
const selectedCategory = ref("");
const draft = ref("");
const original = ref("");
const catalogLoading = ref(false);
const contentLoading = ref(false);
const saving = ref(false);
const resetting = ref(false);
const promptToolbars: ToolbarNames[] = ["bold", "italic", "strikeThrough", "-", "title", "quote", "unorderedList", "orderedList", "table", "code", "-", "revoke", "next", "=", "preview"];

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

const activeEntry = computed(() => entries.value.find((entry) => entry.key === activeKey.value));
const dirty = computed(() => draft.value !== original.value);
const categoryOptions = computed(() => [
  { label: $t("promptManage.allCategories"), value: "" },
  ...Array.from(new Set(entries.value.map((entry) => entry.category))).map((category) => ({ label: categoryLabel(category), value: category })),
]);
const filteredEntries = computed(() => {
  const search = keyword.value.trim().toLowerCase();
  return entries.value.filter((entry) =>
    (!selectedCategory.value || entry.category === selectedCategory.value) &&
    (!search || `${entry.name} ${entry.source} ${categoryLabel(entry.category)}`.toLowerCase().includes(search)),
  );
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
    entries.value = Array.isArray(response.data) ? response.data : [];
    if (activeKey.value && !entries.value.some((entry) => entry.key === activeKey.value)) activeKey.value = "";
    if (!activeKey.value && entries.value.length) await selectEntry(entries.value[0]);
  } catch (error) {
    window.$message.error(`${$t("promptManage.loadFailed")}：${errorMessage(error)}`);
  } finally {
    catalogLoading.value = false;
  }
}

async function selectEntry(entry: PromptCatalogEntry, force = false) {
  if (!force && dirty.value && !window.confirm($t("promptManage.discardConfirm"))) return;
  activeKey.value = entry.key;
  contentLoading.value = true;
  try {
    const response = await axios.post("/setting/promptManage/getContent", { key: entry.key });
    draft.value = typeof response.data === "string" ? response.data : "";
    original.value = draft.value;
  } catch (error) {
    draft.value = "";
    original.value = "";
    window.$message.error(`${$t("promptManage.loadFailed")}：${errorMessage(error)}`);
  } finally {
    contentLoading.value = false;
  }
}

async function savePrompt() {
  if (!activeEntry.value || !draft.value.trim()) return;
  saving.value = true;
  try {
    await axios.post("/setting/promptManage/updateContent", { key: activeEntry.value.key, content: draft.value });
    original.value = draft.value;
    if (activeEntry.value.kind === "system") activeEntry.value.customized = true;
    window.$message.success($t("promptManage.saveSuccess"));
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
    await selectEntry(activeEntry.value, true);
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
.promptManagement { display: grid; grid-template-columns: 310px minmax(0, 1fr); gap: 12px; height: 100%; min-height: 0; }
.catalogPanel, .editorPanel { min-height: 0; border: 1px solid var(--td-component-stroke); border-radius: 8px; background: var(--td-bg-color-container); overflow: hidden; }
.catalogPanel { display: flex; flex-direction: column; }
.catalogToolbar { display: grid; gap: 8px; padding: 12px; border-bottom: 1px solid var(--td-component-stroke); }
.catalogSummary { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; color: var(--td-text-color-secondary); font-size: 12px; }
.catalogList { flex: 1; overflow-y: auto; padding: 0 8px 10px; }
.catalogItem { width: 100%; display: flex; flex-direction: column; gap: 5px; padding: 10px; margin: 2px 0; border: 1px solid transparent; border-radius: 6px; color: var(--td-text-color-primary); background: transparent; text-align: left; cursor: pointer; transition: background-color 180ms ease, border-color 180ms ease; }
.catalogItem:hover { background: var(--td-bg-color-container-hover); }
.catalogItem:focus-visible { outline: 2px solid var(--td-brand-color-focus); outline-offset: 1px; }
.catalogItem.active { border-color: var(--td-brand-color-light); background: var(--td-brand-color-light); }
.itemName { font-size: 14px; font-weight: 600; line-height: 20px; }
.itemMeta { display: flex; flex-wrap: wrap; gap: 4px; }
.itemSource { color: var(--td-text-color-placeholder); font-size: 11px; line-height: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editorPanel { display: flex; flex-direction: column; }
.editorHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--td-component-stroke); }
.editorIdentity { min-width: 0; }
.titleLine { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.titleLine h3 { margin: 0; font-size: 15px; font-weight: 600; }
.editorIdentity p { margin: 4px 0 0; color: var(--td-text-color-secondary); font-size: 12px; word-break: break-all; }
.profileNotice { margin: 10px 12px 0; }
.editorWrap { position: relative; flex: 1; min-height: 0; padding: 12px; }
.editorWrap :deep(.md-editor) { height: 100%; border-radius: 6px; }
@media (max-width: 900px) { .promptManagement { grid-template-columns: 260px minmax(0, 1fr); } .editorHeader { flex-direction: column; } }
@media (max-width: 720px) { .promptManagement { grid-template-columns: 1fr; grid-template-rows: minmax(180px, 36%) minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .catalogItem { transition: none; } }
</style>
