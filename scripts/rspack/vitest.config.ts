import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Vitest runs these tests instead of Jest because @rspack/core 2.x is ESM-only,
// which Jest's CommonJS runtime cannot load in-process. Rooted at the repo so
// the same project covers every rspack config, wherever it lives.
export default defineConfig({
  root: path.resolve(import.meta.dirname, '../..'),
  test: {
    environment: 'node',
    // Not scoped to plugins/: a test placed beside the configs themselves would be silently
    // skipped, which is exactly where the config regression guards live.
    include: ['scripts/rspack/**/*.test.ts', 'packages/grafana-plugin-configs/**/*.test.ts'],
  },
});
