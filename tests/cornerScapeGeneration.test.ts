import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Exercise the actual Vue handlers, not a separately reimplemented request flow.
const source = fs.readFileSync(new URL("../src/views/cornerScape/index.vue", import.meta.url), "utf8");
const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
const parsed = ts.createSourceFile("cornerScape.ts", script, ts.ScriptTarget.Latest, true);
const names = new Set(["batchGenerationImage", "recoverStalePrompts", "persistImageModel"]);
const handlers = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text ?? ""))
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
    setItemState: (id: number, state: string) => { items.find(item => item.id === id)!.state = state; },
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

test("accepted batch enters generating only after acceptance and uses selected model", async () => {
  let accept!: () => void;
  const h = harness(async (_url, body) => {
    assert.equal(body.model, "agnes:agnes-image-2.5-flash");
    await new Promise<void>(resolve => { accept = resolve; });
  });
  const request = h.ctx.batchGenerationImage();
  assert.ok(h.items.every(item => item.state === "已完成"));
  await h.ctx.batchGenerationImage(); // duplicate click is ignored
  accept();
  await request;
  assert.ok(h.items.every(item => item.state === "生成中"));
  assert.equal(h.messages.filter(message => message.kind === "success").length, 1);
});
