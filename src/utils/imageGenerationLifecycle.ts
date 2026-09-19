/**
 * 图片生成共享生命周期契约（Issue #39，与后端 src/assets/imageGenerationLifecycle.ts 对齐）。
 *
 * 单资产、批量生成与 Production Agent 资产生成共用同一状态机；状态由后端
 * 真实事件驱动并持久化，前端只通过轮询读取权威状态，禁止用定时器或百分比
 * 模拟进度，任何页面不得手写状态字符串：
 *
 *   等待中：批量请求已被后端接受，但任务尚未获得本地并发槽。
 *   生成中：已经开始调用 Image Vendor。
 *   下载中：供应商返回图片 URL，Toonflow 开始下载媒体。
 *   已完成：图片已持久化并绑定资产。
 *   生成失败：任一阶段稳定失败（含超时、下载失败、写入失败、进程中断）。
 *   已取消：用户主动取消；供应商迟到结果不得覆盖该终态。
 */
export const IMAGE_GENERATION_LIFECYCLE_STATES = [
  "等待中",
  "生成中",
  "下载中",
  "已完成",
  "生成失败",
  "已取消",
] as const;

export type ImageGenerationLifecycleState = (typeof IMAGE_GENERATION_LIFECYCLE_STATES)[number];

/** 仍可能推进到其他状态的非终态；轮询集合与取消入口都以此判定。 */
export const IMAGE_GENERATION_ACTIVE_STATES: readonly ImageGenerationLifecycleState[] = [
  "等待中",
  "生成中",
  "下载中",
];

export type ImageGenerationActiveState = (typeof IMAGE_GENERATION_ACTIVE_STATES)[number];

export const IMAGE_GENERATION_TERMINAL_STATES: readonly ImageGenerationLifecycleState[] = [
  "已完成",
  "生成失败",
  "已取消",
];

export type ImageGenerationTerminalState = (typeof IMAGE_GENERATION_TERMINAL_STATES)[number];

/** 守卫只断言活跃子集，负分支仍保留“未生成”与终态供模板继续比较。 */
export function isImageGenerationActiveState(state: unknown): boolean {
  return typeof state === "string" && (IMAGE_GENERATION_ACTIVE_STATES as readonly string[]).includes(state);
}

export function isImageGenerationTerminalState(state: unknown): boolean {
  return typeof state === "string" && (IMAGE_GENERATION_TERMINAL_STATES as readonly string[]).includes(state);
}

/** 将不可信 API/旧数据值收敛到共享生命周期联合类型。 */
export function normalizeImageGenerationState(state: unknown): ImageGenerationLifecycleState | null {
  return typeof state === "string" && (IMAGE_GENERATION_LIFECYCLE_STATES as readonly string[]).includes(state)
    ? (state as ImageGenerationLifecycleState)
    : null;
}

/**
 * 轮询接口返回的稳定失败分类（后端 errorKind）。超时、生成失败与下载失败
 * 必须分别展示，不得把原始供应商异常直接透给用户。
 */
export type ImageGenerationErrorKind =
  | "imageGenerationTimeout"
  | "imageGenerationFailed"
  | "imageDownloadFailed"
  | "imagePersistenceFailed";

/** /assets/pollingImageAssets 与 /production/assets/pollingImage 的单条响应。 */
export interface ImageGenerationPollingRecord {
  id: number;
  /** 权威生命周期状态；资产或图片记录缺失时为 null，前端必须停止等待。 */
  state: string | null;
  filePath: string | null;
  errorKind: string | null;
}

/** 后端持久化的 errorReason 形如 `kind:hash`；展示时取 kind 前缀做本地化，避免露出哈希。 */
export function imageFailureKindFromStoredReason(reason: unknown): string | null {
  if (typeof reason !== "string" || !reason) return null;
  const match = /^([a-zA-Z]+):/.exec(reason);
  return match ? match[1] : null;
}

/** 活跃状态 → 展示文案 i18n key（等待中/生成中/下载中）。 */
export function imageGenerationStateLabelKey(state: string): string | null {
  switch (state) {
    case "等待中":
      return "workbench.imageLifecycle.waiting";
    case "生成中":
      return "workbench.imageLifecycle.generating";
    case "下载中":
      return "workbench.imageLifecycle.downloading";
    default:
      return null;
  }
}

/** 后端安全写入 errorReason 的本地稳定文案白名单；除此之外（含历史供应商原文）不直接展示。 */
const SAFE_STORED_REASONS: readonly string[] = ["软件退出导致失败"];

/** 仅白名单内的本地文案可直接展示，历史供应商原文一律回退通用失败提示。 */
export function imageStoredReasonText(reason: unknown): string | null {
  return typeof reason === "string" && SAFE_STORED_REASONS.includes(reason) ? reason : null;
}

/** 稳定失败 kind → 用户可理解文案 i18n key；未知 kind 回退通用失败。 */
export function imageGenerationErrorLabelKey(kind: string | null | undefined): string {
  switch (kind) {
    case "imageGenerationTimeout":
      return "workbench.imageLifecycle.errorTimeout";
    case "imageDownloadFailed":
      return "workbench.imageLifecycle.errorDownloadFailed";
    case "imagePersistenceFailed":
      return "workbench.imageLifecycle.errorPersistenceFailed";
    default:
      return "workbench.imageLifecycle.errorGenerationFailed";
  }
}

type TranslateImageLifecycle = (key: string) => string;

/** 统一各资产页面的生命周期展示，页面只提供自身的历史 fallback key。 */
export function formatImageGenerationState(
  state: string,
  translate: TranslateImageLifecycle,
  fallbackKey: string,
): string {
  return translate(imageGenerationStateLabelKey(state) ?? fallbackKey);
}

/** 统一失败展示与历史原文防泄漏规则。 */
export function formatImageGenerationFailure(
  input: { errorKind?: string | null; errorReason?: string | null },
  translate: TranslateImageLifecycle,
  fallbackKey: string,
): string {
  const kind = input.errorKind || imageFailureKindFromStoredReason(input.errorReason);
  if (kind) return translate(imageGenerationErrorLabelKey(kind));
  return imageStoredReasonText(input.errorReason) ?? translate(fallbackKey);
}
