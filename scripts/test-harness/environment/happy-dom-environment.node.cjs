const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const Environment = require('../../../public/test/happy-dom-environment');

function createEnvironment() {
  return new Environment(
    {
      projectConfig: {
        globals: {},
        testEnvironmentOptions: { customExportConditions: ['@grafana-app/source', 'browser'] },
        fakeTimers: {},
        id: 'happy-dom-environment-test',
        rootDir: path.resolve(__dirname, '../../..'),
      },
    },
    { console, testPath: __filename, docblockPragmas: {} }
  );
}

test('closes the root window and child frames during teardown', async () => {
  const environment = createEnvironment();
  const window = environment.global;
  let child;
  let timerFired = false;
  try {
    const iframe = window.document.createElement('iframe');
    iframe.src = 'about:blank';
    window.document.body.appendChild(iframe);
    await window.happyDOM.waitUntilComplete();
    child = iframe.contentWindow;
    assert.ok(child);
    assert.equal(window.closed, false);
    assert.equal(child.closed, false);
    window.setTimeout(() => { timerFired = true; }, 10000);
    child.setTimeout(() => { timerFired = true; }, 10000);
  } finally {
    await environment.teardown();
  }
  try {
    assert.equal(environment.global, null);
    assert.equal(window.closed, true);
    assert.equal(child.closed, true);
    assert.equal(timerFired, false);
  } finally {
    // Also release the control window when this regression runs against the old adapter.
    await window.happyDOM.close();
  }
});

for (const mode of ['fakeTimers', 'fakeTimersModern']) {
  test(`closes the root window with ${mode} active`, async () => {
    const environment = createEnvironment();
    const window = environment.global;
    const originalRect = Object.getOwnPropertyDescriptor(window.Element.prototype, 'getBoundingClientRect');
    let timerFired = false;
    try {
      environment[mode].useFakeTimers();
      window.setTimeout(() => { timerFired = true; }, 10000);
      window.Element.prototype.getBoundingClientRect = () => ({ width: 123 });
    } finally {
      await environment.teardown();
    }
    try {
      assert.equal(window.closed, true);
      assert.equal(timerFired, false);
      assert.deepEqual(Object.getOwnPropertyDescriptor(window.Element.prototype, 'getBoundingClientRect'), originalRect);
    } finally {
      await window.happyDOM.close();
    }
  });
}

test('disconnects native performance observers at the environment boundary', async () => {
  const { performance, PerformanceObserver } = require('node:perf_hooks');
  const environment = createEnvironment();
  const window = environment.global;
  const entries = [];
  const hostEntries = [];
  const observer = new window.PerformanceObserver((list) => entries.push(...list.getEntries().map(entry => entry.name)));
  const hostObserver = new PerformanceObserver((list) => hostEntries.push(...list.getEntries().map(entry => entry.name)));
  assert.deepEqual(window.PerformanceObserver.supportedEntryTypes, PerformanceObserver.supportedEntryTypes);
  const before = 'environment-observer-before';
  const after = 'environment-observer-after';
  try {
    observer.observe({ entryTypes: ['mark'] });
    hostObserver.observe({ entryTypes: ['mark'] });
    performance.mark(before);
    await new Promise(setImmediate);
    assert.deepEqual(entries, [before]);
    observer.disconnect();
    observer.observe({ entryTypes: ['mark'] });
    await environment.teardown();
    performance.mark(after);
    await new Promise(setImmediate);
    assert.deepEqual(entries, [before]);
    assert.deepEqual(hostEntries, [before, after]);
  } finally {
    observer.disconnect();
    hostObserver.disconnect();
    performance.clearMarks(before);
    performance.clearMarks(after);
    if (environment.global) await environment.teardown();
  }
});

test('restores prototypes when detached close fails and permits Jest to retry teardown', async () => {
  const environment = createEnvironment();
  const window = environment.global;
  const close = window.happyDOM.close.bind(window.happyDOM);
  const failure = new Error('close failed');
  const addedKey = Symbol('teardown failure');
  window.Element.prototype[addedKey] = true;
  window.happyDOM.close = async () => {
    await close();
    throw failure;
  };
  await assert.rejects(environment.teardown(), error => error === failure);
  assert.equal(window.closed, true);
  assert.equal(addedKey in window.Element.prototype, false);
  await environment.teardown();
});

test('restores prototype mocks between sequential Jest environments', async () => {
  const first = createEnvironment();
  const originalRect = Object.getOwnPropertyDescriptor(first.global.Element.prototype, 'getBoundingClientRect');
  const originalOffset = Object.getOwnPropertyDescriptor(first.global.HTMLElement.prototype, 'offsetWidth');
  const addedKey = Symbol('test-only prototype property');
  try {
    Object.defineProperty(first.global.Element.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 400 }),
    });
    Object.defineProperty(first.global.HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(first.global.Element.prototype, 'clientWidth', {
      configurable: true,
      get: () => 123,
    });
    first.global.Element.prototype[addedKey] = true;
    assert.equal(first.global.document.createElement('span').getBoundingClientRect().width, 400);
    assert.equal(first.global.document.createElement('span').clientWidth, 123);
  } finally {
    await first.teardown();
  }

  const second = createEnvironment();
  try {
    assert.deepEqual(Object.getOwnPropertyDescriptor(second.global.Element.prototype, 'getBoundingClientRect'), originalRect);
    assert.deepEqual(Object.getOwnPropertyDescriptor(second.global.HTMLElement.prototype, 'offsetWidth'), originalOffset);
    const span = second.global.document.createElement('span');
    assert.equal(span.getBoundingClientRect().width, 0);
    assert.equal(span.offsetWidth, 0);
    assert.equal(span.clientWidth, 0);
    assert.equal(addedKey in span, false);
    assert.equal(second.global.document.doctype.name, 'html');
    assert.equal(second.global.happyDOM.settings.enableJavaScriptEvaluation, false);
    assert.equal(second.global.happyDOM.settings.navigation.disableChildFrameNavigation, true);
  } finally {
    await second.teardown();
  }
});
