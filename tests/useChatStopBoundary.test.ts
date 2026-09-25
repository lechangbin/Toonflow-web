import assert from "node:assert/strict";
import test from "node:test";

import { acceptsLegacyMessageUpdate, useChat } from "../src/utils/useChat.ts";

test("Legacy projection rejects late updates after a terminal message state", () => {
  assert.equal(acceptsLegacyMessageUpdate("stop", "complete"), false);
  assert.equal(acceptsLegacyMessageUpdate("stop", "streaming"), false);
  assert.equal(acceptsLegacyMessageUpdate("complete", "streaming"), false);
  assert.equal(acceptsLegacyMessageUpdate("pending", "streaming"), true);
});

test("Legacy Socket stop request does not optimistically mark a message stopped", () => {
  const chat = useChat({ url: "unused", autoConnect: false,
    manageLifecycle: false });
  const calls: Array<{ event: string; data: unknown }> = [];
  chat.messages.value.push({ id: "assistant-1", role: "assistant",
    status: "streaming", datetime: "2026-09-25T00:00:00.000Z",
    content: [] } as any);
  chat.status.value = "streaming";
  chat.socket.value = { connected: true,
    emit: (event: string, data: unknown) => calls.push({ event, data }) } as any;
  assert.equal(chat.stopGenerate("assistant-1"), true);
  assert.deepEqual(calls, [{ event: "stop",
    data: { messageId: "assistant-1" } }]);
  assert.equal(chat.messages.value[0].status, "streaming");
  assert.equal(chat.status.value, "streaming");
});

test("Disconnected Legacy Socket cannot falsely stop a message", () => {
  const chat = useChat({ url: "unused", autoConnect: false,
    manageLifecycle: false });
  chat.messages.value.push({ id: "assistant-2", role: "assistant",
    status: "streaming", datetime: "2026-09-25T00:00:00.000Z",
    content: [] } as any);
  chat.status.value = "streaming";
  assert.equal(chat.stopGenerate("assistant-2"), false);
  assert.equal(chat.messages.value[0].status, "streaming");
  assert.equal(chat.status.value, "streaming");
});
