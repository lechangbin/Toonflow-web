import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSET_REFERENCE_LIMIT,
  buildCreateReferenceRequest,
  buildDeleteReferenceRequest,
  buildGenerationReferenceInputs,
  buildListReferencesRequest,
  buildReorderReferencesRequest,
  buildUpdateAssetPromptRequest,
  buildUpdateReferenceRequest,
  canAddReference,
  findControlledDimensionConflicts,
  hydrateAssetConfig,
  isAssetReferenceErrorEnvelope,
  normalizeTagInput,
  parseReferenceError,
  parseReferenceListResponse,
  referenceMediaUrl,
  validateReferenceDraft,
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

test("参考图数量上限固定为 6，第 7 张在前端提交前被阻止", () => {
  assert.equal(ASSET_REFERENCE_LIMIT, 6);
  assert.deepEqual(
    [0, 1, 5, 6, 7].map(canAddReference),
    [true, true, true, false, false],
  );
});

test("空状态是合法状态：列表响应解析出空数组，不伪造参考图", () => {
  assert.deepEqual(parseReferenceListResponse({ code: 200, data: { list: [], total: 0 }, message: "成功" }), []);
  // 直接命中后端空 data 容错
  assert.deepEqual(parseReferenceListResponse({ code: 200, data: null, message: "成功" }), []);
});

test("列表响应按后端持久化顺序还原参考图记录", () => {
  const records = [makeRecord(), makeRecord({ id: 2, orderIndex: 1 })];
  const parsed = parseReferenceListResponse({ code: 200, data: { list: records, total: 2 }, message: "成功" });
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map((item) => item.id), [1, 2]);
  assert.equal(parsed[0].descriptionSource, "manual");
  assert.equal(parsed[0].analysisState, "not_requested");
});

test("旧数据兼容：缺失媒体 MIME 与标签数组的记录仍可解析", () => {
  const legacy = {
    ...makeRecord(),
    mediaMime: null,
    requiredTransfers: null,
    exclusions: null,
    visualRole: null,
  };
  const parsed = parseReferenceListResponse({ code: 200, data: { list: [legacy], total: 1 }, message: "成功" });
  assert.equal(parsed[0].mediaMime, null);
  assert.deepEqual(parsed[0].requiredTransfers, []);
  assert.deepEqual(parsed[0].exclusions, []);
  assert.equal(parsed[0].visualRole, "");
});

test("上传参考图时人工描述必填，空白描述不能提交", () => {
  const missing = validateReferenceDraft({ description: "" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.failure.kind, "descriptionRequired");

  const blank = validateReferenceDraft({ description: "   " });
  assert.equal(blank.ok, false);

  const valid = validateReferenceDraft({ description: " 正面定妆照 " });
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.value.description, "正面定妆照");
});

test("标签输入按逗号（含中文逗号）和换行拆分，去空白去空项", () => {
  assert.deepEqual(normalizeTagInput("红色官袍, 黑金头冠\n 蟒纹腰带 ,,"), ["红色官袍", "黑金头冠", "蟒纹腰带"]);
  assert.deepEqual(normalizeTagInput("红色官袍，黑金头冠"), ["红色官袍", "黑金头冠"]);
  assert.deepEqual(normalizeTagInput(["a", " b ", "", "c"]), ["a", "b", "c"]);
  assert.deepEqual(normalizeTagInput(""), []);
});

test("创建请求携带完整人工契约且不含任何中间 Brief 或模板字段", () => {
  const request = buildCreateReferenceRequest({
    projectId: 10,
    assetsId: 100,
    base64: "data:image/png;base64,AAAA",
    description: " 正面定妆照 ",
    visualRole: " 定妆照 ",
    requiredTransfers: ["红色官袍"],
    exclusions: ["背景"],
  });
  assert.deepEqual(request, {
    projectId: 10,
    assetsId: 100,
    base64: "data:image/png;base64,AAAA",
    description: "正面定妆照",
    visualRole: "定妆照",
    requiredTransfers: ["红色官袍"],
    exclusions: ["背景"],
  });
  for (const forbidden of ["brief", "worldBible", "contrastMatrix", "template", "systemPrompt"]) {
    assert.equal(forbidden in request, false, "创建请求不得包含 " + forbidden);
  }
});

test("创建请求在描述缺失时抛出稳定错误", () => {
  assert.throws(
    () =>
      buildCreateReferenceRequest({
        projectId: 10,
        assetsId: 100,
        base64: "data:image/png;base64,AAAA",
        description: "  ",
      }),
    /描述为必填/,
  );
});

test("更新请求只发送变更字段，描述一旦提供必须非空", () => {
  const request = buildUpdateReferenceRequest({
    projectId: 10,
    assetsId: 100,
    id: 1,
    description: " 更新后的描述 ",
    visualRole: "侧脸照",
  });
  assert.deepEqual(request, {
    projectId: 10,
    assetsId: 100,
    id: 1,
    description: "更新后的描述",
    visualRole: "侧脸照",
  });
  assert.equal("requiredTransfers" in request, false);
  assert.equal("exclusions" in request, false);

  assert.throws(
    () => buildUpdateReferenceRequest({ projectId: 10, assetsId: 100, id: 1, description: "" }),
    /描述为必填/,
  );
});

test("排序请求把界面顺序转换为完整 orderedIds 排列", () => {
  const request = buildReorderReferencesRequest({ projectId: 10, assetsId: 100, orderedIds: [3, 1, 2] });
  assert.deepEqual(request, { projectId: 10, assetsId: 100, orderedIds: [3, 1, 2] });
});

test("删除请求携带目标参考图 id", () => {
  assert.deepEqual(buildDeleteReferenceRequest({ projectId: 10, assetsId: 100, id: 5 }), {
    projectId: 10,
    assetsId: 100,
    id: 5,
  });
});

test("列表请求复用后端 getAssetReference 路由参数", () => {
  assert.deepEqual(buildListReferencesRequest({ projectId: 10, assetsId: 100 }), { projectId: 10, assetsId: 100 });
});

test("最终提示词保存复用现有 /assets/updateAssets 路由且不携带中间产物", () => {
  const request = buildUpdateAssetPromptRequest({
    id: 100,
    name: " 皇帝 ",
    describe: " 九五之尊 ",
    remark: null,
    prompt: "  最终提示词  ",
  });
  assert.deepEqual(request, {
    id: 100,
    name: "皇帝",
    describe: "九五之尊",
    remark: "",
    prompt: "最终提示词",
  });
  for (const forbidden of ["brief", "worldBible", "contrastMatrix", "template", "systemPrompt"]) {
    assert.equal(forbidden in request, false, "提示词保存请求不得包含 " + forbidden);
  }
});

test("后端稳定错误信封被识别并还原 kind 与 message", () => {
  const envelope = { code: 400, data: null, message: "单个资产最多支持 6 张参考图", error: "referenceLimitExceeded" };
  assert.equal(isAssetReferenceErrorEnvelope(envelope), true);
  const parsed = parseReferenceError(envelope);
  assert.equal(parsed.kind, "referenceLimitExceeded");
  assert.equal(parsed.message, "单个资产最多支持 6 张参考图");

  const description = parseReferenceError({ code: 400, data: null, message: "参考图描述为必填项，本版本必须由人工撰写", error: "descriptionRequired" });
  assert.equal(description.kind, "descriptionRequired");

  const notEnvelope = parseReferenceError(new Error("网络错误"));
  assert.equal(notEnvelope.kind, undefined);
  assert.equal(notEnvelope.message, "网络错误");
});

test("预留的分析生命周期值被容忍且不触发任何 AI 分析行为", () => {
  const pending = makeRecord({ descriptionSource: "ai", analysisState: "pending" });
  const parsed = parseReferenceListResponse({ code: 200, data: { list: [pending], total: 1 }, message: "成功" });
  assert.equal(parsed[0].descriptionSource, "ai");
  assert.equal(parsed[0].analysisState, "pending");
});

test("同一 controlledDimension 同时出现在必传与排除中时，提交前给出冲突", () => {
  const sameReference = findControlledDimensionConflicts([
    makeRecord({ id: 1, requiredTransfers: ["红色官袍", "黑金头冠"], exclusions: ["红色官袍"] }),
  ]);
  assert.deepEqual(sameReference, [{ dimension: "红色官袍", referenceIds: [1] }]);

  const acrossReferences = findControlledDimensionConflicts([
    makeRecord({ id: 1, requiredTransfers: ["红色官袍"], exclusions: [] }),
    makeRecord({ id: 2, requiredTransfers: [], exclusions: ["红色官袍"] }),
  ]);
  assert.deepEqual(acrossReferences, [{ dimension: "红色官袍", referenceIds: [1, 2] }]);

  assert.deepEqual(
    findControlledDimensionConflicts([
      makeRecord({ id: 1, requiredTransfers: ["红色官袍"], exclusions: ["背景"] }),
      makeRecord({ id: 2, requiredTransfers: ["黑金头冠"], exclusions: ["道具"] }),
    ]),
    [],
  );
});

test("无参考图时不生成占位参考图，也不发送虚假引用", () => {
  const inputs = buildGenerationReferenceInputs([]);
  assert.deepEqual(inputs, []);

  const one = buildGenerationReferenceInputs([makeRecord()]);
  assert.deepEqual(one, [
    {
      id: 1,
      mediaPath: "/10/assetReferences/a.png",
      description: "正面全身定妆照",
      visualRole: "定妆照",
      requiredTransfers: ["红色官袍"],
      exclusions: ["背景"],
    },
  ]);
});

test("旧 Asset 没有 prompt 或参考图配置时仍能打开配置界面", () => {
  const legacy = hydrateAssetConfig({ id: 7, name: "老资产" });
  assert.deepEqual(legacy, { id: 7, prompt: "" });

  const withPrompt = hydrateAssetConfig({ id: 8, name: "资产", prompt: "已有提示词" });
  assert.deepEqual(withPrompt, { id: 8, prompt: "已有提示词" });
});

test("媒体展示 URL 从 API 基址推导 OSS 静态资源地址", () => {
  assert.equal(
    referenceMediaUrl("http://localhost:10588/api", "/10/assetReferences/a.png"),
    "http://localhost:10588/oss/10/assetReferences/a.png",
  );
  assert.equal(
    referenceMediaUrl("https://example.com/api/", "10/assetReferences/a.png"),
    "https://example.com/oss/10/assetReferences/a.png",
  );
});
