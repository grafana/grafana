// Run with node --experimental-vm-modules --test scripts/test-harness/env-config.test.cjs.
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');

const { getEnvConfig } = require('../cli/env-util.cjs');
const root = path.resolve(__dirname, '../..');

function fixture(t, defaults, custom) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'grafana-env-config-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, 'conf'));
  writeFileSync(path.join(directory, 'conf/defaults.ini'), defaults);
  if (custom !== undefined) writeFileSync(path.join(directory, 'conf/custom.ini'), custom);
  return directory;
}

function loadConfig(directory, ci) {
  const module = { exports: {} };
  let reads = 0;
  const configRequire = (id) => {
    assert.equal(id, './scripts/cli/env-util.cjs');
    return {
      getEnvConfig: (receivedRoot) => {
        assert.equal(receivedRoot, directory);
        reads++;
        return getEnvConfig(receivedRoot);
      },
    };
  };
  configRequire.resolve = (id) => {
    assert.equal(id, 'ts-jest');
    return id;
  };
  vm.runInNewContext(readFileSync(path.join(root, 'jest.config.js'), 'utf8'), {
    module,
    require: configRequire,
    __dirname: directory,
    process: { env: { CI: ci } },
  });
  return { config: module.exports, reads: () => reads };
}

async function runSetup(flag, ci, fallback = false) {
  const calls = [];
  let fallbackReads = 0;
  const i18next = {
    use() {
      return this;
    },
    init() {},
  };
  const dependencies = {
    'core-js/stable/structured-clone': {},
    'whatwg-fetch': {},
    i18next: { default: i18next },
    'jest-fail-on-console': { default: (options) => calls.push(options) },
    'react-i18next/initReactI18next': { initReactI18next: {} },
    '@grafana/test-utils': { matchers: {} },
    '../../packages/grafana-runtime/src/services/pluginExtensions/usePluginComponents': {
      setPluginComponentsHook() {},
    },
    './lazyJestDomMatchers': { jestDomMatchers: {} },
  };
  const setupRequire = (id) => {
    if (id === '../../scripts/cli/env-util.cjs') {
      return {
        getEnvConfig: (directory) => {
          assert.equal(path.resolve(directory), root);
          fallbackReads++;
          return { frontend_dev_fail_tests_on_console: fallback };
        },
      };
    }
    assert.equal(id, '@testing-library/dom/dist/config');
    return { configure() {} };
  };
  setupRequire.resolve = (id) => id;
  setupRequire.cache = {};
  const context = vm.createContext({
    ...(flag === undefined ? {} : { __GRAFANA_TEST_FAIL_ON_CONSOLE__: flag }),
    __dirname: path.join(root, 'public/test'),
    process: { env: { CI: ci } },
    window: {},
    require: setupRequire,
    beforeEach() {},
    afterEach() {},
    jest: { mock() {} },
    expect: { extend() {} },
  });
  const filename = path.join(root, 'public/test/setupTests.ts');
  const module = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(filename, 'utf8')), {
    context,
    identifier: filename,
  });
  await module.link((id) => {
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected setup dependency: ${id}`);
    const values = dependencies[id];
    return new vm.SyntheticModule(
      Object.keys(values),
      function () {
        for (const [name, value] of Object.entries(values)) this.setExport(name, value);
      },
      { context }
    );
  });
  await module.evaluate();
  assert.equal(fallbackReads, flag === undefined && !ci ? 1 : 0);
  return calls;
}

test('TypeScript consumers retain the same configuration reader', async () => {
  const wrapper = await import(pathToFileURL(path.join(root, 'scripts/cli/env-util.ts')));
  assert.equal(wrapper.getEnvConfig, getEnvConfig);
});

test('configuration preserves parsed values, prefixes, unrelated keys, and custom precedence', (t) => {
  const directory = fixture(
    t,
    '[frontend_dev]\nfail_tests_on_console=true\nserver_url=http://localhost:3000\nunchanged=default\n[other]\nignored=true\n',
    '[frontend_dev]\nfail_tests_on_console=false\nserver_url=https://example.invalid\n[other]\nignored=false\n'
  );
  assert.deepEqual(getEnvConfig(directory), {
    frontend_dev_fail_tests_on_console: false,
    frontend_dev_server_url: 'https://example.invalid',
    frontend_dev_unchanged: 'default',
  });
});

test('missing custom configuration uses defaults and missing sections return no frontend keys', (t) => {
  const defaults = fixture(t, '[frontend_dev]\nfail_tests_on_console=true\n');
  assert.deepEqual(getEnvConfig(defaults), { frontend_dev_fail_tests_on_console: true });
  const unrelated = fixture(t, '[other]\nvalue=true\n');
  assert.deepEqual(getEnvConfig(unrelated), {});
});

for (const { defaults, custom, expected } of [
  { defaults: 'true', custom: undefined, expected: true },
  { defaults: 'false', custom: undefined, expected: false },
  { defaults: 'true', custom: 'false', expected: false },
  { defaults: 'false', custom: 'true', expected: true },
]) {
  test(`Jest resolves console enforcement once: default=${defaults}, custom=${custom}`, (t) => {
    const directory = fixture(
      t,
      `[frontend_dev]\nfail_tests_on_console=${defaults}\n`,
      custom === undefined ? undefined : `[frontend_dev]\nfail_tests_on_console=${custom}\n`
    );
    const loaded = loadConfig(directory);
    assert.equal(loaded.reads(), 1);
    for (let suite = 0; suite < 3; suite++) {
      assert.equal(JSON.parse(JSON.stringify(loaded.config.globals)).__GRAFANA_TEST_FAIL_ON_CONSOLE__, expected);
    }
    assert.equal(loaded.reads(), 1);
    assert.equal(loaded.config.globals.__webpack_public_path__, '');
  });
}

test('CI enables console enforcement without reading developer configuration', () => {
  const loaded = loadConfig('/configuration-is-not-read-in-ci', 'true');
  assert.equal(loaded.config.globals.__GRAFANA_TEST_FAIL_ON_CONSOLE__, true);
  assert.equal(loaded.reads(), 0);
});

for (const [flag, ci, expected, fallback] of [
  [false, undefined, 0],
  [true, undefined, 1],
  [false, 'true', 1],
  [false, 'false', 1],
  [false, '', 0],
  [undefined, 'true', 1],
  [undefined, undefined, 1, true],
  [undefined, undefined, 0, false],
]) {
  test(`shared setup honors flag=${flag}, late CI=${ci}, and fallback=${fallback}`, async () => {
    const calls = await runSetup(flag, ci, fallback);
    assert.equal(calls.length, expected);
    if (expected)
      assert.deepEqual(
        { ...calls[0] },
        {
          shouldFailOnLog: true,
          shouldFailOnDebug: true,
          shouldFailOnInfo: true,
          shouldPrintMessage: true,
        }
      );
  });
}
