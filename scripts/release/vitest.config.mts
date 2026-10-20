import { defineConfig } from 'vitest/config';

// Jest's jsdom setup resolves nx's dependencies to their browser builds, so these Node-only tests run in Vitest.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
