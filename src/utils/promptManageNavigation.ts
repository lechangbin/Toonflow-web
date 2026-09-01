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

// 提示词管理只展示运行时提示词；内部 Asset 分析/编译模板等非运行时条目一律排除。
const manageableKinds: readonly string[] = ["system", "skill", "video-profile", "model-prompt"];

export function isManageablePromptEntry(entry: PromptCatalogEntry): boolean {
  return manageableKinds.includes(entry.kind);
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
