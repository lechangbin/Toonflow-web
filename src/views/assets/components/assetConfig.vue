<template>
  <div class="assetConfigWrap">
    <t-dialog
      v-model:visible="visible"
      :header="$t('workbench.assets.config.header') + ' · ' + formData.name"
      width="780px"
      top="40px"
      :footer="false"
      destroy-on-close
    >
      <div class="configBody">
        <t-alert v-if="failure" theme="error" :message="failure.message + '，' + $t('workbench.assets.config.retryHint')" class="configAlert" />
        <t-alert v-if="conflictMessage" theme="warning" :message="conflictMessage" class="configAlert" />

        <div class="sectionHeader">
          <span class="sectionTitle">{{ $t("workbench.assets.config.refTitle") }}</span>
          <t-tag size="small" :theme="canAdd ? 'default' : 'warning'">
            {{ references.length }} / {{ ASSET_REFERENCE_LIMIT }}
          </t-tag>
        </div>
        <t-loading :loading="loading" show-overlay>
          <div v-if="references.length === 0 && !uploadDraft" class="emptyState">
            {{ $t("workbench.assets.config.empty") }}
          </div>
          <div v-else class="referenceList">
            <div v-for="(item, index) in references" :key="item.id" class="referenceCard">
              <div class="thumbBox">
                <img class="thumb" :src="mediaUrl(item.mediaPath)" :alt="item.description" />
              </div>
              <div class="cardFields">
                <div class="fieldRow">
                  <div class="fieldLabel">{{ $t("workbench.assets.config.descLabel") }}</div>
                  <t-textarea
                    v-model="editDrafts[item.id].description"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    :placeholder="$t('workbench.assets.config.descPh')"
                  />
                </div>
                <div class="fieldRow">
                  <div class="fieldLabel">{{ $t("workbench.assets.config.roleLabel") }}</div>
                  <t-input v-model="editDrafts[item.id].visualRole" :placeholder="$t('workbench.assets.config.rolePh')" />
                </div>
                <div class="fieldRow">
                  <div class="fieldLabel">{{ $t("workbench.assets.config.transfersLabel") }}</div>
                  <t-input v-model="editDrafts[item.id].requiredTransfers" :placeholder="$t('workbench.assets.config.transfersPh')" />
                </div>
                <div class="fieldRow">
                  <div class="fieldLabel">{{ $t("workbench.assets.config.exclusionsLabel") }}</div>
                  <t-input v-model="editDrafts[item.id].exclusions" :placeholder="$t('workbench.assets.config.exclusionsPh')" />
                </div>
                <div class="lifecycleRow">
                  <t-tag size="small" :theme="item.descriptionSource === 'manual' ? 'primary' : 'default'">
                    {{ sourceLabel(item) }}
                  </t-tag>
                  <t-tag v-if="item.analysisState !== 'not_requested'" size="small" theme="warning">
                    {{ analysisLabel(item) }}
                  </t-tag>
                </div>
              </div>
              <div class="cardOps">
                <t-button variant="text" size="small" :disabled="index === 0 || saving" @click="moveReference(item.id, -1)">
                  {{ $t("workbench.assets.config.moveUp") }}
                </t-button>
                <t-button variant="text" size="small" :disabled="index === references.length - 1 || saving" @click="moveReference(item.id, 1)">
                  {{ $t("workbench.assets.config.moveDown") }}
                </t-button>
                <t-button variant="text" size="small" theme="primary" :disabled="saving" @click="saveReference(item.id)">
                  {{ $t("workbench.assets.config.save") }}
                </t-button>
                <t-button variant="text" size="small" theme="danger" :disabled="saving" @click="removeReference(item)">
                  {{ $t("workbench.assets.config.remove") }}
                </t-button>
              </div>
            </div>
            <div v-if="uploadDraft" class="referenceCard newCard">
              <div class="thumbBox">
                <img class="thumb" :src="uploadDraft.previewUrl" :alt="$t('workbench.assets.config.uploadBtn')" />
              </div>
              <div class="cardFields">
                <div class="fieldRow">
                  <div class="fieldLabel">{{ $t("workbench.assets.config.descLabel") }}</div>
                  <t-textarea
                    v-model="uploadDraft.description"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    :placeholder="$t('workbench.assets.config.descPh')"
                  />
                </div>
                <div class="fieldRow">
                  <div class="fieldLabel">{{ $t("workbench.assets.config.roleLabel") }}</div>
                  <t-input v-model="uploadDraft.visualRole" :placeholder="$t('workbench.assets.config.rolePh')" />
                </div>
                <div class="fieldRow">
                  <div class="fieldLabel">{{ $t("workbench.assets.config.transfersLabel") }}</div>
                  <t-input v-model="uploadDraft.requiredTransfers" :placeholder="$t('workbench.assets.config.transfersPh')" />
                </div>
                <div class="fieldRow">
                  <div class="fieldLabel">{{ $t("workbench.assets.config.exclusionsLabel") }}</div>
                  <t-input v-model="uploadDraft.exclusions" :placeholder="$t('workbench.assets.config.exclusionsPh')" />
                </div>
              </div>
              <div class="cardOps">
                <t-button variant="text" size="small" theme="primary" :loading="saving" @click="saveUploadDraft">
                  {{ $t("workbench.assets.config.save") }}
                </t-button>
                <t-button variant="text" size="small" theme="danger" :disabled="saving" @click="uploadDraft = null">
                  {{ $t("workbench.assets.config.cancel") }}
                </t-button>
              </div>
            </div>
          </div>
        </t-loading>
        <div class="uploadAction">
          <t-button :disabled="!canAdd || saving || loading" @click="pickImage">
            {{ $t("workbench.assets.config.uploadBtn") }}
          </t-button>
          <span v-if="!canAdd" class="limitHint">{{ $t("workbench.assets.config.limitReached") }}</span>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style="display: none"
            @change="onFileChosen"
          />
        </div>

        <t-divider />

        <div class="sectionHeader">
          <span class="sectionTitle">{{ $t("workbench.assets.config.promptTitle") }}</span>
        </div>
        <t-textarea
          v-model="promptDraft"
          :autosize="{ minRows: 4, maxRows: 10 }"
          :placeholder="$t('workbench.assets.config.promptPh')"
        />
        <div class="promptOps">
          <t-button theme="primary" :loading="saving" @click="savePromptDraft">
            {{ $t("workbench.assets.config.savePrompt") }}
          </t-button>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { DialogPlugin } from "tdesign-vue-next";
import settingStore from "@/stores/setting";
import projectStore from "@/stores/project";
import {
  ASSET_REFERENCE_LIMIT,
  findControlledDimensionConflicts,
  hydrateAssetConfig,
  normalizeTagInput,
  referenceMediaUrl,
  validateReferenceDraft,
  type AssetReferenceRecord,
} from "@/assetReferenceContract";
import { useAssetReferences } from "@/composables/useAssetReferences";

/** 父页面传入的资产行数据（旧资产允许 prompt 为空）。 */
const props = defineProps<{
  formData: {
    id: number;
    name: string;
    describe: string;
    remark: string;
    prompt: string;
  };
}>();
const emit = defineEmits(["refresh"]);
const visible = defineModel<boolean>({ default: false });

interface ReferenceDraftInput {
  description: string;
  visualRole: string;
  requiredTransfers: string;
  exclusions: string;
}

interface UploadDraft extends ReferenceDraftInput {
  base64: string;
  previewUrl: string;
}

const { project } = storeToRefs(projectStore());
const store = settingStore();

const {
  references,
  loading,
  saving,
  failure,
  canAdd,
  load,
  create,
  update,
  remove,
  move,
  savePrompt,
} = useAssetReferences(() => ({ projectId: project.value?.id, assetsId: props.formData.id }));

const promptDraft = ref("");
const editDrafts = ref<Record<number, ReferenceDraftInput>>({});
const uploadDraft = ref<UploadDraft | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

/** 把编辑缓冲与已保存记录合成为有效契约，用于冲突校验。 */
const effectiveReferences = computed(() =>
  references.value.map((item) => {
    const draft = editDrafts.value[item.id];
    if (!draft) return item;
    return {
      ...item,
      description: draft.description,
      visualRole: draft.visualRole,
      requiredTransfers: normalizeTagInput(draft.requiredTransfers),
      exclusions: normalizeTagInput(draft.exclusions),
    };
  }),
);

/** 上传草稿同样参与受控维度冲突校验，保证提交前可见。 */
const conflictSources = computed<Pick<AssetReferenceRecord, "id" | "requiredTransfers" | "exclusions">[]>(() => {
  const sources: Pick<AssetReferenceRecord, "id" | "requiredTransfers" | "exclusions">[] = effectiveReferences.value.map(
    (item) => ({ id: item.id, requiredTransfers: item.requiredTransfers, exclusions: item.exclusions }),
  );
  if (uploadDraft.value) {
    sources.push({
      id: -1,
      requiredTransfers: normalizeTagInput(uploadDraft.value.requiredTransfers),
      exclusions: normalizeTagInput(uploadDraft.value.exclusions),
    });
  }
  return sources;
});

const conflictMessage = computed(() => {
  const conflicts = findControlledDimensionConflicts(conflictSources.value);
  if (conflicts.length === 0) return "";
  return $t("workbench.assets.config.conflictAlert", {
    dimensions: conflicts.map((conflict) => conflict.dimension).join("、"),
  });
});

watch(visible, (open) => {
  if (!open) return;
  promptDraft.value = hydrateAssetConfig(props.formData).prompt;
  uploadDraft.value = null;
  load();
});

function mediaUrl(mediaPath: string): string {
  return referenceMediaUrl(store.baseUrl, mediaPath);
}

function sourceLabel(item: AssetReferenceRecord): string {
  return item.descriptionSource === "ai"
    ? $t("workbench.assets.config.sourceAi")
    : $t("workbench.assets.config.sourceManual");
}

function analysisLabel(item: AssetReferenceRecord): string {
  const key = "workbench.assets.config.analysis." + item.analysisState;
  const label = $t(key);
  return label === key ? item.analysisState : label;
}

function pickImage(): void {
  fileInputRef.value?.click();
}

function onFileChosen(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    uploadDraft.value = {
      base64: String(reader.result ?? ""),
      previewUrl: String(reader.result ?? ""),
      description: "",
      visualRole: "",
      requiredTransfers: "",
      exclusions: "",
    };
  };
  reader.readAsDataURL(file);
}

async function saveUploadDraft(): Promise<void> {
  if (!uploadDraft.value) return;
  const validated = validateReferenceDraft(uploadDraft.value);
  if (!validated.ok) {
    window.$message.warning(validated.failure.message);
    return;
  }
  const result = await create(uploadDraft.value);
  if (result) {
    window.$message.error(result.message);
    return;
  }
  uploadDraft.value = null;
  window.$message.success($t("workbench.assets.config.createSuccess"));
}

async function saveReference(id: number): Promise<void> {
  const draft = editDrafts.value[id];
  if (!draft) return;
  const validated = validateReferenceDraft(draft);
  if (!validated.ok) {
    window.$message.warning(validated.failure.message);
    return;
  }
  const result = await update(id, draft);
  if (result) {
    window.$message.error(result.message);
    return;
  }
  window.$message.success($t("workbench.assets.config.updateSuccess"));
}

function removeReference(item: AssetReferenceRecord): void {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.assets.config.remove"),
    body: $t("workbench.assets.config.confirmDeleteBody"),
    confirmBtn: $t("workbench.assets.config.remove"),
    cancelBtn: $t("workbench.assets.config.cancel"),
    theme: "warning",
    onConfirm: async () => {
      dialog.destroy();
      const result = await remove(item.id);
      if (result) {
        window.$message.error(result.message);
        return;
      }
      window.$message.success($t("workbench.assets.config.deleteSuccess"));
    },
  });
}

async function moveReference(id: number, direction: -1 | 1): Promise<void> {
  const result = await move(id, direction);
  if (result) {
    window.$message.error(result.message);
    return;
  }
  window.$message.success($t("workbench.assets.config.reorderSuccess"));
}

async function savePromptDraft(): Promise<void> {
  const result = await savePrompt({
    id: props.formData.id,
    name: props.formData.name,
    describe: props.formData.describe,
    remark: props.formData.remark,
    prompt: promptDraft.value,
  });
  if (result) {
    window.$message.error(result.message);
    return;
  }
  window.$message.success($t("workbench.assets.config.promptSaved"));
  emit("refresh");
}

/**
 * 列表刷新后同步编辑缓冲：合并语义——保留仍未保存的用户编辑
 * （排序/删除触发的 reload 不丢草稿），为新增记录补建缓冲，
 * 移除已删除记录。弹窗重新打开时缓冲为空，全部由服务端持久化
 * 状态重建（刷新恢复顺序、描述与契约）。
 */
watch(references, (list) => {
  const drafts: Record<number, ReferenceDraftInput> = {};
  for (const item of list) {
    drafts[item.id] = editDrafts.value[item.id] ?? {
      description: item.description,
      visualRole: item.visualRole,
      requiredTransfers: item.requiredTransfers.join("，"),
      exclusions: item.exclusions.join("，"),
    };
  }
  editDrafts.value = drafts;
});
</script>

<style scoped lang="scss">
.assetConfigWrap {
  .configBody {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 72vh;
    overflow-y: auto;
    padding-right: 4px;
  }

  .configAlert {
    margin-bottom: 4px;
  }

  .sectionHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .sectionTitle {
      font-size: 15px;
      font-weight: 600;
    }
  }

  .emptyState {
    padding: 24px 0;
    text-align: center;
    color: var(--td-text-color-placeholder);
    background: var(--td-bg-color-container-hover);
    border-radius: var(--td-radius-medium);
  }

  .referenceList {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .referenceCard {
    display: flex;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--td-component-border);
    border-radius: var(--td-radius-medium);

    .thumbBox {
      flex: 0 0 96px;
      width: 96px;
      height: 96px;
      overflow: hidden;
      border-radius: var(--td-radius-small);
      background: var(--td-bg-color-secondarycontainer);

      .thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .cardFields {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .fieldLabel {
        font-size: 12px;
        color: var(--td-text-color-secondary);
        margin-bottom: 2px;
      }
    }

    .lifecycleRow {
      display: flex;
      gap: 8px;
    }

    .cardOps {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 2px;
    }

    &.newCard {
      border-color: var(--td-brand-color);
    }
  }

  .uploadAction {
    display: flex;
    align-items: center;
    gap: 12px;

    .limitHint {
      color: var(--td-warning-color);
      font-size: 12px;
    }
  }

  .promptOps {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }
}
</style>
