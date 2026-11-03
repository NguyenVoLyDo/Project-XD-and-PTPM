import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Resolve the pnpm virtual store flat node_modules directory so that
// packages like sharp (with native addons) and multer can be resolved
// transitively even when pnpm's symlink graph is not fully hoisted.
const repoRoot = resolve(import.meta.dirname, '..');
const pnpmFlat = resolve(repoRoot, 'node_modules/.pnpm/node_modules');
const nodePath = existsSync(pnpmFlat) ? pnpmFlat : undefined;

export default {
  test: {
    include: ["src/**/*.test.ts", "src/**/*.spec.ts", "test/**/*.spec.ts"],
    // Inject NODE_PATH so transitive deps copied from the pnpm store are found.
    env: nodePath ? { NODE_PATH: nodePath } : {},
  },
};
