import { defineConfig } from 'vitest/config';

// Vitest rather than Jest because @rspack/core 2.x is ESM-only, which Jest's CommonJS runtime
// cannot load in-process. Both bundlers' plugin tests live here so they stay comparable.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    environment: 'node',
    include: ['{webpack,rspack}/plugins/**/*.test.ts'],
  },
});
