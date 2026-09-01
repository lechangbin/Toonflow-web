import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGenerationItem,
  buildPromptRequest,
  buildSemanticInputReferences,
  buildUpdatePromptRequest,
  createVideoSelection,
  getDefaultCapabilityInputs,
  getPresetDurations,
  hydrateTrackMediaFromActualInputs,
  hydrateVideoWorkbenchTrackProjection,
  findCatalogModel,
  normalizeStartedTasks,
  type TrackMediaContract,
  type VideoModelContract,
} from "../src/videoContract.ts";

const agnes: VideoModelContract = {
  name: "Agnes Video V2.0",
  modelName: "agnes-video-v2.0",
  type: "video",
  capabilities: [
    {
      id: "keyframe-to-video",
      promptProfileId: "agnes/keyframe-to-video-v1",
      inputs: [
        { role: "first-frame", mediaType: "image", required: true },
        { role: "intermediate-keyframe", mediaType: "image", required: false },
        { role: "last-frame", mediaType: "image", required: true },
      ],
      audio: { generation: "native", policy: "always" },
      outputPresets: [
        {
          id: "720p",
          resolution: "720p",
          durations: { kind: "values", values: [5, 10] },
          aspectRatios: ["16:9", "9:16"],
        },
      ],
      transitions: { kind: "adjacent-keyframes" },
    },
  ],
};

const frames: TrackMediaContract[] = [
  { id: 11, sources: "storyboard", fileType: "image", inputRole: "first-frame", prompt: "人物站定" },
  { id: 12, sources: "assets", fileType: "image", inputRole: "intermediate-keyframe", prompt: "人物转身" },
  { id: 13, sources: "storyboard", fileType: "image", inputRole: "last-frame", prompt: "人物走远" },
];

test("Project selection derives a valid preset and locks Agnes native audio on", () => {
  const selection = createVideoSelection("agnes:agnes-video-v2.0", agnes, "keyframe-to-video", "720p", "16:9", 10);

  assert.deepEqual(selection, {
    vendorId: "agnes",
    modelId: "agnes-video-v2.0",
    capabilityId: "keyframe-to-video",
    output: { presetId: "720p", duration: 10, resolution: "720p", aspectRatio: "16:9" },
    audio: { generation: "native", enabled: true },
  });
  assert.deepEqual(getPresetDurations(agnes.capabilities[0].outputPresets[0]), [5, 10]);
});

test("Capability Catalog resolves an enabled vendor:model without exposing configuration", () => {
  const resolved = findCatalogModel(
    [{ id: "agnes", name: "Agnes", models: [{ name: agnes.name, modelId: agnes.modelName, capabilities: agnes.capabilities }] }],
    "agnes:agnes-video-v2.0",
  );
  assert.equal(resolved.vendorId, "agnes");
  assert.deepEqual(resolved.model, agnes);
});

test("semantic input references preserve explicit first, intermediate, and last roles", () => {
  assert.deepEqual(buildSemanticInputReferences(agnes.capabilities[0], frames), [
    { role: "first-frame", source: "storyboard", sourceId: 11 },
    { role: "intermediate-keyframe", source: "asset", sourceId: 12 },
    { role: "last-frame", source: "storyboard", sourceId: 13 },
  ]);
  assert.deepEqual(buildSemanticInputReferences(agnes.capabilities[0], [frames[0], frames[2]]), [
    { role: "first-frame", source: "storyboard", sourceId: 11 },
    { role: "last-frame", source: "storyboard", sourceId: 13 },
  ]);
});

test("uploaded-media refresh restores displayUrl but generation sends only filePath", () => {
  const input = {
    role: "first-frame" as const,
    source: "uploaded-media" as const,
    filePath: "/1/video-inputs/2/first.png",
    displayUrl: "https://media.example/first.png?signature=fresh",
  };
  const hydrated = hydrateTrackMediaFromActualInputs([], [input]);

  assert.deepEqual(hydrated, [
    {
      id: null,
      fileType: "image",
      sources: "uploaded-media",
      filePath: input.filePath,
      src: input.displayUrl,
      inputRole: "first-frame",
    },
  ]);

  const reference = buildSemanticInputReferences(
    {
      ...agnes.capabilities[0],
      inputs: [{ role: "first-frame", mediaType: "image", required: true }],
    },
    hydrated,
  )[0];
  assert.deepEqual(reference, {
    role: "first-frame",
    source: "uploaded-media",
    filePath: input.filePath,
  });
  assert.equal("displayUrl" in reference, false);
});

test("prompt and generation requests use Prompt Revision and never send legacy mode or prompt fields", () => {
  const selection = createVideoSelection("agnes:agnes-video-v2.0", agnes, "keyframe-to-video", "720p", "16:9", 5);
  const promptRequest = buildPromptRequest({
    projectId: 1,
    trackId: 2,
    selection,
    medias: frames,
    subject: "人物从站定自然过渡到走远",
  });
  const generationItem = buildGenerationItem({ trackId: 2, promptRevisionId: 99, selection, medias: frames });

  assert.equal(promptRequest.vendorId, "agnes");
  assert.equal(promptRequest.strategy, "standard-with-guidance");
  assert.deepEqual(promptRequest.inputs, buildSemanticInputReferences(agnes.capabilities[0], frames));
  assert.deepEqual(promptRequest.output, selection.output);
  assert.deepEqual(promptRequest.audio, { generation: "native", enabled: true });
  assert.deepEqual(
    promptRequest.brief.references.map((reference) => reference.role),
    ["first-frame", "intermediate-keyframe", "last-frame"],
  );
  assert.equal("mode" in promptRequest, false);
  assert.equal("prompt" in generationItem, false);
  assert.equal(generationItem.promptRevisionId, 99);
  assert.deepEqual(generationItem.inputs, buildSemanticInputReferences(agnes.capabilities[0], frames));
});

test("custom Prompt Revision edits persist the same Track-owned selection as generated revisions", () => {
  const selection = createVideoSelection("agnes:agnes-video-v2.0", agnes, "keyframe-to-video", "720p", "9:16", 10);
  const request = buildUpdatePromptRequest({
    projectId: 1,
    trackId: 2,
    selection,
    medias: frames,
    renderedPrompt: "  从第一帧经中间关键帧自然过渡到尾帧  ",
  });

  assert.deepEqual(request, {
    projectId: 1,
    trackId: 2,
    vendorId: "agnes",
    modelId: "agnes-video-v2.0",
    capabilityId: "keyframe-to-video",
    requestedBy: "user",
    renderedPrompt: "从第一帧经中间关键帧自然过渡到尾帧",
    inputs: buildSemanticInputReferences(agnes.capabilities[0], frames),
    output: selection.output,
    audio: { generation: "native", enabled: true },
  });
});

test("refresh restores the authoritative Track selection and selected output without Project defaults", () => {
  const actual = {
    vendorId: "agnes",
    modelId: "agnes-video-v2.0",
    capabilityId: "keyframe-to-video" as const,
    inputRefs: [
      { role: "first-frame" as const, source: "storyboard" as const, sourceId: 11 },
      { role: "last-frame" as const, source: "uploaded-media" as const, filePath: "/1/last.png", displayUrl: "https://media/last" },
    ],
    outputSelection: { presetId: "720p", duration: 10, resolution: "720p", aspectRatio: "9:16" as const },
    audioSelection: { generation: "native" as const, enabled: true },
    promptRevisionId: 41,
  };
  const hydrated = hydrateVideoWorkbenchTrackProjection({
    id: 2,
    duration: 5,
    prompt: "current prompt",
    promptRevision: {
      id: 40,
      profileId: "agnes/keyframe-to-video-v1",
      strategy: "standard-with-guidance",
      brief: null,
      draft: null,
      renderedPrompt: "stale prompt",
      status: "active",
      createdAt: 1,
    },
    state: "已完成",
    reason: "",
    selectVideoId: 72,
    selectedArtifact: { id: 81, revision: 1, status: "accepted", videoId: 72, generationTaskId: 61, createdAt: 2 },
    currentArtifact: { id: 82, revision: 2, status: "generated", videoId: 73, generationTaskId: 62, createdAt: 3 },
    actual,
    videoList: [],
    medias: frames,
  });

  assert.equal(hydrated.promptRevisionId, 41);
  assert.equal(hydrated.vendorId, "agnes");
  assert.equal(hydrated.modelId, "agnes-video-v2.0");
  assert.equal(hydrated.capabilityId, "keyframe-to-video");
  assert.deepEqual(hydrated.outputSelection, actual.outputSelection);
  assert.deepEqual(hydrated.audioSelection, actual.audioSelection);
  assert.equal(hydrated.selectVideoId, 72);
  assert.deepEqual(
    hydrated.medias.map((media) => [media.inputRole, media.filePath ?? media.id]),
    [
      ["first-frame", 11],
      [undefined, 12],
      [undefined, 13],
      ["last-frame", "/1/last.png"],
    ],
  );
});

test("uploaded inputs fail early when only a display URL is available", () => {
  assert.throws(
    () =>
      buildSemanticInputReferences({ ...agnes.capabilities[0], inputs: [{ role: "first-frame", mediaType: "image", required: true }] }, [
        { id: null, sources: "uploaded-media", fileType: "image", inputRole: "first-frame", src: "https://display-only" },
      ]),
    /上传文件路径/,
  );
});

test("single and batch generation responses normalize to the same task list", () => {
  const task = { trackId: 2, videoId: 3, generationTaskId: 4, artifactRevisionId: 5 };
  assert.deepEqual(normalizeStartedTasks({ actionId: 1, ...task }), [task]);
  assert.deepEqual(normalizeStartedTasks({ actionId: 1, tasks: [task] }), [task]);
});

test("missing required semantic roles fail before an HTTP request", () => {
  assert.throws(() => buildSemanticInputReferences(agnes.capabilities[0], [frames[0]]), /last-frame/);
});

test("default capability inputs come from one shared contract for prompt and generation", () => {
  assert.deepEqual(getDefaultCapabilityInputs("text-to-video"), []);
  assert.deepEqual(getDefaultCapabilityInputs("image-to-video"), [{ role: "source-image", mediaType: "image", required: true }]);
  assert.deepEqual(getDefaultCapabilityInputs("first-last-frame"), [
    { role: "first-frame", mediaType: "image", required: true },
    { role: "last-frame", mediaType: "image", required: true },
  ]);
  assert.deepEqual(getDefaultCapabilityInputs("keyframe-to-video"), [
    { role: "first-frame", mediaType: "image", required: true },
    { role: "intermediate-keyframe", mediaType: "image", required: false },
    { role: "last-frame", mediaType: "image", required: true },
  ]);

  const selection = {
    vendorId: "agnes",
    modelId: "agnes-video-v2.0",
    capabilityId: "image-to-video" as const,
    output: { presetId: "720p", duration: 5, resolution: "720p", aspectRatio: "16:9" as const },
    audio: { generation: "none" as const },
  };
  const sourceImage: TrackMediaContract = { id: 21, sources: "assets", fileType: "image", inputRole: "source-image" };
  const promptRequest = buildPromptRequest({ projectId: 1, trackId: 2, selection, medias: [sourceImage], subject: "主体运动" });
  const generationItem = buildGenerationItem({ trackId: 2, promptRevisionId: 9, selection, medias: [sourceImage] });

  assert.deepEqual(
    promptRequest.brief.references.map((reference) => reference.role),
    ["source-image"],
  );
  assert.deepEqual(generationItem.inputs, [{ role: "source-image", source: "asset", sourceId: 21 }]);
});
