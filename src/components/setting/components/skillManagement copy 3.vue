<template>
  <div class="skillManagement">
    <div class="toolbar">
      <div class="leftTools">
        <t-button theme="primary" @click="openSkillEditor()">
          <template #icon><t-icon name="add" /></template>
          新增 Skill
        </t-button>
        <t-button theme="default" variant="outline" @click="triggerImport">
          <template #icon><t-icon name="upload" /></template>
          导入 Skill
        </t-button>
        <t-upload
          ref="uploadRef"
          v-model="fileList"
          theme="file"
          :multiple="false"
          :max="1"
          :before-upload="handleBeforeUpload"
          style="display: none" />
      </div>
      <div class="rightTools">
        <t-input v-model="searchText" placeholder="按名称搜索 skill" clearable style="width: 220px" @enter="loadSkills" />
        <t-button theme="default" @click="loadSkills">
          <template #icon><t-icon name="search" /></template>
          查询
        </t-button>
      </div>
    </div>

    <div class="listPanel">
      <div class="listHeader">
        <div class="headerInfo">
          <span>共 {{ pagination.total }} 个 Skill</span>
        </div>
      </div>

      <t-loading :loading="loading" text="加载 Skill 列表中...">
        <div v-if="tableData.length === 0" class="emptyWrap">
          <t-empty description="暂无 Skill 数据" />
        </div>

        <div v-else class="skillRows">
          <div v-for="row in tableData" :key="row.id" class="skillRow">
            <div class="rowMain">
              <div class="rowTop">
                <div class="nameBlock">
                  <div class="mainText">{{ row.name || "-" }}</div>
                  <div class="subText monoText">ID: {{ row.id }}</div>
                </div>
                <div class="metaTags">
                  <t-tag v-for="attr in row.attributions" :key="attr" theme="primary" variant="light-outline">{{ formatAttribution(attr) }}</t-tag>
                  <t-tag :theme="getStateTheme(row.state)" variant="light-outline">
                    {{ getStateLabel(row.state) }}
                  </t-tag>
                </div>
              </div>

              <div class="pathLine monoText">{{ row.path || "-" }}</div>

              <div class="descLine">{{ row.description || "-" }}</div>

              <div class="rowBottom">
                <div class="bottomMeta">
                  <span>创建时间: {{ row.updatedAt || "-" }}</span>
                </div>
                <div class="rowActions">
                  <t-button theme="primary" variant="text" @click="openSkillEditor(row)">
                    <template #icon><t-icon name="edit" /></template>
                    编辑
                  </t-button>
                  <t-button theme="danger" variant="text" @click="handleDelete(row)">
                    <template #icon><t-icon name="delete" /></template>
                    删除
                  </t-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </t-loading>

      <t-pagination
        v-model:current="pagination.current"
        v-model:pageSize="pagination.pageSize"
        class="paginationWrap"
        :total="pagination.total"
        show-sizer
        @current-change="loadSkills"
        @page-size-change="handlePageSizeChange" />
    </div>

    <!-- 新增 / 编辑 统一弹窗 -->
    <t-dialog
      v-model:visible="editorVisible"
      :header="isEdit ? `编辑 Skill - ${editorForm.name}` : '新增 Skill'"
      :confirm-btn="null"
      :cancel-btn="null"
      placement="center"
      width="90vw"
      top="3vh"
      :close-on-overlay-click="false"
      @close="closeEditor">
      <div class="editorDialogContent">
        <t-loading :loading="editorLoading" text="加载 Skill 内容中..." size="small" class="editorLoadingWrap">
          <div class="editorBody">
            <div class="editorSidebar">
              <t-form labelAlign="top">
                <t-form-item label="Skill 名称">
                  <t-input v-model="editorForm.name" :disabled="isEdit" placeholder="例如：writing-assistant" />
                </t-form-item>
                <t-form-item label="描述" class="descItem">
                  <t-textarea v-model="editorForm.description" :autosize="false" placeholder="描述这个 skill 的用途" class="descTextarea" />
                </t-form-item>
              </t-form>
            </div>
            <div class="editorMain">
              <MdEditor
                v-model="editorForm.content"
                theme="light"
                :toolbars="mdToolbars"
                :footers="[]"
                class="mdEditorFull"
                @onUploadImg="() => {}"
                @drop.prevent
                @paste="onMdPaste" />
            </div>
          </div>
        </t-loading>
      </div>
      <template #footer>
        <div class="editorFooter">
          <t-button theme="default" @click="closeEditor">取消</t-button>
          <t-button theme="primary" :loading="saveLoading" :disabled="editorLoading" @click="saveSkill">
            {{ isEdit ? "保存" : "创建 Skill" }}
          </t-button>
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import { MdEditor } from "md-editor-v3";
import type { ToolbarNames } from "md-editor-v3";
import "md-editor-v3/lib/style.css";
import { DialogPlugin, LoadingPlugin } from "tdesign-vue-next";
import type { UploadFile } from "tdesign-vue-next";

type SkillAttribution =
  | "production_agent_decision.md"
  | "production_agent_execution.md"
  | "production_agent_supervision.md"
  | "script_agent_decision.md"
  | "script_agent_execution.md"
  | "script_agent_supervision.md"
  | "universal-agent.md";

interface SkillRow {
  id: string;
  md5: string;
  path: string;
  name: string;
  description: string;
  content: string;
  type: "main" | "references";
  attributions: SkillAttribution[];
  state: number;
  createTime: number;
  updateTime: number;
  updatedAt?: string;
}

interface SkillListItem {
  id: string;
  md5: string;
  path: string;
  name: string;
  description: string;
  type: "main" | "references";
  attributions: SkillAttribution[];
  state: number;
  createTime: number;
  updateTime: number;
}

interface SkillDetailPayload {
  content?: string;
  mdContent?: string;
  markdown?: string;
  description?: string;
}

const attributionLabelMap: Record<string, string> = {
  "production_agent_decision.md": "制作-决策",
  "production_agent_execution.md": "制作-执行",
  "production_agent_supervision.md": "制作-监督",
  "script_agent_decision.md": "剧本-决策",
  "script_agent_execution.md": "剧本-执行",
  "script_agent_supervision.md": "剧本-监督",
  "universal-agent.md": "通用",
};

const loading = ref(false);
const saveLoading = ref(false);
const tableData = ref<SkillRow[]>([]);
const searchText = ref("");
const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
});

const editorVisible = ref(false);
const editorLoading = ref(false);
const isEdit = ref(false);
const editorForm = ref<SkillRow>({
  id: "",
  md5: "",
  path: "",
  name: "",
  description: "",
  content: "",
  type: "main",
  attributions: [],
  state: 1,
  createTime: 0,
  updateTime: 0,
});

const mdToolbars: ToolbarNames[] = [
  "bold",
  "underline",
  "italic",
  "strikeThrough",
  "-",
  "title",
  "sub",
  "sup",
  "quote",
  "unorderedList",
  "orderedList",
  "task",
  "-",
  "codeRow",
  "code",
  "table",
  "-",
  "revoke",
  "next",
  "=",
  "preview",
];

const uploadRef = ref<any>(null);
const fileList = ref<UploadFile[]>([]);

function formatTime(timestamp?: number) {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getStateLabel(state?: number) {
  if (state === 1) return "正常";
  if (state === -1) return "描述为空";
  if (state === -2) return "归属为空";
  if (state === -3) return "MD5变动";
  return "未知状态";
}

function getStateTheme(state?: number): "success" | "warning" | "danger" | "default" {
  if (state === 1) return "success";
  if (state === -1 || state === -2 || state === -3) return "danger";
  return "default";
}

function formatAttribution(attr: string) {
  return attributionLabelMap[attr] ?? attr;
}

function onMdPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/") || item.type.startsWith("video/")) {
      e.preventDefault();
      return;
    }
  }
}

async function loadSkills() {
  loading.value = true;
  try {
    const { data }: { data: { list: SkillListItem[]; total: number } } = await axios.post("/setting/skillManagement/getSkillList", {
      page: pagination.value.current,
      limit: pagination.value.pageSize,
      search: searchText.value,
    });
    tableData.value = data.list.map((item) => ({
      ...item,
      content: "",
      attributions: item.attributions ?? [],
      updatedAt: formatTime(item.updateTime),
    }));
    pagination.value.total = Number(data.total);
  } catch (error: any) {
    window.$message.error(error?.message || "获取 Skill 列表失败");
    tableData.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

function handlePageSizeChange(pageSize: number) {
  pagination.value.pageSize = pageSize;
  pagination.value.current = 1;
  loadSkills();
}

function normalizeSkillDetail(response: unknown) {
  const payload = (
    response && typeof response === "object" && "data" in response ? (response as { data?: SkillDetailPayload | string }).data : response
  ) as SkillDetailPayload | string | undefined;

  if (typeof payload === "string") {
    return { content: payload, description: undefined };
  }
  return {
    content: payload?.content ?? payload?.mdContent ?? payload?.markdown ?? "",
    description: payload?.description,
  };
}

async function openSkillEditor(row?: SkillRow) {
  if (row) {
    isEdit.value = true;
    editorForm.value = { ...row };
    editorVisible.value = true;
    editorLoading.value = true;
    try {
      const detailResponse = await axios.post("/setting/skillManagement/getSkillDetail", { id: row.id });
      const detail = normalizeSkillDetail(detailResponse);
      editorForm.value = {
        ...row,
        description: detail.description ?? row.description,
        content: detail.content,
      };
    } catch (error: any) {
      window.$message.warning(error?.message || "Skill 详情加载失败，已使用列表数据打开");
    } finally {
      editorLoading.value = false;
    }
  } else {
    isEdit.value = false;
    editorForm.value = {
      id: "",
      md5: "",
      path: "",
      name: "",
      description: "",
      content: "# 新 Skill\n\n请在这里编写 skill markdown 内容。",
      type: "main",
      attributions: [],
      state: 1,
      createTime: 0,
      updateTime: 0,
    };
    editorLoading.value = false;
    editorVisible.value = true;
  }
}

function closeEditor() {
  editorVisible.value = false;
  editorLoading.value = false;
}

async function saveSkill() {
  if (editorLoading.value) return;
  if (!editorForm.value.name.trim()) {
    window.$message.warning("请先填写 Skill 名称");
    return;
  }
  if (!editorForm.value.content.trim()) {
    window.$message.warning("请先填写 Markdown 内容");
    return;
  }
  saveLoading.value = true;
  try {
    if (isEdit.value) {
      await axios.post("/setting/skillManagement/updateSkill", {
        id: editorForm.value.id,
        name: editorForm.value.name,
        description: editorForm.value.description,
        content: editorForm.value.content,
      });
      window.$message.success("Skill 更新成功");
    } else {
      await axios.post("/setting/skillManagement/addSkill", {
        name: editorForm.value.name,
        description: editorForm.value.description,
        content: editorForm.value.content,
      });
      window.$message.success("Skill 创建成功");
    }
    closeEditor();
    loadSkills();
  } catch (error: any) {
    window.$message.error(error?.message || (isEdit.value ? "Skill 更新失败" : "Skill 创建失败"));
  } finally {
    saveLoading.value = false;
  }
}

function handleDelete(row: SkillRow) {
  const confirmDialog = DialogPlugin.confirm({
    header: "删除确认",
    body: `确认删除 Skill: ${row.name} ?`,
    onConfirm: async () => {
      try {
        await axios.post("/setting/skillManagement/deleteSkill", { id: row.id });
        window.$message.success("Skill 删除成功");
        if (tableData.value.length === 1 && pagination.value.current > 1) {
          pagination.value.current -= 1;
        }
        loadSkills();
      } catch (error: any) {
        window.$message.error(error?.message || "Skill 删除失败");
      } finally {
        confirmDialog.destroy();
      }
    },
    onClose: () => confirmDialog.destroy(),
  });
}

function triggerImport() {
  uploadRef.value?.triggerUpload();
}

async function handleBeforeUpload(file: UploadFile) {
  const rawFile = file.raw;
  if (!rawFile) {
    window.$message.error("读取文件失败");
    return false;
  }
  if (!rawFile.name.toLowerCase().endsWith(".md")) {
    window.$message.warning("仅支持导入 .md 文件");
    fileList.value = [];
    return false;
  }
  const loader = LoadingPlugin({ fullscreen: true, attach: "body", text: "正在导入 Skill..." });
  try {
    const content = await rawFile.text();
    await axios.post("/setting/skillManagement/importSkill", { fileName: rawFile.name, content });
    window.$message.success("Skill 导入成功");
    loadSkills();
  } catch (error: any) {
    window.$message.error(error?.message || "Skill 导入失败");
  } finally {
    loader.hide();
    fileList.value = [];
  }
  return false;
}

onMounted(() => {
  loadSkills();
});
</script>

<style lang="scss" scoped>
.skillManagement {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.leftTools,
.rightTools {
  display: flex;
  gap: 8px;
  align-items: center;
}

.listPanel {
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-default);
  background: var(--td-bg-color-container);
  overflow: hidden;
}

.listHeader {
  padding: 12px 16px;
  border-bottom: 1px solid var(--td-component-border);
  background: var(--td-bg-color-secondarycontainer);

  .headerInfo {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: var(--td-text-color-secondary);
  }
}

.emptyWrap {
  padding: 40px 0;
}

.skillRows {
  display: flex;
  flex-direction: column;
}

.skillRow {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--td-component-border);
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--td-bg-color-container-hover);
  }
}

.rowMain {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rowTop {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.nameBlock {
  min-width: 0;
}

.mainText {
  font-size: 15px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.subText {
  margin-top: 2px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.monoText {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.metaTags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
  justify-content: flex-end;
}

.pathLine {
  font-size: 12px;
  line-height: 1.5;
  color: var(--td-text-color-placeholder);
  word-break: break-all;
}

.descLine {
  line-height: 1.6;
  color: var(--td-text-color-primary);
  display: -webkit-box;
  line-clamp: 3;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.rowBottom {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.bottomMeta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.rowActions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.paginationWrap {
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
}

.editorDialogContent {
  min-height: 68vh;
}

.editorLoadingWrap {
  width: 100%;
  min-height: 68vh;
}

.editorBody {
  display: flex;
  gap: 16px;
  height: 68vh;

  .editorSidebar {
    width: 260px;
    min-width: 220px;
    height: 100%;
    min-height: 0;
    flex-shrink: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;

    :deep(.t-form) {
      flex: 1;
      min-height: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .descItem {
      flex: 1;
      min-height: 0;
      margin-bottom: 0;
      display: flex;
      flex-direction: column;

      :deep(.t-form__item) {
        flex: 1;
        min-height: 0;
      }

      :deep(.t-form__content) {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      :deep(.t-form__controls) {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      :deep(.t-form__controls-content) {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      .descTextarea {
        flex: 1;
        min-height: 0;
        height: 100%;

        :deep(.t-textarea) {
          flex: 1;
          min-height: 0;
          height: 100%;
        }

        :deep(.t-textarea__inner) {
          height: 100% !important;
          min-height: 100% !important;
          resize: none;
        }

        :deep(textarea) {
          height: 100% !important;
          resize: none;
        }
      }
    }
  }

  .editorMain {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    .mdEditorFull {
      flex: 1;
      height: 100%;
    }
  }
}

.editorFooter {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 900px) {
  .toolbar,
  .rowTop,
  .rowBottom {
    flex-direction: column;
    align-items: stretch;
  }

  .leftTools,
  .rightTools {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .paginationWrap {
    justify-content: center;
  }

  .editorBody {
    flex-direction: column;
    height: auto;

    .editorSidebar {
      width: 100%;
      min-width: unset;
    }

    .editorMain {
      min-height: 50vh;
    }
  }
}
</style>
