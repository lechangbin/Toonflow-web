/**
 * Asset Reference 前端契约（Issue #34）。
 *
 * 本模块镜像后端 Issue #30 最终评审通过的 Asset Reference API：
 * - 路由：/assetReference/{get,add,update,reorder,del}AssetReference（全部 POST）。
 * - 字段：description、visualRole、requiredTransfers、exclusions、
 *   descriptionSource、analysisState、mediaPath、mediaMime、orderIndex。
 * - 数量：单个资产 0~6 张，第 7 张在提交前被阻止。
 * - 错误：稳定信封 { code, data: null, message, error: kind }。
 * 不重新发明字段；Asset Brief、内部模板等中间产物不出现在任何请求中。
 * 纯函数模块，与 videoContract.ts 同一测试 seam（node --experimental-strip-types --test）。
 */

/** 单个资产最多持有的参考图数量（与当前 Agnes Image 2.1 Flash 能力一致）。 */
export const ASSET_REFERENCE_LIMIT = 6;

/** 描述来源。本版本落库 manual；ai 为后端预留值，前端仅容忍展示，不提供分析入口。 */
export const ASSET_REFERENCE_DESCRIPTION_SOURCES = ["manual", "ai"] as const;

/** 分析生命周期状态。本版本落库 not_requested；其余为后端预留值。 */
export const ASSET_REFERENCE_ANALYSIS_STATES = ["not_requested", "pending", "completed", "failed"] as const;

export type AssetReferenceDescriptionSource = (typeof ASSET_REFERENCE_DESCRIPTION_SOURCES)[number] | (string & {});
export type AssetReferenceAnalysisState = (typeof ASSET_REFERENCE_ANALYSIS_STATES)[number] | (string & {});

/** 与后端 assetReferenceErrorEnvelope 一一对应的失败 kind。 */
export type AssetReferenceFailureKind =
  | "projectNotFound"
  | "assetNotFound"
  | "assetProjectMismatch"
  | "referenceNotFound"
  | "referenceLimitExceeded"
  | "descriptionRequired"
  | "invalidMedia"
  | "orderMismatch";

/** 后端稳定错误信封。 */
export interface AssetReferenceErrorEnvelope {
  code: number;
  data: null;
  message: string;
  error: AssetReferenceFailureKind;
}

/** 后端持久化的参考图记录（getAssetReference 返回 list 的元素）。 */
export interface AssetReferenceRecord {
  id: number;
  projectId: number;
  assetsId: number;
  mediaPath: string;
  mediaMime: string | null;
  orderIndex: number;
  description: string;
  descriptionSource: AssetReferenceDescriptionSource;
  analysisState: AssetReferenceAnalysisState;
  visualRole: string;
  requiredTransfers: string[];
  exclusions: string[];
  createTime: number;
  updateTime: number;
}

/** 前端编辑中的参考图草稿（标签允许字符串或数组，提交前统一归一化）。 */
export interface AssetReferenceDraft {
  description?: string;
  visualRole?: string;
  requiredTransfers?: string | readonly string[];
  exclusions?: string | readonly string[];
}

/** 前端本地校验失败，与后端 kind 对齐。 */
export interface AssetReferenceValidationFailure {
  kind: "descriptionRequired";
  message: string;
}

const DESCRIPTION_REQUIRED_MESSAGE = "参考图描述为必填项，本版本必须由人工撰写";

function trimToText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 把逗号/换行分隔的标签输入（或数组）归一化为非空字符串数组。 */
export function normalizeTagInput(input: string | readonly string[] | null | undefined): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) {
    return input.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0);
  }
  if (typeof input !== "string") return [];
  return input
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** 数量守卫：当前已有 count 张时是否还能继续上传。第 7 张（count >= 6）被阻止。 */
export function canAddReference(count: number): boolean {
  return count < ASSET_REFERENCE_LIMIT;
}

/** 校验编辑草稿：描述必填，角色与标签归一化。 */
export function validateReferenceDraft(
  draft: AssetReferenceDraft,
): { ok: true; value: { description: string; visualRole: string; requiredTransfers: string[]; exclusions: string[] } } | { ok: false; failure: AssetReferenceValidationFailure } {
  const description = trimToText(draft.description);
  if (!description) {
    return { ok: false, failure: { kind: "descriptionRequired", message: DESCRIPTION_REQUIRED_MESSAGE } };
  }
  return {
    ok: true,
    value: {
      description,
      visualRole: trimToText(draft.visualRole),
      requiredTransfers: normalizeTagInput(draft.requiredTransfers),
      exclusions: normalizeTagInput(draft.exclusions),
    },
  };
}

/** 列表请求体（POST /assetReference/getAssetReference）。 */
export function buildListReferencesRequest(input: { projectId: number; assetsId: number }): { projectId: number; assetsId: number } {
  return { projectId: input.projectId, assetsId: input.assetsId };
}

/** 创建请求体（POST /assetReference/addAssetReference）。描述必填，缺失即抛出稳定错误。 */
export function buildCreateReferenceRequest(
  input: { projectId: number; assetsId: number; base64: string } & AssetReferenceDraft,
): { projectId: number; assetsId: number; base64: string; description: string; visualRole: string; requiredTransfers: string[]; exclusions: string[] } {
  const validated = validateReferenceDraft(input);
  if (!validated.ok) throw new Error(validated.failure.message);
  return {
    projectId: input.projectId,
    assetsId: input.assetsId,
    base64: input.base64,
    description: validated.value.description,
    visualRole: validated.value.visualRole,
    requiredTransfers: validated.value.requiredTransfers,
    exclusions: validated.value.exclusions,
  };
}

/** 更新请求体（POST /assetReference/updateAssetReference）。只发送提供的字段。 */
export function buildUpdateReferenceRequest(
  input: { projectId: number; assetsId: number; id: number } & AssetReferenceDraft,
): { projectId: number; assetsId: number; id: number; description?: string; visualRole?: string; requiredTransfers?: string[]; exclusions?: string[] } {
  const request: { projectId: number; assetsId: number; id: number; description?: string; visualRole?: string; requiredTransfers?: string[]; exclusions?: string[] } = {
    projectId: input.projectId,
    assetsId: input.assetsId,
    id: input.id,
  };
  if (input.description !== undefined) {
    const description = trimToText(input.description);
    if (!description) throw new Error(DESCRIPTION_REQUIRED_MESSAGE);
    request.description = description;
  }
  if (input.visualRole !== undefined) {
    request.visualRole = trimToText(input.visualRole);
  }
  if (input.requiredTransfers !== undefined) {
    request.requiredTransfers = normalizeTagInput(input.requiredTransfers);
  }
  if (input.exclusions !== undefined) {
    request.exclusions = normalizeTagInput(input.exclusions);
  }
  return request;
}

/** 排序请求体（POST /assetReference/reorderAssetReference）。orderedIds 必须是完整排列。 */
export function buildReorderReferencesRequest(input: { projectId: number; assetsId: number; orderedIds: readonly number[] }): {
  projectId: number;
  assetsId: number;
  orderedIds: number[];
} {
  return { projectId: input.projectId, assetsId: input.assetsId, orderedIds: [...input.orderedIds] };
}

/** 删除请求体（POST /assetReference/delAssetReference）。 */
export function buildDeleteReferenceRequest(input: { projectId: number; assetsId: number; id: number }): { projectId: number; assetsId: number; id: number } {
  return { projectId: input.projectId, assetsId: input.assetsId, id: input.id };
}

/**
 * 最终图片提示词保存请求体（复用现有 POST /assets/updateAssets）。
 * 该路由要求 id/name/describe 必填，remark/prompt 可选；只编辑最终
 * generationPrompt，不携带任何中间产物。
 */
export function buildUpdateAssetPromptRequest(input: {
  id: number;
  name: string;
  describe: string;
  remark?: string | null;
  prompt: string;
}): { id: number; name: string; describe: string; remark: string; prompt: string } {
  return {
    id: input.id,
    name: trimToText(input.name),
    describe: trimToText(input.describe),
    remark: typeof input.remark === "string" ? input.remark : "",
    prompt: trimToText(input.prompt),
  };
}

function toRecord(row: any): AssetReferenceRecord {
  return {
    id: Number(row?.id ?? 0),
    projectId: Number(row?.projectId ?? 0),
    assetsId: Number(row?.assetsId ?? 0),
    mediaPath: typeof row?.mediaPath === "string" ? row.mediaPath : "",
    mediaMime: typeof row?.mediaMime === "string" ? row.mediaMime : null,
    orderIndex: Number(row?.orderIndex ?? 0),
    description: typeof row?.description === "string" ? row.description : "",
    descriptionSource: typeof row?.descriptionSource === "string" ? row.descriptionSource : "manual",
    analysisState: typeof row?.analysisState === "string" ? row.analysisState : "not_requested",
    visualRole: typeof row?.visualRole === "string" ? row.visualRole : "",
    requiredTransfers: normalizeTagInput(Array.isArray(row?.requiredTransfers) ? row.requiredTransfers : []),
    exclusions: normalizeTagInput(Array.isArray(row?.exclusions) ? row.exclusions : []),
    createTime: Number(row?.createTime ?? 0),
    updateTime: Number(row?.updateTime ?? 0),
  };
}

/** 解析 getAssetReference 响应（axios 拦截器已解出 body）。空列表与空 data 均返回 []。 */
export function parseReferenceListResponse(body: unknown): AssetReferenceRecord[] {
  const data = (body as { data?: unknown } | null | undefined)?.data;
  const list = (data as { list?: unknown } | null | undefined)?.list;
  if (!Array.isArray(list)) return [];
  return list.map(toRecord);
}

/** 判断错误是否为后端 Asset Reference 稳定错误信封。 */
export function isAssetReferenceErrorEnvelope(error: unknown): error is AssetReferenceErrorEnvelope {
  if (error == null || typeof error !== "object") return false;
  const candidate = error as Partial<AssetReferenceErrorEnvelope>;
  return typeof candidate.message === "string" && typeof candidate.error === "string" && typeof candidate.code === "number";
}

/** 把请求错误归一化为可展示的 { kind, message }；非信封错误仅有 message。 */
export function parseReferenceError(error: unknown): { kind?: AssetReferenceFailureKind; message: string } {
  if (isAssetReferenceErrorEnvelope(error)) {
    return { kind: error.error, message: error.message };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  if (error != null && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return { message: (error as { message: string }).message };
  }
  return { message: "请求失败，请重试" };
}

export interface ControlledDimensionConflict {
  dimension: string;
  referenceIds: number[];
}

/**
 * 提交前的受控维度冲突校验：同一维度同时出现在某张参考图的必传要素与
 * 排除项中（含跨参考图互斥）时返回冲突列表，由界面在提交前提示。
 */
export function findControlledDimensionConflicts(
  references: ReadonlyArray<Pick<AssetReferenceRecord, "id" | "requiredTransfers" | "exclusions">>,
): ControlledDimensionConflict[] {
  const required = new Map<string, Set<number>>();
  const excluded = new Map<string, Set<number>>();
  const touch = (map: Map<string, Set<number>>, dimension: string, id: number) => {
    const key = dimension.trim();
    if (!key) return;
    const ids = map.get(key) ?? new Set<number>();
    ids.add(id);
    map.set(key, ids);
  };
  for (const reference of references) {
    for (const dimension of reference.requiredTransfers ?? []) touch(required, dimension, reference.id);
    for (const dimension of reference.exclusions ?? []) touch(excluded, dimension, reference.id);
  }
  const conflicts: ControlledDimensionConflict[] = [];
  for (const [dimension, requiredIds] of required) {
    const excludedIds = excluded.get(dimension);
    if (!excludedIds) continue;
    const referenceIds = [...new Set([...requiredIds, ...excludedIds])].sort((a, b) => a - b);
    conflicts.push({ dimension, referenceIds });
  }
  return conflicts;
}

/**
 * 生成请求中的参考图输入（#35 接入 Image Vendor 执行时使用）。
 * 无参考图时返回空数组且调用方必须整体省略参考图字段——不生成占位图，
 * 不发送虚假引用。
 */
export function buildGenerationReferenceInputs(
  references: readonly AssetReferenceRecord[],
): Array<{ id: number; mediaPath: string; description: string; visualRole: string; requiredTransfers: string[]; exclusions: string[] }> {
  return references.map((reference) => ({
    id: reference.id,
    mediaPath: reference.mediaPath,
    description: reference.description,
    visualRole: reference.visualRole,
    requiredTransfers: reference.requiredTransfers,
    exclusions: reference.exclusions,
  }));
}

/**
 * 旧数据兼容：没有参考图配置或 prompt 的 Asset 仍能打开配置界面。
 * prompt 缺失时回退为空字符串，参考图列表由加载流程独立获取。
 */
export function hydrateAssetConfig(asset: { id: number; prompt?: unknown }): { id: number; prompt: string } {
  return { id: asset.id, prompt: typeof asset.prompt === "string" ? asset.prompt : "" };
}

/**
 * 从 API 基址推导参考图媒体展示 URL。
 * 后端媒体落在 OSS 静态目录（/oss/<mediaPath>），前端 axios 基址形如 <origin>/api。
 */
export function referenceMediaUrl(apiBaseUrl: string, mediaPath: string): string {
  const base = (apiBaseUrl ?? "").replace(/\/+$/, "");
  const origin = base.replace(/\/api$/, "");
  const path = (mediaPath ?? "").replace(/^\/+/, "");
  return origin + "/oss/" + path;
}
