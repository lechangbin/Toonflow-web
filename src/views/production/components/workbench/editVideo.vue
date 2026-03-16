<template>
  <div class="editVideo">
    <div class="toolbar">
      <t-button @click="addVideo">+ video</t-button>
      <t-button @click="addAudio">+ audio</t-button>
      <t-button @click="addImage">+ image</t-button>
      <t-button @click="addText">+ text</t-button>
      <t-button @click="togglePlay">{{ playing ? "Pause" : "Play" }}</t-button>
      <t-button @click="scale++">缩放-</t-button>
      <t-button @click="scale = scale - 1 > 1 ? scale - 1 : 1">缩放+</t-button>
      <t-button class="action-btn" :disabled="activeAction == null" @click="deleteAction">删除</t-button>
      <t-button class="action-btn" :disabled="activeAction == null" @click="splitAction">分割</t-button>
      <t-button class="action-btn" @click="exportVideo">导出视频</t-button>
      <t-switch v-model="autoScroll">autoScroll</t-switch>
      <t-switch v-model="gridSnap">gridSnap</t-switch>
      <t-switch v-model="dragLine">dragLine</t-switch>
      <t-switch v-model="disableDrag">disableDrag</t-switch>
    </div>

    <div ref="cvsWrapEl" class="canvasContainer"></div>
    <ReactTimeline
      ref="timelineRef"
      :style="{ width: '100%', height: '200px' }"
      :scale="scale"
      :editorData="tlData"
      :scaleSplitCount="5"
      :onClickTimeArea="onPreviewTime"
      :onClickAction="clickAction"
      :onCursorDragEnd="onPreviewTime"
      :onActionResizing="onActionResizing"
      :onActionMoveEnd="onActionMoveEnd"
      :getActionRender="getActionRender"
      :getScaleRender="customScale"
      :autoScroll="autoScroll"
      :gridSnap="gridSnap"
      :dragLine="dragLine"
      :disableDrag="disableDrag"
      enableRowDrag />
  </div>
</template>

<script setup lang="ts">
import React from "react";
import { useFileDialog, useFileSystemAccess } from "@vueuse/core";
import { applyPureReactInVue } from "veaury";
import { AVCanvas } from "@webav/av-canvas";
import { AudioClip, ImgClip, MP4Clip, VisibleSprite, renderTxt2ImgBitmap } from "@webav/av-cliper";
import { Timeline } from "@xzdarcy/react-timeline-editor";
import type { TimelineRow, TimelineAction } from "@xzdarcy/timeline-engine";
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";

const ReactTimeline = applyPureReactInVue(Timeline);

type TLActionWithName = TimelineAction & { name: string };

//时间轴效果
const autoScroll = ref(true); //拖拽时是否启动自动滚动
const gridSnap = ref(false); //是否启动网格移动吸附
const dragLine = ref(true); //启动拖拽辅助线吸附
const disableDrag = ref(false); //禁止拖拽动作块

//  基础状态
const scale = ref(10);
const cvsWrapEl = ref<HTMLDivElement | null>(null);
const avCvs = shallowRef<AVCanvas | null>(null);
const timelineRef = ref<InstanceType<typeof ReactTimeline> | null>(null);
const activeAction = ref<TLActionWithName | null>(null);
const playing = ref(false);

const tlData = ref<TimelineRow[]>([
  { id: "1-video", actions: [] },
  { id: "2-audio", actions: [] },
  { id: "3-img", actions: [] },
  { id: "4-text", actions: [] },
]);

const actionSpriteMap = new Map<string, VisibleSprite>();

//刻度线
function customScale(scale: number) {
  const min = parseInt(scale / 60 + "");
  const second = ((scale % 60) + "").padStart(2, "0");
  return React.createElement("div", null, `${min}:${second}`);
}
//  文件选择
const { open: openFileDialog, onChange: onFileSelected } = useFileDialog({ reset: true });

function pickSingleFile(accept: string): Promise<File> {
  return new Promise((resolve, reject) => {
    openFileDialog({ accept, multiple: false });
    const { off } = onFileSelected((files) => {
      off();
      if (files && files.length) resolve(files[0]);
      else reject(new Error("未选择文件"));
    });
  });
}

//  添加资源核心函数
async function addAsset(trackId: string, label: string, createSprite: () => Promise<VisibleSprite>) {
  const cvs = avCvs.value;
  if (!cvs) return;

  // 1) 创建 sprite
  const spr = await createSprite();

  // 2) 计算开始时间（默认放到该轨道末尾），并兜底 duration
  const track = tlData.value.find((row) => row.id === trackId);
  if (!track) return;

  if (!Number.isFinite(spr.time.offset) || spr.time.offset === 0) {
    const endSec = track.actions.length ? Math.max(...track.actions.map((a) => a.end)) : 0;
    spr.time.offset = endSec * 1e6;
  }
  if (!Number.isFinite(spr.time.duration) || spr.time.duration <= 0) spr.time.duration = 10e6;

  // 3) 加入画布
  await cvs.addSprite(spr);

  // 4) 写入 timeline action
  const startSec = spr.time.offset / 1e6;
  const endSec = (spr.time.offset + spr.time.duration) / 1e6;

  const action: TimelineAction & { name: string } = {
    id: Math.random().toString(16).slice(2),
    start: startSec,
    end: endSec,
    effectId: "",
    name: label,
  };

  actionSpriteMap.set(action.id, spr);
  track.actions.push(action);

  // 5) 触发响应式更新
  tlData.value = [...tlData.value];
}

//  添加资源
function addVideo() {
  return addAsset("1-video", "video", async () => {
    const file = await pickSingleFile("video/mp4,video/quicktime");
    return new VisibleSprite(new MP4Clip(file.stream()));
  });
}

function addAudio() {
  return addAsset("2-audio", "audio", async () => {
    const file = await pickSingleFile("audio/*");
    return new VisibleSprite(new AudioClip(file.stream()));
  });
}

function addImage() {
  return addAsset("3-img", "image", async () => {
    const file = await pickSingleFile("image/*");
    const stream = file.stream();
    const clip = /\.gif$/i.test(file.name) ? new ImgClip({ type: "image/gif", stream }) : new ImgClip(stream);
    await clip.ready;
    const spr = new VisibleSprite(clip);
    if (!Number.isFinite(spr.time.duration) || spr.time.duration <= 0) {
      spr.time.duration = 10e6; // 默认 10 秒
    }
    return spr;
  });
}

function addText() {
  return addAsset("4-text", "text", async () => {
    const bitmap = await renderTxt2ImgBitmap("示例文字", "font-size: 80px; color: red;");
    const clip = new ImgClip(bitmap);
    await clip.ready;
    const spr = new VisibleSprite(clip);
    if (!Number.isFinite(spr.time.duration) || spr.time.duration <= 0) {
      spr.time.duration = 10e6; // 默认 10 秒
    }
    return spr;
  });
}

//  初始化 & 播放
onMounted(() => {
  if (!cvsWrapEl.value) return;

  avCvs.value?.destroy();
  const cvs = new AVCanvas(cvsWrapEl.value, { bgColor: "#000", width: 1280, height: 720 });
  avCvs.value = cvs;

  cvs.on("timeupdate", (timeUs: number) => {
    const timeline = timelineRef.value as any;
    timeline?.setTime(timeUs / 1e6);
  });
});

function togglePlay() {
  const cvs = avCvs.value;
  const timeline = timelineRef.value as any;
  if (!cvs || !timeline) return;

  if (playing.value) {
    cvs.pause();
    playing.value = false;
    return;
  }

  const startUs = timeline.getTime() * 1e6;
  cvs.play({ start: startUs });
  playing.value = true;
}

function onPreviewTime(time: number) {
  avCvs.value?.previewFrame(time * 1e6);
}

function clickAction(_: any, { action }: { action: TimelineAction }) {
  // 通过 id 查找原始 action 引用，因为 React Timeline 可能传递的是复制的对象
  const originalAction = tlData.value.flatMap((t) => t.actions).find((a) => a.id === action.id) as TLActionWithName | undefined;
  activeAction.value = originalAction ?? (action as TLActionWithName);
  tlData.value = [...tlData.value];
}

function onActionResizing({ dir, action, start, end }: { dir: string; action: TimelineAction; start: number; end: number }): boolean {
  if (dir === "left") return false;
  const spr = actionSpriteMap.get(action.id);
  if (spr == null) return false;
  const duration = (end - start) * 1e6;
  if (duration > spr.getClip().meta.duration) return false;
  spr.time.duration = duration;
  return true;
}

function onActionMoveEnd({ action }: { action: TimelineAction }) {
  const spr = actionSpriteMap.get(action.id);
  if (spr == null) return;
  spr.time.offset = action.start * 1e6;
}

function getActionRender(action: TLActionWithName) {
  const isActive = action.id === activeAction.value?.id;
  return React.createElement("div", { className: isActive ? "actionItem actionItemActive" : "actionItem" }, action.name);
}

function deleteAction() {
  if (activeAction.value == null) return;
  const action = activeAction.value;
  const spr = actionSpriteMap.get(action.id);
  if (spr == null) return;
  avCvs.value?.removeSprite(spr);
  actionSpriteMap.delete(action.id);
  const track = tlData.value.map((t) => t.actions).find((actions) => actions.includes(action));
  if (track == null) return;
  track.splice(track.indexOf(action), 1);
  tlData.value = [...tlData.value];
}

async function splitAction() {
  if (activeAction.value == null) return;
  const timeline = timelineRef.value as any;
  const action = activeAction.value;
  const spr = actionSpriteMap.get(action.id);
  if (avCvs.value == null || spr == null || timeline == null) return;

  const currentTimeUs = timeline.getTime() * 1e6;
  const splitTimeUs = currentTimeUs - spr.time.offset;

  // 检查分割点是否在 sprite 范围内
  if (splitTimeUs <= 0 || splitTimeUs >= spr.time.duration) return;

  const clip = spr.getClip();
  if (!clip.split) return;

  // 确保分割时间不超出 clip 的实际时长
  const clipDuration = clip.meta.duration;
  if (splitTimeUs <= 0 || splitTimeUs >= clipDuration) return;

  let newClips: Awaited<ReturnType<typeof clip.split>>;
  try {
    newClips = await clip.split(splitTimeUs);
  } catch (e) {
    console.warn("分割失败:", e);
    return;
  }
  if (!newClips || newClips.length < 2) return;

  // 移除原始 sprite
  avCvs.value.removeSprite(spr);
  actionSpriteMap.delete(action.id);
  const track = tlData.value.find((t) => t.actions.includes(action));
  if (track == null) return;
  track.actions.splice(track.actions.indexOf(action), 1);

  // 计算分割后的时长和偏移
  const sprsDuration = [splitTimeUs, spr.time.duration - splitTimeUs];
  const sprsOffset = [spr.time.offset, spr.time.offset + splitTimeUs];

  for (let i = 0; i < newClips.length; i++) {
    const newClip = newClips[i];
    const newSpr = new VisibleSprite(newClip);
    newSpr.time.duration = sprsDuration[i];
    newSpr.time.offset = sprsOffset[i];
    await avCvs.value.addSprite(newSpr);

    // 直接创建 action，不调用 addSprite2Track 避免重复计算 offset
    const newAction = {
      id: Math.random().toString(),
      start: sprsOffset[i] / 1e6,
      end: (sprsOffset[i] + sprsDuration[i]) / 1e6,
      effectId: "",
      name: action.name,
    };
    actionSpriteMap.set(newAction.id, newSpr);
    track.actions.push(newAction);
  }

  activeAction.value = null;
  tlData.value = [...tlData.value];
}

async function exportVideo() {
  if (avCvs.value == null) return;
  const { data, save } = useFileSystemAccess({
    dataType: "Blob",
    types: [{ description: "MP4 Video", accept: { "video/mp4": [".mp4"] } }],
    excludeAcceptAllOption: true,
  });

  const combinator = await avCvs.value.createCombinator();
  const response = new Response(combinator.output());
  data.value = await response.blob();
  await save();
}
</script>

<style scoped lang="scss">
.editVideo {
  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    align-items: center;
  }
  .canvasContainer {
    width: 400px;
  }
}
</style>

<style lang="scss">
.actionItem {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  user-select: none;

  &.actionItemActive {
    border: 1px solid #fca5a5;
    border-style: solid;
    box-sizing: border-box;
  }
}
</style>
