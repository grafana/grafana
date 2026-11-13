// Run with node --test, not Jest. Load candidate patches on the Node parent process.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { before, test } = require('node:test');
const { pathToFileURL } = require('node:url');

const fakeTimersRequire = createRequire(require.resolve('@jest/fake-timers'));
const { LegacyFakeTimers, ModernFakeTimers } = fakeTimersRequire('@jest/fake-timers');
const { ModuleMocker } = fakeTimersRequire('jest-mock');
let Window;

before(async () => {
  ({ Window } = await import(pathToFileURL(require.resolve('happy-dom')).href));
});

function selectionTest(name, run) {
  test(name, { concurrency: false, timeout: 3000 }, async () => {
    const window = new Window();
    const text = window.document.createTextNode('abcdef');
    window.document.body.append(text);
    try {
      await run(window, window.getSelection(), text);
    } finally {
      await window.happyDOM.close();
    }
  });
}

selectionTest(
  'state updates synchronously; notification follows nested microtasks',
  async (window, selection, text) => {
    const order = [];
    window.document.addEventListener('selectionchange', () => order.push('event'));
    selection.setBaseAndExtent(text, 4, text, 1);
    assert.equal(selection.anchorNode, text);
    assert.equal(selection.anchorOffset, 4);
    assert.equal(selection.focusOffset, 1);
    assert.equal(selection.toString(), 'bcd');
    order.push('stack');
    await Promise.resolve().then(() => Promise.resolve().then(() => order.push('microtask')));
    assert.deepEqual(order, ['stack', 'microtask']);
    await window.happyDOM.waitUntilComplete();
    assert.deepEqual(order, ['stack', 'microtask', 'event']);
  }
);

selectionTest('changes through a microtask coalesce and expose the latest state', async (window, selection, text) => {
  const states = [];
  window.document.addEventListener('selectionchange', () => states.push(selection.toString()));
  selection.collapse(text, 0);
  selection.extend(text, 2);
  await Promise.resolve();
  selection.setBaseAndExtent(text, 5, text, 1);
  await window.happyDOM.waitUntilComplete();
  assert.deepEqual(states, ['bcde']);
});

selectionTest('listener changes schedule another task without reentry', async (window, selection, text) => {
  const order = [];
  let calls = 0;
  window.document.addEventListener('selectionchange', () => {
    order.push(`event ${++calls}`);
    if (calls === 1) {
      selection.collapse(text, 3);
      order.push('changed');
      Promise.resolve().then(() => order.push('microtask'));
    }
  });
  selection.collapse(text, 1);
  await window.happyDOM.waitUntilComplete();
  assert.deepEqual(order, ['event 1', 'changed', 'microtask', 'event 2']);
  assert.equal(selection.anchorOffset, 3);
});

selectionTest(
  'explicit dispatch stays synchronous without consuming the native task',
  async (window, selection, text) => {
    const explicit = new window.Event('selectionchange', { cancelable: true });
    const order = [];
    window.document.addEventListener('selectionchange', (event) => {
      order.push(event === explicit ? 'explicit' : 'native');
      event.preventDefault();
    });
    selection.collapse(text, 2);
    assert.equal(window.document.dispatchEvent(explicit), false);
    assert.deepEqual(order, ['explicit']);
    await window.happyDOM.waitUntilComplete();
    assert.deepEqual(order, ['explicit', 'native']);
  }
);

selectionTest(
  'windows schedule independently and closing one cancels its notification',
  async (window, selection, text) => {
    const other = new Window();
    const events = [];
    try {
      other.document.body.textContent = 'other';
      window.document.addEventListener('selectionchange', () => events.push('first'));
      other.document.addEventListener('selectionchange', () => events.push('second'));
      selection.collapse(text, 1);
      other.getSelection().selectAllChildren(other.document.body);
      await Promise.all([window.happyDOM.waitUntilComplete(), other.happyDOM.waitUntilComplete()]);
      assert.deepEqual(events.sort(), ['first', 'second']);
      events.length = 0;
      other.getSelection().removeAllRanges();
      await other.happyDOM.close();
      selection.collapse(text, 3);
      await window.happyDOM.waitUntilComplete();
      assert.equal(other.closed, true);
      assert.deepEqual(events, ['first']);
    } finally {
      await other.happyDOM.close();
    }
  }
);

selectionTest(
  'abort cancels the native task, preserves state, and permits rescheduling',
  async (window, selection, text) => {
    const offsets = [];
    window.document.addEventListener('selectionchange', () => offsets.push(selection.anchorOffset));
    selection.collapse(text, 1);
    await window.happyDOM.abort();
    assert.equal(selection.anchorOffset, 1);
    assert.deepEqual(offsets, []);
    selection.collapse(text, 4);
    await window.happyDOM.waitUntilComplete();
    assert.deepEqual(offsets, [4]);
  }
);

selectionTest(
  'close preserves synchronous selection changes from an XHR abort listener without notification',
  async (window, selection, text) => {
    const calls = [];
    window.document.addEventListener('selectionchange', () => calls.push('selectionchange'));
    const xhr = new window.XMLHttpRequest();
    xhr.open('GET', 'data:text/plain,pending');
    xhr.addEventListener('abort', () => {
      calls.push(['abort', window.closed]);
      try {
        selection.collapse(text, 2);
        calls.push(['state', selection.anchorNode === text, selection.anchorOffset]);
      } catch (error) {
        calls.push(error);
      }
    });
    xhr.send();
    await window.happyDOM.close();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(window.closed, true);
    assert.deepEqual(calls, [
      ['abort', false],
      ['state', true, 2],
    ]);
  }
);

async function withFakeTimers(mode, window, run) {
  // Jest supplies process; isolate its fake nextTick from the Node test runner.
  window.process = { nextTick: process.nextTick };
  const config = { rootDir: process.cwd(), fakeTimers: {} };
  const timers =
    mode === 'modern'
      ? new ModernFakeTimers({ global: window, config })
      : new LegacyFakeTimers({
          global: window,
          config,
          moduleMocker: new ModuleMocker(window),
          timerConfig: { idToRef: (id) => id, refToId: (id) => id },
        });
  timers.useFakeTimers();
  try {
    await run(timers);
  } finally {
    // Cancel while this clock still owns the pending timeout handles.
    await window.happyDOM.abort();
    timers.useRealTimers();
    timers.dispose();
  }
}

for (const mode of ['modern', 'legacy']) {
  selectionTest(
    `${mode} fake timers control delivery while completion tracks the task`,
    async (window, selection, text) => {
      const offsets = [];
      window.document.addEventListener('selectionchange', () => offsets.push(selection.anchorOffset));
      await withFakeTimers(mode, window, async (timers) => {
        selection.collapse(text, 1);
        selection.collapse(text, 3);
        let completed = false;
        const completion = window.happyDOM.waitUntilComplete().then(() => {
          completed = true;
        });
        // A captured host task must not bypass the fake clock.
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.deepEqual(offsets, []);
        assert.equal(completed, false);
        timers.runOnlyPendingTimers();
        await completion;
        assert.deepEqual(offsets, [3]);
        assert.equal(completed, true);
      });
    }
  );

  selectionTest(`${mode} abort recovers both pending and discarded fake timers`, async (window, selection, text) => {
    const offsets = [];
    window.document.addEventListener('selectionchange', () => offsets.push(selection.anchorOffset));
    await withFakeTimers(mode, window, async (timers) => {
      selection.collapse(text, 1);
      await window.happyDOM.abort();
      timers.runOnlyPendingTimers();
      assert.deepEqual(offsets, []);
      selection.collapse(text, 2);
      timers.clearAllTimers();
      await window.happyDOM.abort();
      await window.happyDOM.waitUntilComplete();
      selection.collapse(text, 4);
      timers.runOnlyPendingTimers();
      await window.happyDOM.waitUntilComplete();
      assert.deepEqual(offsets, [4]);
    });
    selection.collapse(text, 5);
    await window.happyDOM.waitUntilComplete();
    assert.deepEqual(offsets, [4, 5]);
  });
}
