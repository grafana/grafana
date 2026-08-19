import { defineConfig } from 'vitest/config';

// Vitest runs these tests instead of Jest because @rspack/core 2.x is ESM-only,
// which Jest's CommonJS runtime cannot load in-process.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    environment: 'node',
    include: ['plugins/**/*.test.ts'],
  },
});
