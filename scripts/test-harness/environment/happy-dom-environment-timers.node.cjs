// Run with node --test, not Jest.
// The Jasmine checks exercise stack routing, not a full Jasmine runner.

const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

const path = require('node:path');
const { test } = require('node:test');

const vm = require('node:vm');

const Environment = require('../../../public/test/happy-dom-environment');
const rootDir = path.resolve(__dirname, '../../..');
// Follow Jest's dependency tree because pnpm need not hoist Circus to the project root.
const jestRequire = createRequire(require.resolve('jest'));
const jestCoreRequire = createRequire(jestRequire.resolve('@jest/core'));
const jestConfigRequire = createRequire(jestCoreRequire.resolve('jest-config'));
const standardCircus = jestConfigRequire.resolve('jest-circus/runner');
const testOptions = { concurrency: false, timeout: 5000 };

async function withEnvironment(testRunner, run, settings = {}) {
  const environment = new Environment(
    {
      projectConfig: {
        globals: {},
        testEnvironmentOptions: { customExportConditions: ['@grafana-app/source', 'browser'], settings },
        fakeTimers: {},
        id: 'happy-dom-timer-regression',
        rootDir,
        ...(testRunner === undefined ? {} : { testRunner }),
      },
    },
    { console, testPath: __filename, docblockPragmas: {} }
  );
  try {
    await environment.setup();
    await run(environment);
  } finally {
    await environment.teardown();
  }
}

async function bounded(promise, label) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        // This is the host timer, never the environment's real/fake timer.
        timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 1500);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function countStackFormatting(run) {
  // The ESM wrapper uses the host Error, not environment.global.Error.
  // Keep the hook synchronous so Node's test runner cannot format errors inside this scope.
  const descriptor = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
  let count = 0;
  Object.defineProperty(Error, 'prepareStackTrace', {
    configurable: true,
    writable: true,
    value(error, frames) {
      count++;
      return `${error.name}: ${error.message}\n${frames.map((frame) => `    at ${frame}`).join('\n')}`;
    },
  });
  try {
    run();
    return count;
  } finally {
    if (descriptor) {
      Object.defineProperty(Error, 'prepareStackTrace', descriptor);
    } else {
      delete Error.prepareStackTrace;
    }
  }
}

test('compatibility: real timers forward arguments and clearTimeout cancels callbacks', testOptions, async () => {
  await withEnvironment(standardCircus, async ({ global: window }) => {
    const calls = [];
    const payload = { value: 42 };
    const cancelled = window.setTimeout(() => calls.push('cancelled'), 0);
    window.clearTimeout(cancelled);
    window.setTimeout((...args) => calls.push(args), 10, 'application', payload, 7);
    await bounded(window.happyDOM.waitUntilComplete(), 'real timers');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], ['application', payload, 7]);
    assert.equal(calls[0][1], payload);
  });
});

test('compatibility: waitUntilComplete awaits an application timer and its nested timer', testOptions, async () => {
  await withEnvironment(standardCircus, async ({ global: window }) => {
    const events = [];
    window.setTimeout(() => {
      events.push('outer');
      window.setTimeout(() => events.push('inner'), 10);
    }, 10);
    await bounded(window.happyDOM.waitUntilComplete(), 'nested application timers');
    events.push('complete');
    assert.deepEqual(events, ['outer', 'inner', 'complete']);
  });
});

test('compatibility: abort cancels pending application timers and allows completion', testOptions, async () => {
  await withEnvironment(standardCircus, async ({ global: window }) => {
    const events = [];
    window.setTimeout(() => events.push('cancelled'), 20);
    await bounded(window.happyDOM.abort(), 'abort');
    await bounded(window.happyDOM.waitUntilComplete(), 'completion after abort');
    events.push('complete');
    // Abort ends this environment's task lifecycle; use a host timer to pass the cancelled deadline.
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.deepEqual(events, ['complete']);
  });
});

for (const [mode, field] of [
  ['modern', 'fakeTimersModern'],
  ['legacy', 'fakeTimers'],
]) {
  test(`compatibility: ${mode} fake timers restore tracked real timers`, testOptions, async () => {
    await withEnvironment(standardCircus, async (environment) => {
      const window = environment.global;
      const fakeTimers = environment[field];
      const events = [];
      fakeTimers.useFakeTimers();
      try {
        const cancelled = window.setTimeout(() => events.push('cancelled fake'), 10);
        window.clearTimeout(cancelled);
        window.setTimeout((value) => events.push(value), 10, 'fake');
        fakeTimers.advanceTimersByTime(9);
        assert.deepEqual(events, []);
        fakeTimers.advanceTimersByTime(1);
        assert.deepEqual(events, ['fake']);
      } finally {
        fakeTimers.useRealTimers();
      }
      const cancelled = window.setTimeout(() => events.push('cancelled real'), 0);
      window.clearTimeout(cancelled);
      const formatted = countStackFormatting(() => {
        window.setTimeout((value) => events.push(value), 10, 'real');
      });
      assert.equal(formatted, 0, `${mode} fake timers must restore the unwrapped Happy DOM timer`);
      await bounded(window.happyDOM.waitUntilComplete(), `${mode} fake-to-real transition`);
      assert.deepEqual(events, ['fake', 'real']);
    });
  });
}

test('optimization: standard Circus real timers do not format Error.stack', testOptions, async () => {
  await withEnvironment(standardCircus, async ({ global: window }) => {
    const events = [];
    const formatted = countStackFormatting(() => {
      const { setTimeout } = window;
      setTimeout((value) => events.push(value), 0, 'application timer');
      setTimeout.call({}, (value) => events.push(value), 10, 'bound timer');
    });
    await bounded(window.happyDOM.waitUntilComplete(), 'Circus application timer');
    assert.deepEqual(events, ['application timer', 'bound timer']);
    assert.equal(formatted, 0, 'standard resolved Circus must bypass the Jasmine stack wrapper');
  });
});

test('compatibility: Circus keeps Happy DOM timer-loop stack inspection enabled when requested', testOptions, async () => {
  await withEnvironment(
    standardCircus,
    async ({ global: window }) => {
      const events = [];
      const formatted = countStackFormatting(() => {
        window.setTimeout(() => events.push('tracked'), 10);
      });
      assert.ok(formatted > 0, 'the bypass must not disable Error.stack globally or change timer settings');
      await bounded(window.happyDOM.waitUntilComplete(), 'timer with loop prevention');
      assert.deepEqual(events, ['tracked']);
    },
    { timer: { preventTimerLoops: true } }
  );
});

const unknownRunners = [
  ['missing runner', undefined],
  ['unresolved Circus specifier', 'jest-circus/runner'],
  ['null runner', null],
  ['non-string runner', {}],
  ['Jasmine runner', path.join(rootDir, 'custom/jest-jasmine2/build/index.js')],
  ['custom runner with Circus-like suffix', path.join(rootDir, 'custom/jest-circus/runner.js')],
  ['unknown runner', path.join(rootDir, 'custom/runner.cjs')],
];

for (const [label, runner] of unknownRunners) {
  test(`compatibility: ${label} retains stack inspection and application tracking`, testOptions, async () => {
    await withEnvironment(runner, async ({ global: window }) => {
      const events = [];
      const formatted = countStackFormatting(() => {
        window.setTimeout(() => events.push('tracked'), 10);
      });
      assert.ok(formatted > 0, 'only the exact resolved standard Circus runner may bypass the wrapper');
      await bounded(window.happyDOM.waitUntilComplete(), `${label} application timer`);
      assert.deepEqual(events, ['tracked']);
    });
  });
}

// A real V8 stack contains this filename; no Jasmine package or forged Error.stack is needed.
const scheduleFromJasmine = vm.runInThisContext(
  '(function scheduleFromJasmine(window, callback, delay, ...args) { return window.setTimeout(callback, delay, ...args); })',
  { filename: '/timer-regression/jest-jasmine2/build/queueRunner.js' }
);

for (const [label, runner] of [
  ['unknown runner', path.join(rootDir, 'custom/runner.cjs')],
  ['Jasmine runner', '/timer-regression/jest-jasmine2/build/index.js'],
]) {
  test(`compatibility: ${label} routes a simulated Jasmine timeout outside Happy DOM tracking`, testOptions, async () => {
    await withEnvironment(runner, async ({ global: window }) => {
      const events = [];
      let handle;
      const fired = new Promise((resolve) => {
        handle = scheduleFromJasmine(
          window,
          (...args) => {
            events.push(args);
            resolve();
          },
          100,
          'runner timeout',
          42
        );
      });
      try {
        await bounded(window.happyDOM.waitUntilComplete(), 'completion excluding runner timeout');
        assert.deepEqual(events, [], 'waitUntilComplete must not wait for the runner timeout');
        await bounded(window.happyDOM.abort(), 'abort excluding runner timeout');
        await bounded(fired, 'runner timeout surviving abort');
        assert.deepEqual(events, [['runner timeout', 42]]);
      } finally {
        // Native timers are deliberately not owned by the environment's teardown.
        clearTimeout(handle);
        window.clearTimeout(handle);
      }
    });
  });
}
