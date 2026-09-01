import assert from "node:assert/strict";
import test from "node:test";

import parseScript from "../src/utils/parseScript.ts";

test("batch import falls back to the configured chapter regular expression", () => {
  const text = "第1章 开端\n内容甲\n第2章 转折\n内容乙";
  const episodes = parseScript(text, {
    configuredRegex: "/第\\s*([0-9]+)\\s*章\\s*([^\\n\\r]*)/g",
  });

  assert.deepEqual(episodes, [
    { index: 1, chapter: "开端", text: "内容甲" },
    { index: 2, chapter: "转折", text: "内容乙" },
  ]);
});

test("a dialog-specific regular expression overrides the configured fallback", () => {
  const text = "EP-1 Alpha\nA\nEP-2 Beta\nB";
  const episodes = parseScript(text, {
    customRegex: "/EP-([0-9]+)\\s+([^\\n\\r]*)/g",
    configuredRegex: "/第([0-9]+)章([^\\n\\r]*)/g",
  });
  assert.equal(episodes.length, 2);
  assert.equal(episodes[1].chapter, "Beta");
});
