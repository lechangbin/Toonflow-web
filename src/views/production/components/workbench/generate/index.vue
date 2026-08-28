<template>
  <div class="index fc">
    <imageSelect v-model="imageList" :capability="modelParmas.capability" :project-id="Number(project?.id)" :script-id="episodesId" :storyboard-list="storyboardList" />
    <modeMenu
      v-model="modelParmas"
      :track-id="currentTrack?.id"
      @model-change="handleModelChange"
      @selection-change="handleSelectionChange" />
    <div class="generate ac">
      <t-card v-if="currentTrack" :title="'#' + (activeTrackIndex + 1) + $t('workbench.generate.generateText')" header-bordered class="prompt">
        <template #actions><t-button size="small" :loading="currentTrack.state === '生成中'" @click="genText">{{ $t("workbench.generate.generateText") }}</t-button></template>
        <div @focusout="handlePromptBlur"><promptEditor v-model="currentTrack.prompt" :references="references" :placeholder="$t('workbench.generate.promptPlaceholder')" /></div>
      </t-card>
      <div class="video"><videoCard v-if="currentTrack" :active-track-index="activeTrackIndex" v-model:current-track="currentTrack" @refresh="getGenerateData" @generate="generateVideo" /></div>
    </div>
    <newTrack class="track" v-model:activeTrackIndex="activeTrackIndex" v-model="trackList" :image-list="imageList" :model-parmas="modelParmas" @change="trackChange" @get-data="getGenerateData" @batch-prompt="batchGenText" @batch-video="batchGenVideo" />
  </div>
</template>

<script setup lang="ts">
import type { Ref } from "vue";
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import settingStore from "@/stores/setting";
import imageListCacheStore from "@/stores/imageListCache";
import promptEditor from "@/components/promptEditor.vue";
import newTrack from "./components/track.vue";
import imageSelect from "./components/imageSelect.vue";
import modeMenu from "./components/modeMenu.vue";
import videoCard from "./components/video.vue";
import { getVideoCapabilityCatalog } from "@/utils/videoCapabilityCatalog";
import {
  buildGenerationItem,
  buildPromptRequest,
  createVideoSelection,
  findCatalogModel,
  getPresetDurations,
  hydrateTrackMediaFromActualInputs,
  normalizeStartedTasks,
  type PromptRevisionResponse,
  type VideoAspectRatio,
  type VideoCapabilityCatalogVendor,
  type VideoCapabilityId,
  type VideoOutputSelection,
  type VideoSelection,
  type VideoTrackInputReference,
} from "@/videoContract";
import "@/views/production/components/workbench/type/type";

const { project } = storeToRefs(projectStore());
const { otherSetting } = storeToRefs(settingStore());
const episodesId = inject<Ref<number>>("episodesId")!;
const { getCache, setCache, initCacheFromTrackList, warmUpUrls } = imageListCacheStore();
const catalog = ref<VideoCapabilityCatalogVendor[]>([]);
const activeTrackIndex = ref(0);
const trackList = ref<TrackItem[]>([]);
const storyboardList = ref<StoryboardItem[]>([]);
const lastSavedPrompt = new Map<number, string>();
const modelParmas = ref<ModelSetting>({ modelSelection: "", model: null, capabilityId: "", capability: null, output: null, audio: { generation: "none" } });
const currentTrack = computed({ get: () => trackList.value[activeTrackIndex.value], set: (value: TrackItem) => (trackList.value[activeTrackIndex.value] = value) });

function configureSelection(
  modelSelection: string,
  capabilityId?: VideoCapabilityId | null,
  output?: Partial<VideoOutputSelection> | null,
) {
  const model = findCatalogModel(catalog.value, modelSelection).model;
  const capability = model.capabilities.find((item) => item.id === capabilityId) ?? model.capabilities[0];
  if (!capability) throw new Error(`${model.modelName} 没有可用的 Video Capability`);
  const preset = capability.outputPresets.find((item) => item.id === output?.presetId) ?? capability.outputPresets[0];
  if (!preset) throw new Error(`${capability.id} 没有输出预设`);
  const durations = getPresetDurations(preset);
  const aspectRatio = preset.aspectRatios.includes(output?.aspectRatio as VideoAspectRatio) ? (output!.aspectRatio as VideoAspectRatio) : preset.aspectRatios[0];
  const duration = durations.includes(output?.duration ?? -1) ? output!.duration : durations[0];
  const selection = createVideoSelection(modelSelection, model, capability.id, preset.id, aspectRatio, duration);
  modelParmas.value = { modelSelection, model, capabilityId: capability.id, capability, output: selection.output, audio: selection.audio };
}

function handleModelChange(value: string) {
  const apply = () => {
    configureSelection(value);
    imageList.value = [];
    if (currentTrack.value) {
      currentTrack.value.prompt = "";
      currentTrack.value.promptRevisionId = null;
      applySelectionToTrack(currentTrack.value);
    }
  };
  if (modelParmas.value.modelSelection && modelParmas.value.modelSelection !== value && (imageList.value.length || currentTrack.value?.prompt)) {
    const dialog = DialogPlugin.confirm({ header: $t("workbench.generate.modeChange"), body: $t("workbench.generate.modeChangeConfirm"), onConfirm: () => { apply(); dialog.destroy(); }, onCancel: () => { revertModelSelection(); dialog.destroy(); } });
  } else apply();
}

function revertModelSelection() {
  modelParmas.value = { ...modelParmas.value };
}

function applySelectionToTrack(track: TrackItem) {
  const selection = selectedVideoConfiguration(track);
  track.vendorId = selection.vendorId;
  track.modelId = selection.modelId;
  track.capabilityId = selection.capabilityId;
  track.outputSelection = selection.output;
  track.audioSelection = selection.audio;
}

function handleSelectionChange(kind: "capability" | "output" | "audio") {
  const track = currentTrack.value;
  if (!track) return;
  if (kind === "capability") {
    track.prompt = "";
    track.promptRevisionId = null;
    lastSavedPrompt.delete(track.id);
  }
  applySelectionToTrack(track);
}

function selectedVideoConfiguration(track = currentTrack.value): VideoSelection {
  const isCurrentTrack = track?.id === currentTrack.value?.id;
  if (!isCurrentTrack && track?.vendorId && track.modelId && track.capabilityId) {
    const modelSelection = `${track.vendorId}:${track.modelId}`;
    const model = findCatalogModel(catalog.value, modelSelection).model;
    const capability = model.capabilities.find((item) => item.id === track.capabilityId);
    if (!capability) throw new Error(`${track.modelId} 不支持 ${track.capabilityId}`);
    const projectPresetId =
      project.value?.videoVendorId === track.vendorId &&
      project.value.videoModelId === track.modelId &&
      project.value.videoCapabilityId === track.capabilityId
        ? project.value.videoOutputPresetId
        : undefined;
    const preset =
      capability.outputPresets.find((item) => item.id === track.outputSelection?.presetId) ??
      capability.outputPresets.find((item) => item.id === projectPresetId) ??
      capability.outputPresets[0];
    if (!preset) throw new Error(`${track.capabilityId} 没有输出预设`);
    const durations = getPresetDurations(preset);
    const aspectRatio = preset.aspectRatios.includes(track.outputSelection?.aspectRatio as VideoAspectRatio)
      ? (track.outputSelection!.aspectRatio as VideoAspectRatio)
      : preset.aspectRatios.includes(project.value?.videoRatio as VideoAspectRatio)
        ? (project.value!.videoRatio as VideoAspectRatio)
        : preset.aspectRatios[0];
    const duration = durations.includes(track.duration)
      ? track.duration
      : durations.includes(track.outputSelection?.duration ?? -1)
        ? track.outputSelection!.duration
        : durations[0];
    const audioEnabled = track.audioSelection?.generation === "native" ? track.audioSelection.enabled : true;
    return createVideoSelection(modelSelection, model, track.capabilityId, preset.id, aspectRatio, duration, audioEnabled);
  }
  if (!modelParmas.value.model || !modelParmas.value.capability || !modelParmas.value.output) throw new Error("请先选择视频模型与 Capability");
  return createVideoSelection(modelParmas.value.modelSelection, modelParmas.value.model, modelParmas.value.capability.id, modelParmas.value.output.presetId, modelParmas.value.output.aspectRatio, track?.duration || modelParmas.value.output.duration, modelParmas.value.audio.generation === "native" && modelParmas.value.audio.enabled);
}

function sortByRole(items: UploadItem[]): UploadItem[] {
  const roles = modelParmas.value.capability?.inputs.map((item) => item.role) ?? [];
  return [...items].filter((item) => item.inputRole && roles.includes(item.inputRole)).sort((a, b) => roles.indexOf(a.inputRole!) - roles.indexOf(b.inputRole!));
}
const imageList = computed({
  get(): UploadItem[] { const track = currentTrack.value; if (!track) return []; const cached = project.value && getCache(project.value.id, episodesId.value, track.id); return sortByRole((cached?.length ? cached : (track.medias as UploadItem[])) ?? []); },
  set(value: UploadItem[]) { const track = currentTrack.value; if (!track || !project.value) return; track.medias = sortByRole(value) as TrackMedia[]; setCache(project.value.id, episodesId.value, track.id, track.medias); },
});
const references = computed(() => imageList.value.filter((item) => item.src).map((item) => ({ type: "image" as const, src: item.src ?? "" })));

function hydrateInputRoles(track: any): TrackItem {
  const serverInputs = track.actual?.inputRefs as VideoTrackInputReference[] | null | undefined;
  const inputs = serverInputs ?? [];
  const medias = serverInputs == null
    ? ([...(track.medias ?? [])] as UploadItem[])
    : (hydrateTrackMediaFromActualInputs(track.medias ?? [], serverInputs) as UploadItem[]);
  return { ...track, promptRevisionId: track.actual?.promptRevisionId ?? track.promptRevision?.id ?? null, vendorId: track.actual?.vendorId ?? null, modelId: track.actual?.modelId ?? null, capabilityId: track.actual?.capabilityId ?? null, outputSelection: track.actual?.outputSelection ?? null, audioSelection: track.actual?.audioSelection ?? null, inputReferences: inputs, medias };
}

async function getGenerateData() {
  if (!project.value) return;
  const { data } = await axios.post("/production/workbench/getGenerateData", { projectId: Number(project.value.id), scriptId: episodesId.value });
  const defaults = data.projectDefaults;
  if (defaults?.vendorId && defaults.modelId) {
    configureSelection(`${defaults.vendorId}:${defaults.modelId}`, defaults.capabilityId, {
      presetId: defaults.outputPresetId,
      aspectRatio: defaults.aspectRatio,
    });
  }
  storyboardList.value = data.storyboardList ?? [];
  const tracks = (data.trackList ?? []).map(hydrateInputRoles);
  initCacheFromTrackList(project.value.id, episodesId.value, tracks);
  for (const track of tracks) {
    const serverInputs = track.actual?.inputRefs;
    if (serverInputs !== null && serverInputs !== undefined) {
      setCache(project.value.id, episodesId.value, track.id, track.medias);
    }
  }
  await warmUpUrls(project.value.id, episodesId.value);
  for (const track of tracks) { const cached = getCache(project.value.id, episodesId.value, track.id); if (cached?.some((item) => item.inputRole)) track.medias = cached as TrackMedia[]; lastSavedPrompt.set(track.id, track.prompt ?? ""); }
  trackList.value = tracks;
  if (activeTrackIndex.value >= tracks.length) activeTrackIndex.value = Math.max(0, tracks.length - 1);
  syncTrackSelection();
}

function syncTrackSelection() {
  const track = currentTrack.value;
  const vendorId = track?.vendorId || project.value?.videoVendorId;
  const modelId = track?.modelId || project.value?.videoModelId;
  if (!vendorId || !modelId) return;
  configureSelection(`${vendorId}:${modelId}`, track?.capabilityId || project.value?.videoCapabilityId, track?.outputSelection ?? undefined);
  if (track?.audioSelection) modelParmas.value.audio = track.audioSelection;
  if (track && modelParmas.value.output) { const preset = modelParmas.value.capability!.outputPresets.find((p) => p.id === modelParmas.value.output!.presetId)!; if (getPresetDurations(preset).includes(track.duration)) modelParmas.value.output.duration = track.duration; }
}

function promptSubject(track: TrackItem): string { return track.prompt?.trim() || (track.medias as UploadItem[]).map((item) => item.prompt || item.name).filter(Boolean).join("；") || `分镜轨道 ${track.id} 的主体动作与场景`; }
async function handlePromptBlur() {
  const track = currentTrack.value;
  if (!track?.promptRevisionId || !track.prompt.trim() || lastSavedPrompt.get(track.id) === track.prompt) return;
  try { const { data } = await axios.post("/production/workbench/updateVideoPrompt", { projectId: Number(project.value!.id), trackId: track.id, requestedBy: "user", renderedPrompt: track.prompt }); track.promptRevisionId = data.promptRevisionId; lastSavedPrompt.set(track.id, data.renderedPrompt); }
  catch (error) { window.$message.error((error as Error)?.message ?? "保存提示词失败"); }
}

function applyPromptRevision(track: TrackItem, revision: PromptRevisionResponse) {
  const selection = selectedVideoConfiguration(track);
  track.prompt = revision.renderedPrompt; track.promptRevisionId = revision.promptRevisionId; track.vendorId = selection.vendorId; track.modelId = selection.modelId; track.capabilityId = selection.capabilityId; track.state = "已完成"; lastSavedPrompt.set(track.id, revision.renderedPrompt);
}
async function genText() {
  const track = currentTrack.value; if (!track || track.state === "生成中") return;
  try { track.state = "生成中"; const request = buildPromptRequest({ projectId: Number(project.value!.id), trackId: track.id, selection: selectedVideoConfiguration(track), medias: imageList.value, subject: promptSubject(track) }); const { data } = await axios.post("/production/workbench/generateVideoPrompt", request); applyPromptRevision(track, data); }
  catch (error) { track.state = "生成失败"; window.$message.error((error as Error)?.message ?? "提示词生成失败"); }
}
async function batchGenText(trackIds: number[]) {
  const tracks = trackList.value.filter((track) => trackIds.includes(track.id)); if (!tracks.length) return;
  try { tracks.forEach((track) => (track.state = "生成中")); const items = tracks.map((track) => buildPromptRequest({ projectId: Number(project.value!.id), trackId: track.id, selection: selectedVideoConfiguration(track), medias: track.medias, subject: promptSubject(track) })); await axios.post("/production/workbench/batchGeneratePrompt", { items, concurrentCount: otherSetting.value.assetsBatchGenereateSize }); await getGenerateData(); }
  catch (error) { tracks.forEach((track) => (track.state = "生成失败")); window.$message.error((error as Error)?.message ?? "批量生成提示词失败"); }
}

function generationItem(track: TrackItem) {
  if (!track.promptRevisionId) throw new Error(`轨道 ${track.id} 尚无 Prompt Revision`);
  const selection = selectedVideoConfiguration(track);
  const model = findCatalogModel(catalog.value, `${selection.vendorId}:${selection.modelId}`).model;
  const capability = model.capabilities.find((item) => item.id === selection.capabilityId);
  if (!capability) throw new Error(`${selection.modelId} 不支持 ${selection.capabilityId}`);
  return buildGenerationItem({
    trackId: track.id,
    promptRevisionId: track.promptRevisionId,
    selection,
    medias: track.medias,
    capability,
  });
}
function attachStartedTasks(response: unknown) { for (const task of normalizeStartedTasks(response)) { const track = trackList.value.find((item) => item.id === task.trackId); if (track) track.videoList.push({ id: task.videoId, state: "生成中", src: "", artifactRevisionId: task.artifactRevisionId }); } }
async function startGeneration(items: ReturnType<typeof generationItem>[], batch: boolean) { const endpoint = batch ? "/production/workbench/batchGenerateVideo" : "/production/workbench/generateVideo"; const payload = { projectId: Number(project.value!.id), scriptId: episodesId.value, requestedBy: "user", ...(batch ? { items } : { item: items[0] }) }; const { data } = await axios.post(endpoint, payload); attachStartedTasks(data); window.$message.success($t("workbench.generate.generateStarted")); }
function generateVideo() { const dialog = DialogPlugin.confirm({ header: $t("workbench.generate.generateConfirm"), body: $t("workbench.generate.generateConfirmBody"), onConfirm: async () => { dialog.destroy(); try { await startGeneration([generationItem(currentTrack.value)], false); } catch (error) { window.$message.error((error as Error)?.message ?? "视频发起生成请求失败"); } }, onCancel: () => dialog.destroy() }); }
async function batchGenVideo(trackIds: number[]) { try { await startGeneration(trackList.value.filter((track) => trackIds.includes(track.id)).map(generationItem), true); } catch (error) { window.$message.error((error as Error)?.message ?? "批量生成视频失败"); } }
function trackChange(previousIndex?: number) { const previous = previousIndex == null ? undefined : trackList.value[previousIndex]; if (previous && project.value) setCache(project.value.id, episodesId.value, previous.id, previous.medias); syncTrackSelection(); }

const pendingVideoIds = computed(() => trackList.value.flatMap((track) => track.videoList.filter((video) => video.state === "生成中").map((video) => video.id)));
let pollTimer: ReturnType<typeof setInterval> | null = null;
async function pollVideos() { if (!pendingVideoIds.value.length || !project.value) return; const { data } = await axios.post("/production/workbench/checkVideoStateList", { projectId: Number(project.value.id), scriptId: episodesId.value, videoIds: pendingVideoIds.value }); for (const update of data ?? []) for (const track of trackList.value) { const video = track.videoList.find((item) => item.id === update.id); if (video) Object.assign(video, { ...update, state: update.state === "生成成功" ? "已完成" : update.state }); } }
watch(pendingVideoIds, (ids) => { if (ids.length && !pollTimer) pollTimer = setInterval(pollVideos, 3000); if (!ids.length && pollTimer) { clearInterval(pollTimer); pollTimer = null; } }, { immediate: true });
onMounted(async () => { try { catalog.value = await getVideoCapabilityCatalog(); if (project.value?.videoVendorId && project.value.videoModelId) configureSelection(`${project.value.videoVendorId}:${project.value.videoModelId}`, project.value.videoCapabilityId); await getGenerateData(); } catch (error) { window.$message.error((error as Error)?.message ?? "加载视频工作台失败"); } });
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<style lang="scss" scoped>
.index { height: calc(100vh - 120px); gap: 16px; overflow-y: auto; }
.generate { flex: 1; min-height: 0; width: 100%; gap: 8px; }
.prompt, .video { width: 50%; height: 100%; min-height: 0; }
.track { min-height: 210px; }
</style>
