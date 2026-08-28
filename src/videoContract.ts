export type VideoCapabilityId = "text-to-video" | "image-to-video" | "first-last-frame" | "keyframe-to-video";
export type VideoInputRole = "source-image" | "first-frame" | "intermediate-keyframe" | "last-frame";
export type VideoAspectRatio = "16:9" | "9:16";
export type PromptStrategy = "standard" | "standard-with-guidance";

export interface VideoInputContract {
  role: VideoInputRole;
  mediaType: "image";
  required: boolean;
}

export type VideoAudioContract =
  | { generation: "none"; policy: "none" }
  | { generation: "native"; policy: "always" | "optional" };

export type VideoDurationContract =
  | { kind: "values"; values: number[] }
  | { kind: "integer-range"; min: number; max: number; step: number };

export interface VideoOutputPreset {
  id: string;
  resolution: string;
  durations: VideoDurationContract;
  aspectRatios: VideoAspectRatio[];
}

export interface VideoCapabilityContract {
  id: VideoCapabilityId;
  promptProfileId: string;
  inputs: VideoInputContract[];
  audio: VideoAudioContract;
  outputPresets: VideoOutputPreset[];
  transitions?: { kind: "adjacent-keyframes" };
}

export interface VideoModelContract {
  name: string;
  modelName: string;
  type: "video";
  associationSkills?: string;
  capabilities: VideoCapabilityContract[];
}

export interface VideoCapabilityCatalogVendor {
  id: string;
  name: string;
  models: Array<{
    name: string;
    modelId: string;
    capabilities: VideoCapabilityContract[];
  }>;
}

export interface VideoOutputSelection {
  presetId: string;
  duration: number;
  resolution: string;
  aspectRatio: VideoAspectRatio;
}

export type VideoAudioSelection =
  | { generation: "none" }
  | { generation: "native"; enabled: boolean };

export interface VideoSelection {
  vendorId: string;
  modelId: string;
  capabilityId: VideoCapabilityId;
  output: VideoOutputSelection;
  audio: VideoAudioSelection;
}

export interface TrackMediaContract {
  id?: number | null;
  filePath?: string;
  src?: string;
  sources?: "storyboard" | "assets" | "uploaded-media" | string;
  fileType: "image" | "video" | "audio";
  inputRole?: VideoInputRole;
  prompt?: string;
  name?: string;
  index?: number;
}

export interface VideoTrackInputReference {
  role: VideoInputRole;
  source: "storyboard" | "asset" | "uploaded-media";
  sourceId?: number;
  filePath?: string;
  displayUrl?: string;
}

export interface VideoPromptReference {
  role: VideoInputRole;
  intent: string;
  preserve: string[];
  exclude: string[];
}

export interface VideoPromptBrief {
  subject: string;
  motion?: string;
  scene?: string;
  camera?: string;
  lighting?: string;
  style?: string;
  continuity?: string;
  transition?: string;
  audio?: string;
  constraints: string[];
  references: VideoPromptReference[];
}

export interface GenerateVideoPromptRequest {
  trackId: number;
  projectId: number;
  vendorId: string;
  modelId: string;
  capabilityId: VideoCapabilityId;
  requestedBy: "user" | "project-agent";
  strategy: PromptStrategy;
  brief: VideoPromptBrief;
}

export interface VideoGenerationItem {
  trackId: number;
  vendorId: string;
  modelId: string;
  capabilityId: VideoCapabilityId;
  inputs: VideoTrackInputReference[];
  output: VideoOutputSelection;
  audio: VideoAudioSelection;
  promptRevisionId: number;
}

export interface StartedVideoTask {
  trackId: number;
  videoId: number;
  generationTaskId: number;
  artifactRevisionId: number;
}

export interface PromptRevisionResponse {
  actionId: number;
  promptRevisionId: number;
  profileId: string;
  strategy: PromptStrategy | "custom";
  renderedPrompt: string;
}

export function splitVideoModelSelection(modelSelection: string): { vendorId: string; modelId: string } {
  const separator = modelSelection.indexOf(":");
  if (separator <= 0 || separator === modelSelection.length - 1) {
    throw new Error("视频模型选择必须使用 vendor:model 格式");
  }
  return {
    vendorId: modelSelection.slice(0, separator),
    modelId: modelSelection.slice(separator + 1),
  };
}

export function findCatalogModel(
  catalog: VideoCapabilityCatalogVendor[],
  modelSelection: string,
): { vendorId: string; vendorName: string; model: VideoModelContract } {
  const { vendorId, modelId } = splitVideoModelSelection(modelSelection);
  const vendor = catalog.find((item) => item.id === vendorId);
  const model = vendor?.models.find((item) => item.modelId === modelId);
  if (!vendor || !model) throw new Error(`Capability Catalog 中不存在 ${modelSelection}`);
  return {
    vendorId,
    vendorName: vendor.name,
    model: {
      name: model.name,
      modelName: model.modelId,
      type: "video",
      capabilities: model.capabilities,
    },
  };
}

export function getPresetDurations(preset: VideoOutputPreset): number[] {
  if (preset.durations.kind === "values") return [...preset.durations.values];
  const values: number[] = [];
  for (let value = preset.durations.min; value <= preset.durations.max; value += preset.durations.step) {
    values.push(value);
  }
  return values;
}

export function getCapability(model: VideoModelContract, capabilityId: VideoCapabilityId): VideoCapabilityContract {
  const capability = model.capabilities.find((item) => item.id === capabilityId);
  if (!capability) throw new Error(`${model.modelName} 不支持 ${capabilityId}`);
  return capability;
}

export function getDefaultCapabilityInputs(capabilityId: VideoCapabilityId): VideoInputContract[] {
  switch (capabilityId) {
    case "text-to-video":
      return [];
    case "image-to-video":
      return [{ role: "source-image", mediaType: "image", required: true }];
    case "first-last-frame":
      return [
        { role: "first-frame", mediaType: "image", required: true },
        { role: "last-frame", mediaType: "image", required: true },
      ];
    case "keyframe-to-video":
      return [
        { role: "first-frame", mediaType: "image", required: true },
        { role: "intermediate-keyframe", mediaType: "image", required: false },
        { role: "last-frame", mediaType: "image", required: true },
      ];
  }
}

export function createRuntimeCapability(capabilityId: VideoCapabilityId): VideoCapabilityContract {
  return {
    id: capabilityId,
    promptProfileId: "runtime",
    inputs: getDefaultCapabilityInputs(capabilityId),
    audio: { generation: "none", policy: "none" },
    outputPresets: [],
  };
}

export function createAudioSelection(contract: VideoAudioContract, requested = true): VideoAudioSelection {
  if (contract.generation === "none") return { generation: "none" };
  return { generation: "native", enabled: contract.policy === "always" ? true : requested };
}

export function createVideoSelection(
  modelSelection: string,
  model: VideoModelContract,
  capabilityId: VideoCapabilityId,
  presetId: string,
  aspectRatio: VideoAspectRatio,
  duration?: number,
  audioEnabled = true,
): VideoSelection {
  const { vendorId, modelId } = splitVideoModelSelection(modelSelection);
  if (modelId !== model.modelName) throw new Error(`模型 ${modelId} 与 ${model.modelName} 不一致`);
  const capability = getCapability(model, capabilityId);
  const preset = capability.outputPresets.find((item) => item.id === presetId);
  if (!preset) throw new Error(`${capabilityId} 不支持输出预设 ${presetId}`);
  if (!preset.aspectRatios.includes(aspectRatio)) throw new Error(`${presetId} 不支持画幅 ${aspectRatio}`);
  const durations = getPresetDurations(preset);
  const selectedDuration = duration ?? durations[0];
  if (!durations.includes(selectedDuration)) throw new Error(`${presetId} 不支持 ${selectedDuration}s`);
  return {
    vendorId,
    modelId,
    capabilityId,
    output: { presetId, duration: selectedDuration, resolution: preset.resolution, aspectRatio },
    audio: createAudioSelection(capability.audio, audioEnabled),
  };
}

function toTrackReference(media: TrackMediaContract): VideoTrackInputReference {
  if (!media.inputRole) throw new Error("视频输入缺少语义角色");
  if (media.sources === "storyboard") {
    if (!media.id) throw new Error(`${media.inputRole} 缺少 Storyboard ID`);
    return { role: media.inputRole, source: "storyboard", sourceId: media.id };
  }
  if (media.sources === "assets" || media.sources === "asset") {
    if (!media.id) throw new Error(`${media.inputRole} 缺少 Asset ID`);
    return { role: media.inputRole, source: "asset", sourceId: media.id };
  }
  const filePath = media.filePath || media.src;
  if (!filePath) throw new Error(`${media.inputRole} 缺少上传文件路径`);
  return { role: media.inputRole, source: "uploaded-media", filePath };
}

export function buildSemanticInputReferences(
  capability: VideoCapabilityContract,
  medias: TrackMediaContract[],
): VideoTrackInputReference[] {
  const declared = new Map(capability.inputs.map((input) => [input.role, input]));
  const references = medias.filter((media) => media.inputRole).map(toTrackReference);
  const seen = new Set<VideoInputRole>();
  for (const reference of references) {
    if (!declared.has(reference.role)) throw new Error(`${capability.id} 不接受输入角色 ${reference.role}`);
    if (seen.has(reference.role)) throw new Error(`输入角色 ${reference.role} 只能出现一次`);
    seen.add(reference.role);
  }
  for (const input of capability.inputs) {
    if (input.required && !seen.has(input.role)) throw new Error(`${capability.id} 缺少必需输入角色 ${input.role}`);
  }
  return capability.inputs.flatMap((input) => references.filter((reference) => reference.role === input.role));
}

export function hydrateTrackMediaFromActualInputs(
  medias: TrackMediaContract[],
  inputs: VideoTrackInputReference[],
): TrackMediaContract[] {
  const hydrated = medias.map((media) => {
    const { inputRole: _staleRole, ...rest } = media;
    return rest as TrackMediaContract;
  });

  for (const input of inputs) {
    const existing = hydrated.find((media) => {
      if (input.source === "uploaded-media") return media.sources === "uploaded-media" && media.filePath === input.filePath;
      if (input.source === "asset") return media.sources === "assets" && media.id === input.sourceId;
      return media.sources === "storyboard" && media.id === input.sourceId;
    });
    if (existing) {
      existing.inputRole = input.role;
    } else if (input.source === "uploaded-media" && input.filePath) {
      hydrated.push({
        id: null,
        fileType: "image",
        sources: "uploaded-media",
        filePath: input.filePath,
        src: input.displayUrl ?? "",
        inputRole: input.role,
      });
    }
  }

  return hydrated;
}

export function buildPromptRequest(input: {
  projectId: number;
  trackId: number;
  selection: VideoSelection;
  medias: TrackMediaContract[];
  subject: string;
  strategy?: PromptStrategy;
}): GenerateVideoPromptRequest {
  const subject = input.subject.trim();
  if (!subject) throw new Error("Prompt Brief subject 不能为空");
  if (input.selection.capabilityId !== "text-to-video") {
    buildSemanticInputReferences(createRuntimeCapability(input.selection.capabilityId), input.medias);
  }
  const references = input.medias
    .filter((media): media is TrackMediaContract & { inputRole: VideoInputRole } => !!media.inputRole)
    .map((media) => ({
      role: media.inputRole,
      intent: media.prompt?.trim() || media.name?.trim() || subject,
      preserve: [],
      exclude: [],
    }));
  return {
    trackId: input.trackId,
    projectId: input.projectId,
    vendorId: input.selection.vendorId,
    modelId: input.selection.modelId,
    capabilityId: input.selection.capabilityId,
    requestedBy: "user",
    strategy: input.strategy ?? "standard-with-guidance",
    brief: {
      subject,
      ...(input.selection.capabilityId === "image-to-video" ? { motion: "描述主体应发生的运动，并保持关键主体元素稳定" } : {}),
      ...(input.selection.capabilityId === "first-last-frame" || input.selection.capabilityId === "keyframe-to-video"
        ? { transition: "在相邻关键帧之间自然、连续地推进时间和动作" }
        : {}),
      ...(input.selection.audio.generation === "native" && input.selection.audio.enabled
        ? { audio: "生成与画面动作和环境一致的原生音频，不编造未要求的对白或音乐" }
        : {}),
      constraints: [],
      references,
    },
  };
}

export function buildGenerationItem(input: {
  trackId: number;
  promptRevisionId: number;
  selection: VideoSelection;
  medias: TrackMediaContract[];
  capability?: VideoCapabilityContract;
}): VideoGenerationItem {
  const capability = input.capability ?? createRuntimeCapability(input.selection.capabilityId);
  return {
    trackId: input.trackId,
    vendorId: input.selection.vendorId,
    modelId: input.selection.modelId,
    capabilityId: input.selection.capabilityId,
    inputs: buildSemanticInputReferences(capability, input.medias),
    output: input.selection.output,
    audio: input.selection.audio,
    promptRevisionId: input.promptRevisionId,
  };
}

export function normalizeStartedTasks(response: unknown): StartedVideoTask[] {
  if (!response || typeof response !== "object") throw new Error("视频生成响应为空");
  const value = response as Record<string, unknown>;
  const tasks = Array.isArray(value.tasks) ? value.tasks : [value];
  return tasks.map((task) => {
    const item = task as Record<string, unknown>;
    for (const key of ["trackId", "videoId", "generationTaskId", "artifactRevisionId"] as const) {
      if (!Number.isInteger(item[key]) || Number(item[key]) <= 0) throw new Error(`视频生成响应缺少 ${key}`);
    }
    return {
      trackId: Number(item.trackId),
      videoId: Number(item.videoId),
      generationTaskId: Number(item.generationTaskId),
      artifactRevisionId: Number(item.artifactRevisionId),
    };
  });
}
