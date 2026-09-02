import axios from "@/utils/axios";
import {
  buildCreateReferenceRequest,
  buildDeleteReferenceRequest,
  buildListReferencesRequest,
  buildReorderReferencesRequest,
  buildUpdateAssetPromptRequest,
  buildUpdateReferenceRequest,
  canAddReference,
  isDerivedAsset,
  makeReferenceMutationFailure,
  parseReferenceError,
  parseReferenceListResponse,
  type AssetParentLinkage,
  type AssetReferenceDraft,
  type AssetReferenceFailureKind,
  type AssetReferenceRecord,
} from "@/assetReferenceContract";

/** 界面可展示的失败：优先使用后端稳定错误信封。 */
export interface AssetReferenceFailure {
  kind?: AssetReferenceFailureKind;
  message: string;
}

export interface AssetPromptSaveInput {
  id: number;
  name: string;
  describe: string;
  remark?: string | null;
  prompt: string;
}

/**
 * 单个资产的参考图请求编排（Issue #34）。
 * 页面组件只负责渲染与事件接线；所有请求构建与错误归一化都经由
 * src/assetReferenceContract.ts，不重新发明字段。
 */
export function useAssetReferences(
  getIds: () => { projectId?: number | string | null; assetsId?: number | null },
  getAsset?: () => AssetParentLinkage | null | undefined,
) {
  const references = ref<AssetReferenceRecord[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const failure = ref<AssetReferenceFailure | null>(null);

  /**
   * Derived Asset 边界（Issue #38）：人工参考图仅属于基础资产。composable/
   * service 层再次阻止衍生资产的参考图 mutation，不能只靠隐藏按钮。
   */
  function derivedMutationGuard(): AssetReferenceFailure | null {
    return makeReferenceMutationFailure(getAsset?.());
  }

  function resolveIds(): { projectId: number; assetsId: number } | null {
    const { projectId, assetsId } = getIds();
    const project = Number(projectId);
    const asset = Number(assetsId);
    if (!Number.isFinite(project) || !Number.isFinite(asset) || asset <= 0) return null;
    return { projectId: project, assetsId: asset };
  }

  /** 加载参考图列表（含空状态）。Derived Asset 人工参考图必须为 0，不发请求。 */
  async function load(): Promise<boolean> {
    if (isDerivedAsset(getAsset?.())) {
      references.value = [];
      return true;
    }
    const ids = resolveIds();
    if (!ids) return false;
    loading.value = true;
    failure.value = null;
    try {
      const body = await axios.post("/assetReference/getAssetReference", buildListReferencesRequest(ids));
      references.value = parseReferenceListResponse(body);
      return true;
    } catch (error) {
      failure.value = parseReferenceError(error);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /** 上传参考图：第 7 张在前端提交前被阻止，描述必填。失败时保留草稿由调用方恢复。 */
  async function create(draft: AssetReferenceDraft & { base64: string }): Promise<AssetReferenceFailure | null> {
    const forbidden = derivedMutationGuard();
    if (forbidden) return forbidden;
    const ids = resolveIds();
    if (!ids) return { message: "缺少项目或资产上下文，无法保存参考图" };
    if (!canAddReference(references.value.length)) {
      return { kind: "referenceLimitExceeded", message: "单个资产最多支持 6 张参考图" };
    }
    let request: ReturnType<typeof buildCreateReferenceRequest>;
    try {
      request = buildCreateReferenceRequest({ ...ids, ...draft });
    } catch (error) {
      return parseReferenceError(error);
    }
    saving.value = true;
    failure.value = null;
    try {
      await axios.post("/assetReference/addAssetReference", request);
      await load();
      return null;
    } catch (error) {
      failure.value = parseReferenceError(error);
      return failure.value;
    } finally {
      saving.value = false;
    }
  }

  /** 更新参考图的人工契约。 */
  async function update(id: number, draft: AssetReferenceDraft): Promise<AssetReferenceFailure | null> {
    const forbidden = derivedMutationGuard();
    if (forbidden) return forbidden;
    const ids = resolveIds();
    if (!ids) return { message: "缺少项目或资产上下文，无法保存参考图" };
    let request: ReturnType<typeof buildUpdateReferenceRequest>;
    try {
      request = buildUpdateReferenceRequest({ ...ids, id, ...draft });
    } catch (error) {
      return parseReferenceError(error);
    }
    saving.value = true;
    failure.value = null;
    try {
      await axios.post("/assetReference/updateAssetReference", request);
      await load();
      return null;
    } catch (error) {
      failure.value = parseReferenceError(error);
      return failure.value;
    } finally {
      saving.value = false;
    }
  }

  /** 删除参考图。 */
  async function remove(id: number): Promise<AssetReferenceFailure | null> {
    const forbidden = derivedMutationGuard();
    if (forbidden) return forbidden;
    const ids = resolveIds();
    if (!ids) return { message: "缺少项目或资产上下文，无法删除参考图" };
    saving.value = true;
    failure.value = null;
    try {
      await axios.post("/assetReference/delAssetReference", buildDeleteReferenceRequest({ ...ids, id }));
      await load();
      return null;
    } catch (error) {
      failure.value = parseReferenceError(error);
      return failure.value;
    } finally {
      saving.value = false;
    }
  }

  /** 上移/下移参考图：把界面顺序转换为完整 orderedIds 排列。 */
  async function move(id: number, direction: -1 | 1): Promise<AssetReferenceFailure | null> {
    const forbidden = derivedMutationGuard();
    if (forbidden) return forbidden;
    const ids = resolveIds();
    if (!ids) return { message: "缺少项目或资产上下文，无法排序参考图" };
    const orderedIds = references.value.map((item) => item.id);
    const from = orderedIds.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= orderedIds.length) return null;
    [orderedIds[from], orderedIds[to]] = [orderedIds[to], orderedIds[from]];
    saving.value = true;
    failure.value = null;
    try {
      await axios.post("/assetReference/reorderAssetReference", buildReorderReferencesRequest({ ...ids, orderedIds }));
      await load();
      return null;
    } catch (error) {
      failure.value = parseReferenceError(error);
      return failure.value;
    } finally {
      saving.value = false;
    }
  }

  /** 保存最终图片提示词（复用现有 /assets/updateAssets 路由）。 */
  async function savePrompt(input: AssetPromptSaveInput): Promise<AssetReferenceFailure | null> {
    saving.value = true;
    failure.value = null;
    try {
      await axios.post("/assets/updateAssets", buildUpdateAssetPromptRequest(input));
      return null;
    } catch (error) {
      failure.value = parseReferenceError(error);
      return failure.value;
    } finally {
      saving.value = false;
    }
  }

  const canAdd = computed(() => canAddReference(references.value.length));

  return { references, loading, saving, failure, canAdd, load, create, update, remove, move, savePrompt };
}
