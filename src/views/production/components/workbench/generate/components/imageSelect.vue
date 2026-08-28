<template>
  <div class="semanticInputs ac">
    <div v-if="!capability || capability.inputs.length === 0" class="emptyHint">当前 Capability 不需要参考图</div>
    <div
      v-for="input in capability?.inputs ?? []"
      :key="input.role"
      class="inputSlot"
      :class="{ optional: !input.required }"
      @click="chooseMedia(input.role)">
      <template v-if="mediaByRole.get(input.role)">
        <t-image :src="mediaByRole.get(input.role)?.src" fit="contain" class="preview" />
        <div class="clearBtn" @click.stop="clearRole(input.role)"><i-close size="12" /></div>
        <t-tag size="small" class="sourceTag">
          {{ sourceLabel(mediaByRole.get(input.role)?.sources) }}
        </t-tag>
      </template>
      <template v-else>
        <i-plus size="24" />
        <span>{{ roleLabel(input.role) }}</span>
        <small>{{ input.required ? "必填" : "可选" }}</small>
      </template>
      <button class="uploadLink" type="button" @click.stop="chooseUpload(input.role)">本地上传</button>
    </div>

    <input ref="fileInput" class="fileInput" type="file" accept="image/jpeg,image/png,image/webp" @change="uploadImage" />

    <t-dialog v-model:visible="storyboardDialogVisible" header="选择分镜" :footer="false" width="800px" placement="center">
      <div class="storyboardGrid">
        <div v-for="storyboard in storyboardList" :key="storyboard.id" class="storyboardItem" @click="pickStoryboard(storyboard)">
          <span class="storyboardIndex">P{{ storyboard.index + 1 }}</span>
          <img v-if="storyboard.src" :src="storyboard.src" />
          <div v-else class="textBox ac jc">分镜 {{ storyboard.index + 1 }}</div>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import assetsCheck from "@/utils/assetsCheck";
import axios from "@/utils/axios";
import type { VideoCapabilityContract, VideoInputRole } from "@/videoContract";

const props = defineProps<{
  capability: VideoCapabilityContract | null;
  storyboardList: StoryboardItem[];
  projectId: number;
  scriptId: number;
}>();
const imageList = defineModel<UploadItem[]>({ default: () => [] });
const storyboardDialogVisible = ref(false);
const currentRole = ref<VideoInputRole | null>(null);
const fileInput = ref<HTMLInputElement>();

const mediaByRole = computed(() => new Map(imageList.value.filter((item) => item.inputRole).map((item) => [item.inputRole!, item])));

watch(
  () => props.capability?.id,
  () => {
    const accepted = new Set(props.capability?.inputs.map((input) => input.role) ?? []);
    imageList.value = imageList.value.filter((item) => item.inputRole && accepted.has(item.inputRole));
  },
);

function roleLabel(role: VideoInputRole): string {
  return {
    "source-image": "参考图",
    "first-frame": "首帧",
    "intermediate-keyframe": "中间参考帧",
    "last-frame": "尾帧",
  }[role];
}

function sourceLabel(source?: string): string {
  if (source === "storyboard") return "分镜";
  if (source === "uploaded-media") return "上传";
  return "资产";
}

function setRole(role: VideoInputRole, item: UploadItem) {
  const withoutRole = imageList.value.filter((candidate) => candidate.inputRole !== role);
  const declaredOrder = props.capability?.inputs.map((input) => input.role) ?? [];
  imageList.value = [...withoutRole, { ...item, inputRole: role }].sort(
    (left, right) => declaredOrder.indexOf(left.inputRole!) - declaredOrder.indexOf(right.inputRole!),
  );
}

function clearRole(role: VideoInputRole) {
  imageList.value = imageList.value.filter((item) => item.inputRole !== role);
}

function chooseUpload(role: VideoInputRole) {
  currentRole.value = role;
  fileInput.value?.click();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const role = currentRole.value;
  input.value = "";
  if (!file || !role) return;
  if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
    window.$message.error("仅支持 JPEG、PNG 或 WEBP 图片");
    return;
  }
  try {
    const { data } = await axios.post("/production/workbench/uploadVideoInputImage", {
      projectId: props.projectId,
      scriptId: props.scriptId,
      base64Data: await fileToDataUrl(file),
    });
    setRole(role, {
      id: null,
      sources: "uploaded-media",
      fileType: "image",
      filePath: data.filePath,
      src: data.url,
      name: file.name,
    });
  } catch (error) {
    window.$message.error((error as Error)?.message ?? "上传图片失败");
  }
}

function chooseMedia(role: VideoInputRole) {
  currentRole.value = role;
  const dialog = DialogPlugin.confirm({
    header: `${roleLabel(role)}：选择来源`,
    body: "确认选择资产；取消后可从分镜中选择。",
    confirmBtn: "选择资产",
    cancelBtn: "选择分镜",
    onConfirm: async () => {
      dialog.destroy();
      const assets = await assetsCheck({ types: ["role", "tool", "scene", "clip"], clipMediaTypes: ["image"], multiple: false });
      const asset = assets[0];
      if (!asset || !currentRole.value) return;
      setRole(currentRole.value, {
        id: asset.id,
        sources: "assets",
        fileType: "image",
        src: asset.src,
        prompt: asset.prompt,
        name: asset.name,
      } as UploadItem);
    },
    onCancel: () => {
      dialog.destroy();
      storyboardDialogVisible.value = true;
    },
  });
}

function pickStoryboard(storyboard: StoryboardItem) {
  storyboardDialogVisible.value = false;
  if (!currentRole.value) return;
  setRole(currentRole.value, {
    id: storyboard.id,
    sources: "storyboard",
    fileType: "image",
    src: storyboard.src,
    prompt: storyboard.videoDesc ?? undefined,
    index: storyboard.index,
  });
}
</script>

<style lang="scss" scoped>
.semanticInputs {
  gap: 10px;
  min-height: 90px;
  overflow-x: auto;

  .emptyHint {
    color: var(--td-text-color-secondary);
    font-size: 13px;
  }

  .inputSlot {
    position: relative;
    width: 112px;
    min-width: 112px;
    height: 82px;
    border: 1px dashed var(--td-component-border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    overflow: hidden;

    &.optional {
      opacity: 0.82;
    }

    &:hover {
      border-color: var(--td-brand-color);
    }

    small {
      color: var(--td-text-color-secondary);
    }

    .preview {
      width: 100%;
      height: 100%;
    }

    .clearBtn {
      position: absolute;
      top: 3px;
      right: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: rgba(0, 0, 0, 0.65);
    }

    .sourceTag {
      position: absolute;
      right: 3px;
      bottom: 3px;
    }

    .uploadLink {
      position: absolute;
      left: 3px;
      bottom: 3px;
      padding: 1px 4px;
      border: 0;
      border-radius: 3px;
      color: #fff;
      background: rgba(0, 0, 0, 0.65);
      cursor: pointer;
    }
  }

  .fileInput {
    display: none;
  }

  .storyboardGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    max-height: 60vh;
    overflow-y: auto;

    .storyboardItem {
      position: relative;
      cursor: pointer;
      border: 2px solid transparent;
      border-radius: 8px;
      overflow: hidden;

      &:hover {
        border-color: var(--td-brand-color);
      }

      img,
      .textBox {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
      }

      .storyboardIndex {
        position: absolute;
        z-index: 1;
        top: 4px;
        left: 4px;
        padding: 1px 5px;
        color: #fff;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 4px;
      }
    }
  }
}
</style>
