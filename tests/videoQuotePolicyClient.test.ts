import assert from "node:assert/strict";
import test from "node:test";

import { createVideoQuoteClient, videoQuoteTarget } from
  "../src/utils/videoQuotePolicy.ts";

const selection = { vendorId: "agnes", modelId: "video-v2",
  capabilityId: "text-to-video" as const,
  output: { presetId: "720p", duration: 5, resolution: "720p",
    aspectRatio: "16:9" as const },
  audio: { generation: "native" as const, enabled: true } };

test("Video estimate uses exact selection and expected revision, never dispatch route", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const target = videoQuoteTarget(7, selection);
  const client = createVideoQuoteClient(async <T>(path, body) => {
    calls.push({ path, body });
    return { data: { quote: path.endsWith("/get") ? null
      : { ...target, estimatedMaxCostMicros: 250_000,
        currency: "USD", revision: 1, updatedAt: 100 } } as T };
  });
  assert.equal(await client.get(target), null);
  assert.equal((await client.set(target, 0, 250_000, "USD")).revision, 1);
  assert.deepEqual(calls, [
    { path: "/agentRuns/videoQuote/get", body: target },
    { path: "/agentRuns/videoQuote/set", body: { ...target,
      expectedRevision: 0, estimatedMaxCostMicros: 250_000,
      currency: "USD" } },
  ]);
  await assert.rejects(client.set(target, -1, 250_000, "USD"), /invalid/);
  await assert.rejects(client.set(target, 1, 0, "USD"), /invalid/);
  assert.equal(calls.length, 2);
});

test("Video estimate rejects non-text or invalid Project selection", () => {
  assert.throws(() => videoQuoteTarget(0, selection));
  assert.throws(() => videoQuoteTarget(7,
    { ...selection, capabilityId: "image-to-video" }));
});
