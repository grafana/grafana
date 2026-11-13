const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let Window;
before(async () => {
  ({ Window } = await import('happy-dom'));
});

function createWindow(t) {
  const window = new Window({ url: 'https://example.test/' });
  t.after(() => window.happyDOM.close());
  return window;
}

test('abort discards queued hashchange events before the window is reused', async (t) => {
  const window = createWindow(t);
  window.location.hash = '#previous';
  await window.happyDOM.abort();
  assert.equal(window.location.hash, '#previous');

  const events = [];
  window.addEventListener('hashchange', (event) => events.push([event.oldURL, event.newURL]));
  window.location.hash = '#current';
  await window.happyDOM.waitUntilComplete();
  assert.deepEqual(events, [['https://example.test/#previous', 'https://example.test/#current']]);
});

test('queued hash changes retain every old/new URL pair in order', async (t) => {
  const window = createWindow(t);
  const events = [];
  window.addEventListener('hashchange', (event) => events.push([event.oldURL, event.newURL]));
  window.location.hash = '#one';
  window.location.hash = '#two';
  window.location.hash = '#three';
  assert.deepEqual(events, []);
  await window.happyDOM.waitUntilComplete();
  assert.deepEqual(events, [
    ['https://example.test/', 'https://example.test/#one'],
    ['https://example.test/#one', 'https://example.test/#two'],
    ['https://example.test/#two', 'https://example.test/#three'],
  ]);
});

test('a hashchange listener can schedule a later notification', async (t) => {
  const window = createWindow(t);
  const order = [];
  window.addEventListener('hashchange', (event) => {
    order.push(new URL(event.newURL).hash);
    if (window.location.hash === '#one') {
      window.location.hash = '#two';
      Promise.resolve().then(() => order.push('microtask'));
    }
  });
  window.location.hash = '#one';
  await window.happyDOM.waitUntilComplete();
  assert.deepEqual(order, ['#one', 'microtask', '#two']);
});

test('an XHR abort listener can update the hash while the window closes', async (t) => {
  const window = createWindow(t);
  const errors = [];
  const events = [];
  let aborted = false;
  window.addEventListener('hashchange', () => events.push('hashchange'));
  const xhr = new window.XMLHttpRequest();
  xhr.open('GET', 'data:text/plain,hello');
  xhr.onabort = () => {
    aborted = true;
    try {
      window.location.hash = '#closing';
    } catch (error) {
      errors.push(error);
    }
  };
  xhr.send();
  await window.happyDOM.close();
  assert.equal(aborted, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(events, []);
});
