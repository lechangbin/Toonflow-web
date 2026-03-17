/** 媒体素材接口 */
export interface MediaItem {
  id: string;
  type: "video" | "audio" | "image";
  name: string;
  duration: number;
  icon: string;
  color: string;
  url: string;
  thumbnail?: string;
  thumbnails?: string[];
  waveformData?: number[];
  loading?: boolean;
}

/** 音频素材接口 */
export interface AudioItem {
  id: string;
  type: "audio";
  name: string;
  duration: number;
  url: string;
  waveformData?: number[];
  loading?: boolean;
}

/** 字幕/文本列表 */
export const textItems = [
  { id: "text-1", type: "subtitle", name: "标题文本", preview: "Aa", duration: 3 },
  { id: "text-2", type: "subtitle", name: "字幕文本", preview: "字", duration: 3 },
  { id: "text-3", type: "text", name: "自定义文本", preview: "Text", duration: 3 },
];

/** 转场效果列表 */
export const transitionItems = [
  { id: "trans-1", type: "transition", subType: "fade", name: "淡入淡出", icon: "i-round" },
  { id: "trans-2", type: "transition", subType: "slide", name: "滑动", icon: "i-right" },
  { id: "trans-3", type: "transition", subType: "wipe", name: "擦除", icon: "i-erase" },
  { id: "trans-4", type: "transition", subType: "dissolve", name: "溶解", icon: "i-platte" },
  { id: "trans-5", type: "transition", subType: "zoom", name: "缩放", icon: "i-zoom-in" },
  { id: "trans-6", type: "transition", subType: "rotate", name: "旋转", icon: "i-redo" },
];

/** 特效列表 */
export const effectItems = [
  { id: "fadeIn", type: "effect", effectType: "fadeIn", name: "淡入", icon: "i-sun-one" },
  { id: "fadeOut", type: "effect", effectType: "fadeOut", name: "淡出", icon: "i-moon" },
  { id: "flash", type: "effect", effectType: "flash", name: "闪烁", icon: "i-flashlamp" },
  { id: "shake", type: "effect", effectType: "shake", name: "抖动", icon: "i-shake" },
  { id: "zoomIn", type: "effect", effectType: "zoomIn", name: "放大进入", icon: "i-zoom-in" },
  { id: "zoomOut", type: "effect", effectType: "zoomOut", name: "缩小退出", icon: "i-zoom-out" },
  { id: "pulse", type: "effect", effectType: "pulse", name: "脉冲", icon: "i-heartbeat" },
  { id: "rotateIn", type: "effect", effectType: "rotateIn", name: "旋转进入", icon: "i-redo" },
  { id: "sticker-1", type: "sticker", name: "贴纸 1", icon: "i-emotion-happy" },
  { id: "sticker-2", type: "sticker", name: "贴纸 2", icon: "i-star" },
];

/** 滤镜列表 */
export const filterItems = [
  { id: "grayscale", type: "filter", filterType: "grayscale", filterValue: 1, name: "黑白", icon: "i-dark-mode" },
  { id: "sepia", type: "filter", filterType: "sepia", filterValue: 1, name: "复古", icon: "i-camera-one" },
  { id: "warm", type: "filter", filterType: "sepia", filterValue: 0.3, name: "暖色", icon: "i-fire" },
  { id: "cool", type: "filter", filterType: "hue-rotate", filterValue: 180, name: "冷色", icon: "i-snowflake" },
  { id: "saturate", type: "filter", filterType: "saturate", filterValue: 2, name: "鲜艳", icon: "i-brightness" },
  { id: "brightness", type: "filter", filterType: "brightness", filterValue: 1.3, name: "明亮", icon: "i-sun-one" },
  { id: "contrast", type: "filter", filterType: "contrast", filterValue: 1.5, name: "高对比", icon: "i-contrast-view" },
  { id: "blur", type: "filter", filterType: "blur", filterValue: 3, name: "模糊", icon: "i-fog" },
  { id: "invert", type: "filter", filterType: "invert", filterValue: 1, name: "反色", icon: "i-reverse-rotation" },
  { id: "opacity", type: "filter", filterType: "opacity", filterValue: 0.5, name: "半透明", icon: "i-ghost" },
];

/** 资源库 Tab 配置 */
export const libraryTabs = [
  { id: "media", label: "媒体", icon: "i-video" },
  { id: "image", label: "图片", icon: "i-pic" },
  { id: "audio", label: "音频", icon: "i-music" },
  { id: "text", label: "字幕", icon: "i-text" },
  { id: "transition", label: "转场", icon: "i-switch-themes" },
  { id: "effect", label: "特效", icon: "i-magic" },
  { id: "filter", label: "滤镜", icon: "i-color-filter" },
];

/** 格式化时长 */
export function formatDuration(seconds: number): string {
  if (seconds === 0) return "加载中...";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs.toFixed(1)}s`;
}

/** 在 canvas 上绘制迷你波形图 */
export function drawMiniWaveform(audioId: string, waveformData: number[]) {
  const canvas = document.querySelector(`canvas[data-audio-id="${audioId}"]`) as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const barWidth = width / waveformData.length;
  ctx.fillStyle = "rgba(16, 185, 129, 0.8)";

  for (let i = 0; i < waveformData.length; i++) {
    const barHeight = waveformData[i] * height * 0.9;
    const x = i * barWidth;
    const y = (height - barHeight) / 2;
    ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
  }
}
