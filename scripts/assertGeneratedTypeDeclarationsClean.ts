import { spawnSync } from "node:child_process";

import {
  generatedTypeDeclarations,
  repositoryRoot,
} from "./generatedTypeDeclarations.ts";

const declarationPaths = Object.values(generatedTypeDeclarations);

for (const declaration of declarationPaths) {
  const tracked = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "--", declaration],
    { cwd: repositoryRoot, stdio: "ignore" },
  );

  if (tracked.status !== 0) {
    throw new Error(`${declaration} must be tracked by Git`);
  }
}

const diff = spawnSync(
  "git",
  ["diff", "--exit-code", "--", ...declarationPaths],
  { cwd: repositoryRoot, stdio: "inherit" },
);

if (diff.status !== 0) {
  throw new Error(
    "Generated type declarations changed during the Vite build; commit the authoritative output",
  );
}
