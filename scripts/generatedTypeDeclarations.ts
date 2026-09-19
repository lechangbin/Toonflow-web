import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const generatedTypeDeclarations = {
  autoImports: "src/types/auto-imports.d.ts",
  components: "src/types/components.d.ts",
} as const;

export const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
