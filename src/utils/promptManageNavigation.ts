export interface PromptCatalogEntry {
  key: string;
  name: string;
  category: string;
  kind: string;
  source: string;
  customized: boolean;
  resettable: boolean;
}

export type PromptManageView = { view: "list" } | { view: "detail"; entryKey: string };

// 提示词管理只展示运行时提示词；非运行时 kind（如内部 Asset 分析/编译模板）一律排除。
const manageableKinds: readonly string[] = ["system", "skill", "video-profile", "model-prompt"];

// 后端 catalog 递归扫描 skills/**/*.md，内部 Asset 技能目录 asset-prompting/ 下的模板
// 也会以 kind:"skill"（category 归入 agent-skill）返回，必须按来源路径整体排除。
const internalSkillPaths: readonly string[] = ["asset-prompting/"];

function normalizedSource(entry: PromptCatalogEntry): string {
  return entry.source.replace(/\\/g, "/");
}

export function isManageablePromptEntry(entry: PromptCatalogEntry): boolean {
  if (!manageableKinds.includes(entry.kind)) return false;
  const source = normalizedSource(entry);
  return !internalSkillPaths.some((prefix) => source.startsWith(prefix));
}

export function manageableCatalogEntries(entries: PromptCatalogEntry[]): PromptCatalogEntry[] {
  return entries.filter(isManageablePromptEntry);
}

export function openPromptDetail(entryKey: string): PromptManageView {
  return { view: "detail", entryKey };
}

export function closePromptDetail(): PromptManageView {
  return { view: "list" };
}

export function detailEntryKey(view: PromptManageView): string | null {
  return view.view === "detail" ? view.entryKey : null;
}
