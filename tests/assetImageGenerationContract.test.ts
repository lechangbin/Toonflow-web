import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS,
  ASSET_REFERENCE_LIMIT,
  assetImageGenerationFailureText,
  buildBatchAssetImageGenerationRequest,
  buildSingleAssetImageGenerationRequest,
  resolveBatchGenerationAssets,
  resolveGenerationReferences,
  type AssetReferenceFailureKind,
  type AssetReferenceRecord,
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

const SINGLE_INPUT = {
  projectId: 10,
  id: 100,
  type: "role",
  name: "皇帝",
  prompt: "最终提示词",
  model: "agnes-image-2.1-flash",
  resolution: "1K",
};

test("无参考图时单资产生成请求保持纯文本形态：不含 base64，也不含任何参考图占位字段", () => {
  const result = buildSingleAssetImageGenerationRequest({ ...SINGLE_INPUT, references: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.referenceInputs, []);
  assert.deepEqual(result.request, {
    type: "role",
    projectId: 10,
    name: "皇帝",
    prompt: "最终提示词",
    model: "agnes-image-2.1-flash",
    id: 100,
    resolution: "1K",
  });
  for (const forbidden of ["base64", "references", "referenceImages", "referenceInputs", "brief", "contrastMatrix", "systemPrompt"]) {
    assert.equal(forbidden in result.request, false, "生成请求不得包含 " + forbidden);
  }
});

test("单资产生成在提示词为空时被本地阻止，不发送请求", () => {
  for (const stalePrompt of ["", "   "]) {
    const result = buildSingleAssetImageGenerationRequest({ ...SINGLE_INPUT, prompt: stalePrompt, references: [] });
    assert.equal(result.ok, false, `提示词 "${stalePrompt}" 应被阻止`);
    if (!result.ok) {
      assert.equal(result.failure.kind, "promptRequired");
    }
  }
});

test("一至六张参考图通过校验，referenceInputs 与持久化顺序与人工意图一致", () => {
  for (const count of [1, 3, ASSET_REFERENCE_LIMIT]) {
    const references = makeOrderedReferences(count);
    const resolved = resolveGenerationReferences(references);
    assert.equal(resolved.ok, true, `${count} 张参考图应通过校验`);
    if (!resolved.ok) return;
    assert.equal(resolved.inputs.length, count);
    assert.deepEqual(
      resolved.inputs.map((item) => item.id),
      references.map((item) => item.id),
    );
    assert.deepEqual(
      resolved.inputs.map((item) => item.description),
      references.map((item) => item.description),
    );
  }

  // 用户排序（非 id 顺序）被完整保持
  const userOrdered = [makeRecord({ id: 5, orderIndex: 0 }), makeRecord({ id: 2, orderIndex: 1 }), makeRecord({ id: 9, orderIndex: 2 })];
  const resolved = resolveGenerationReferences(userOrdered);
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.deepEqual(
      resolved.inputs.map((item) => item.id),
      [5, 2, 9],
    );
  }
});

test("第七张参考图在提交前被阻止（referenceLimitExceeded），不构建请求", () => {
  const tooMany = makeOrderedReferences(ASSET_REFERENCE_LIMIT + 1);
  const resolved = resolveGenerationReferences(tooMany);
  assert.equal(resolved.ok, false);
  if (!resolved.ok) {
    assert.equal(resolved.failure.kind, "referenceLimitExceeded");
  }

  const result = buildSingleAssetImageGenerationRequest({ ...SINGLE_INPUT, references: tooMany });
  assert.equal(result.ok, false);
});

test("参考图人工描述缺失在提交前被阻止（descriptionRequired）", () => {
  const missingDescription = [makeRecord({ id: 1 }), makeRecord({ id: 2, description: "   " })];
  const resolved = resolveGenerationReferences(missingDescription);
  assert.equal(resolved.ok, false);
  if (!resolved.ok) {
    assert.equal(resolved.failure.kind, "descriptionRequired");
  }
});

test("校验失败不修改调用方传入的参考图数组（失败后保留用户配置，可直接重试）", () => {
  const references = makeOrderedReferences(ASSET_REFERENCE_LIMIT + 1);
  const snapshot = JSON.stringify(references);
  const result = buildSingleAssetImageGenerationRequest({ ...SINGLE_INPUT, references });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(references), snapshot);
  assert.equal(references.length, ASSET_REFERENCE_LIMIT + 1);
});

test("批量生成沿用既有 batchGenerateImageAssets 请求形状，逐资产归一参考图且不携带 base64", () => {
  const withNone = { id: 101, type: "role", name: "无参考图资产", prompt: "提示词 A", references: [] as AssetReferenceRecord[] };
  const withSome = {
    id: 102,
    type: "scene",
    name: "多参考图资产",
    prompt: "提示词 B",
    references: makeOrderedReferences(2),
  };
  const resolvedAssets = resolveBatchGenerationAssets([withNone, withSome]);
  assert.equal(resolvedAssets.skipped.length, 0);
  const result = buildBatchAssetImageGenerationRequest({
    projectId: 10,
    model: "agnes-image-2.1-flash",
    resolution: "2K",
    concurrentCount: 5,
    assets: resolvedAssets.submittable,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.request, {
    projectId: 10,
    model: "agnes-image-2.1-flash",
    resolution: "2K",
    concurrentCount: 5,
    items: [
      { id: 101, type: "role", name: "无参考图资产", prompt: "提示词 A" },
      { id: 102, type: "scene", name: "多参考图资产", prompt: "提示词 B" },
    ],
  });
  assert.deepEqual(result.referenceInputs.map((item) => item.id), [1, 2]);
  for (const item of result.request.items) {
    for (const forbidden of ["base64", "references", "referenceImages", "brief", "systemPrompt"]) {
      assert.equal(forbidden in item, false, "批量生成条目不得包含 " + forbidden);
    }
  }

  // 没有可提交资产时拒绝构建请求
  const empty = buildBatchAssetImageGenerationRequest({
    projectId: 10,
    model: "agnes-image-2.1-flash",
    resolution: "2K",
    concurrentCount: 5,
    assets: [],
  });
  assert.equal(empty.ok, false);
});

test("批量生成把参考图配置无效的资产识别为跳过项，其余资产仍可提交", () => {
  const good = { id: 101, type: "role", name: "正常资产", prompt: "提示词 A", references: makeOrderedReferences(1) };
  const tooMany = {
    id: 102,
    type: "scene",
    name: "超限资产",
    prompt: "提示词 B",
    references: makeOrderedReferences(ASSET_REFERENCE_LIMIT + 1),
  };
  const noDescription = { id: 103, type: "prop", name: "缺描述资产", prompt: "提示词 C", references: [makeRecord({ id: 1, description: "" })] };

  const resolved = resolveBatchGenerationAssets([good, tooMany, noDescription]);
  assert.deepEqual(resolved.submittable.map((item) => item.id), [101]);
  assert.deepEqual(
    resolved.skipped.map((item) => item.name),
    ["超限资产", "缺描述资产"],
  );
  assert.equal(resolved.skipped[0].failure.kind, "referenceLimitExceeded");
  assert.equal(resolved.skipped[1].failure.kind, "descriptionRequired");
  assert.equal(resolved.submittable[0].referenceInputs.length, 1);

  // 全部无效时没有可提交项，调用方据此终止而不发送请求
  const allInvalid = resolveBatchGenerationAssets([tooMany]);
  assert.equal(allInvalid.submittable.length, 0);
  assert.equal(allInvalid.skipped.length, 1);
});

test("批量生成在提示词为空时把该资产判定为跳过项（stale prompt 不发送）", () => {
  const resolved = resolveBatchGenerationAssets([
    { id: 101, type: "role", name: "正常资产", prompt: "提示词 A", references: [] },
    { id: 102, type: "role", name: "空提示词资产", prompt: "   ", references: [] },
  ]);
  assert.deepEqual(resolved.submittable.map((item) => item.id), [101]);
  assert.deepEqual(
    resolved.skipped.map((item) => item.failure.kind),
    ["promptRequired"],
  );
});

test("稳定错误 kind 与 i18n 键一一对应，覆盖全部后端 Asset Reference 错误", () => {
  const backendKinds: AssetReferenceFailureKind[] = [
    "projectNotFound",
    "assetNotFound",
    "assetProjectMismatch",
    "referenceNotFound",
    "referenceLimitExceeded",
    "descriptionRequired",
    "invalidMedia",
    "orderMismatch",
  ];
  for (const kind of backendKinds) {
    const key = ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS[kind];
    assert.equal(typeof key, "string", `kind ${kind} 缺少 i18n 键`);
    assert.ok(key.startsWith("workbench.assets.gen.errors."), `kind ${kind} 的 i18n 键应位于 workbench.assets.gen.errors 下`);
  }
  // 本地校验 kind 同样提供可展示文案键
  assert.equal(ASSET_IMAGE_GENERATION_FAILURE_I18N_KEYS.promptRequired, "workbench.assets.gen.errors.promptRequired");
});

test("失败 kind 经注入的翻译函数映射为用户可理解中文，未知 kind 与无 kind 回退原始 message", () => {
  const dictionary: Record<string, string> = {
    "workbench.assets.gen.errors.referenceLimitExceeded": "参考图数量超过上限（最多 6 张），请在资产配置中删除多余参考图",
    "workbench.assets.gen.errors.descriptionRequired": "参考图描述缺失，请在资产配置中补充人工描述",
  };
  const translate = (key: string) => dictionary[key] ?? key;

  assert.equal(
    assetImageGenerationFailureText({ kind: "referenceLimitExceeded", message: "单个资产最多支持 6 张参考图" }, translate),
    "参考图数量超过上限（最多 6 张），请在资产配置中删除多余参考图",
  );
  assert.equal(
    assetImageGenerationFailureText({ kind: "descriptionRequired", message: "原始后端消息" }, translate),
    "参考图描述缺失，请在资产配置中补充人工描述",
  );
  // 未知 kind（后端未来新增）与无 kind 的错误回退到 message
  assert.equal(assetImageGenerationFailureText({ kind: "futureKind" as AssetReferenceFailureKind, message: "未来错误消息" }, translate), "未来错误消息");
  assert.equal(assetImageGenerationFailureText({ message: "网络错误" }, translate), "网络错误");
  assert.equal(assetImageGenerationFailureText({}, translate), "请求失败，请重试");
});
