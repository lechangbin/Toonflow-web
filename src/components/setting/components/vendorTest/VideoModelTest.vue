<template>
  <t-dialog placement="center" width="58vw" v-model:visible="visible" :header="$t('settings.vendor.test.videoTitle') + ' - ' + model.modelName" :footer="false" @closed="handleClose">
    <div class="videoTestDialog">
      <div class="settingsRow">
        <t-select v-model="capabilityId" @change="resetSelection"><t-option v-for="item in model.capabilities" :key="item.id" :value="item.id" :label="capabilityLabel(item.id)" /></t-select>
        <t-select v-model="presetId" @change="resetOutput"><t-option v-for="item in capability?.outputPresets ?? []" :key="item.id" :value="item.id" :label="`${item.resolution} · ${item.id}`" /></t-select>
        <t-select v-model="aspectRatio"><t-option v-for="item in preset?.aspectRatios ?? []" :key="item" :value="item" :label="item" /></t-select>
        <t-select v-model="duration"><t-option v-for="item in durations" :key="item" :value="item" :label="`${item}s`" /></t-select>
      </div>
      <t-alert v-if="capability?.audio.policy === 'always'" theme="info">该 Capability 始终生成原生音频。</t-alert>
      <t-switch v-else-if="capability?.audio.policy === 'optional'" v-model="audioEnabled">
        <template #label>原生音频</template>
      </t-switch>
      <div v-if="capability?.inputs.length" class="frameRow">
        <t-form-item v-for="input in capability.inputs" :key="input.role" :label="`${roleLabel(input.role)}${input.required ? '' : '（可选）'}`">
          <ImageUploadBox
            :model-value="images[input.role] ?? null"
            :optional="!input.required"
            @update:model-value="images[input.role] = $event" />
        </t-form-item>
      </div>
      <t-form-item :label="$t('settings.vendor.test.prompt')">
        <t-textarea v-model="prompt" :placeholder="$t('settings.vendor.test.videoPromptPlaceholder')" :autosize="{ minRows: 3, maxRows: 6 }" :disabled="loading" />
      </t-form-item>
      <div v-if="resultUrl" class="resultSection"><video :src="resultUrl" controls autoplay loop class="resultVideo" /></div>
      <div v-else-if="loading" class="loadingSection"><t-loading size="large" :text="$t('settings.vendor.videoGenerating')" /></div>
      <div class="dialogFooter">
        <t-button variant="outline" @click="visible = false">{{ $t("settings.vendor.test.cancel") }}</t-button>
        <t-button theme="primary" :loading="loading" :disabled="!canSubmit" @click="handleTest">{{ $t("settings.vendor.test.startTest") }}</t-button>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import ImageUploadBox from "./ImageUploadBox.vue";
import { createAudioSelection, getPresetDurations, type VideoAspectRatio, type VideoCapabilityId, type VideoInputRole, type VideoModelContract } from "@/videoContract";

const props = defineProps<{ vendorId: string; model: VideoModelContract }>();
const visible = defineModel<boolean>("modelVisible");
const capabilityId = ref<VideoCapabilityId>(props.model.capabilities[0]?.id ?? "text-to-video");
const capability = computed(() => props.model.capabilities.find((item) => item.id === capabilityId.value));
const presetId = ref(capability.value?.outputPresets[0]?.id ?? "");
const preset = computed(() => capability.value?.outputPresets.find((item) => item.id === presetId.value));
const durations = computed(() => (preset.value ? getPresetDurations(preset.value) : []));
const aspectRatio = ref<VideoAspectRatio>(preset.value?.aspectRatios[0] ?? "16:9");
const duration = ref(preset.value ? getPresetDurations(preset.value)[0] : 0);
const audioEnabled = ref(true);
const images = reactive<Partial<Record<VideoInputRole, File | null>>>({});
const prompt = ref("");
const loading = ref(false);
const resultUrl = ref("");

function capabilityLabel(id: VideoCapabilityId) { return ({ "text-to-video": "文生视频", "image-to-video": "图生视频", "first-last-frame": "首尾帧", "keyframe-to-video": "关键帧动画" } as const)[id]; }
function roleLabel(role: VideoInputRole) { return ({ "source-image": "参考图", "first-frame": "首帧", "intermediate-keyframe": "中间参考帧", "last-frame": "尾帧" } as const)[role]; }
function resetOutput() { if (!preset.value) return; aspectRatio.value = preset.value.aspectRatios[0]; duration.value = getPresetDurations(preset.value)[0]; }
function resetSelection() { presetId.value = capability.value?.outputPresets[0]?.id ?? ""; for (const key of Object.keys(images)) delete images[key as VideoInputRole]; audioEnabled.value = true; resultUrl.value = ""; resetOutput(); }
const canSubmit = computed(() => !!prompt.value.trim() && !!capability.value && !!preset.value && capability.value.inputs.every((input) => !input.required || !!images[input.role]) && !loading.value);
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }); }
async function handleTest() {
  if (!canSubmit.value || !capability.value || !preset.value) return;
  loading.value = true; resultUrl.value = "";
  try {
    const encoded = await Promise.all(capability.value.inputs.flatMap((input) => images[input.role] ? [{ role: input.role, file: images[input.role]! }] : []).map(async (item) => ({ role: item.role, base64: await fileToDataUrl(item.file) })));
    const { data } = await axios.post("/setting/vendorConfig/modelTest/videoTest", {
      vendorId: props.vendorId, modelId: props.model.modelName, capabilityId: capability.value.id, prompt: prompt.value.trim(),
      output: { presetId: preset.value.id, resolution: preset.value.resolution, duration: duration.value, aspectRatio: aspectRatio.value },
      audio: createAudioSelection(capability.value.audio, audioEnabled.value), images: encoded,
    }, { timeout: 30 * 60 * 1000 });
    resultUrl.value = data; window.$message.success($t("settings.vendor.msg.videoGenSuccess"));
  } catch (error) { window.$message.error((error as Error)?.message ?? $t("settings.vendor.msg.requestFailed")); }
  finally { loading.value = false; }
}
function handleClose() { prompt.value = ""; resetSelection(); loading.value = false; }
</script>

<style lang="scss" scoped>
.videoTestDialog { display: flex; flex-direction: column; gap: 14px; max-height: 80vh; overflow-y: auto; }
.settingsRow, .frameRow, .dialogFooter { display: flex; gap: 12px; align-items: flex-start; }
.settingsRow > * { flex: 1; }
.frameRow { flex-wrap: wrap; }
.resultVideo { width: 100%; max-height: 40vh; border-radius: 8px; background: #000; }
.loadingSection { display: flex; justify-content: center; padding: 32px; }
.dialogFooter { justify-content: flex-end; border-top: 1px solid var(--td-component-border); padding-top: 12px; }
</style>
