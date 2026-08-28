<template>
  <div class="modeMenu ac">
    <modelSelect
      v-model="modelParmas.modelSelection"
      type="video"
      size="small"
      :changeConfig="true"
      @change="handleModelChange" />
    <t-select v-model="modelParmas.capabilityId" size="small" class="selector" @change="handleCapabilityChange">
      <t-option v-for="capability in modelParmas.model?.capabilities ?? []" :key="capability.id" :value="capability.id" :label="capabilityLabel(capability.id)" />
    </t-select>
    <t-select :value="modelParmas.output?.presetId" size="small" class="selector" @change="handlePresetChange">
      <t-option v-for="preset in modelParmas.capability?.outputPresets ?? []" :key="preset.id" :value="preset.id" :label="`${preset.resolution} · ${preset.id}`" />
    </t-select>
    <t-select :value="modelParmas.output?.aspectRatio" size="small" class="ratio" @change="handleRatioChange">
      <t-option v-for="ratio in selectedPreset?.aspectRatios ?? []" :key="ratio" :value="ratio" :label="ratio" />
    </t-select>
    <t-select :value="modelParmas.output?.duration" size="small" class="duration" @change="handleDurationChange">
      <t-option v-for="duration in durations" :key="duration" :value="duration" :label="`${duration}s`" />
    </t-select>
    <t-button
      size="small"
      variant="outline"
      :theme="audioEnabled ? 'success' : 'default'"
      :disabled="audioLocked"
      @click="toggleAudio">
      <template #icon>
        <i-volume-notice v-if="audioEnabled" size="16" />
        <i-volume-mute v-else size="16" />
      </template>
      {{ audioLabel }}
    </t-button>
  </div>
</template>

<script setup lang="ts">
import "@/views/production/components/workbench/type/type";
import axios from "@/utils/axios";
import {
  createAudioSelection,
  getPresetDurations,
  type VideoAspectRatio,
  type VideoCapabilityId,
  type VideoModelContract,
} from "@/videoContract";

const props = defineProps<{ trackId?: number }>();
const modelParmas = defineModel<ModelSetting>({ required: true });
const emit = defineEmits<{
  modelChange: [value: string, model: VideoModelContract];
  selectionChange: [kind: "capability" | "output" | "audio"];
}>();

const selectedPreset = computed(() =>
  modelParmas.value.capability?.outputPresets.find((preset) => preset.id === modelParmas.value.output?.presetId),
);
const durations = computed(() => (selectedPreset.value ? getPresetDurations(selectedPreset.value) : []));
const audioEnabled = computed(() => modelParmas.value.audio.generation === "native" && modelParmas.value.audio.enabled);
const audioLocked = computed(() => modelParmas.value.capability?.audio.policy !== "optional");
const audioLabel = computed(() => {
  const policy = modelParmas.value.capability?.audio.policy;
  if (policy === "always") return "原生音频（始终）";
  if (policy === "none") return "无原生音频";
  return audioEnabled.value ? "原生音频" : "静音";
});

function capabilityLabel(id: VideoCapabilityId): string {
  return {
    "text-to-video": "文生视频",
    "image-to-video": "图生视频",
    "first-last-frame": "首尾帧",
    "keyframe-to-video": "关键帧动画",
  }[id];
}

function handleModelChange(value: string, model: VideoModelContract) {
  emit("modelChange", value, model);
}

function handleCapabilityChange(value: unknown) {
  const capabilityId = String(value) as VideoCapabilityId;
  const capability = modelParmas.value.model?.capabilities.find((item) => item.id === capabilityId) ?? null;
  modelParmas.value.capability = capability;
  modelParmas.value.capabilityId = capability?.id ?? "";
  modelParmas.value.audio = capability ? createAudioSelection(capability.audio) : { generation: "none" };
  const preset = capability?.outputPresets[0];
  modelParmas.value.output = preset
    ? {
        presetId: preset.id,
        resolution: preset.resolution,
        duration: getPresetDurations(preset)[0],
        aspectRatio: preset.aspectRatios[0],
      }
    : null;
  persistDuration();
  emit("selectionChange", "capability");
}

function handlePresetChange(value: unknown) {
  const presetId = String(value);
  const preset = modelParmas.value.capability?.outputPresets.find((item) => item.id === presetId);
  if (!preset) return;
  modelParmas.value.output = {
    presetId: preset.id,
    resolution: preset.resolution,
    duration: getPresetDurations(preset)[0],
    aspectRatio: preset.aspectRatios.includes(modelParmas.value.output?.aspectRatio as VideoAspectRatio)
      ? (modelParmas.value.output!.aspectRatio as VideoAspectRatio)
      : preset.aspectRatios[0],
  };
  persistDuration();
  emit("selectionChange", "output");
}

function handleRatioChange(value: unknown) {
  const aspectRatio = String(value) as VideoAspectRatio;
  if (modelParmas.value.output) modelParmas.value.output.aspectRatio = aspectRatio;
  emit("selectionChange", "output");
}

function handleDurationChange(value: unknown) {
  const duration = Number(value);
  if (modelParmas.value.output) modelParmas.value.output.duration = duration;
  persistDuration();
  emit("selectionChange", "output");
}

function toggleAudio() {
  if (modelParmas.value.capability?.audio.policy !== "optional") return;
  modelParmas.value.audio = { generation: "native", enabled: !audioEnabled.value };
  emit("selectionChange", "audio");
}

function persistDuration() {
  if (props.trackId && modelParmas.value.output) {
    void axios.post("/production/workbench/updateVideoDuration", {
      id: props.trackId,
      duration: modelParmas.value.output.duration,
    });
  }
}
</script>

<style lang="scss" scoped>
.modeMenu {
  gap: 8px;
  width: 100%;
  flex-wrap: wrap;

  .selector {
    width: 220px;
  }

  .ratio,
  .duration {
    width: 96px;
  }
}
</style>
