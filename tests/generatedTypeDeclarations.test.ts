import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

import {
  generatedTypeDeclarations,
  repositoryRoot,
} from "../scripts/generatedTypeDeclarations.ts";

test("a clean checkout contains the generated declarations required by type-check", () => {
  for (const declaration of Object.values(generatedTypeDeclarations)) {
    const tracked = spawnSync(
      "git",
      ["ls-files", "--error-unmatch", "--", declaration],
      { cwd: repositoryRoot },
    );
    const ignored = spawnSync(
      "git",
      ["check-ignore", "--quiet", "--no-index", declaration],
      { cwd: repositoryRoot },
    );
    const lineEnding = spawnSync(
      "git",
      ["check-attr", "eol", "--", declaration],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    assert.equal(tracked.status, 0, `${declaration} must be tracked by Git`);
    assert.equal(
      ignored.status,
      1,
      `${declaration} must be versioned instead of ignored`,
    );
    assert.match(
      lineEnding.stdout,
      /: eol: lf\s*$/,
      `${declaration} must keep the generator's LF output on every platform`,
    );
    assert.equal(
      existsSync(resolve(repositoryRoot, declaration)),
      true,
      `${declaration} must exist before Vite is started`,
    );
  }
});
