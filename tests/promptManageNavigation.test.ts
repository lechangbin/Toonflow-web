import assert from "node:assert/strict";
import test from "node:test";

import {
  closePromptDetail,
  detailEntryKey,
  manageableCatalogEntries,
  openPromptDetail,
  type PromptCatalogEntry,
} from "../src/utils/promptManageNavigation.ts";

function entry(overrides: Partial<PromptCatalogEntry>): PromptCatalogEntry {
  return {
    key: "system:test",
    name: "Test",
    category: "system",
    kind: "system",
    source: "test",
    customized: false,
    resettable: true,
    ...overrides,
  };
}

test("opening a prompt card enters the detail view for that prompt", () => {
  const view = openPromptDetail("system:script");

  assert.equal(view.view, "detail");
  assert.equal(detailEntryKey(view), "system:script");
});

test("closing the detail dialog returns to the prompt list", () => {
  const view = closePromptDetail();

  assert.equal(view.view, "list");
  assert.equal(detailEntryKey(view), null);
});

test("closing the detail dialog after opening one returns to the list", () => {
  const opened = openPromptDetail("skill:story_skills/plot.md");
  assert.equal(detailEntryKey(opened), "skill:story_skills/plot.md");

  const closed = closePromptDetail();
  assert.equal(detailEntryKey(closed), null);
});

test("runtime prompt categories remain listed in prompt management", () => {
  const entries = [
    entry({ key: "system:script", kind: "system", category: "system" }),
    entry({ key: "skill:story_skills/plot.md", kind: "skill", category: "story-skill" }),
    entry({ key: "skill:art_skills/color.md", kind: "skill", category: "visual-skill" }),
    entry({ key: "video-profile:main.md", kind: "video-profile", category: "video-profile" }),
    entry({ key: "model-prompt:hero.md", kind: "model-prompt", category: "model-prompt" }),
  ];

  const visible = manageableCatalogEntries(entries);
  assert.equal(visible.length, 5);
});

test("internal asset analysis and compiler templates are not listed in prompt management", () => {
  const entries = [
    entry({ key: "asset-analysis:character.md", kind: "asset-analysis", category: "asset" }),
    entry({ key: "asset-compiler:prop.md", kind: "asset-compiler", category: "asset" }),
    entry({ key: "system:script", kind: "system", category: "system" }),
  ];

  const visible = manageableCatalogEntries(entries);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].key, "system:script");
});
