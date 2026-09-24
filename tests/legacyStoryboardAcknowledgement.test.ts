import assert from "node:assert/strict";
import test from "node:test";

import { reconcileLegacyStoryboardSubmission } from
  "../src/utils/legacyStoryboardAcknowledgement.ts";

test("legacy storyboard acknowledgement follows one backend write and reread", async () => {
  const calls: string[] = [];
  const result = await reconcileLegacyStoryboardSubmission(async () => {
    calls.push("persist");
  }, async () => { calls.push("reread"); });
  assert.equal(result, "acknowledged");
  assert.deepEqual(calls, ["persist", "reread"]);
});

test("legacy storyboard write failure rereads but never replays the write", async () => {
  const calls: string[] = [];
  const result = await reconcileLegacyStoryboardSubmission(async () => {
    calls.push("persist");
    throw new Error("transport failed after possible commit");
  }, async () => { calls.push("reread"); });
  assert.equal(result, "unknown");
  assert.deepEqual(calls, ["persist", "reread"]);
});

test("legacy storyboard reread failure prevents a success claim", async () => {
  const calls: string[] = [];
  const result = await reconcileLegacyStoryboardSubmission(async () => {
    calls.push("persist");
  }, async () => { calls.push("reread"); throw new Error("read failed"); });
  assert.equal(result, "unknown");
  assert.deepEqual(calls, ["persist", "reread", "reread"]);
});
