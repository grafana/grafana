const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '../..');
const harnessDirectory = '<rootDir>/scripts/test-harness/';
const harnessFiles = readdirSync(__dirname, { recursive: true })
  .filter((file) => /\.(?:test\.(?:[jt]sx?|cjs|mts)|node\.cjs)$/.test(file))
  .map((file) => `scripts/test-harness/${file.split(path.sep).join('/')}`);

// Transformer resolution is unrelated to discovery. Keep these config checks dependency-free.
function loadConfig(filename) {
  const module = { exports: {} };
  const configRequire = (id) => {
    if (id === './scripts/cli/env-util.cjs') return { getEnvConfig: () => ({}) };
    assert.ok(['./jest.config', './jest.config.js'].includes(id));
    return loadConfig('jest.config.js');
  };
  configRequire.resolve = (id) => {
    assert.ok(['ts-jest', '@sucrase/jest-plugin'].includes(id));
    return id;
  };
  vm.runInNewContext(
    readFileSync(path.join(rootDir, filename), 'utf8'),
    {
      module,
      require: configRequire,
      process: { env: {} },
      __dirname: rootDir,
    },
    { filename }
  );
  return module.exports;
}

function selected(config, file) {
  const absolute = `${rootDir}/${file}`;
  const ignored = config.testPathIgnorePatterns.some((pattern) =>
    new RegExp(pattern.replaceAll('<rootDir>', rootDir)).test(absolute)
  );
  const inRoot = config.roots.some((root) => absolute.startsWith(`${root.replace('<rootDir>', rootDir)}/`));
  return inRoot && !ignored && new RegExp(config.testRegex).test(absolute);
}

const sourceSuites = [
  'packages/grafana-ui/src/components/Drawer/Drawer.test.tsx',
  'scripts/tests/compare-coverage-by-codeowner.test.ts',
  'scripts/tests/generate-transformations.test.ts',
  'public/test/core/redux/reducerTester.test.ts',
  'public/test/helpers/seedDataSources.test.ts',
  'public/app/features/inspector/utils/download.jsdom.test.ts',
  'public/app/plugins/panel/annolist/AnnoListPanel.jsdom.test.tsx',
  'public/swagger/schemaAnnotations.jsdom.test.ts',
  'public/test/core/utils/version.test.ts',
];

for (const filename of ['jest.config.js', 'jest.happy-dom.config.js']) {
  test(`${filename} excludes the harness directory and retains source suites`, () => {
    const config = loadConfig(filename);
    for (const file of sourceSuites) {
      assert.equal(selected(config, file), true, file);
    }
    assert.ok(config.testPathIgnorePatterns.includes(harnessDirectory));
    for (const file of [...harnessFiles, 'scripts/test-harness/future.test.ts']) {
      assert.equal(selected(config, file), false, file);
      // The ignore entry still protects shards if a future change broadens the source roots.
      assert.equal(selected({ ...config, roots: ['<rootDir>'] }, file), false, file);
    }
  });
}

test('the separate harness configuration selects Jest suites, but not source or Node suites', () => {
  const config = loadConfig('jest.harness.config.js');
  const jestFiles = harnessFiles.filter((file) => /\.test\.[jt]sx?$/.test(file));
  assert.deepEqual(jestFiles.sort(), [
    'scripts/test-harness/dependency-patches/FloatingFocusManager.test.tsx',
    'scripts/test-harness/helpers/events.test.ts',
    'scripts/test-harness/regressions/Drawer.test.tsx',
    'scripts/test-harness/regressions/alertQueryEntryPoint.test.ts',
    'scripts/test-harness/regressions/alertingLeafEntryPoints.test.tsx',
    'scripts/test-harness/regressions/backend_srv.dashboard.test.ts',
    'scripts/test-harness/regressions/baseQueryEntryPoint.test.ts',
    'scripts/test-harness/regressions/coreExtensionInitialization.test.ts',
    'scripts/test-harness/regressions/datasourceFilter.test.ts',
    'scripts/test-harness/regressions/debugUtilities.test.ts',
    'scripts/test-harness/regressions/exploreCorrelationEntryPoint.test.ts',
    'scripts/test-harness/regressions/featureFlagEntryPoint.test.ts',
    'scripts/test-harness/regressions/fingerprintTelemetry.test.ts',
    'scripts/test-harness/regressions/lazyJestDomMatchers.test.ts',
    'scripts/test-harness/regressions/lazyMatchers.test.ts',
    'scripts/test-harness/regressions/lazySetup.test.ts',
    'scripts/test-harness/regressions/notificationPolicyEntryPoint.test.ts',
    'scripts/test-harness/regressions/paginationLimits.test.ts',
    'scripts/test-harness/regressions/panelEditorEntryPoint.test.tsx',
    'scripts/test-harness/regressions/providerConfigFields.test.tsx',
    'scripts/test-harness/regressions/reactSetup.test.tsx',
    'scripts/test-harness/regressions/ruleRoutingEntryPoint.test.tsx',
    'scripts/test-harness/regressions/searchIcons.test.ts',
    'scripts/test-harness/regressions/storeEntryPoint.test.ts',
    'scripts/test-harness/regressions/testWithFeatureToggles.test.ts',
    'scripts/test-harness/regressions/timeRangeDescriptions.test.ts',
    'scripts/test-harness/test-utils-initialization.test.tsx',
    'scripts/test-harness/test-utils.test.tsx',
    'scripts/test-harness/theme-registry.test.ts',
  ]);
  for (const file of harnessFiles) {
    assert.equal(selected(config, file), jestFiles.includes(file), file);
  }
  for (const file of sourceSuites) {
    assert.equal(selected(config, file), false, file);
  }
  assert.equal(selected(config, 'scripts/test-harness/node_modules/dependency/example.test.ts'), false);
});
