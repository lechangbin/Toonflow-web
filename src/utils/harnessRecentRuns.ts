export interface HarnessRecentRun { id: string }

/** Keep selection only while it remains in the server's bounded recent window. */
export function chooseHarnessRecentRun<T extends HarnessRecentRun>(input: {
  selectedId?: string;
  current: T | null;
  recent: T[];
}): { selectedId: string | null; recent: T[] } {
  const recent = input.recent.slice(0, 20);
  const selectedId = input.selectedId && recent.some((run) => run.id === input.selectedId)
    ? input.selectedId : input.current?.id ?? recent[0]?.id ?? null;
  return { selectedId, recent };
}
