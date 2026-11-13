import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';

import { loadBenchmarkConfig } from '../../../jest-benchmark-config.mts';
import { loadProfileConfiguration } from './configuration.mts';

const jsdomConfig = `
  module.exports = Object.freeze({
    testEnvironment: 'jsdom',
    testEnvironmentOptions: Object.freeze({ customExportConditions: ['browser'] }),
    setupFiles: Object.freeze(['./baseline-setup.js']),
    setupFilesAfterEnv: Object.freeze(['./baseline-after.js']),
    moduleNameMapper: Object.freeze({ '^fixture$': './baseline-mock.js' }),
    globals: Object.freeze({ 'ts-jest': Object.freeze({ tsconfig: 'baseline.tsconfig.json' }) }),
    transform: Object.freeze({
      '^.+\\\\.tsx?$': Object.freeze([require.resolve('ts-jest'), Object.freeze({
        diagnostics: false, tsconfig: 'custom.tsconfig.json', arbitrary: { retained: true },
      })]),
    }),
  });
`;
const happyConfig = `
  const base = require('./jest.config.js');
  module.exports = Object.freeze({
    ...base,
    testEnvironment: '<rootDir>/public/test/happy-dom-environment.js',
    setupFiles: Object.freeze(['./happy-setup.js']),
    setupFilesAfterEnv: Object.freeze(['./happy-after.js']),
    moduleNameMapper: Object.freeze({ '^fixture$': './happy-mock.js' }),
    globals: Object.freeze({ happyOnly: true }),
    transform: Object.freeze({
      '^.+\\\\.[jt]sx?$': Object.freeze([require.resolve('@sucrase/jest-plugin'), Object.freeze({
        jsxRuntime: 'classic', production: false, arbitrary: { retained: 'donor options' },
      })]),
    }),
  });
`;

async function put(root: string, name: string, content: string) {
  const filename = path.join(root, name);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, content);
  return filename;
}

async function stubPackage(root: string, name: string, entry = 'index.js') {
  await put(root, `node_modules/${name}/package.json`, JSON.stringify({
    name, main: entry,
    ...(name === 'jest' ? { exports: { './bin/jest': './bin/jest.js' } } : {}),
  }));
  return put(root, `node_modules/${name}/${entry}`, "throw new Error('Resolved modules must not execute during configuration loading');\n");
}

async function fixture(t: TestContext, { happy = false, config = jsdomConfig } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'shard-profile-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'package.json', '{"private":true,"type":"commonjs"}');
  await stubPackage(root, 'ts-jest', 'dist/index.js');
  await stubPackage(root, 'jest-environment-jsdom');
  await stubPackage(root, 'jest', 'bin/jest.js');
  await put(root, 'jest.config.js', config);
  if (happy) {
    await stubPackage(root, '@sucrase/jest-plugin');
    await put(root, 'public/test/happy-dom-environment.js', "throw new Error('Do not execute the environment');\n");
    await put(root, 'jest.happy-dom.config.js', happyConfig);
    await put(root, 'jest.benchmark.happy-dom.json', JSON.stringify({
      version: 1, jestConfig: 'jest.happy-dom.config.js', testEnvironment: './public/test/happy-dom-environment.js',
      include: ['happy.test.ts'], exclude: ['happy-exclude.test.ts'], groups: [['happy-a.test.ts', 'happy-b.test.ts']],
    }));
  }
  return root;
}

function checkoutRequire(root: string) { return createRequire(path.join(root, 'package.json')); }

function assertAbsolutePaths(config: Awaited<ReturnType<typeof loadProfileConfiguration>>) {
  for (const key of ['baseConfigPath', 'transformConfigPath', 'configuredEnvironment', 'transformerModule', 'jest'] as const) {
    assert.ok(path.isAbsolute(config[key]), key);
  }
}

test('baseline jsdom defaults to ts-jest without Happy DOM files, packages, Sucrase or benchmark JSON', async (t) => {
  const root = await fixture(t);
  const before = await readdir(root, { recursive: true });
  assert.ok(before.every((name) => !/happy|sucrase|benchmark/.test(name)));
  const require = checkoutRequire(root);
  const original = require(path.join(root, 'jest.config.js'));
  const snapshot = structuredClone(original);
  const config = await loadProfileConfiguration(root, '5/8', 'jsdom');
  assert.equal(config.environment, 'jsdom');
  assert.equal(config.transformer, 'ts-jest');
  assert.equal(config.baseConfigPath, path.join(root, 'jest.config.js'));
  assert.equal(config.transformConfigPath, config.baseConfigPath);
  assert.equal(config.configuredEnvironment, require.resolve('jest-environment-jsdom'));
  assert.equal(config.transformerModule, require.resolve('ts-jest'));
  assert.equal(config.jest, require.resolve('jest/bin/jest'));
  assert.deepEqual(config.benchmark, await loadBenchmarkConfig(root, 'jsdom', '5/8'));
  assert.deepEqual(config.benchmark.files, []);
  assert.deepEqual(original, snapshot);
  assert.equal(require(config.baseConfigPath), original);
  assert.deepEqual(await readdir(root, { recursive: true }), before);
  assertAbsolutePaths(config);
});

test('omitting environment defaults to the existing Happy DOM configuration and its Sucrase options', async (t) => {
  const root = await fixture(t, { happy: true });
  const require = checkoutRequire(root);
  const original = require(path.join(root, 'jest.happy-dom.config.js'));
  const snapshot = structuredClone(original);
  const config = await loadProfileConfiguration(root, '5/8');
  assert.equal(config.environment, 'happy-dom');
  assert.equal(config.transformer, 'sucrase');
  assert.equal(config.baseConfigPath, path.join(root, 'jest.happy-dom.config.js'));
  assert.equal(config.transformConfigPath, config.baseConfigPath);
  assert.equal(config.configuredEnvironment, path.join(root, 'public/test/happy-dom-environment.js'));
  assert.equal(config.transformerModule, require.resolve('@sucrase/jest-plugin'));
  assert.deepEqual(config.benchmark, await loadBenchmarkConfig(root, 'happy-dom', '5/8'));
  assert.deepEqual(original, snapshot);
  assert.equal(require(config.baseConfigPath), original);
  assertAbsolutePaths(config);
});

for (const [environment, transformer] of [['jsdom', 'ts-jest'], ['happy-dom', 'sucrase']] as const) {
  test(`explicit ${environment}/${transformer} matches its implicit default and never reads the donor configuration`, async (t) => {
    const root = await fixture(t, { happy: environment === 'happy-dom' });
    const donor = environment === 'jsdom' ? 'happy-dom' : 'jsdom';
    await put(root, `jest.benchmark.${donor}.json`, '{invalid donor JSON');
    assert.deepEqual(
      await loadProfileConfiguration(root, '5/8', environment, transformer),
      await loadProfileConfiguration(root, '5/8', environment)
    );
  });
}

for (const [environment, transformer] of [['jsdom', 'sucrase'], ['happy-dom', 'ts-jest']] as const) {
  test(`${environment}/${transformer} borrows only the other mode's transform configuration`, async (t) => {
    const root = await fixture(t, { happy: true });
    await put(root, 'jest.benchmark.json', JSON.stringify({ version: 1, include: ['shared.test.ts'] }));
    await put(root, 'jest.benchmark.jsdom.json', JSON.stringify({
      version: 1, jestConfig: 'baseline.config.cjs', include: ['jsdom.test.ts'],
      shards: { '5/8': { exclude: ['jsdom-exclude.test.ts'] } },
    }));
    await put(root, 'baseline.config.cjs', "module.exports = require('./jest.config.js');\n");
    const require = checkoutRequire(root);
    const baseName = environment === 'jsdom' ? 'baseline.config.cjs' : 'jest.happy-dom.config.js';
    const donorName = environment === 'jsdom' ? 'jest.happy-dom.config.js' : 'baseline.config.cjs';
    const base = require(`./${baseName}`);
    const donor = require(`./${donorName}`);
    const snapshots = [structuredClone(base), structuredClone(donor)];
    const config = await loadProfileConfiguration(root, '5/8', environment, transformer);
    assert.equal(config.environment, environment);
    assert.equal(config.transformer, transformer);
    assert.equal(config.baseConfigPath, path.join(root, baseName));
    assert.equal(config.transformConfigPath, path.join(root, donorName));
    assert.equal(config.transformerModule, require.resolve(transformer === 'sucrase' ? '@sucrase/jest-plugin' : 'ts-jest'));
    assert.equal(config.configuredEnvironment, environment === 'jsdom'
      ? require.resolve('jest-environment-jsdom') : path.join(root, 'public/test/happy-dom-environment.js'));
    assert.deepEqual(config.benchmark, await loadBenchmarkConfig(root, environment, '5/8'));
    assert.equal(config.benchmark.files.length, 2);
    assert.deepEqual(config.benchmark.roster.include, ['shared.test.ts', environment === 'jsdom' ? 'jsdom.test.ts' : 'happy.test.ts']);
    assert.equal(require(config.baseConfigPath), base);
    assert.equal(require(config.transformConfigPath).transform, donor.transform);
    assert.notDeepEqual(base.transform, donor.transform);
    assert.deepEqual([base, donor], snapshots);
    assertAbsolutePaths(config);
  });
}

test('a cross-mode donor contributes no runtime, runner or environment restrictions', async (t) => {
  const root = await fixture(t, { happy: true });
  await put(root, 'jest.happy-dom.config.js', `module.exports = {
    runtime: 'donor-runtime', testRunner: 'donor-runner',
    transform: { typescript: ['@sucrase/jest-plugin', { arbitrary: true }] },
  };`);
  await rm(path.join(root, 'public/test/happy-dom-environment.js'));
  const config = await loadProfileConfiguration(root, '5/8', 'jsdom', 'sucrase');
  assert.equal(config.configuredEnvironment, checkoutRequire(root).resolve('jest-environment-jsdom'));
  assert.equal(config.transformConfigPath, path.join(root, 'jest.happy-dom.config.js'));
});

test('resolves package and relative configured jsdom environments without executing them', async (t) => {
  const root = await fixture(t);
  for (const environment of ['jest-environment-jsdom', './custom-environment.cjs']) {
    await put(root, 'jest.benchmark.jsdom.json', JSON.stringify({ version: 1, testEnvironment: environment }));
    if (environment.startsWith('./')) await put(root, environment, "throw new Error('Do not execute custom environment');\n");
    const config = await loadProfileConfiguration(root, '5/8', 'jsdom');
    assert.equal(config.configuredEnvironment, checkoutRequire(root).resolve(environment));
  }
});

for (const entry of [
  "'ts-jest'", "['ts-jest']", "['ts-jest', { diagnostics: false, custom: { value: 7 } }]",
  "require.resolve('ts-jest')", "[require.resolve('ts-jest')]",
  "'<rootDir>/node_modules/ts-jest/dist/index.js'", "'./node_modules/ts-jest/dist/index.js'",
]) {
  test(`accepts a standard transformer entry without rewriting it: ${entry}`, async (t) => {
    const root = await fixture(t, { config: `module.exports = { transform: { typescript: ${entry}, assets: 'asset-transform' } };` });
    await stubPackage(root, 'asset-transform');
    const require = checkoutRequire(root);
    const original = require(path.join(root, 'jest.config.js'));
    const snapshot = structuredClone(original);
    const config = await loadProfileConfiguration(root, '5/8', 'jsdom');
    assert.equal(config.transformerModule, require.resolve('ts-jest'));
    assert.equal(require(config.transformConfigPath).transform, original.transform);
    assert.deepEqual(original, snapshot);
  });
}

test('invalid public choices and shards fail before evaluating checkout configuration or creating files', async (t) => {
  const root = await fixture(t, { config: "throw new Error('Configuration must not load');" });
  const before = await readdir(root, { recursive: true });
  for (const environment of ['', 'node', 'HappyDOM']) {
    await assert.rejects(loadProfileConfiguration(root, '5/8', environment), /Invalid environment/);
  }
  for (const transformer of ['', 'babel-jest', 'typescript']) {
    await assert.rejects(loadProfileConfiguration(root, '5/8', 'jsdom', transformer), /Invalid transformer/);
  }
  await assert.rejects(loadProfileConfiguration(root, '0/8', 'jsdom'), /Invalid shard/);
  assert.deepEqual(await readdir(root, { recursive: true }), before);
});

test('rejects missing Happy DOM configuration or the wrong configured environment', async (t) => {
  const baseline = await fixture(t);
  await assert.rejects(loadProfileConfiguration(baseline, '5/8'), /Happy DOM is not configured/);
  await assert.rejects(loadProfileConfiguration(baseline, '5/8', 'jsdom', 'sucrase'), /Happy DOM is not configured/);
  const root = await fixture(t, { happy: true });
  await put(root, 'jest.benchmark.happy-dom.json', JSON.stringify({
    version: 1, jestConfig: 'jest.happy-dom.config.js', testEnvironment: 'jsdom',
  }));
  await assert.rejects(loadProfileConfiguration(root, '5/8'), /requires the configured Grafana Happy DOM environment/);
});

for (const [expression, error] of [
  ['null', /configuration object/], ['[]', /configuration object/], ['() => ({})', /configuration object/],
  ['{}', /transform table/], ['{ transform: [] }', /transform table/],
  ["{ transform: { typescript: 'other-transform' } }", /must configure the checkout's ts-jest adapter/],
  ["{ transform: { '[': 'ts-jest' } }", /invalid transform pattern/],
  ["{ transform: { typescript: [] } }", /module string or/],
  ["{ transform: { typescript: ['ts-jest', {}, {}] } }", /module string or/],
  ["{ transform: { typescript: [42] } }", /module string or/],
  ["{ transform: { typescript: '' } }", /module string or/],
  ["{ transform: { typescript: ['ts-jest', null] } }", /module string or/],
  ["{ transform: { typescript: ['ts-jest', []] } }", /module string or/],
  ["{ transform: { typescript: ['ts-jest', false] } }", /module string or/],
  ["{ transform: { typescript: ['node:fs'] } }", /Cannot resolve transformer/],
  ["{ transform: { typescript: 'not-installed-transform' } }", /Cannot resolve transformer/],
  ["{ runtime: 'custom', transform: { typescript: 'ts-jest' } }", /custom Jest runtime/],
  ["{ testRunner: 'jest-jasmine2', transform: { typescript: 'ts-jest' } }", /default Jest Circus runner/],
  ["{ testRunner: 17, transform: { typescript: 'ts-jest' } }", /default Jest Circus runner/],
] as const) {
  test(`rejects an invalid selected configuration: ${expression}`, async (t) => {
    const root = await fixture(t, { config: `module.exports = ${expression};` });
    await stubPackage(root, 'other-transform');
    await assert.rejects(loadProfileConfiguration(root, '5/8', 'jsdom'), error);
  });
}

for (const runner of ["'jest-circus/runner'", "require.resolve('jest-circus/runner')", "'<rootDir>/node_modules/jest-circus/runner.js'"]) {
  test(`accepts the default Circus runner: ${runner}`, async (t) => {
    const root = await fixture(t, { config: `module.exports = { runtime: null, testRunner: ${runner}, transform: { typescript: 'ts-jest' } };` });
    await stubPackage(root, 'jest-circus', 'runner.js');
    await loadProfileConfiguration(root, '5/8', 'jsdom');
  });
}

test('rejects a donor whose transform table does not resolve the requested adapter', async (t) => {
  const root = await fixture(t, { happy: true });
  await put(root, 'jest.happy-dom.config.js', "module.exports = { transform: { typescript: 'ts-jest' } };");
  await assert.rejects(loadProfileConfiguration(root, '5/8', 'jsdom', 'sucrase'), /jest.happy-dom.config.js must configure the checkout's sucrase adapter/);
});

for (const [file, label] of [
  ['node_modules/ts-jest', /ts-jest adapter/],
  ['node_modules/jest-environment-jsdom', /test environment/],
  ['node_modules/jest', /Jest executable/],
] as const) {
  test(`reports missing checkout dependency: ${file}`, async (t) => {
    const root = await fixture(t, { config: "module.exports = { transform: { typescript: 'ts-jest' } };" });
    await rm(path.join(root, file), { recursive: true });
    await assert.rejects(loadProfileConfiguration(root, '5/8', 'jsdom'), (error: Error) => {
      assert.match(error.message, /Cannot resolve/);
      assert.match(error.message, label);
      assert.ok(error.message.includes(root));
      return true;
    });
  });
}
