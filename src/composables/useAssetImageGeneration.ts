import axios from "@/utils/axios";
import {
  assetImageGenerationFailureText,
  buildBatchAssetImageGenerationRequest,
  buildListReferencesRequest,
  buildSingleAssetImageGenerationRequest,
  isDerivedAsset,
  parseReferenceError,
  parseReferenceListResponse,
  resolveBatchGenerationAssets,
  type AssetImageGenerationFailureKind,
  type AssetParentLinkage,
  type AssetReferenceRecord,
  type BatchGenerationAssetInput,
} from "@/assetReferenceContract";

/** 界面可展示的失败：message 已本地化为用户可理解中文。 */
export interface AssetImageGenerationFailureView {
  kind?: AssetImageGenerationFailureKind;
  message: string;
}

/** 批量生成中被跳过的资产（保留配置，可修正后重试）。 */
export interface AssetImageGenerationSkippedAsset {
  name: string;
  message: string;
}

function toFailureView(failure: { kind?: string; message?: string }): AssetImageGenerationFailureView {
  const message = assetImageGenerationFailureText(failure, (key) => window.$t(key));
  return { kind: failure.kind as AssetImageGenerationFailureKind | undefined, message };
}

/**
 * Asset 图片生成请求编排（Issue #35）。
 *
 * 单个与批量生成的全部后端调用集中在此 seam，页面组件只负责渲染与
 * 事件接线：
 * - Derived Asset 边界（Issue #38）：仅凭后端父子关系字段识别衍生资产，
 *   人工参考图一律为空（父资产锚点由后端自动解析），不加载、不提交。
 * - 生成前经 /assetReference/getAssetReference 加载资产已持久化的参考图，
 *   并用契约纯函数做发送前本地校验与形状归一（0 张省略参考图、1~6 张
 *   保持用户排序、第 7 张与描述缺失阻止）。
 * - 生成请求沿用既有端点 /assetsGenerate/generateAssets 与
 *   /assetsGenerate/batchGenerateImageAssets，不携带 base64 或参考图数据
 *   （服务端解析持久化配置），legacy 临时参考图上传路径就此移除。
 * - 后端稳定错误信封 kind 映射为用户可理解中文；失败时调用方保留配置
 *   即可直接重试。
 */
export function useAssetImageGeneration() {
  /** 加载单个资产已持久化的参考图（含空状态）。Derived Asset 人工参考图必须为 0，不发请求。 */
  async function loadReferences(
    projectId: number,
    assetsId: number,
    asset?: AssetParentLinkage | null,
  ): Promise<{ ok: true; references: AssetReferenceRecord[] } | { ok: false; failure: AssetImageGenerationFailureView }> {
    if (isDerivedAsset(asset)) {
      return { ok: true, references: [] };
    }
    try {
      const body = await axios.post("/assetReference/getAssetReference", buildListReferencesRequest({ projectId, assetsId }));
      return { ok: true, references: parseReferenceListResponse(body) };
    } catch (error) {
      return { ok: false, failure: toFailureView(parseReferenceError(error)) };
    }
  }

  /**
   * 单资产生图：加载持久化参考图 → 发送前本地校验 → POST /assetsGenerate/generateAssets。
   * 参考图输入（0~6 张）由服务端从持久化配置解析；请求不携带 base64。
   */
  async function generateSingleAssetImage(input: {
    projectId: number;
    id: number;
    type: string;
    name: string;
    prompt: string;
    model: string;
    resolution: string;
    asset?: AssetParentLinkage | null;
  }): Promise<{ ok: true; referenceCount: number } | { ok: false; failure: AssetImageGenerationFailureView }> {
    const loaded = await loadReferences(input.projectId, input.id, input.asset);
    if (!loaded.ok) return loaded;
    const built = buildSingleAssetImageGenerationRequest({ ...input, references: loaded.references });
    if (!built.ok) return { ok: false, failure: toFailureView(built.failure) };
    try {
      await axios.post("/assetsGenerate/generateAssets", built.request);
      return { ok: true, referenceCount: built.referenceInputs.length };
    } catch (error) {
      return { ok: false, failure: toFailureView(parseReferenceError(error)) };
    }
  }

  /**
   * 批量生图：逐资产加载持久化参考图并发送前校验（无效资产进入 skipped，
   * 保留配置可修正后重试）→ POST /assetsGenerate/batchGenerateImageAssets。
   */
  async function generateBatchAssetImage(input: {
    projectId: number;
    model: string;
    resolution: string;
    concurrentCount: number;
    assets: ReadonlyArray<{ id: number; type: string; name: string; prompt: string; asset?: AssetParentLinkage | null }>;
  }): Promise<
    | { ok: true; submitted: Array<{ id: number; name: string; referenceCount: number }>; skipped: AssetImageGenerationSkippedAsset[] }
    | { ok: false; failure: AssetImageGenerationFailureView; skipped: AssetImageGenerationSkippedAsset[] }
  > {
    const skipped: AssetImageGenerationSkippedAsset[] = [];
    const loaded: BatchGenerationAssetInput[] = [];

    // 按 concurrentCount 分批加载参考图，避免大批量选中时瞬时并发请求过多
    const loadBatchSize = Math.max(1, Math.min(input.concurrentCount || 5, 10));
    const loadedResults: Array<{ asset: { id: number; type: string; name: string; prompt: string; asset?: AssetParentLinkage | null }; result: Awaited<ReturnType<typeof loadReferences>> }> = [];
    for (let i = 0; i < input.assets.length; i += loadBatchSize) {
      const slice = input.assets.slice(i, i + loadBatchSize);
      loadedResults.push(
        ...(await Promise.all(slice.map(async (asset) => ({ asset, result: await loadReferences(input.projectId, asset.id, asset.asset) })))),
      );
    }
    for (const { asset, result } of loadedResults) {
      if (!result.ok) {
        skipped.push({ name: asset.name, message: result.failure.message });
        continue;
      }
      loaded.push({ ...asset, references: result.references });
    }

    const resolved = resolveBatchGenerationAssets(loaded);
    for (const item of resolved.skipped) {
      skipped.push({ name: item.name, message: toFailureView(item.failure).message });
    }

    const built = buildBatchAssetImageGenerationRequest({
      projectId: input.projectId,
      model: input.model,
      resolution: input.resolution,
      concurrentCount: input.concurrentCount,
      assets: resolved.submittable,
    });
    if (!built.ok) {
      return { ok: false, failure: toFailureView(built.failure), skipped };
    }
    try {
      await axios.post("/assetsGenerate/batchGenerateImageAssets", built.request);
      return {
        ok: true,
        submitted: resolved.submittable.map((asset) => ({
          id: asset.id,
          name: asset.name,
          referenceCount: asset.referenceInputs.length,
        })),
        skipped,
      };
    } catch (error) {
      return { ok: false, failure: toFailureView(parseReferenceError(error)), skipped };
    }
  }

  return { loadReferences, generateSingleAssetImage, generateBatchAssetImage };
}
