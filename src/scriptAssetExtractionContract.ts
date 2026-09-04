/**
 * Script Asset Extraction 前端契约（Issue #44）。
 *
 * 镜像后端 /script/extractAssets 的最终契约：
 * - 请求：{ scriptIds, projectId, replaceExisting? }。replaceExisting 只在用户
 *   显式确认“删除并重新提取”后携带；未确认时字段必须缺席，防止意外替换。
 * - 错误信封：{ code, data: null, message, error: kind }，与 assetReference
 *   契约的稳定信封一致。后端是权威：即使前端缓存认为没有资产，收到
 *   409 reextractConfirmationRequired 也必须弹出相同确认框后重试。
 *
 * 前端的“选中剧本是否已有资产”判断只是交互优化（getScrptApi 的
 * relatedAssets），不新增预检数量接口。纯函数模块，与 assetReferenceContract.ts
 * 同一测试 seam（node --experimental-strip-types --test）。
 */

/** 后端稳定失败 kind：已有资产且缺少显式替换意图。 */
export const REEXTRACT_CONFIRMATION_REQUIRED = "reextractConfirmationRequired";

/** 后端稳定失败 kind：同一剧本已有提取任务在运行。 */
export const EXTRACTION_IN_PROGRESS = "extractionInProgress";

export type ScriptAssetExtractionFailureKind =
  | typeof REEXTRACT_CONFIRMATION_REQUIRED
  | typeof EXTRACTION_IN_PROGRESS;

/** 后端稳定错误信封（axios 拦截器 reject 出来的 response.data 形状）。 */
export interface ScriptAssetExtractionErrorEnvelope {
  code: number;
  data: null;
  message: string;
  error: ScriptAssetExtractionFailureKind;
}

/** getScrptApi 返回的剧本摘要：前端据此判断是否需要重新提取确认。 */
export interface ScriptAssetSummaryRow {
  id: number;
  relatedAssets?: ReadonlyArray<unknown> | null;
}

/** 选中剧本中任意一个已有关联资产时，重新提取必须先经用户确认。 */
export function needsReextractConfirmation(
  scripts: ReadonlyArray<ScriptAssetSummaryRow>,
  selectedIds: ReadonlyArray<number>,
): boolean {
  const selected = new Set(selectedIds);
  return scripts.some(
    (script) => selected.has(script.id) && (script.relatedAssets?.length ?? 0) > 0,
  );
}

export interface ExtractAssetsRequestInput {
  projectId: number;
  scriptIds: readonly number[];
  /** 用户确认“删除并重新提取”后传 true；其余情况字段缺席。 */
  replaceExisting?: boolean;
}

/** 构建提取请求体：替换意图只在显式确认后出现。 */
export function buildExtractAssetsRequest(input: ExtractAssetsRequestInput): {
  projectId: number;
  scriptIds: number[];
  replaceExisting?: boolean;
} {
  const request: { projectId: number; scriptIds: number[]; replaceExisting?: boolean } = {
    projectId: input.projectId,
    scriptIds: [...input.scriptIds],
  };
  if (input.replaceExisting === true) request.replaceExisting = true;
  return request;
}

function errorKindOf(failure: unknown): string | undefined {
  if (!failure || typeof failure !== "object") return undefined;
  const error = (failure as { error?: unknown }).error;
  return typeof error === "string" ? error : undefined;
}

function isConflictEnvelope(failure: unknown): boolean {
  if (!failure || typeof failure !== "object") return false;
  return (failure as { code?: unknown }).code === 409;
}

/** 后端 409 权威拒绝：前端缓存过期时也要弹出重新提取确认框。 */
export function isReextractConfirmationRequired(failure: unknown): boolean {
  return isConflictEnvelope(failure) && errorKindOf(failure) === REEXTRACT_CONFIRMATION_REQUIRED;
}

/** 后端 409 并发拒绝：已有提取任务正在运行。 */
export function isExtractionInProgress(failure: unknown): boolean {
  return isConflictEnvelope(failure) && errorKindOf(failure) === EXTRACTION_IN_PROGRESS;
}

// ---------------------------------------------------------------------------
// 提取动作决策：页面只是这些纯函数的适配器
// ---------------------------------------------------------------------------

export type ScriptAssetExtractionAction =
  /** 直接提交提取；replaceExisting 仅在显式确认后为 true。 */
  | { action: "submit"; replaceExisting: boolean }
  /** 弹出重新提取确认框。 */
  | { action: "confirm" }
  /** 不做任何事（请求进行中防重、用户取消）。 */
  | { action: "none" };

/** 点击“提取资产”时的入口决策：防重 → 是否需要确认 → 提交。 */
export function resolveExtractAssetsAction(input: {
  /** getScrptApi 缓存判断：选中剧本是否已有资产（交互优化，非权威）。 */
  hasCachedAssets: boolean;
  /** 是否已有提取请求在途（防连续点击）。 */
  requestInFlight: boolean;
}): ScriptAssetExtractionAction {
  if (input.requestInFlight) return { action: "none" };
  if (input.hasCachedAssets) return { action: "confirm" };
  return { action: "submit", replaceExisting: false };
}

/** 确认框按钮决策：取消不发送任何请求；确认携带替换意图重新提交。 */
export function resolveReextractDialogAction(confirmed: boolean): ScriptAssetExtractionAction {
  if (!confirmed) return { action: "none" };
  return { action: "submit", replaceExisting: true };
}

export type ScriptAssetExtractionFailureAction =
  /** 后端 409 权威拒绝 → 弹确认框，确认后携带替换意图重试。 */
  | { action: "confirm" }
  /** 后端 409 并发拒绝 → 提示已有提取在运行。 */
  | { action: "inProgress" }
  /** 其余失败 → 展示错误信息，页面恢复可操作状态。 */
  | { action: "error"; message?: string };

/** 提取请求失败后的决策：409 兜底弹框、并发提示、普通错误恢复。 */
export function resolveExtractAssetsFailure(failure: unknown): ScriptAssetExtractionFailureAction {
  if (isReextractConfirmationRequired(failure)) return { action: "confirm" };
  if (isExtractionInProgress(failure)) return { action: "inProgress" };
  const message = (failure as { message?: unknown } | null | undefined)?.message;
  return { action: "error", message: typeof message === "string" ? message : undefined };
}
