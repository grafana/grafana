// Run with node --experimental-vm-modules --test scripts/test-harness/test-utils-imports.test.cjs.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const filename = path.resolve(__dirname, '../../public/test/test-utils.tsx');

// Only dependencies are substituted: execute the actual facade, with native type erasure and ESM linking.
// Real renderer/provider behavior is covered by scripts/test-harness/test-utils.test.tsx.
async function loadFacade(dependencies = {}) {
  const imports = [];
  const requires = [];
  const hooks = { beforeEach: [], afterEach: [] };
  const rtl = Object.fromEntries(
    ['act', 'cleanup', 'configure', 'fireEvent', 'getConfig', 'render', 'renderHook', 'waitFor', 'within'].map(
      (name) => [name, () => name]
    )
  );
  rtl.screen = { getByRole: () => 'screen' };
  const userEvent = { setup: () => 'user' };
  const context = vm.createContext({
    beforeEach: (hook) => hooks.beforeEach.push(hook),
    afterEach: (hook) => hooks.afterEach.push(hook),
    require: (id) => {
      requires.push(id);
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected lazy dependency: ${id}`);
      return dependencies[id];
    },
  });
  const module = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(filename, 'utf8')), {
    context,
    identifier: filename,
  });
  await module.link((id) => {
    imports.push(id);
    const values = id === '@testing-library/react' ? rtl : { default: userEvent };
    assert.ok(['@testing-library/react', '@testing-library/user-event'].includes(id), `Unexpected eager import: ${id}`);
    return new vm.SyntheticModule(
      Object.keys(values),
      function () {
        for (const [name, value] of Object.entries(values)) {
          this.setExport(name, value);
        }
      },
      { context }
    );
  });
  await module.evaluate();
  return { exports: module.namespace, imports, requires, hooks, rtl, userEvent };
}

test('Testing Library exports load without the renderer, app store, runtime, or feature-toggle helper', async () => {
  const loaded = await loadFacade();
  assert.deepEqual(loaded.imports.sort(), ['@testing-library/react', '@testing-library/user-event']);
  assert.deepEqual(loaded.requires, []);
  for (const [name, value] of Object.entries(loaded.rtl)) {
    if (name !== 'render') {
      assert.equal(loaded.exports[name], value, name);
    }
  }
  assert.equal(loaded.exports.userEvent, loaded.userEvent);
  assert.notEqual(loaded.exports.render, loaded.rtl.render);
});

for (const name of ['render', 'getWrapper']) {
  test(`${name} loads the renderer on demand and forwards arguments and the synchronous result`, async () => {
    const calls = [];
    const result = { source: name };
    const loaded = await loadFacade({
      './test-utils-renderer': {
        [name]: (...args) => {
          calls.push(args);
          return result;
        },
      },
    });
    const options = { store: { source: 'custom' }, renderWithRouter: false };
    const args = name === 'render' ? [{ source: 'element' }, options] : [options];
    assert.equal(loaded.exports[name](...args), result);
    assert.deepEqual(calls, [args]);
    assert.deepEqual(loaded.requires, ['./test-utils-renderer']);
  });
}

test('feature-toggle helper loads only when called and receives the original options', async () => {
  const calls = [];
  const loaded = await loadFacade({
    './helpers/testWithFeatureToggles': { testWithFeatureToggles: (options) => calls.push(options) },
  });
  const options = { enable: ['panelTitleSearch'] };
  loaded.exports.testWithFeatureToggles(options);
  assert.deepEqual(calls, [options]);
  assert.equal(calls[0], options);
  assert.deepEqual(loaded.requires, ['./helpers/testWithFeatureToggles']);
});

test('license helper loads runtime on demand and preserves per-test setup and reset', async () => {
  const config = { licenseInfo: {} };
  const loaded = await loadFacade({ '@grafana/runtime': { config } });
  loaded.exports.testWithLicenseFeatures({ enable: ['enabled', 'both'], disable: ['disabled', 'both'] });
  assert.deepEqual(loaded.requires, ['@grafana/runtime']);
  assert.equal(config.licenseInfo.enabledFeatures, undefined);
  assert.equal(loaded.hooks.beforeEach.length, 1);
  assert.equal(loaded.hooks.afterEach.length, 1);
  for (let run = 0; run < 2; run++) {
    loaded.hooks.beforeEach[0]();
    assert.deepEqual({ ...config.licenseInfo.enabledFeatures }, { enabled: true, disabled: false, both: false });
    loaded.hooks.afterEach[0]();
    assert.deepEqual({ ...config.licenseInfo.enabledFeatures }, {});
  }
});
