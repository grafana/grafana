// Run with node --test, not Jest.
// Intentional Jest failures and isolated package layouts exist only in temporary directories.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const adapterPath = require.resolve('../../../public/test/happy-dom-environment');
// Follow Jest's dependency tree because pnpm need not hoist Circus to the project root.
const jestRequire = createRequire(require.resolve('jest'));
const jestCoreRequire = createRequire(jestRequire.resolve('@jest/core'));
const jestConfigRequire = createRequire(jestCoreRequire.resolve('jest-config'));

function runNode(args, cwd) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.error, undefined, `${result.error?.message}\n${output}`);
  assert.equal(result.signal, null, output);
  return { status: result.status, output };
}

test('runner-local resolution works without hoisting and falls back when resolution fails', { timeout: 25000 }, () => {
  const root = mkdtempSync(path.join(tmpdir(), 'grafana-happy-dom-resolution-'));
  try {
    const adapterDir = path.join(root, 'public/test');
    const environmentDir = path.join(root, 'node_modules/@happy-dom/jest-environment');
    const store = path.join(root, 'node_modules/.pnpm');
    const circusDir = path.join(store, 'jest-circus@fixture/node_modules/jest-circus');
    const configDir = path.join(store, 'jest-config@fixture/node_modules/jest-config');
    const customDir = path.join(store, 'jest-circus@fixture/node_modules/custom-runner');
    const missingDir = path.join(root, 'missing-runner');
    const unexportedDir = path.join(store, 'unexported/node_modules/jest-circus');
    for (const dir of [adapterDir, environmentDir, circusDir, configDir, customDir, missingDir, unexportedDir]) {
      mkdirSync(dir, { recursive: true });
    }
    const adapter = path.join(adapterDir, 'happy-dom-environment.js');
    copyFileSync(adapterPath, adapter);
    // Bridge to the real upstream environment without copying or changing any installed dependencies.
    writeFileSync(
      path.join(environmentDir, 'index.js'),
      `module.exports = require(${JSON.stringify(require.resolve('@happy-dom/jest-environment'))});`
    );
    writeFileSync(
      path.join(circusDir, 'package.json'),
      JSON.stringify({ name: 'jest-circus', exports: { './runner': './runner.js' } })
    );
    writeFileSync(path.join(circusDir, 'runner.js'), 'throw new Error("Resolution must not execute the runner");');
    writeFileSync(path.join(configDir, 'index.js'), '');
    writeFileSync(path.join(customDir, 'runner.js'), '');
    writeFileSync(path.join(missingDir, 'runner.js'), '');
    writeFileSync(path.join(unexportedDir, 'package.json'), JSON.stringify({ name: 'jest-circus', exports: {} }));
    writeFileSync(path.join(unexportedDir, 'runner.js'), '');
    symlinkSync(circusDir, path.join(configDir, '../jest-circus'), 'dir');

    const script = `
      const assert = require('node:assert/strict');
      const { createRequire } = require('node:module');
      const Environment = require(${JSON.stringify(adapter)});
      const configPath = ${JSON.stringify(path.join(configDir, 'index.js'))};
      const standard = createRequire(configPath).resolve('jest-circus/runner');
      assert.equal(standard, ${JSON.stringify(path.join(circusDir, 'runner.js'))});
      for (const origin of [${JSON.stringify(adapter)}, ${JSON.stringify(path.join(environmentDir, 'index.js'))}]) {
        assert.throws(() => createRequire(origin).resolve('jest-circus/runner'), { code: 'MODULE_NOT_FOUND' });
      }
      const custom = ${JSON.stringify(path.join(customDir, 'runner.js'))};
      const missing = ${JSON.stringify(path.join(missingDir, 'runner.js'))};
      const unexported = ${JSON.stringify(path.join(unexportedDir, 'runner.js'))};
      assert.equal(createRequire(custom).resolve('jest-circus/runner'), standard);
      assert.throws(() => createRequire(missing).resolve('jest-circus/runner'), { code: 'MODULE_NOT_FOUND' });
      assert.throws(() => createRequire(unexported).resolve('jest-circus/runner'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
      (async () => {
        for (const [testRunner, expectedStacks] of [[standard, 0], [custom, 1], [missing, 1], [unexported, 1]]) {
          const environment = new Environment({ projectConfig: {
            globals: {}, testEnvironmentOptions: {}, fakeTimers: {},
            id: 'isolated-resolution', rootDir: ${JSON.stringify(root)}, testRunner,
          } }, { console, testPath: configPath, docblockPragmas: {} });
          try {
            await environment.setup();
            let calls = 0;
            let stacks = 0;
            const descriptor = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
            try {
              Error.prepareStackTrace = () => { stacks++; return 'application timer'; };
              environment.global.setTimeout(() => calls++, 10);
            } finally {
              if (descriptor) Object.defineProperty(Error, 'prepareStackTrace', descriptor);
              else delete Error.prepareStackTrace;
            }
            assert.equal(stacks, expectedStacks, testRunner);
            await environment.global.happyDOM.waitUntilComplete();
            assert.equal(calls, 1, testRunner);
          } finally {
            await environment.teardown();
          }
        }
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    // Disable NODE_PATH and user/global module paths so a hoisted Circus cannot make this test pass.
    const result = runNode(['--no-global-search-paths', '-e', script], root);
    assert.equal(result.status, 0, result.output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('actual Circus enforces test and hook timeouts with real, modern and legacy timers', { timeout: 25000 }, () => {
  const root = mkdtempSync(path.join(tmpdir(), 'grafana-happy-dom-circus-'));
  try {
    const markerPath = path.join(root, 'events.txt');
    const resultPath = path.join(root, 'results.json');
    const cases = [];
    for (const kind of ['test', 'hook']) {
      for (const mode of ['real', 'modern', 'legacy']) {
        const name = `${kind}-${mode}`;
        cases.push({ kind, name });
        const body = `
          ${mode === 'real' ? '' : `jest.useFakeTimers({ legacyFakeTimers: ${mode === 'legacy'} });`}
          record('${name}:ready');
          await new Promise(() => {});
        `;
        writeFileSync(
          path.join(root, `${name}.test.js`),
          `
            const { appendFileSync } = require('node:fs');
            const record = value => appendFileSync(${JSON.stringify(markerPath)}, value + '\\n');
            afterEach(() => jest.useRealTimers());
            ${
              kind === 'test'
                ? `test('intentional timeout', async () => { ${body} }, 300);`
                : `
                  describe('timed out hook', () => {
                    beforeEach(async () => { ${body} }, 300);
                    test('blocked by hook', () => record('${name}:must-not-run'));
                  });
                `
            }
            test('surviving test', () => {
              expect(document.doctype.name).toBe('html');
              record('${name}:survived');
            });
          `
        );
      }
    }
    // Circus 29's deadline is itself tracked by Happy DOM. Awaiting waitUntilComplete() inside a
    // Jest test (or aborting its deadline) is an upstream limitation, also present before this bypass.
    writeFileSync(
      path.join(root, 'transitions.test.js'),
      `
        test.each([false, true])('fake-to-real timers, legacy=%s', async legacyFakeTimers => {
          const calls = [];
          jest.useFakeTimers({ legacyFakeTimers });
          try {
            const cancelled = setTimeout(() => calls.push('cancelled fake'), 10);
            clearTimeout(cancelled);
            setTimeout(value => calls.push(value), 10, 'fake');
            jest.advanceTimersByTime(10);
            expect(calls).toEqual(['fake']);
          } finally {
            jest.useRealTimers();
          }
          const cancelled = setTimeout(() => calls.push('cancelled real'), 0);
          clearTimeout(cancelled);
          await new Promise(resolve => setTimeout(value => { calls.push(value); resolve(); }, 10, 'real'));
          expect(calls).toEqual(['fake', 'real']);
        });
      `
    );
    const config = {
      rootDir: root,
      testEnvironment: adapterPath,
      testRunner: jestConfigRequire.resolve('jest-circus/runner'),
      testMatch: ['<rootDir>/*.test.js'],
      transform: {},
      testTimeout: 2000,
    };
    const result = runNode(
      [
        require.resolve('jest/bin/jest'),
        '--config',
        JSON.stringify(config),
        '--runInBand',
        '--no-watch',
        '--no-cache',
        '--json',
        '--outputFile',
        resultPath,
      ],
      root
    );
    // Do not use forceExit: the parent must verify that Jest exits without intervention.
    assert.equal(result.status, 1, result.output);
    const report = JSON.parse(readFileSync(resultPath, 'utf8'));
    assert.equal(report.numFailedTests, 6, result.output);
    assert.equal(report.numPassedTests, 8, result.output);
    assert.equal(report.numTotalTests, 14, result.output);
    const events = readFileSync(markerPath, 'utf8').trim().split('\n');
    assert.deepEqual(events.sort(), cases.flatMap(({ name }) => [`${name}:ready`, `${name}:survived`]).sort());
    for (const { kind, name } of cases) {
      const suite = report.testResults.find((suite) => suite.name === path.join(root, `${name}.test.js`));
      assert.ok(suite, result.output);
      const failed = suite.assertionResults.filter((result) => result.status === 'failed');
      assert.equal(failed.length, 1);
      assert.match(failed[0].failureMessages.join('\n'), new RegExp('Exceeded timeout of 300 ms for a ' + kind));
      assert.equal(suite.assertionResults.find((result) => result.title === 'surviving test').status, 'passed');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
