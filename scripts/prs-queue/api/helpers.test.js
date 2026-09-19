const assert = require('node:assert/strict');
const test = require('node:test');

const { mapWithLimit } = require('./helpers');

// Resolves only when released, so a test can hold every task open at once and see that it started.
function gate() {
  const pending = [];
  return {
    wait: () => new Promise((resolve) => pending.push(resolve)),
    releaseAll: () => {
      for (const resolve of pending.splice(0)) {
        resolve();
      }
    },
  };
}

test('mapWithLimit: results come back in input order, not completion order', async () => {
  const delays = [30, 0, 10];

  const results = await mapWithLimit(delays, 3, async (delay, index) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return index;
  });

  assert.deepEqual(results, [0, 1, 2]);
});

test('mapWithLimit: never runs more than the limit at once', async () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  let running = 0;
  let peak = 0;

  await mapWithLimit(items, 3, async (item) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setImmediate(resolve));
    running -= 1;
    return item;
  });

  assert.equal(peak, 3);
});

test('mapWithLimit: a slow task does not block the others', async () => {
  const held = gate();
  const started = [];

  const all = mapWithLimit([1, 2, 3], 3, async (item) => {
    started.push(item);
    await held.wait();
    return item;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [1, 2, 3]);

  held.releaseAll();
  assert.deepEqual(await all, [1, 2, 3]);
});

test('mapWithLimit: a limit above the item count starts one worker per item', async () => {
  let peak = 0;
  let running = 0;

  await mapWithLimit([1, 2], 10, async (item) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setImmediate(resolve));
    running -= 1;
    return item;
  });

  assert.equal(peak, 2);
});

test('mapWithLimit: an empty list runs nothing', async () => {
  let calls = 0;

  const results = await mapWithLimit([], 4, async () => {
    calls += 1;
  });

  assert.deepEqual(results, []);
  assert.equal(calls, 0);
});

test('mapWithLimit: a rejecting task rejects the whole run', async () => {
  await assert.rejects(
    () =>
      mapWithLimit([1, 2, 3], 2, async (item) => {
        if (item === 2) {
          throw new Error('boom');
        }
        return item;
      }),
    /boom/
  );
});
