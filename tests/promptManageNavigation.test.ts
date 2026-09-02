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
    entry({ key: "system:script", kind: "system", category: "system", source: "script" }),
    entry({ key: "skill:script_agent_decision.md", kind: "skill", category: "script-agent", source: "script_agent_decision.md" }),
    entry({ key: "skill:production_agent_supervision.md", kind: "skill", category: "production-agent", source: "production_agent_supervision.md" }),
    entry({ key: "skill:art_skills/2D_90s_japanese_anime/style.md", kind: "skill", category: "visual-skill", source: "art_skills/2D_90s_japanese_anime/style.md" }),
    entry({ key: "skill:story_skills/plot.md", kind: "skill", category: "story-skill", source: "story_skills/plot.md" }),
    entry({ key: "skill:legacy_agent.md", kind: "skill", category: "agent-skill", source: "legacy_agent.md" }),
    entry({ key: "video-profile:video/main.md", kind: "video-profile", category: "video-profile", source: "video/main.md" }),
    entry({ key: "model-prompt:hero.md", kind: "model-prompt", category: "model-prompt", source: "hero.md" }),
  ];

  const visible = manageableCatalogEntries(entries);
  assert.deepEqual(
    visible.map((item) => item.key),
    entries.map((item) => item.key),
  );
});

test("internal asset-prompting skill templates scanned as skills are not listed in prompt management", () => {
  // 后端 catalog 递归扫描 skills/**/*.md（仅排除 readme.md），asset-prompting 目录下
  // 的 .md 以 kind:"skill"、category:"agent-skill" 返回，必须按来源路径整体排除。
  const internalAssetTemplates = [
    "asset-prompting/SKILL.md",
    "asset-prompting/prompts/batch_asset_analysis.md",
    "asset-prompting/prompts/compile_character_asset.md",
    "asset-prompting/prompts/compile_prop_asset.md",
    "asset-prompting/prompts/compile_scene_asset.md",
    "asset-prompting/prompts/reference_contract.md",
    "asset-prompting/references/contract.md",
  ].map((source) =>
    entry({
      key: `skill:${source}`,
      kind: "skill",
      category: "agent-skill",
      source,
      name: source,
    }),
  );
  const runtimeSkill = entry({
    key: "skill:script_agent_decision.md",
    kind: "skill",
    category: "script-agent",
    source: "script_agent_decision.md",
  });

  const visible = manageableCatalogEntries([...internalAssetTemplates, runtimeSkill]);
  assert.deepEqual(
    visible.map((item) => item.key),
    [runtimeSkill.key],
  );
});

test("internal asset-prompting templates with backslash source paths are also excluded", () => {
  const visible = manageableCatalogEntries([
    entry({ key: "skill:asset-prompting\\prompts\\compile_scene_asset.md", kind: "skill", category: "agent-skill", source: "asset-prompting\\prompts\\compile_scene_asset.md" }),
    entry({ key: "system:script", kind: "system", category: "system", source: "script" }),
  ]);

  assert.equal(visible.length, 1);
  assert.equal(visible[0].key, "system:script");
});

test("unknown prompt kinds stay out of prompt management", () => {
  const visible = manageableCatalogEntries([
    entry({ key: "asset-analysis:character.md", kind: "asset-analysis", category: "asset", source: "character.md" }),
    entry({ key: "asset-compiler:prop.md", kind: "asset-compiler", category: "asset", source: "prop.md" }),
    entry({ key: "system:script", kind: "system", category: "system", source: "script" }),
  ]);

  assert.equal(visible.length, 1);
  assert.equal(visible[0].key, "system:script");
});
