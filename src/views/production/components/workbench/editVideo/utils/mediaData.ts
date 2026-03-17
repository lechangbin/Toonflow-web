/** 媒体素材接口 */
export interface MediaItem {
  id: string;
  type: "video" | "audio";
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
  { id: "trans-1", type: "transition", subType: "fade", name: "淡入淡出", icon: "⚪" },
  { id: "trans-2", type: "transition", subType: "slide", name: "滑动", icon: "➡️" },
  { id: "trans-3", type: "transition", subType: "wipe", name: "擦除", icon: "🔲" },
  { id: "trans-4", type: "transition", subType: "dissolve", name: "溶解", icon: "💫" },
  { id: "trans-5", type: "transition", subType: "zoom", name: "缩放", icon: "🔍" },
  { id: "trans-6", type: "transition", subType: "rotate", name: "旋转", icon: "🔄" },
];

/** 特效列表 */
export const effectItems = [
  { id: "fadeIn", type: "effect", effectType: "fadeIn", name: "淡入", icon: "🌅", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { id: "fadeOut", type: "effect", effectType: "fadeOut", name: "淡出", icon: "🌇", gradient: "linear-gradient(135deg, #ffd89b 0%, #19547b 100%)" },
  { id: "flash", type: "effect", effectType: "flash", name: "闪烁", icon: "💫", gradient: "linear-gradient(135deg, #f5af19 0%, #f12711 100%)" },
  { id: "shake", type: "effect", effectType: "shake", name: "抖动", icon: "📳", gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
  { id: "zoomIn", type: "effect", effectType: "zoomIn", name: "放大进入", icon: "🔍", gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
  { id: "zoomOut", type: "effect", effectType: "zoomOut", name: "缩小退出", icon: "🔎", gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { id: "pulse", type: "effect", effectType: "pulse", name: "脉冲", icon: "💓", gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
  { id: "rotateIn", type: "effect", effectType: "rotateIn", name: "旋转进入", icon: "🔄", gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" },
  { id: "sticker-1", type: "sticker", name: "贴纸 1", icon: "😀", gradient: "linear-gradient(135deg, #FFE985 0%, #FA742B 100%)" },
  { id: "sticker-2", type: "sticker", name: "贴纸 2", icon: "⭐", gradient: "linear-gradient(135deg, #F6D242 0%, #FF52E5 100%)" },
];

/** 滤镜列表 */
export const filterItems = [
  { id: "grayscale", type: "filter", filterType: "grayscale", filterValue: 1, name: "黑白", icon: "⚫", gradient: "linear-gradient(135deg, #000000 0%, #ffffff 100%)" },
  { id: "sepia", type: "filter", filterType: "sepia", filterValue: 1, name: "复古", icon: "📷", gradient: "linear-gradient(135deg, #d4a574 0%, #8b6f47 100%)" },
  { id: "warm", type: "filter", filterType: "sepia", filterValue: 0.3, name: "暖色", icon: "🔥", gradient: "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)" },
  { id: "cool", type: "filter", filterType: "hue-rotate", filterValue: 180, name: "冷色", icon: "❄️", gradient: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" },
  { id: "saturate", type: "filter", filterType: "saturate", filterValue: 2, name: "鲜艳", icon: "🌈", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { id: "brightness", type: "filter", filterType: "brightness", filterValue: 1.3, name: "明亮", icon: "☀️", gradient: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)" },
  { id: "contrast", type: "filter", filterType: "contrast", filterValue: 1.5, name: "高对比", icon: "🎭", gradient: "linear-gradient(135deg, #000000 0%, #434343 100%)" },
  { id: "blur", type: "filter", filterType: "blur", filterValue: 3, name: "模糊", icon: "〰️", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { id: "invert", type: "filter", filterType: "invert", filterValue: 1, name: "反色", icon: "🔄", gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" },
  { id: "opacity", type: "filter", filterType: "opacity", filterValue: 0.5, name: "半透明", icon: "👻", gradient: "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(0,0,0,0.5) 100%)" },
];

/** 资源库 Tab 配置 */
export const libraryTabs = [
  { id: "media", label: "媒体", icon: "🎬" },
  { id: "audio", label: "音频", icon: "🎵" },
  { id: "text", label: "字幕", icon: "📝" },
  { id: "transition", label: "转场", icon: "🔀" },
  { id: "effect", label: "特效", icon: "✨" },
  { id: "filter", label: "滤镜", icon: "🎨" },
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
