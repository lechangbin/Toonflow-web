import type { Clip } from "vue-clip-track";

const CLIP_ICONS: Record<string, string> = {
  video: "i-video",
  audio: "i-music",
  subtitle: "i-editor",
  transition: "i-exchange",
  sticker: "i-pic",
  filter: "i-filter",
  effect: "i-flash",
};

const CLIP_TYPE_NAMES: Record<string, string> = {
  video: "视频",
  audio: "音频",
  subtitle: "字幕",
  transition: "转场",
  sticker: "贴纸",
  filter: "滤镜",
  effect: "特效",
};

/** 获取 clip 类型对应的图标 */
export function getClipIcon(clip: Clip): string {
  return CLIP_ICONS[clip.type] || "i-file-text";
}

/** 获取 clip 类型的中文名称 */
export function getClipTypeName(type: string): string {
  return CLIP_TYPE_NAMES[type] || type;
}

/** 格式化时间为 MM:SS.ms 格式 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}
