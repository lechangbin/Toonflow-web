<template>
  <div class="editVideo">
    <splitpanes class="default-theme content" horizontal :push-other-panes="false">
      <pane size="60">
        <splitpanes :push-other-panes="false">
          <pane size="20">
            <mediaLibrary :initial-media-items="initialMediaItems" :initial-audio-items="initialAudioItems" :initial-image-items="initialImageItems" />
          </pane>
          <pane size="60">
            <videoPreview />
          </pane>
          <pane size="20">
            <propertyPanel />
          </pane>
        </splitpanes>
      </pane>
      <pane size="40" class="pr">
        <VideoTrack
          :theme="theme"
          ref="videoTrackRef"
          :operation-buttons="operationButtons"
          :scale-config-buttons="scaleConfigButtons"
          :track-types="trackTypes"
          :clip-configs="clipConfigs"
          :enable-main-track-mode="true"
          :enable-cross-track-drag="true"
          :enable-snap="true"
          :default-scale="1"
          @add-transition="handleAddTransitionFromClick"
          @drop-media="handleDropMedia"
          @transition-added="onTransitionAdded">
          <!-- 自定义操作按钮 -->
          <template #custom-operation-import>
            <button class="tools-bar__btn" @click="handleImport" title="导入项目">
              <span class="tools-bar__icon">📁</span>
              <span class="tools-bar__label">导入</span>
            </button>
          </template>

          <template #custom-operation-export>
            <button class="tools-bar__btn" @click="handleExport" title="导出项目">
              <span class="tools-bar__icon">💾</span>
              <span class="tools-bar__label">导出</span>
            </button>
          </template>
        </VideoTrack>
      </pane>
    </splitpanes>
  </div>
</template>

<script setup lang="ts">
import mediaLibrary from "./mediaLibrary.vue";
import videoPreview from "./videoPreview.vue";
import propertyPanel from "./propertyPanel.vue";
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";
import "vue-clip-track/style.css";
import {
  VideoTrack,
  useTracksStore,
  usePlaybackStore,
  useHistoryStore,
  generateId,
  normalizeTime,
  type OperationButton,
  type ScaleConfigButton,
  type TrackTypeConfig,
  type Track,
  type Clip,
  type MediaClip,
} from "vue-clip-track";

import type { MediaItem, AudioItem } from "./utils/mediaData";
import { getDefaultDuration, findOrCreateTrackWithSpace } from "./utils/trackHelper";
import { loadVideoClipThumbnails, loadAudioClipWaveform, loadInitialAudioWaveforms } from "./utils/mediaLoader";
import { findAdjacentClipsAtTime, addTransitionBetweenClips } from "./utils/transitionHelper";

const props = withDefaults(
  defineProps<{
    initialTracks?: Track[];
    initialMediaItems?: MediaItem[];
    initialAudioItems?: AudioItem[];
    initialImageItems?: MediaItem[];
  }>(),
  {
    initialTracks: () => [],
    initialMediaItems: () => [],
    initialAudioItems: () => [],
    initialImageItems: () => [],
  },
);

const tracksStore = useTracksStore();
const playbackStore = usePlaybackStore();
const historyStore = useHistoryStore();

const operationButtons = ref<OperationButton[]>([
  "reset",
  "undo",
  "redo",
  "split",
  "delete",
  { type: "custom", key: "import" },
  { type: "custom", key: "export" },
]);

const scaleConfigButtons = ref<ScaleConfigButton[]>(["snap"]);

const trackTypes = ref<TrackTypeConfig>({
  video: { max: 5 },
  image: { max: 3 },
  audio: { max: 3 },
  subtitle: { max: 2 },
  text: { max: 2 },
  sticker: { max: 2 },
  filter: { max: 1 },
  effect: { max: 2 },
});

const clipConfigs = ref({
  video: {
    backgroundColor: "linear-gradient(45deg, #667eea 0%, #764ba2 100%)",
    borderColor: "#667eea",
    height: 60,
    selected: {
      borderColor: "#ff6b6b",
      boxShadow: "0 0 0 3px rgba(255, 107, 107, 0.3)",
    },
  },
  audio: {
    backgroundColor: "linear-gradient(45deg, #f093fb 0%, #f5576c 100%)",
    height: 36,
    selected: {
      borderColor: "#4ecdc4",
    },
  },
  image: {
    backgroundColor: "linear-gradient(45deg, #43e97b 0%, #38f9d7 100%)",
    borderColor: "#43e97b",
    height: 60,
    selected: {
      borderColor: "#ff6b6b",
      boxShadow: "0 0 0 3px rgba(255, 107, 107, 0.3)",
    },
  },
});

const videoTrackRef = ref();

function handleImport() {
  alert("导入功能 - 这里可以实现项目导入逻辑");
}

function handleExport() {
  alert("导出功能 - 这里可以实现项目导出逻辑");
}

// 处理从资源库拖拽媒体到轨道
async function handleDropMedia(mediaData: any, trackId: string, startTime: number) {
  try {
    if (mediaData.type === "transition") {
      handleDropTransition(mediaData, trackId, startTime);
      return;
    }

    const duration = getDefaultDuration(mediaData.type, mediaData);
    const { track } = findOrCreateTrackWithSpace(tracksStore, mediaData.type, startTime, duration, trackId);
    if (!track) return;

    let clip: Partial<Clip> = {
      id: generateId("clip-"),
      trackId: track.id,
      startTime: normalizeTime(startTime),
      selected: false,
    };

    if (mediaData.type === "video") {
      const sourceUrl = mediaData.sourceUrl || mediaData.url || mediaData.id;
      clip = {
        ...clip,
        type: "video",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        sourceUrl,
        originalDuration: duration,
        trimStart: 0,
        trimEnd: duration,
        playbackRate: 1,
        thumbnails: mediaData.thumbnails || [],
      } as Partial<MediaClip>;

      tracksStore.addClip(track.id, clip as Clip);
      historyStore.pushSnapshot(`添加 ${mediaData.name}`);

      if (!mediaData.thumbnails || mediaData.thumbnails.length === 0) {
        loadVideoClipThumbnails(tracksStore, clip.id!, sourceUrl);
      }
      return;
    } else if (mediaData.type === "image") {
      const sourceUrl = mediaData.sourceUrl || mediaData.url || mediaData.id;
      clip = {
        ...clip,
        type: "image" as any,
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        sourceUrl,
        originalDuration: duration,
        trimStart: 0,
        trimEnd: duration,
        playbackRate: 1,
        thumbnails: mediaData.thumbnail ? [mediaData.thumbnail] : [],
      };

      tracksStore.addClip(track.id, clip as Clip);
      historyStore.pushSnapshot(`添加 ${mediaData.name}`);
      return;
    } else if (mediaData.type === "audio") {
      const sourceUrl = mediaData.sourceUrl || mediaData.url || mediaData.id;
      clip = {
        ...clip,
        type: "audio",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        sourceUrl,
        originalDuration: duration,
        trimStart: 0,
        trimEnd: duration,
        playbackRate: 1,
        volume: 1,
        waveformData: mediaData.waveformData || [],
      } as Partial<MediaClip>;

      tracksStore.addClip(track.id, clip as Clip);
      historyStore.pushSnapshot(`添加 ${mediaData.name}`);

      if (!mediaData.waveformData || mediaData.waveformData.length === 0) {
        loadAudioClipWaveform(tracksStore, clip.id!, sourceUrl);
      }
      return;
    } else if (mediaData.type === "subtitle") {
      clip = { ...clip, type: "subtitle", name: mediaData.name, endTime: normalizeTime(startTime + duration), text: "示例字幕文本" };
    } else if (mediaData.type === "text") {
      clip = { ...clip, type: "text", name: mediaData.name, endTime: normalizeTime(startTime + duration), text: "自定义文本内容" };
    } else if (mediaData.type === "sticker") {
      clip = { ...clip, type: "sticker", name: mediaData.name, endTime: normalizeTime(startTime + duration), sourceUrl: mediaData.id };
    } else if (mediaData.type === "filter") {
      clip = {
        ...clip,
        type: "filter",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        filterType: mediaData.filterType || mediaData.id,
        filterValue: mediaData.filterValue ?? 1,
      };
    } else if (mediaData.type === "effect") {
      clip = {
        ...clip,
        type: "effect",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        effectType: mediaData.effectType || mediaData.id,
        effectDuration: duration,
      };
    }

    tracksStore.addClip(track.id, clip as Clip);
    historyStore.pushSnapshot(`添加 ${mediaData.name}`);
  } catch (error: any) {
    alert(error.message);
  }
}

// 处理转场拖拽
function handleDropTransition(transitionData: any, trackId: string, dropTime: number) {
  const track = tracksStore.tracks.find((t) => t.id === trackId);
  if (!track) return;

  const clips = track.clips.filter((c) => c.type !== "transition").sort((a, b) => a.startTime - b.startTime);
  if (clips.length === 0) {
    window.$message.warning("转场需要添加在两个相邻的 Clip 之间");
    return;
  }

  const result = findAdjacentClipsAtTime(clips, dropTime);
  if (!result) {
    window.$message.warning("转场需要添加在两个相邻的 Clip 之间");
    return;
  }

  applyTransition(result.beforeClip.id, result.afterClip.id, transitionData.subType);
}

function handleAddTransitionFromClick(beforeClipId: string, afterClipId: string) {
  applyTransition(beforeClipId, afterClipId, "fade");
}

// 添加转场并触发后续事件
function applyTransition(beforeClipId: string, afterClipId: string, transitionType: string = "fade") {
  const result = addTransitionBetweenClips(tracksStore, historyStore, beforeClipId, afterClipId, transitionType);
  if (result) {
    if (videoTrackRef.value) {
      videoTrackRef.value.emitTransitionAdded(result.transitionClip, result.beforeClip.id, result.afterClip.id);
    }
  }
}

function onTransitionAdded(transitionClip: any, beforeClipId: string, afterClipId: string) {
  window.$message.success(`已添加转场: ${transitionClip.name}`);
  playbackStore.seekTo(transitionClip.startTime);
}

// 初始化轨道数据
function initializeTracks() {
  tracksStore.reset();

  if (props.initialTracks.length > 0) {
    props.initialTracks.forEach((track) => {
      tracksStore.addTrack(track);
    });
  }

  playbackStore.setDuration(30);
  playbackStore.seekTo(0);
  historyStore.initialize();
  loadInitialAudioWaveforms(tracksStore);
}

onMounted(() => {
  initializeTracks();
  nextTick(() => {
    const cursorLine = document.querySelector(".ruler__cursor-line") as HTMLElement;
    if (cursorLine) {
      cursorLine.style.display = "none";
      requestAnimationFrame(() => {
        cursorLine.style.display = "";
      });
    }
  });
});

const theme = {
  primaryColor: "#000",
  backgroundColor: "#ecedef",
  textColor: "#ffffff",
  borderColor: "#ecedef",
};
</script>

<style lang="scss" scoped>
.editVideo {
  .content {
    height: calc(100vh - var(--td-comp-paddingTB-xl) * 2 - 50px - 1rem);
  }
}
:deep(.ruler__cursor-handle) {
  &:hover {
    filter: none !important;
  }
}
</style>
