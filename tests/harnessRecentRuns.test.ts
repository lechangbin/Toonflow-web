import assert from "node:assert/strict";
import test from "node:test";

import { chooseHarnessRecentRun } from "../src/utils/harnessRecentRuns.ts";

test("Harness recent selection survives refresh but follows server current when stale", () => {
  const current = { id: "run-current" };
  const recent = [{ id: "run-old" }, current];
  assert.equal(chooseHarnessRecentRun({ selectedId: "run-old", current,
    recent }).selectedId, "run-old");
  assert.equal(chooseHarnessRecentRun({ selectedId: "run-missing", current,
    recent }).selectedId, "run-current");
  assert.equal(chooseHarnessRecentRun({ current: null,
    recent }).selectedId, "run-old");
});

test("Harness recent selection never retains a Run beyond the 20-item server window", () => {
  const recent = Array.from({ length: 22 }, (_, index) => ({ id: `run-${index}` }));
  const selected = chooseHarnessRecentRun({ selectedId: "run-21", current: null,
    recent });
  assert.equal(selected.recent.length, 20);
  assert.equal(selected.selectedId, "run-0");
  assert.deepEqual(chooseHarnessRecentRun({ current: null, recent: [] }),
    { selectedId: null, recent: [] });
});
