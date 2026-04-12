<template>
  <div class="modelMap">
    <div v-if="loading" class="loadingWrap">
      <t-loading size="medium" />
    </div>
    <template v-else>
      <!-- 图像模型 -->
      <div v-if="imageModels.length > 0" class="section">
        <div class="sectionTitle">
          <t-tag theme="primary" variant="light">{{ $t("settings.modelMap.imageModel") }}</t-tag>
        </div>
        <div v-for="model in imageModels" :key="model.modelName" class="modelCard">
          <div class="modelHeader">
            <span class="modelName">{{ model.name }}</span>
            <span class="modelId">{{ model.modelName }}</span>
          </div>
          <t-table
            :data="getImageModeRows(model)"
            :columns="tableColumns"
            row-key="mode"
            size="small"
            bordered
            :show-header="true">
            <template #prompt="{ row }">
              <t-input
                v-model="row.prompt"
                :placeholder="$t('settings.modelMap.promptPlaceholder')"
                @blur="handlePromptChange(model, row)"
              />
            </template>
          </t-table>
        </div>
      </div>

      <!-- 视频模型 -->
      <div v-if="videoModels.length > 0" class="section">
        <div class="sectionTitle">
          <t-tag theme="warning" variant="light">{{ $t("settings.modelMap.videoModel") }}</t-tag>
        </div>
        <div v-for="model in videoModels" :key="model.modelName" class="modelCard">
          <div class="modelHeader">
            <span class="modelName">{{ model.name }}</span>
            <span class="modelId">{{ model.modelName }}</span>
          </div>
          <t-table
            :data="getVideoModeRows(model)"
            :columns="tableColumns"
            row-key="mode"
            size="small"
            bordered
            :show-header="true">
            <template #prompt="{ row }">
              <t-input
                v-model="row.prompt"
                :placeholder="$t('settings.modelMap.promptPlaceholder')"
                @blur="handlePromptChange(model, row)"
              />
            </template>
          </t-table>
        </div>
      </div>

      <div v-if="imageModels.length === 0 && videoModels.length === 0" class="emptyTip">
        {{ $t("settings.modelMap.noModel") }}
      </div>
    </template>

    <!-- 保存按钮 -->
    <div class="footer" v-if="!loading">
      <t-button theme="primary" :loading="saving" @click="handleSave">{{ $t("settings.modelMap.save") }}</t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";

// ── 类型定义 ──
interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
}

type VideoModeItem =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | string[];

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoModeItem[];
}
interface TableData {
    id:string;
    label:string;
    value:string;
}
// mode 对应的中文标签映射
const MODE_LABEL_MAP: Record<string, string> = {
  text: $t("settings.modelMap.mode.text"),
  singleImage: $t("settings.modelMap.mode.singleImage"),
  multiReference: $t("settings.modelMap.mode.multiReference"),
  startEndRequired: $t("settings.modelMap.mode.startEndRequired"),
  endFrameOptional: $t("settings.modelMap.mode.endFrameOptional"),
  startFrameOptional: $t("settings.modelMap.mode.startFrameOptional"),
  videoReference: $t("settings.modelMap.mode.videoReference"),
  imageReference: $t("settings.modelMap.mode.imageReference"),
  audioReference: $t("settings.modelMap.mode.audioReference"),
};

function getModeLabel(mode: VideoModeItem | string): string {
  if (Array.isArray(mode)) {
    return (
      mode
        .map((m) => {
          const base = m.replace(/:.*$/, "");
          return MODE_LABEL_MAP[base] ?? base;
        })
        .join(" + ") + $t("settings.modelMap.mode.referenceSuffix")
    );
  }
  return MODE_LABEL_MAP[mode as string] ?? (mode as string);
}

function modeToKey(mode: VideoModeItem | string): string {
  return Array.isArray(mode) ? JSON.stringify(mode) : (mode as string);
}

// ── 表格列配置（title 必须是字符串，不能是 ComputedRef）──
const tableColumns = computed(() => [
  {
    colKey: "modeLabel",
    title: $t("settings.modelMap.col.mode"),
    width: 200,
  },
  {
    colKey: "prompt",
    title: $t("settings.modelMap.col.prompt"),
    cell: "prompt",
  },
]);

// ── 状态 ──
const loading = ref(true);
const saving = ref(false);
const imageModels = ref<ImageModel[]>([]);
const videoModels = ref<VideoModel[]>([]);

// promptMap 结构: { [modelName]: { [modeKey]: string } }
const promptMap = ref<Record<string, Record<string, string>>>({});

// ── 工具：将 model.mode 转换为表格行数据 ──
function getImageModeRows(model: ImageModel) {
  return model.mode.map((mode) => ({
    mode: modeToKey(mode),
    modeLabel: getModeLabel(mode),
    prompt: promptMap.value[model.modelName]?.[modeToKey(mode)] ?? "",
  }));
}

function getVideoModeRows(model: VideoModel) {
  return model.mode.map((mode) => ({
    mode: modeToKey(mode),
    modeLabel: getModeLabel(mode),
    prompt: promptMap.value[model.modelName]?.[modeToKey(mode)] ?? "",
  }));
}

// ── 输入框 blur 时同步到 promptMap ──
function handlePromptChange(model: ImageModel | VideoModel, row: { mode: string; prompt: string }) {
  if (!promptMap.value[model.modelName]) {
    promptMap.value[model.modelName] = {};
  }
  promptMap.value[model.modelName][row.mode] = row.prompt;
}

// ── 获取模型列表 ──
async function loadModelList() {
  loading.value = true;
  try {
    const { data } = await axios.post("/setting/modelMap/getImageAndVideoModel");
    console.log("%c Line:187 🥓 data", "background:#93c0a4", data);

    

    // 加载已保存的 promptMap
    // await loadSavedPrompts();
  } catch (error) {
    console.error($t("components.modelSelect.msg.fetchModelFailed"), error);
  } finally {
    loading.value = false;
  }
}

// ── 加载已保存的提示词映射 ──
async function loadSavedPrompts() {
  try {
    const { data } = await axios.post("/modelSelect/getModelPromptMap");
    if (data) promptMap.value = data;
  } catch {
    // 若接口不存在则忽略
  }
}

// ── 保存 ──
async function handleSave() {
  saving.value = true;
  try {
    await axios.post("/modelSelect/saveModelPromptMap", { promptMap: promptMap.value });
    window.$message.success($t("settings.modelMap.msg.saveSuccess"));
  } catch (error) {
    window.$message.error($t("settings.modelMap.msg.saveFailed"));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadModelList();
});
</script>

<style lang="scss" scoped>
.modelMap {
  width: 100%;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loadingWrap {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sectionTitle {
  font-size: 15px;
  font-weight: 600;
  padding-bottom: 4px;
}

.modelCard {
  border: 1px solid var(--td-component-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--td-bg-color-container);

  .modelHeader {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;

    .modelName {
      font-size: 14px;
      font-weight: 600;
    }

    .modelId {
      font-size: 12px;
      color: var(--td-text-color-secondary);
    }
  }
}

.emptyTip {
  text-align: center;
  color: var(--td-text-color-secondary);
  padding: 40px 0;
}

.footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>
