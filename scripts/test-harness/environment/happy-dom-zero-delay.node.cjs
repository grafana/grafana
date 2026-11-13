// Run with node --test, not Jest.
const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const { pathToFileURL } = require('node:url');
let Window;

before(async () => {
  ({ Window } = await import(pathToFileURL(require.resolve('happy-dom')).href));
});

function createWindow(t) {
  const window = new Window();
  t.after(() => window.happyDOM.close());
  return window;
}

const options = { timeout: 3000 };

test('abort discards a zero-delay batch and permits a new timer', options, async (t) => {
  const window = createWindow(t);
  const calls = [];
  window.setTimeout(() => calls.push('cancelled'), 0);
  await window.happyDOM.abort();
  window.setTimeout(() => calls.push('replacement'), 0);
  await window.happyDOM.waitUntilComplete();
  assert.deepEqual(calls, ['replacement']);
});

test('close ignores a zero-delay timer requested by an XHR abort listener', options, async (t) => {
  const window = createWindow(t);
  const calls = [];
  const xhr = new window.XMLHttpRequest();
  xhr.open('GET', 'data:text/plain,pending');
  xhr.addEventListener('abort', () => {
    calls.push(['abort', window.closed]);
    try {
      window.setTimeout(() => calls.push('timer'), 0);
      calls.push('returned');
    } catch (error) {
      calls.push(error);
    }
  });
  xhr.send();
  await window.happyDOM.close();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(window.closed, true);
  assert.deepEqual(calls, [['abort', false], 'returned']);
});

test('a zero-delay batch preserves order, arguments, and individual cancellation', options, async (t) => {
  const window = createWindow(t);
  const calls = [];
  window.setTimeout(() => calls.push('first'), 0);
  const cancelled = window.setTimeout(() => calls.push('cancelled'), 0);
  window.setTimeout((label, value) => calls.push(`${label}:${value}`), 0, 'last', 2);
  window.clearTimeout(cancelled);
  assert.deepEqual(calls, []);
  await window.happyDOM.waitUntilComplete();
  assert.deepEqual(calls, ['first', 'last:2']);
});

test('a reentrant zero-delay timer runs in the next task after the current batch', options, async (t) => {
  const window = createWindow(t);
  const order = [];
  window.setTimeout(() => {
    order.push('outer');
    window.setTimeout(() => order.push('inner'), 0);
    Promise.resolve().then(() => order.push('microtask'));
  }, 0);
  window.setTimeout(() => order.push('peer'), 0);
  await window.happyDOM.waitUntilComplete();
  assert.deepEqual(order, ['outer', 'peer', 'microtask', 'inner']);
});

test('aborting one window leaves another batch intact and allows local recovery', options, async (t) => {
  const first = createWindow(t);
  const second = createWindow(t);
  const calls = [];
  first.setTimeout(() => calls.push('cancelled'), 0);
  second.setTimeout(() => calls.push('independent'), 0);
  await first.happyDOM.abort();
  first.setTimeout(() => calls.push('replacement'), 0);
  await Promise.all([first.happyDOM.waitUntilComplete(), second.happyDOM.waitUntilComplete()]);
  assert.deepEqual(calls.sort(), ['independent', 'replacement']);
});
