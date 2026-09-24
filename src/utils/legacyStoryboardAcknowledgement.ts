/** Legacy Socket compatibility: acknowledgement follows a backend reread, never an optimistic list insert. */
export async function reconcileLegacyStoryboardSubmission(
  persist: () => Promise<unknown>, reread: () => Promise<unknown>,
): Promise<"acknowledged" | "unknown"> {
  try {
    await persist();
    await reread();
    return "acknowledged";
  } catch {
    // A transport failure may follow a committed write. Reread once, but never replay the write.
    try { await reread(); } catch { /* The owner must refresh manually. */ }
    return "unknown";
  }
}
