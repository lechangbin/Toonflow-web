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
 *
 * Issue #38：Derived Asset 父资产锚点边界。后端正式父子关系字段（o_assets.assetsId，
 * 即 getAssetsApi 返回资产行上的 assetsId）非空即为衍生资产：人工参考图必须为 0，
 * 参考图 mutation 被稳定拒绝，生成请求构建对衍生资产一律返回空人工引用输入；
 * 父资产锚点由后端自动解析，前端不提供任何锚点管理 UI。
 */

/** 单个资产最多持有的参考图数量（与当前 Agnes Image 2.1 Flash 能力一致）。 */
export const ASSET_REFERENCE_LIMIT = 6;

/** 描述来源。本版本落库 manual；ai 为后端预留值，前端仅容忍展示，不提供分析入口。 */
export const ASSET_REFERENCE_DESCRIPTION_SOURCES = ["manual", "ai"] as const;

/** 分析生命周期状态。本版本落库 not_requested；其余为后端预留值。 */
export const ASSET_REFERENCE_ANALYSIS_STATES = ["not_requested", "pending", "completed", "failed"] as const;

export type AssetReferenceDescriptionSource = (typeof ASSET_REFERENCE_DESCRIPTION_SOURCES)[number] | (string & {});
export type AssetReferenceAnalysisState = (typeof ASSET_REFERENCE_ANALYSIS_STATES)[number] | (string & {});

/**
 * Derived Asset 边界（Issue #38）：仅凭后端正式父子关系字段识别。
 * getAssetsApi 返回的资产行上 assetsId 为父资产 id（基础资产为 null）。
 */
export interface AssetParentLinkage {
  assetsId?: unknown;
}

/** 与后端 assetReferenceErrorEnvelope 一一对应的失败 kind。 */
export type AssetReferenceFailureKind =
  | "projectNotFound"
  | "assetNotFound"
  | "assetProjectMismatch"
  | "referenceNotFound"
  | "referenceLimitExceeded"
  | "descriptionRequired"
  | "invalidMedia"
  | "orderMismatch"
  | "derivedAssetReferenceForbidden";

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

const DERIVED_ASSET_REFERENCE_FORBIDDEN_MESSAGE = "衍生资产不支持人工参考图，图片将自动继承父资产当前图片";

/**
 * 归一父子关系字段：能转为正整数的任何形态（number、数字字符串）都视为
 * 父资产 id，其余（null、undefined、0、非数字）归一为 null。所有调用方
 * 共用同一语义，避免不同路径对 Derived Asset 的判定不一致。
 */
export function normalizeParentAssetId(value: unknown): number | null {
  const parentId = Number(value);
  return Number.isFinite(parentId) && parentId > 0 ? parentId : null;
}

/** 仅凭后端父子关系字段（assetsId 指向父资产）识别 Derived Asset。 */
export function isDerivedAsset(asset: AssetParentLinkage | null | undefined): boolean {
  return normalizeParentAssetId(asset?.assetsId) != null;
}

/**
 * 参考图 mutation 守卫（Issue #38）：Derived Asset 的人工参考图增改/排序/删除
 * 在契约层被稳定拒绝；基础资产返回 null 照常放行。composable/service 层
 * 调用本函数，不能只靠隐藏按钮。
 */
export function makeReferenceMutationFailure(asset: AssetParentLinkage | null | undefined): {
  kind: "derivedAssetReferenceForbidden";
  message: string;
} | null {
  if (!isDerivedAsset(asset)) return null;
  return { kind: "derivedAssetReferenceForbidden", message: DERIVED_ASSET_REFERENCE_FORBIDDEN_MESSAGE };
}

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

export interface TransferExclusionConflict {
  dimension: string;
  referenceIds: number[];
}

/**
 * 提交前的包含/排除矛盾检查：同一要素同时出现在必传要素与排除项中
 * （含跨参考图互斥）时返回矛盾列表，由界面在提交前提示。
 *
 * 规格差距说明：Issue #34 的 controlledDimensions 冲突指多张参考图争夺
 * 同一视觉维度的控制权。#30 后端契约没有为维度所有权模型提供持久化
 * 字段（仅 visualRole/requiredTransfers/exclusions），该规则在本版本
 * 无法表达，作为 #33/#35 集成依赖记录；本函数只检测包含/排除矛盾。
 */
export function findTransferExclusionConflicts(
  references: ReadonlyArray<Pick<AssetReferenceRecord, "id" | "requiredTransfers" | "exclusions">>,
): TransferExclusionConflict[] {
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
  const conflicts: TransferExclusionConflict[] = [];
  for (const [dimension, requiredIds] of required) {
    const excludedIds = excluded.get(dimension);
    if (!excludedIds) continue;
    const referenceIds = [...new Set([...requiredIds, ...excludedIds])].sort((a, b) => a - b);
    conflicts.push({ dimension, referenceIds });
  }
  return conflicts;
}

/**
 * 生成请求中的参考图输入（#35 接入 Image Vendor 执行时使用，#38 扩展）。
 * 无参考图时返回空数组且调用方必须整体省略参考图字段——不生成占位图，
 * 不发送虚假引用。Derived Asset 一律返回空人工引用输入。
 */
export function buildGenerationReferenceInputs(
  references: readonly AssetReferenceRecord[],
  asset?: AssetParentLinkage | null,
): Array<{ id: number; mediaPath: string; description: string; visualRole: string; requiredTransfers: string[]; exclusions: string[] }> {
  if (isDerivedAsset(asset)) return [];
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

/* ---------------------------------------------------------------------------
 * Issue #35：Asset 图片生成契约（单个与批量）。
 *
 * 单个与批量图片生成由后端从同一领域契约解析持久化的最终 prompt 与
 * 有序 Asset References（服务端解析），前端不再走 legacy 临时参考图
 * 上传路径（本地 FileReader → base64）：
 * - 生成请求沿用既有端点 /assetsGenerate/generateAssets 与
 *   /assetsGenerate/batchGenerateImageAssets 的字段形状，不携带 base64，
 *   也不携带任何参考图占位字段；0 张参考图的资产保持纯文本请求。
 * - buildGenerationReferenceInputs 的输出在发送前做本地校验与形状归一：
 *   0 张返回空数组（调用方整体省略参考图字段），1~6 张保持用户排序与
 *   人工意图，第 7 张或描述缺失在提交前被阻止。
 * - 后端稳定错误信封 kind 经 ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS
 *   映射为用户可理解的 i18n 文案键（7 个语言文件同步维护）。
 * ------------------------------------------------------------------------- */

/** 生成参考图输入（buildGenerationReferenceInputs 的输出形状）。 */
export type GenerationReferenceInput = ReturnType<typeof buildGenerationReferenceInputs>[number];

/**
 * 后端 Asset Prompt 域稳定错误 kind（assetBriefContract.ts 的
 * AssetPromptFailureKind 镜像）。图片生成链路经提示词记录解析可达。
 */
export type AssetPromptFailureKind =
  | "invalidRequest"
  | "projectNotFound"
  | "assetNotFound"
  | "assetProjectMismatch"
  | "unsupportedAssetType"
  | "scriptNotFound"
  | "visualManualMissing"
  | "skillContractMissing"
  | "malformedOutput"
  | "missingAssetResult"
  | "duplicateAssetResult"
  | "unknownAssetResult"
  | "assetTypeMismatch"
  | "derivedMismatch"
  | "referenceBindingMismatch"
  | "analysisFailed"
  | "languageProfileNotAvailable"
  | "promptNotGenerated"
  | "stalePromptRecord"
  | "referenceLimitExceeded";

/**
 * Derived Asset 父资产锚点/变化契约稳定错误 kind（后端 Issue #37 错误族的
 * 前端镜像，#37 落地后须逐项核对）。错误字符串不得散落在 Vue 组件中，
 * 统一经 ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS 映射。
 */
export type DerivedAssetFailureKind =
  | "derivedAssetReferenceForbidden"
  | "parentAssetMissing"
  | "parentAssetAnchorMissing"
  | "parentAssetAnchorUnauthorized"
  | "parentAssetAnchorUnreadable"
  | "derivedChangeInstructionMissing"
  | "derivedChangeInstructionInvalid"
  | "derivedPromptCompilationFailed";

/** 后端图片生成专属稳定错误 kind（assetImageGeneration.ts 的扩展 kind）。 */
export type AssetImageGenerationBackendFailureKind =
  | AssetPromptFailureKind
  | DerivedAssetFailureKind
  | "referenceMediaUnreadable"
  | "referenceMediaInvalid"
  | "imageGenerationFailed"
  | "imagePersistenceFailed"
  | "cancelled";

/** 生成流程本地校验失败 kind：后端稳定错误 kind + 前端提示词校验。 */
export type AssetImageGenerationFailureKind =
  | AssetReferenceFailureKind
  | AssetImageGenerationBackendFailureKind
  | "promptRequired";

/** 生成流程失败（含本地校验与后端稳定错误）。 */
export interface AssetImageGenerationFailure {
  kind: AssetImageGenerationFailureKind;
  message: string;
}

/** 稳定错误 kind → 用户可理解文案的 i18n 键（7 个语言文件同步维护）。 */
export const ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS: Record<AssetImageGenerationFailureKind, string> = {
  // Asset Reference 域（Issue #34）
  projectNotFound: "workbench.assets.gen.errors.projectNotFound",
  assetNotFound: "workbench.assets.gen.errors.assetNotFound",
  assetProjectMismatch: "workbench.assets.gen.errors.assetProjectMismatch",
  referenceNotFound: "workbench.assets.gen.errors.referenceNotFound",
  referenceLimitExceeded: "workbench.assets.gen.errors.referenceLimitExceeded",
  descriptionRequired: "workbench.assets.gen.errors.descriptionRequired",
  invalidMedia: "workbench.assets.gen.errors.invalidMedia",
  orderMismatch: "workbench.assets.gen.errors.orderMismatch",
  // Asset Prompt 域（生成链路经提示词记录解析可达，Issue #35）
  invalidRequest: "workbench.assets.gen.errors.invalidRequest",
  unsupportedAssetType: "workbench.assets.gen.errors.unsupportedAssetType",
  scriptNotFound: "workbench.assets.gen.errors.scriptNotFound",
  visualManualMissing: "workbench.assets.gen.errors.visualManualMissing",
  skillContractMissing: "workbench.assets.gen.errors.skillContractMissing",
  malformedOutput: "workbench.assets.gen.errors.malformedOutput",
  missingAssetResult: "workbench.assets.gen.errors.missingAssetResult",
  duplicateAssetResult: "workbench.assets.gen.errors.duplicateAssetResult",
  unknownAssetResult: "workbench.assets.gen.errors.unknownAssetResult",
  assetTypeMismatch: "workbench.assets.gen.errors.assetTypeMismatch",
  derivedMismatch: "workbench.assets.gen.errors.derivedMismatch",
  referenceBindingMismatch: "workbench.assets.gen.errors.referenceBindingMismatch",
  analysisFailed: "workbench.assets.gen.errors.analysisFailed",
  languageProfileNotAvailable: "workbench.assets.gen.errors.languageProfileNotAvailable",
  promptNotGenerated: "workbench.assets.gen.errors.promptNotGenerated",
  stalePromptRecord: "workbench.assets.gen.errors.stalePromptRecord",
  // 图片生成专属（Issue #35）
  referenceMediaUnreadable: "workbench.assets.gen.errors.referenceMediaUnreadable",
  referenceMediaInvalid: "workbench.assets.gen.errors.referenceMediaInvalid",
  imageGenerationFailed: "workbench.assets.gen.errors.imageGenerationFailed",
  imagePersistenceFailed: "workbench.assets.gen.errors.imagePersistenceFailed",
  cancelled: "workbench.assets.gen.errors.cancelled",
  // Derived Asset 父资产锚点/变化契约（Issue #38，镜像 #37 错误族）
  derivedAssetReferenceForbidden: "workbench.assets.gen.errors.derivedAssetReferenceForbidden",
  parentAssetMissing: "workbench.assets.gen.errors.parentAssetMissing",
  parentAssetAnchorMissing: "workbench.assets.gen.errors.parentAssetAnchorMissing",
  parentAssetAnchorUnauthorized: "workbench.assets.gen.errors.parentAssetAnchorUnauthorized",
  parentAssetAnchorUnreadable: "workbench.assets.gen.errors.parentAssetAnchorUnreadable",
  derivedChangeInstructionMissing: "workbench.assets.gen.errors.derivedChangeInstructionMissing",
  derivedChangeInstructionInvalid: "workbench.assets.gen.errors.derivedChangeInstructionInvalid",
  derivedPromptCompilationFailed: "workbench.assets.gen.errors.derivedPromptCompilationFailed",
  // 本地校验
  promptRequired: "workbench.assets.gen.errors.promptRequired",
};

/**
 * 把失败 kind 经注入的翻译函数（调用方传 window.$t）映射为用户可理解
 * 文案；未知 kind、无 kind 或翻译缺失时回退到原始 message。
 */
export function assetImageGenerationFailureText(
  failure: { kind?: AssetImageGenerationFailureKind | string; message?: string },
  translate: (key: string) => string,
): string {
  const kind = failure.kind;
  if (kind && typeof kind === "string" && kind in ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS) {
    const key = ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS[kind as AssetImageGenerationFailureKind];
    const text = translate(key);
    if (text && text !== key) return text;
  }
  // 未知错误安全兜底：优先保留后端原始 message；缺失时经 i18n 键取通用文案，
  // 翻译不可用时回退内置中文，绝不让错误被静默吞掉。
  const message = typeof failure.message === "string" ? failure.message.trim() : "";
  if (message) return message;
  const genericKey = "workbench.assets.gen.errors.unknownFailure";
  const generic = translate(genericKey);
  if (generic && generic !== genericKey) return generic;
  return "请求失败，请重试";
}

/** 单资产生成请求体（POST /assetsGenerate/generateAssets）。参考图由服务端解析。 */
export interface SingleAssetImageGenerationRequest {
  type: string;
  projectId: number;
  name: string;
  prompt: string;
  model: string;
  id: number;
  resolution: string;
}

/** 批量生成请求体（POST /assetsGenerate/batchGenerateImageAssets）。 */
export interface BatchAssetImageGenerationRequest {
  projectId: number;
  model: string;
  resolution: string;
  concurrentCount: number;
  items: Array<{ id: number; type: string; name: string; prompt: string }>;
}

/**
 * 发送前的参考图本地校验与形状归一（#35，#38 扩展衍生资产边界）。
 * Derived Asset 一律返回空人工引用（父资产锚点由后端自动解析）；基础资产
 * 0 张参考图返回空数组（调用方整体省略参考图字段，不发送占位引用）；
 * 1~6 张保持用户排序与人工意图；第 7 张与描述缺失在提交前被阻止。
 */
export function resolveGenerationReferences(
  references: readonly AssetReferenceRecord[],
  asset?: AssetParentLinkage | null,
): { ok: true; inputs: GenerationReferenceInput[] } | { ok: false; failure: AssetImageGenerationFailure } {
  // Derived Asset：人工引用必须为 0。旧 hydrate 数据或伪造本地状态中携带的
  // 参考图在此被丢弃（不提交、不报错、不修改输入），防止绕过限制。
  if (isDerivedAsset(asset)) {
    return { ok: true, inputs: [] };
  }
  if (references.length > ASSET_REFERENCE_LIMIT) {
    return { ok: false, failure: { kind: "referenceLimitExceeded", message: "单个资产最多支持 6 张参考图" } };
  }
  for (const reference of references) {
    if (typeof reference.description !== "string" || reference.description.trim().length === 0) {
      return { ok: false, failure: { kind: "descriptionRequired", message: "参考图描述为必填项，本版本必须由人工撰写" } };
    }
  }
  return { ok: true, inputs: buildGenerationReferenceInputs(references) };
}

function resolveGenerationPrompt(
  prompt: string,
  asset?: AssetParentLinkage | null,
): { ok: true; prompt: string } | { ok: false; failure: AssetImageGenerationFailure } {
  const trimmed = typeof prompt === "string" ? prompt.trim() : "";
  // Derived Asset 的最终提示词由后端根据 Parent Asset Anchor 与变化契约
  // 确定性编译；新建记录在首次生成前可以没有前端缓存 prompt。
  if (!trimmed && isDerivedAsset(asset)) return { ok: true, prompt: "" };
  if (!trimmed) {
    return { ok: false, failure: { kind: "promptRequired", message: "请填写提示词" } };
  }
  return { ok: true, prompt: trimmed };
}

/**
 * 单资产生成请求构建（发送前本地校验）。
 * 校验失败返回稳定失败，不产生请求；成功时请求保持既有端点字段形状，
 * 不携带 base64 与任何参考图占位字段（参考图由服务端解析持久化配置）。
 */
export function buildSingleAssetImageGenerationRequest(
  input: {
    projectId: number;
    id: number;
    type: string;
    name: string;
    prompt: string;
    model: string;
    resolution: string;
    references: readonly AssetReferenceRecord[];
    asset?: AssetParentLinkage | null;
  },
): { ok: true; request: SingleAssetImageGenerationRequest; referenceInputs: GenerationReferenceInput[] } | { ok: false; failure: AssetImageGenerationFailure } {
  const prompt = resolveGenerationPrompt(input.prompt, input.asset);
  if (!prompt.ok) return prompt;
  const references = resolveGenerationReferences(input.references, input.asset);
  if (!references.ok) return references;
  return {
    ok: true,
    request: {
      type: input.type,
      projectId: input.projectId,
      name: input.name,
      prompt: prompt.prompt,
      model: input.model,
      id: input.id,
      resolution: input.resolution,
    },
    referenceInputs: references.inputs,
  };
}

/** 批量生成中单个资产的输入（含发送前加载的持久化参考图与父子关系字段）。 */
export interface BatchGenerationAssetInput {
  id: number;
  type: string;
  name: string;
  prompt: string;
  references: readonly AssetReferenceRecord[];
  asset?: AssetParentLinkage | null;
}

export interface BatchGenerationResolvedAsset {
  id: number;
  type: string;
  name: string;
  prompt: string;
  referenceInputs: GenerationReferenceInput[];
}

export interface BatchGenerationSkippedAsset {
  name: string;
  failure: AssetImageGenerationFailure;
}

/**
 * 批量生成发送前的逐资产校验（#35）：参考图配置或提示词无效的资产进入
 * skipped（调用方提示并保留其配置，可修正后重试），其余资产保序进入
 * submittable。全部无效时 submittable 为空，调用方据此不发送请求。
 */
export function resolveBatchGenerationAssets(assets: readonly BatchGenerationAssetInput[]): {
  submittable: BatchGenerationResolvedAsset[];
  skipped: BatchGenerationSkippedAsset[];
} {
  const submittable: BatchGenerationResolvedAsset[] = [];
  const skipped: BatchGenerationSkippedAsset[] = [];
  for (const asset of assets) {
    const prompt = resolveGenerationPrompt(asset.prompt, asset.asset);
    if (!prompt.ok) {
      skipped.push({ name: asset.name, failure: prompt.failure });
      continue;
    }
    const references = resolveGenerationReferences(asset.references, asset.asset);

    if (!references.ok) {
      skipped.push({ name: asset.name, failure: references.failure });
      continue;
    }
    submittable.push({ id: asset.id, type: asset.type, name: asset.name, prompt: prompt.prompt, referenceInputs: references.inputs });
  }
  return { submittable, skipped };
}

/**
 * 批量生成请求构建（输入应为 resolveBatchGenerationAssets 的 submittable）。
 * 沿用既有 batchGenerateImageAssets 字段形状，不携带 base64 与参考图数据。
 */
export function buildBatchAssetImageGenerationRequest(input: {
  projectId: number;
  model: string;
  resolution: string;
  concurrentCount: number;
  assets: ReadonlyArray<BatchGenerationResolvedAsset>;
}): { ok: true; request: BatchAssetImageGenerationRequest; referenceInputs: GenerationReferenceInput[] } | { ok: false; failure: AssetImageGenerationFailure } {
  if (input.assets.length === 0) {
    return { ok: false, failure: { kind: "promptRequired", message: "没有可提交的资产" } };
  }
  const referenceInputs: GenerationReferenceInput[] = [];
  const items: BatchAssetImageGenerationRequest["items"] = input.assets.map((asset) => {
    referenceInputs.push(...asset.referenceInputs);
    return { id: asset.id, type: asset.type, name: asset.name, prompt: asset.prompt };
  });
  return {
    ok: true,
    request: {
      projectId: input.projectId,
      model: input.model,
      resolution: input.resolution,
      concurrentCount: input.concurrentCount,
      items,
    },
    referenceInputs,
  };
}
