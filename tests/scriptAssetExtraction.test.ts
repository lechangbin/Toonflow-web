import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExtractAssetsRequest,
  isExtractionInProgress,
  isReextractConfirmationRequired,
  needsReextractConfirmation,
  resolveExtractAssetsAction,
  resolveExtractAssetsFailure,
  resolveReextractDialogAction,
} from "../src/scriptAssetExtractionContract.ts";

function script(overrides: Partial<{ id: number; relatedAssets: { id: number; name: string }[] }> = {}) {
  return {
    id: 1,
    relatedAssets: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 规格用例 1：无已有资产 → 直接发送提取，不带替换意图
// 规格用例 9：刷新后按后端真实数据（relatedAssets）恢复判断
// 规格用例 10：现有提取功能回归（请求体形状不变，仅可能多 replaceExisting）
// ---------------------------------------------------------------------------

test("选中的剧本都没有资产关联时不需要确认，请求不带替换意图", () => {
  const scripts = [script({ id: 1 }), script({ id: 2, relatedAssets: [] })];
  assert.equal(needsReextractConfirmation(scripts, [1, 2]), false);
  assert.deepEqual(buildExtractAssetsRequest({ projectId: 7, scriptIds: [1, 2] }), {
    projectId: 7,
    scriptIds: [1, 2],
  });
  // 刷新后 relatedAssets 为空数组/null 也视为没有资产
  assert.equal(needsReextractConfirmation([script({ id: 1, relatedAssets: null as never })], [1]), false);
});

test("任意选中剧本已有关联资产时需要确认", () => {
  const scripts = [
    script({ id: 1 }),
    script({ id: 2, relatedAssets: [{ id: 11, name: "胡亥" }] }),
    script({ id: 3, relatedAssets: [{ id: 12, name: "赵高" }] }),
  ];
  assert.equal(needsReextractConfirmation(scripts, [1, 2]), true);
  // 未选中的剧本有资产不影响判断
  assert.equal(needsReextractConfirmation(scripts, [1]), false);
});

// ---------------------------------------------------------------------------
// 入口决策：防重（用例 7）与弹窗（用例 2）
// ---------------------------------------------------------------------------

test("请求在途时连续点击不产生任何动作（防重）", () => {
  assert.deepEqual(resolveExtractAssetsAction({ hasCachedAssets: false, requestInFlight: true }), { action: "none" });
  assert.deepEqual(resolveExtractAssetsAction({ hasCachedAssets: true, requestInFlight: true }), { action: "none" });
});

test("没有缓存资产时直接提交且不带替换意图；有缓存资产时先弹确认框", () => {
  assert.deepEqual(resolveExtractAssetsAction({ hasCachedAssets: false, requestInFlight: false }), {
    action: "submit",
    replaceExisting: false,
  });
  assert.deepEqual(resolveExtractAssetsAction({ hasCachedAssets: true, requestInFlight: false }), { action: "confirm" });
});

// ---------------------------------------------------------------------------
// 确认框按钮：取消不发送请求（用例 3），确认携带 replaceExisting（用例 4、6）
// ---------------------------------------------------------------------------

test("取消不发送任何请求；确认携带替换意图重新提交", () => {
  assert.deepEqual(resolveReextractDialogAction(false), { action: "none" });
  const confirmed = resolveReextractDialogAction(true);
  assert.deepEqual(confirmed, { action: "submit", replaceExisting: true });
  // 确认后的请求体必须显式携带 replaceExisting: true（用例 6 重试）
  assert.deepEqual(
    buildExtractAssetsRequest({ projectId: 7, scriptIds: [1], replaceExisting: confirmed.action === "submit" }),
    { projectId: 7, scriptIds: [1], replaceExisting: true },
  );
});

test("确认后的请求显式携带 replaceExisting: true", () => {
  assert.deepEqual(buildExtractAssetsRequest({ projectId: 7, scriptIds: [1], replaceExisting: true }), {
    projectId: 7,
    scriptIds: [1],
    replaceExisting: true,
  });
  // 未确认时不得出现该字段，防止意外触发后端替换
  assert.equal("replaceExisting" in buildExtractAssetsRequest({ projectId: 7, scriptIds: [1] }), false);
  assert.equal(
    "replaceExisting" in buildExtractAssetsRequest({ projectId: 7, scriptIds: [1], replaceExisting: false }),
    false,
  );
});

// ---------------------------------------------------------------------------
// 失败决策：409 兜底弹框（用例 5）、失败恢复可操作（用例 8）
// ---------------------------------------------------------------------------

test("识别后端 409 reextractConfirmationRequired 稳定错误信封（前端缓存过期兜底）", () => {
  const rejection = {
    code: 409,
    data: null,
    message: "当前操作会删除当前已有资产，请确认是否提取",
    error: "reextractConfirmationRequired",
  };
  assert.equal(isReextractConfirmationRequired(rejection), true);
  assert.deepEqual(resolveExtractAssetsFailure(rejection), { action: "confirm" });
  assert.equal(
    isReextractConfirmationRequired({ code: 409, data: null, message: "x", error: "extractionInProgress" }),
    false,
  );
  assert.equal(
    isReextractConfirmationRequired({ code: 400, data: null, message: "x", error: "reextractConfirmationRequired" }),
    false,
  );
  assert.equal(isReextractConfirmationRequired(new Error("网络错误")), false);
  assert.equal(isReextractConfirmationRequired(undefined), false);
});

test("识别后端 409 extractionInProgress 稳定错误信封", () => {
  assert.equal(
    isExtractionInProgress({ code: 409, data: null, message: "已有提取任务正在运行", error: "extractionInProgress" }),
    true,
  );
  assert.deepEqual(
    resolveExtractAssetsFailure({ code: 409, data: null, message: "x", error: "extractionInProgress" }),
    { action: "inProgress" },
  );
  assert.equal(isExtractionInProgress({ code: 409, data: null, message: "x", error: "reextractConfirmationRequired" }), false);
  assert.equal(isExtractionInProgress(null), false);
});

test("普通失败返回错误信息并允许再次操作（失败后恢复）", () => {
  const failure = resolveExtractAssetsFailure({ code: 500, data: null, message: "服务器内部错误" });
  assert.deepEqual(failure, { action: "error", message: "服务器内部错误" });
  // 失败后 requestInFlight 复位为 false，再次点击可直接提交
  assert.deepEqual(resolveExtractAssetsAction({ hasCachedAssets: false, requestInFlight: false }), {
    action: "submit",
    replaceExisting: false,
  });
  assert.deepEqual(resolveExtractAssetsFailure(new Error("Network Error")), {
    action: "error",
    message: "Network Error",
  });
});
