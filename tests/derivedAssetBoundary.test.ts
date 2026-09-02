import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS,
  assetImageGenerationFailureText,
  buildGenerationReferenceInputs,
  buildSingleAssetImageGenerationRequest,
  isDerivedAsset,
  makeReferenceMutationFailure,
  resolveBatchGenerationAssets,
  resolveGenerationReferences,
  type AssetReferenceRecord,
  type DerivedAssetFailureKind,
} from "../src/assetReferenceContract.ts";

function makeRecord(overrides: Partial<AssetReferenceRecord> = {}): AssetReferenceRecord {
  return {
    id: 1,
    projectId: 10,
    assetsId: 100,
    mediaPath: "/10/assetReferences/a.png",
    mediaMime: "image/png",
    orderIndex: 0,
    description: "正面全身定妆照",
    descriptionSource: "manual",
    analysisState: "not_requested",
    visualRole: "定妆照",
    requiredTransfers: ["红色官袍"],
    exclusions: ["背景"],
    createTime: 1,
    updateTime: 1,
    ...overrides,
  };
}

function makeOrderedReferences(count: number): AssetReferenceRecord[] {
  return Array.from({ length: count }, (_, index) =>
    makeRecord({
      id: index + 1,
      orderIndex: index,
      mediaPath: `/10/assetReferences/r${index + 1}.png`,
      description: `第 ${index + 1} 张参考图的人工描述`,
      visualRole: `角色设定 ${index + 1}`,
    }),
  );
}

/** 父资产行（getAssetsApi 返回 assetsId 为 null 的基础资产）。 */
const BASE_ASSET = { id: 100, assetsId: null as number | null };
/** 子资产行（getAssetsApi 返回 assetsId 指向父资产的 Derived Asset）。 */
const DERIVED_ASSET = { id: 200, assetsId: 100 };

const SINGLE_INPUT = {
  projectId: 10,
  id: 200,
  type: "role",
  name: "夜行皇帝",
  prompt: "最终提示词",
  model: "agnes-image-2.1-flash",
  resolution: "1K",
};

test("isDerivedAsset 仅凭后端父子关系字段识别衍生资产，不依赖名称或 UI 位置", () => {
  assert.equal(isDerivedAsset(BASE_ASSET), false);
  assert.equal(isDerivedAsset(DERIVED_ASSET), true);
  assert.equal(isDerivedAsset({ id: 1, assetsId: 0 }), false);
  assert.equal(isDerivedAsset({ id: 1 }), false);
  assert.equal(isDerivedAsset(null), false);
  assert.equal(isDerivedAsset(undefined), false);
});

test("衍生资产的参考图 mutation 在契约层被稳定拒绝（derivedAssetReferenceForbidden）", () => {
  const failure = makeReferenceMutationFailure(DERIVED_ASSET);
  assert.equal(failure.kind, "derivedAssetReferenceForbidden");
  assert.equal(typeof failure.message, "string");
  assert.ok(failure.message.length > 0);

  // 基础资产不产生拒绝
  assert.equal(makeReferenceMutationFailure(BASE_ASSET), null);
  assert.equal(makeReferenceMutationFailure(null), null);
});

test("buildGenerationReferenceInputs 对 Derived Asset 必须返回空人工引用输入", () => {
  const references = makeOrderedReferences(3);
  assert.deepEqual(buildGenerationReferenceInputs(references, DERIVED_ASSET), []);
  // 基础资产行为保持不变
  assert.equal(buildGenerationReferenceInputs(references, BASE_ASSET).length, 3);
  // 兼容旧调用（未提供资产上下文时按基础资产处理）
  assert.equal(buildGenerationReferenceInputs(references).length, 3);
});

test("旧 hydrate 数据中带参考图的 Derived Asset 不会被提交：校验直接归一为空引用", () => {
  const legacyHydrated = makeOrderedReferences(6);
  const resolved = resolveGenerationReferences(legacyHydrated, DERIVED_ASSET);
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.deepEqual(resolved.inputs, []);
  }
  // 输入数组不被修改（保留现场，可诊断）
  assert.equal(legacyHydrated.length, 6);
});

test("单资产生成对 Derived Asset 构建出无人工参考图的请求，最终提示词仍正常提交", () => {
  const result = buildSingleAssetImageGenerationRequest({
    ...SINGLE_INPUT,
    references: makeOrderedReferences(2),
    asset: DERIVED_ASSET,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.referenceInputs, []);
  assert.equal(result.request.prompt, "最终提示词");
  assert.equal(result.request.id, 200);
});

test("基础资产在 0、1、6 张人工参考图下行为不回归（#34/#35 保留）", () => {
  for (const count of [0, 1, 6]) {
    const references = makeOrderedReferences(count);
    const resolved = resolveGenerationReferences(references, BASE_ASSET);
    assert.equal(resolved.ok, true, `${count} 张参考图应通过校验`);
    if (resolved.ok) {
      assert.equal(resolved.inputs.length, count);
    }
    const result = buildSingleAssetImageGenerationRequest({
      ...SINGLE_INPUT,
      id: 100,
      references,
      asset: BASE_ASSET,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.referenceInputs.length, count);
    }
  }
});

test("批量生成把 Derived Asset 的人工参考图归一为空，其余资产不受影响", () => {
  const resolved = resolveBatchGenerationAssets([
    { id: 101, type: "role", name: "基础资产", prompt: "提示词 A", references: makeOrderedReferences(2), asset: BASE_ASSET },
    { id: 201, type: "role", name: "衍生资产", prompt: "提示词 B", references: makeOrderedReferences(3), asset: DERIVED_ASSET },
  ]);
  assert.equal(resolved.skipped.length, 0);
  assert.equal(resolved.submittable.length, 2);
  assert.equal(resolved.submittable[0].referenceInputs.length, 2);
  assert.deepEqual(resolved.submittable[1].referenceInputs, []);
});

test("衍生边界错误 kind 与 i18n 键一一对应，全部集中在契约模块维护", () => {
  const derivedKinds: DerivedAssetFailureKind[] = [
    "derivedAssetReferenceForbidden",
    "parentAssetMissing",
    "parentAssetAnchorMissing",
    "parentAssetAnchorUnauthorized",
    "parentAssetAnchorUnreadable",
    "derivedChangeInstructionMissing",
    "derivedChangeInstructionInvalid",
    "derivedPromptCompilationFailed",
  ];
  for (const kind of derivedKinds) {
    const key = ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS[kind];
    assert.equal(typeof key, "string", `kind ${kind} 缺少 i18n 键`);
    assert.equal(key, `workbench.assets.gen.errors.${kind}`, `kind ${kind} 的 i18n 键应与 kind 一一对应`);
  }
});

test("父资产锚点/变化契约错误经注入翻译函数映射为用户可理解中文", () => {
  const dictionary: Record<string, string> = {
    "workbench.assets.gen.errors.derivedAssetReferenceForbidden": "衍生资产不支持人工参考图，图片将自动继承父资产当前图片",
    "workbench.assets.gen.errors.parentAssetAnchorMissing": "父资产暂无已确认的图片，请先为父资产生成并确认图片",
    "workbench.assets.gen.errors.derivedPromptCompilationFailed": "衍生资产提示词编译失败，请重试或重新分析该衍生资产",
  };
  const translate = (key: string) => dictionary[key] ?? key;

  assert.equal(
    assetImageGenerationFailureText({ kind: "derivedAssetReferenceForbidden", message: "原始后端消息" }, translate),
    "衍生资产不支持人工参考图，图片将自动继承父资产当前图片",
  );
  assert.equal(
    assetImageGenerationFailureText({ kind: "parentAssetAnchorMissing", message: "原始后端消息" }, translate),
    "父资产暂无已确认的图片，请先为父资产生成并确认图片",
  );
  assert.equal(
    assetImageGenerationFailureText({ kind: "derivedPromptCompilationFailed", message: "" }, translate),
    "衍生资产提示词编译失败，请重试或重新分析该衍生资产",
  );
});

test("未知错误有安全兜底，不会被静默吞掉", () => {
  const translate = (key: string) => (key === "workbench.assets.gen.errors.unknownFailure" ? "请求失败，请重试" : key);
  // 未知 kind：回退到原始 message（不吞掉后端信息）
  assert.equal(
    assetImageGenerationFailureText({ kind: "futureDerivedKind" as unknown as DerivedAssetFailureKind, message: "后端新错误" }, translate),
    "后端新错误",
  );
  // 未知 kind 且无 message：通用兜底文案
  assert.equal(
    assetImageGenerationFailureText({ kind: "futureDerivedKind" as unknown as DerivedAssetFailureKind }, translate),
    "请求失败，请重试",
  );
  // 完全空的失败对象：通用兜底文案
  assert.equal(assetImageGenerationFailureText({}, translate), "请求失败，请重试");
});

test("衍生边界校验失败不改变调用方传入状态（retry 后用户状态不丢失）", () => {
  const references = makeOrderedReferences(2);
  const snapshot = JSON.stringify(references);
  const resolved = resolveGenerationReferences(references, DERIVED_ASSET);
  assert.equal(resolved.ok, true);
  assert.equal(JSON.stringify(references), snapshot);

  const result = buildSingleAssetImageGenerationRequest({ ...SINGLE_INPUT, references, asset: DERIVED_ASSET });
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(references), snapshot);
  // 提示词等其余输入不被改写
  if (result.ok) {
    assert.equal(result.request.prompt, "最终提示词");
    assert.equal(result.request.model, "agnes-image-2.1-flash");
  }
});
