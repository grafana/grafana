import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

import { jestStyleResolverPlugin } from './public/test/vitest-resolver';

export default defineConfig({
  test: {
    globals: true,
    reporters: ['verbose'],
    css: false, // disables CSS processing entirely in tests
    environment: 'jsdom',
    include: [
      // TODO: uncomment when everything is migrated
      // 'public/app/**/*.test.{ts,tsx}',
      // 'public/test/**/*.test.{ts,tsx}',
      // 'packages/**/*.test.{ts,tsx}',
      // 'scripts/tests/**/*.test.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      'packages/grafana-alerting/**/*.test.{ts,tsx}',
      'packages/grafana-data/**/*.test.{ts,tsx}',
      'packages/grafana-eslint-rules/**/*.test.{ts,tsx}',
      'packages/grafana-flamegraph/**/*.test.{ts,tsx}',
      'packages/grafana-i18n/**/*.test.{ts,tsx}',
      'packages/grafana-runtime/**/*.test.{ts,tsx}',
      'packages/grafana-ui/**/*.test.{ts,tsx}',
      'public/app/plugins/datasource/azuremonitor/**',
      'public/app/plugins/datasource/cloud-monitoring/**',
      'public/app/plugins/datasource/elasticsearch/**',
      'public/app/plugins/datasource/grafana-postgresql-datasource/**',
      'public/app/plugins/datasource/grafana-pyroscope-datasource/**',
      'public/app/plugins/datasource/grafana-testdata-datasource/**',
      'public/app/plugins/datasource/jaeger/**',
      'public/app/plugins/datasource/loki/**',
      'public/app/plugins/datasource/mysql/**',
      'public/app/plugins/datasource/parca/**',
      'public/app/plugins/datasource/tempo/**',
      'public/app/plugins/datasource/zipkin/**',
    ],
    setupFiles: [
      'public/test/setup-polyfills.ts', // MUST be first
      'vitest-canvas-mock',
      'public/test/vitest-setup.ts',
      'public/test/setupVitestTests.ts',
    ],
    testTimeout: 30_000,
    env: {
      TZ: 'Pacific/Easter',
    },
  },
  resolve: {
    conditions: ['@grafana-app/source', 'import', 'module', 'default'],
    alias: [
      { find: /.*\.(svg|png|jpg)$/, replacement: '/public/test/mocks/images.ts' },
      // { find: /\.css$/, replacement: '/public/test/mocks/style.ts' },
      { find: 'react-inlinesvg', replacement: '/public/test/mocks/react-inlinesvg.tsx' },
      { find: 'monaco-editor', replacement: 'monaco-editor/esm/vs/editor/editor.api.js' },
      { find: '@kusto/monaco-kusto', replacement: '@kusto/monaco-kusto/release/esm/monaco.contribution.js' },
      { find: '@locker/near-membrane-dom', replacement: '/public/test/mocks/nearMembraneDom.ts' },
      { find: 'systemjs/dist/extras/amd', replacement: '/public/test/mocks/systemjsAMDExtra.ts' },
      { find: '@bsull/augurs', replacement: '/public/test/mocks/augurs.ts' },
      { find: '@grafana/assistant', replacement: '/public/test/mocks/assistant.ts' },
      { find: 'uwrap', replacement: 'uwrap/dist/uWrap.mjs' },
    ],
  },
  define: {
    __webpack_public_path__: '""',
  },
  plugins: [tsconfigPaths(), jestStyleResolverPlugin()],
});
