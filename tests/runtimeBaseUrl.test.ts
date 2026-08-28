import assert from "node:assert/strict";
import test from "node:test";

import {
  getInitialApiBaseUrl,
  legacyLocalApiBaseUrl,
  migrateLegacyWebApiBaseUrl,
} from "../src/runtimeBaseUrl.ts";

const remoteLocation = { protocol: "http:", origin: "http://192.168.150.46:10589" };

test("web deployments use their current origin for API requests", () => {
  assert.equal(getInitialApiBaseUrl(remoteLocation), "http://192.168.150.46:10589/api");
});

test("the persisted legacy localhost default migrates without replacing custom endpoints", () => {
  assert.equal(migrateLegacyWebApiBaseUrl(legacyLocalApiBaseUrl, remoteLocation), "http://192.168.150.46:10589/api");
  assert.equal(migrateLegacyWebApiBaseUrl("https://api.example.test", remoteLocation), "https://api.example.test");
});

test("non-web runtimes retain the desktop fallback", () => {
  assert.equal(getInitialApiBaseUrl({ protocol: "file:", origin: "null" }), legacyLocalApiBaseUrl);
});
