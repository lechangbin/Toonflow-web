import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import {
  IMAGE_GENERATION_ACTIVE_STATES,
  IMAGE_GENERATION_LIFECYCLE_STATES,
  IMAGE_GENERATION_TERMINAL_STATES,
  formatImageGenerationFailure,
  formatImageGenerationState,
  imageFailureKindFromStoredReason,
  imageGenerationErrorLabelKey,
  imageGenerationStateLabelKey,
  imageStoredReasonText,
  isImageGenerationActiveState,
  isImageGenerationTerminalState,
  normalizeImageGenerationState,
} from "../src/utils/imageGenerationLifecycle.ts";

// Exercise the actual Vue handlers, not a separately reimplemented request flow.
const source = fs.readFileSync(new URL("../src/views/cornerScape/index.vue", import.meta.url), "utf8");
const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
const parsed = ts.createSourceFile("cornerScape.ts", script, ts.ScriptTarget.Latest, true);
const names = new Set([
  "batchGenerationImage",
  "recoverStalePrompts",
  "persistImageModel",
  "pollingImageAssets",
  "imageStateText",
  "imageErrorText",
  "getFilteredData",
  "addUniqueId",
  "removeId",
]);
const variableNames = new Set([
  "generatingData",
  "submittingImageIds",
  "acceptedImageIds",
  "addSubmittingImageId",
  "removeSubmittingImageId",
  "addAcceptedImageId",
  "imagePollingIds",
]);
const handlers = parsed.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && names.has(node.name?.text ?? "")) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => variableNames.has(declaration.name.getText(parsed))))
)
  .map(node => node.getText(parsed)).join("\n");

function harness(post: (url: string, body: any) => Promise<any>, confirm = false) {
  const items = [1, 2].map(id => ({ id, name: `Asset ${id}`, prompt: "prompt", type: "role", describe: "description", state: "已完成", promptState: "" }));
  const messages: { kind: string; value: unknown }[] = [];
  const dialogs: any[] = [];
  const ctx: any = {
    modelSaving: { value: false }, imageSubmitting: { value: false }, modelSaveRevision: 0, modelSaveQueue: Promise.resolve(),
    selectedIds: { value: [1, 2] }, selectValue: { value: "agnes:agnes-image-2.5-flash" }, resolution: { value: "1K" },
    dataList: { value: items }, project: { value: { id: "1", imageModel: "agnes:agnes-image-2.1-flash" } },
    otherSetting: { value: { assetsBatchGenereateSize: 1 } }, otherTextPrompt: { value: "" },
    currentItem: { value: null }, loading: { value: false }, checkboxValue: { value: [] },
    computed: (getter: () => any) => ({ get value() { return getter(); } }), ref: (value: any) => ({ value }),
    syncSelectedIdsWithData: () => {},
    setItemState: (id: number, state: string) => { items.find(item => item.id === id)!.state = state; },
    isImageGenerationActiveState,
    formatImageGenerationFailure,
    formatImageGenerationState,
    normalizeImageGenerationState,
    imageGenerationStateLabelKey,
    imageGenerationErrorLabelKey,
    imageFailureKindFromStoredReason,
    imageStoredReasonText,
    console,
    window: { $message: Object.fromEntries(["warning", "success", "error"].map(kind => [kind, (value: unknown) => messages.push({ kind, value })])) },
    $t: (key: string, params: unknown) => JSON.stringify({ key, params }),
    axios: { post }, DialogPlugin: { confirm: (options: any) => {
      dialogs.push(options);
      queueMicrotask(() => confirm ? options.onConfirm() : options.onClose());
      return { destroy() {} };
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(ts.transpileModule(handlers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  return { ctx, items, dialogs, messages };
}

test("rejected batch does not report started or leave fake generating state", async () => {
  const h = harness(async () => { throw { message: "rejected" }; });
  await h.ctx.batchGenerationImage();
  assert.ok(h.items.every(item => item.state === "已完成"));
  assert.equal(h.messages.some(message => message.kind === "success"), false);
  assert.equal(h.ctx.imageSubmitting.value, false);
  assert.deepEqual(h.ctx.selectedIds.value, [1, 2]);
});

test("stale confirmation names only affected assets; cancel makes no prompt call", async () => {
  const calls: string[] = [];
  const h = harness(async url => {
    calls.push(url);
    throw { error: "stalePromptRecord", affectedAssets: [{ id: 2, name: "Asset 2" }] };
  });
  await h.ctx.batchGenerationImage();
  assert.equal(calls.length, 1);
  assert.match(h.dialogs[0].body, /Asset 2/);
  assert.doesNotMatch(h.dialogs[0].body, /Asset 1/);
  assert.ok(h.items.every(item => item.state === "已完成" && !item.promptState));
});

test("confirm regenerates only expired prompts, with no implicit image retry", async () => {
  const calls: { url: string; body: any }[] = [];
  const h = harness(async (url, body) => {
    calls.push({ url, body });
    if (url.endsWith("batchGenerateImageAssets")) throw { error: "stalePromptRecord", affectedAssets: [{ id: 2 }] };
    return {};
  }, true);
  await h.ctx.batchGenerationImage();
  assert.deepEqual(calls.map(call => call.url), ["/assetsGenerate/batchGenerateImageAssets", "/assetsGenerate/batchPolishAssetsPrompt"]);
  assert.deepEqual(Array.from(calls[1].body.items, (item: any) => item.assetsId), [2]);
  assert.equal(h.items[0].promptState, "");
  assert.equal(h.items[1].promptState, "生成中");
});

test("model choices are serialized and persisted to the project; failure restores saved choice", async () => {
  const calls: string[] = [];
  const h = harness(async (_url, body) => { calls.push(body.imageModel); if (body.imageModel === "bad") throw new Error("unavailable"); });
  h.ctx.persistImageModel(h.ctx.selectValue.value);
  h.ctx.selectValue.value = "bad";
  h.ctx.persistImageModel("bad");
  await h.ctx.modelSaveQueue;
  assert.deepEqual(calls, ["agnes:agnes-image-2.5-flash", "bad"]);
  assert.equal(h.ctx.selectValue.value, "agnes:agnes-image-2.5-flash");
  assert.equal(h.ctx.project.value.imageModel, "agnes:agnes-image-2.5-flash");
  assert.equal(h.ctx.modelSaving.value, false);
  assert.equal((source.match(/@change="persistImageModel"/g) ?? []).length, 2);
});

test("accepted batch displays waiting only after authoritative polling reports it", async () => {
  let accept!: () => void;
  const h = harness(async (url, body) => {
    if (url.endsWith("pollingImageAssets")) {
      return { data: body.ids.map((id: number) => ({ id, state: "等待中", filePath: null, errorKind: null })) };
    }
    assert.equal(body.model, "agnes:agnes-image-2.5-flash");
    await new Promise<void>(resolve => { accept = resolve; });
  });
  const request = h.ctx.batchGenerationImage();
  assert.ok(h.items.every(item => item.state === "已完成"));
  await h.ctx.batchGenerationImage(); // duplicate click is ignored
  accept();
  await request;
  await new Promise(resolve => setImmediate(resolve));
  // “等待中”来自接受后的权威轮询，不是客户端乐观写入。
  assert.ok(h.items.every(item => item.state === "等待中"));
  assert.equal(h.messages.filter(message => message.kind === "success").length, 1);
});

test("polling applies authoritative states and stops waiting on missing records", async () => {
  const h = harness(async (url) => {
    if (url.endsWith("pollingImageAssets")) {
      return {
        data: [
          { id: 1, state: "下载中", filePath: null, errorKind: null },
          { id: 2, state: null, filePath: null, errorKind: null },
        ],
      };
    }
    return { data: [] };
  });
  h.items.forEach(item => { item.state = "等待中"; });
  h.ctx.currentItem.value = { id: 1, state: "等待中", errorKind: "", filePath: null };
  await h.ctx.pollingImageAssets();
  // 供应商返回 URL 后进入“下载中”；缺失记录必须停止等待而不是无限轮询
  assert.equal(h.items[0].state, "下载中");
  assert.equal(h.items[1].state, "");
  assert.equal(h.ctx.currentItem.value.state, "下载中");
});

test("polling terminal states carry distinct stable error kinds", async () => {
  const h = harness(async (url) => {
    if (url.endsWith("pollingImageAssets")) {
      return {
        data: [
          { id: 1, state: "生成失败", filePath: null, errorKind: "imageGenerationTimeout" },
          { id: 2, state: "生成失败", filePath: null, errorKind: "imageDownloadFailed" },
        ],
      };
    }
    return { data: [] };
  });
  h.items.forEach(item => { item.state = "生成中"; });
  await h.ctx.pollingImageAssets();
  assert.equal(h.items[0].state, "生成失败");
  assert.equal(h.items[0].errorKind, "imageGenerationTimeout");
  assert.equal(h.items[1].errorKind, "imageDownloadFailed");
});

test("refresh restores persisted lifecycle states straight from the backend", async () => {
  const fresh = [1, 2].map(id => ({
    id, name: `Asset ${id}`, prompt: "prompt", type: "role", describe: "description",
    state: id === 1 ? "等待中" : "下载中", promptState: "",
  }));
  const h = harness(async (url) => (url.endsWith("getAllAssets") ? { data: fresh } : { data: [] }));
  await h.ctx.getFilteredData();
  // getFilteredData 用后端返回的持久化状态整体替换列表，刷新后状态原样恢复
  assert.equal(h.ctx.dataList.value[0].state, "等待中");
  assert.equal(h.ctx.dataList.value[1].state, "下载中");
});

test("state and error labels stay distinct per lifecycle stage and kind", async () => {
  const h = harness(async () => ({}));
  assert.match(h.ctx.imageStateText("等待中"), /imageLifecycle\.waiting/);
  assert.match(h.ctx.imageStateText("生成中"), /imageLifecycle\.generating/);
  assert.match(h.ctx.imageStateText("下载中"), /imageLifecycle\.downloading/);
  assert.match(h.ctx.imageErrorText({ errorKind: "imageGenerationTimeout", errorReason: "" }), /imageLifecycle\.errorTimeout/);
  assert.match(h.ctx.imageErrorText({ errorKind: "imageDownloadFailed", errorReason: "" }), /imageLifecycle\.errorDownloadFailed/);
  // errorReason 形如 kind:hash 时解析 kind，不把哈希直接展示给用户
  assert.match(h.ctx.imageErrorText({ errorReason: "imageGenerationTimeout:deadbeef" }), /imageLifecycle\.errorTimeout/);
  assert.doesNotMatch(h.ctx.imageErrorText({ errorReason: "imageGenerationTimeout:deadbeef" }), /deadbeef/);
  assert.match(h.ctx.imageErrorText({ errorReason: "软件退出导致失败" }), /软件退出导致失败/);
  // 历史行残留的供应商原文（#39 事故指纹）不得直接泄露给用户，回退通用失败提示
  const legacy = h.ctx.imageErrorText({ errorReason: "Agnes 图片生成失败：timeout of 360000ms exceeded" });
  assert.match(legacy, /imageLifecycle\.errorGenerationFailed|cornerScape\.genFailed/);
  assert.doesNotMatch(legacy, /Agnes|timeout/);
});

test("shared lifecycle contract mirrors the backend state machine", () => {
  assert.deepEqual([...IMAGE_GENERATION_LIFECYCLE_STATES], ["等待中", "生成中", "下载中", "已完成", "生成失败", "已取消"]);
  assert.deepEqual([...IMAGE_GENERATION_ACTIVE_STATES], ["等待中", "生成中", "下载中"]);
  assert.deepEqual([...IMAGE_GENERATION_TERMINAL_STATES], ["已完成", "生成失败", "已取消"]);
  for (const state of IMAGE_GENERATION_ACTIVE_STATES) {
    assert.equal(isImageGenerationActiveState(state), true);
    assert.equal(isImageGenerationTerminalState(state), false);
  }
  for (const state of IMAGE_GENERATION_TERMINAL_STATES) {
    assert.equal(isImageGenerationTerminalState(state), true);
    assert.equal(isImageGenerationActiveState(state), false);
  }
  assert.equal(isImageGenerationActiveState("未生成"), false);
  assert.equal(isImageGenerationActiveState(null), false);
  assert.equal(imageFailureKindFromStoredReason("imageGenerationTimeout:abc"), "imageGenerationTimeout");
  assert.equal(imageFailureKindFromStoredReason("软件退出导致失败"), null);
  assert.equal(imageGenerationErrorLabelKey("imageGenerationTimeout"), "workbench.imageLifecycle.errorTimeout");
  assert.equal(imageGenerationErrorLabelKey("imageDownloadFailed"), "workbench.imageLifecycle.errorDownloadFailed");
  assert.equal(imageGenerationErrorLabelKey("imagePersistenceFailed"), "workbench.imageLifecycle.errorPersistenceFailed");
  assert.equal(imageGenerationErrorLabelKey(null), "workbench.imageLifecycle.errorGenerationFailed");
  assert.equal(imageGenerationErrorLabelKey("unknownKind"), "workbench.imageLifecycle.errorGenerationFailed");
});
