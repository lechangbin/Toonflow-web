<template>
  <div class="addScript">
    <t-dialog
      v-model:visible="addScriptShow"
      width="60vw"
      top="1vh"
      header="新增剧本"
      :closable="false"
      :maskClosable="false"
      >
      <div class="data">
        <div class="section name">
          <span class="section-label">剧本名称</span>
          <t-input v-model="scriptName" placeholder="请输入剧本名称" />
        </div>

        <div class="section upload">
          <span class="section-label">上传文件</span>
          <div class="upload-area" @click="triggerUpload" @dragover.prevent @drop.prevent="handleDrop">
            <t-upload
              ref="uploadRef"
              v-model="fileList"
              theme="file"
              :multiple="false"
              :max="1"
              :before-upload="handleBeforeUpload"
              style="display: none" />
            <div class="dragIcon">
              <i-upload-one theme="outline" size="32" fill="var(--td-brand-color)" />
            </div>
            <p class="upload-text">拖拽剧本文件到此处或点击上传</p>
            <p class="upload-hint">支持 .txt, .docx 格式，建议文件大小不超过 10MB</p>
          </div>
        </div>

        <div class="section content">
          <span class="section-label">剧本内容</span>
          <t-textarea v-model="scriptData" placeholder="请上传或输入剧本内容..." name="description" :autosize="{ minRows: 12, maxRows: 12 }" />
        </div>

        <div class="section assets-section">
          <div class="assets-header">
            <span class="section-label">关联资产</span>
            <t-button size="small" theme="primary" variant="outline" @click="handleSelectAssets">
              <template #icon><i-plus /></template>
              选择资产
            </t-button>
          </div>
          <div class="assets-list" v-if="selectedAssets.length">
            <t-tag v-for="asset in selectedAssets" :key="asset.id" closable variant="light-outline" @close="removeAsset(asset.id)">
              {{ asset.name }}
            </t-tag>
          </div>
          <div v-else class="assets-empty">暂未关联资产</div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <t-button theme="default" @click="handleCancel">取消</t-button>
          <t-button theme="primary" @click="handleConfirm">确认</t-button>
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { LoadingPlugin } from "tdesign-vue-next";
import mammoth from "mammoth";
import { MessagePlugin } from "tdesign-vue-next";
import type { UploadFile } from "tdesign-vue-next";
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import openAssetsSelector from "@/utils/assetsCheck";

const { project } = storeToRefs(projectStore());

const addScriptShow = defineModel<boolean>({
  default: false,
});

const uploadRef = ref<any>(null);
const content = ref<string>("");
const fileList = ref<UploadFile[]>([]);
const scriptData = ref<string>("");

// 触发上传
function triggerUpload(): void {
  uploadRef.value?.triggerUpload();
}
// 读取文件内容
async function readFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (file.type === "text/plain") {
    return new TextDecoder().decode(buffer);
  }
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}
// 上传前校验并解析
async function handleBeforeUpload(file: UploadFile): Promise<boolean> {
  const rawFile = file.raw;
  if (!rawFile) {
    MessagePlugin.error("文件读取失败");
    return false;
  }

  const allowTypes = ["text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

  if (rawFile.type === "application/msword") {
    MessagePlugin.warning(".doc文件不支持解析,请转换为.txt或.docx文件");
    fileList.value = [];
    return false;
  }
  if (!allowTypes.includes(rawFile.type)) {
    MessagePlugin.error("不支持的文件类型");
    fileList.value = [];
    return false;
  }
  if (rawFile.size > 10 * 1024 * 1024) {
    MessagePlugin.error("文件大小超过10MB，请上传更小的文件");
    fileList.value = [];
    return false;
  }

  const loader = LoadingPlugin({
    fullscreen: true,
    attach: "body",
    text: "文件解析中...",
  });
  try {
    content.value = await readFile(rawFile);
    scriptData.value = content.value;
  } catch (error) {
    console.error("文件解析失败:", error);
    MessagePlugin.error("文件解析失败，请重新上传");
    fileList.value = [];
  } finally {
    loader.hide();
  }
  return false;
}
// 处理拖拽上传
async function handleDrop(e: DragEvent): Promise<void> {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    fileList.value = [];
    const file = files[0];
    await handleBeforeUpload({ raw: file } as UploadFile);
  }
}
// ============== Assets ==============
interface SelectedAsset {
  id: number;
  name: string;
}
const selectedAssets = ref<SelectedAsset[]>([]);

async function handleSelectAssets() {
  const assets = await openAssetsSelector({ title: "选择关联资产", types: ["role", "tool", "scene"] });
  if (assets.length) {
    const existing = new Set(selectedAssets.value.map((a) => a.id));
    for (const a of assets) {
      if (!existing.has(a.id)) {
        selectedAssets.value.push({ id: a.id, name: a.name });
      }
    }
  }
}

function removeAsset(id: number) {
  selectedAssets.value = selectedAssets.value.filter((a) => a.id !== id);
}

function handleCancel(): void {
  addScriptShow.value = false;
  scriptData.value = "";
  content.value = "";
  fileList.value = [];
  selectedAssets.value = [];
}
function close(): void {
  scriptData.value = "";
  content.value = "";
  fileList.value = [];
  selectedAssets.value = [];
  addScriptShow.value = false;
}
const emit = defineEmits(["searchScripts"]);
async function handleConfirm(): Promise<void> {
  if (!scriptData.value.trim()) {
    MessagePlugin.warning("请上传或输入剧本内容");
    return;
  }
  if (!scriptName.value.trim()) {
    MessagePlugin.warning("请输入剧本名称");
    return;
  }
  try {
    await axios.post("/script/addScript", {
      name: scriptName.value,
      content: scriptData.value,
      projectId: project.value?.id,
      assets: selectedAssets.value.map((a) => a.id),
    });
    MessagePlugin.success("剧本添加成功");
  } catch (error) {
    console.error("添加剧本失败:", error);
    MessagePlugin.error("添加剧本失败，请稍后再试");
  } finally {
    close();
    emit("searchScripts");
  }
}
const scriptName = ref<string>("");
</script>

<style lang="scss" scoped>
$line-height: 28px;

.addScript {
  .titHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
    width: 100%;

    .titleWrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      .title {
        font-weight: 600;
        font-size: 18px;
      }
    }
  }

  .data {
    display: flex;
    flex-direction: column;
    gap: 20px;

    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .section-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--td-text-color-primary);
    }

    .upload {
      .upload-area {
        padding: 32px 20px;
        border: 2px dashed var(--td-component-border);
        border-radius: 8px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        &:hover {
          background-color: var(--td-bg-color-secondarycontainer-hover);
          border-color: var(--td-brand-color);
        }

        .dragIcon {
          margin-bottom: 12px;
        }

        .upload-text {
          font-size: 14px;
          margin: 0 0 8px;
        }

        .upload-hint {
          font-size: 12px;
          margin: 0;
          color: var(--td-text-color-placeholder);
        }
      }
    }

    .assets-section {
      .assets-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .assets-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .assets-empty {
        font-size: 13px;
        color: var(--td-text-color-placeholder);
      }
    }

    .content {
      width: 100%;
      overflow: auto;
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 0 0;
  }
}
</style>
