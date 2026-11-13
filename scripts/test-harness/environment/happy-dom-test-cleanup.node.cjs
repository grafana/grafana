// Run with node --test, with the approved native selection patch installed or preloaded.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const adapterPath = require.resolve('../../../public/test/happy-dom-environment');
const Environment = require(adapterPath);
const BaseEnvironment = require('@happy-dom/jest-environment').default;
const rootDir = path.resolve(__dirname, '../../..');
const jestRequire = createRequire(require.resolve('jest'));
const jestCoreRequire = createRequire(jestRequire.resolve('@jest/core'));
const jestConfigRequire = createRequire(jestCoreRequire.resolve('jest-config'));
const testRunner = jestConfigRequire.resolve('jest-circus/runner');
const options = { concurrency: false, timeout: 5000 };

async function withEnvironment(run) {
  const environment = new Environment(
    {
      projectConfig: {
        globals: {},
        testEnvironmentOptions: {},
        fakeTimers: {},
        id: 'test-cleanup',
        rootDir,
        testRunner,
      },
    },
    { console, testPath: __filename, docblockPragmas: {} }
  );
  try {
    await environment.setup();
    const window = environment.global;
    const text = window.document.createTextNode('abcdef');
    window.document.body.append(text);
    await run(environment, window, window.getSelection(), text);
  } finally {
    await environment.teardown();
  }
}

// Match Circus: environments without an event handler receive no callback.
const dispatch = (environment, name) => environment.handleTestEvent?.({ name }, {});

test('test_done cancels real selection notification before the next test reuses the window', options, async () => {
  await withEnvironment(async (environment, window, selection, text) => {
    const offsets = [];
    const timerCalls = [];
    window.document.addEventListener('selectionchange', () => offsets.push(selection.anchorOffset));
    selection.collapse(text, 1);
    window.setTimeout(() => timerCalls.push('cancelled'), 0);
    await dispatch(environment, 'test_done');
    await window.happyDOM.waitUntilComplete();
    assert.equal(selection.anchorOffset, 1);
    assert.deepEqual(offsets, []);
    assert.deepEqual(timerCalls, []);
    window.setTimeout(() => timerCalls.push('next test'), 0);
    selection.collapse(text, 4);
    await window.happyDOM.waitUntilComplete();
    assert.deepEqual(offsets, [4]);
    assert.deepEqual(timerCalls, ['next test']);
  });
});

for (const [mode, field] of [
  ['modern', 'fakeTimersModern'],
  ['legacy', 'fakeTimers'],
]) {
  test(`${mode}: clearAllTimers then test_done resets selection scheduling`, options, async () => {
    await withEnvironment(async (environment, window, selection, text) => {
      const timers = environment[field];
      const offsets = [];
      window.document.addEventListener('selectionchange', () => offsets.push(selection.anchorOffset));
      timers.useFakeTimers();
      try {
        // Cover both a clock left active and a clock restored by an afterEach hook.
        for (const restore of [false, true]) {
          offsets.length = 0;
          selection.collapse(text, 1);
          timers.clearAllTimers();
          if (restore) timers.useRealTimers();
          await dispatch(environment, 'test_done');
          if (restore) timers.useFakeTimers();
          selection.collapse(text, 4);
          timers.runOnlyPendingTimers();
          assert.deepEqual(offsets, [4]);
          await window.happyDOM.waitUntilComplete();
        }
      } finally {
        await window.happyDOM.abort();
        timers.useRealTimers();
      }
    });
  });
}

test('other Circus events do not cancel browser work', options, async () => {
  await withEnvironment(async (environment, window) => {
    const calls = [];
    window.setTimeout(() => calls.push('completed'), 1);
    await dispatch(environment, 'test_start');
    await window.happyDOM.waitUntilComplete();
    assert.deepEqual(calls, ['completed']);
  });
});

test('base event handling is forwarded and awaited before abort', options, async () => {
  const descriptor = Object.getOwnPropertyDescriptor(BaseEnvironment.prototype, 'handleTestEvent');
  try {
    await withEnvironment(async (environment, window) => {
      const event = { name: 'test_done' };
      const state = {};
      const order = [];
      Object.defineProperty(BaseEnvironment.prototype, 'handleTestEvent', {
        configurable: true,
        value: async function (receivedEvent, receivedState) {
          assert.equal(this, environment);
          assert.equal(receivedEvent, event);
          assert.equal(receivedState, state);
          order.push('base start');
          await Promise.resolve();
          order.push('base end');
        },
      });
      const abort = window.happyDOM.abort.bind(window.happyDOM);
      window.happyDOM.abort = async () => {
        order.push('abort start');
        await abort();
        order.push('abort end');
      };
      await environment.handleTestEvent(event, state);
      assert.deepEqual(order, ['base start', 'base end', 'abort start', 'abort end']);
    });
  } finally {
    if (descriptor) Object.defineProperty(BaseEnvironment.prototype, 'handleTestEvent', descriptor);
    else delete BaseEnvironment.prototype.handleTestEvent;
  }
});

test(
  'actual Circus cleans up after hooks and permits new work in following tests and afterAll',
  { timeout: 30000 },
  () => {
    const root = mkdtempSync(path.join(tmpdir(), 'grafana-happy-dom-test-cleanup-'));
    try {
      for (const mode of ['real', 'modern', 'legacy']) {
        writeFileSync(
          path.join(root, `${mode}.test.js`),
          `
        const events = [];
        let phase = 0;
        let text;
        let selection;
        beforeAll(() => {
          text = document.createTextNode('abcdef');
          document.body.append(text);
          selection = document.getSelection();
          document.addEventListener('selectionchange', () => events.push(selection.anchorOffset));

        });
        afterEach(async () => {
          if (phase === 1) {
            await Promise.resolve();
            selection.collapse(text, 1);
            ${mode === 'real' ? "setTimeout(() => events.push('leaked timer'), 0);" : 'jest.clearAllTimers(); jest.useRealTimers();'}
          }
        });
        test('leaves selection work in afterEach', () => {
          ${mode === 'real' ? '' : `jest.useFakeTimers({ legacyFakeTimers: ${mode === 'legacy'} });`}
          phase = 1;
          expect(selection.rangeCount).toBe(0);
        });
        test('next test starts after cleanup', async () => {
          phase = 2;
          expect(events).toEqual([]);
          expect(selection.anchorOffset).toBe(1);

          const delivered = new Promise(resolve => document.addEventListener('selectionchange', resolve, { once: true }));
          selection.collapse(text, 4);
          await delivered;
          await new Promise(resolve => setTimeout(resolve, 0));
          expect(events).toEqual([4]);

        });
        afterAll(async () => {
          await new Promise(resolve => setTimeout(resolve, 0));
          expect(events).toEqual([4]);
        });
      `
        );
      }
      const resultPath = path.join(root, 'results.json');
      const config = {
        rootDir: root,
        cacheDirectory: path.join(root, 'cache'),
        testEnvironment: adapterPath,
        testRunner,
        testMatch: ['<rootDir>/*.test.js'],
        transform: {},
        testTimeout: 1500,
      };
      // Forward parent preloads so in-memory native patches also reach this real Jest child.
      // Keep the project cwd so relative --require paths retain their meaning.
      const preloads = process.execArgv.filter(
        (arg, index, args) =>
          arg === '--require' ||
          arg === '-r' ||
          args[index - 1] === '--require' ||
          args[index - 1] === '-r' ||
          arg.startsWith('--require=')
      );
      const result = spawnSync(
        process.execPath,
        [
          ...preloads,
          require.resolve('jest/bin/jest'),
          '--config',
          JSON.stringify(config),
          '--runInBand',
          '--no-watch',
          '--watchAll=false',
          '--json',
          '--outputFile',
          resultPath,
        ],
        {
          cwd: rootDir,
          env: { ...process.env, FORCE_COLOR: '0' },
          encoding: 'utf8',
          timeout: 25000,
          maxBuffer: 4 * 1024 * 1024,
        }
      );
      const output = `${result.stdout}\n${result.stderr}`;
      assert.equal(result.error, undefined, output);
      assert.equal(result.signal, null, output);
      assert.equal(result.status, 0, output);
      const report = JSON.parse(readFileSync(resultPath, 'utf8'));
      assert.equal(report.numPassedTests, 6, output);
      assert.equal(report.numFailedTests, 0, output);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
);
