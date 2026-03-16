<template>
  <div class="editVideo">
    <div class="toolbar">
      <t-button @click="addVideo">+ video</t-button>
      <t-button @click="addAudio">+ audio</t-button>
      <t-button @click="addImage">+ image</t-button>
      <t-button @click="addText">+ text</t-button>
      <t-button @click="togglePlay">{{ playing ? "Pause" : "Play" }}</t-button>
    </div>

    <div ref="cvsWrapEl" class="canvasContainer"></div>
    <ReactTimeline
      ref="timelineRef"
      :editorData="tlData"
      :scaleSplitCount="5"
      :autoScroll="true"
      @clickTimeArea="onPreviewTime"
      @action="onPreviewTime"
      :onCursorDragEnd="onPreviewTime"
      :onActionResizing="onActionResizing"
      :onActionMoveEnd="onActionMoveEnd"
      :getActionRender="getActionRender" />
  </div>
</template>

<script setup lang="ts">
import React from "react";
import { useFileDialog } from "@vueuse/core";
import { applyPureReactInVue } from "veaury";
import { AVCanvas } from "@webav/av-canvas";
import { AudioClip, ImgClip, MP4Clip, VisibleSprite, renderTxt2ImgBitmap } from "@webav/av-cliper";
import { Timeline } from "@xzdarcy/react-timeline-editor";
import type { TimelineRow, TimelineAction } from "@xzdarcy/timeline-engine";
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";

const ReactTimeline = applyPureReactInVue(Timeline);

type TLActionWithName = TimelineAction & { name: string };

//  基础状态
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

const actionSpriteMap = new WeakMap<TimelineAction, VisibleSprite>();

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

  if (spr.time.offset === 0) {
    const endSec = track.actions.length ? Math.max(...track.actions.map((a) => a.end)) : 0;
    spr.time.offset = endSec * 1e6;
  }
  if (spr.time.duration === Infinity) spr.time.duration = 10e6;

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

  actionSpriteMap.set(action, spr);
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
    return new VisibleSprite(clip);
  });
}

function addText() {
  return addAsset("4-text", "text", async () => {
    const bitmap = await renderTxt2ImgBitmap("示例文字", "font-size: 80px; color: red;");
    return new VisibleSprite(new ImgClip(bitmap));
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

function onActionResizing({ dir, action, start, end }: { dir: string; action: TimelineAction; start: number; end: number }): boolean {
  if (dir === "left") return false;
  const spr = actionSpriteMap.get(action);
  if (spr == null) return false;
  const duration = (end - start) * 1e6;
  if (duration > spr.getClip().meta.duration) return false;
  spr.time.duration = duration;
  return true;
}

function onActionMoveEnd({ action }: { action: TimelineAction }) {
  const spr = actionSpriteMap.get(action);
  if (spr == null) return;
  spr.time.offset = action.start * 1e6;
}

function getActionRender(action: TLActionWithName) {
  console.log("%c Line:193 🍣", "background:#fca650");
  const isActive = action.id === activeAction.value?.id;
  console.log("%c Line:194 🎂 action", "background:#33a5ff", action);
  return React.createElement(
    "div",
    {
      className: isActive ? "actionItem actionItemActive" : "actionItem",
    },
    action.name,
  );
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

  &.actionItemActive {
    border: 1px solid #fca5a5;
    border-style: solid;
    box-sizing: border-box;
  }
}
</style>