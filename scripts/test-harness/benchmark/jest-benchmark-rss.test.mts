import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { startRssSampler } from '../../jest-benchmark-rss.mts';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function ioError(code: string) {
  return Object.assign(new Error(code), { code });
}

type Process = { rss: number; threads?: Record<string, number[]>; status?: string };
type Tree = Record<number, Process | Error>;

function fixture(initial: Tree) {
  let tree = initial;
  let clock = 0;
  let sleeping = deferred();
  let wake = () => {};
  let activeSleeps = 0;
  const paths: string[] = [];
  const waits: number[] = [];
  const options = {
    platform: 'linux',
    now: () => clock,
    async readText(path: string) {
      paths.push(path);
      const match = /^\/proc\/(\d+)\/(status|task\/(\d+)\/children)$/.exec(path);
      assert.ok(match, `Unexpected proc read: ${path}`);
      const entry = tree[Number(match[1])];
      if (!entry || entry instanceof Error) {
        throw entry ?? ioError('ENOENT');
      }
      return match[2] === 'status'
        ? (entry.status ?? `State:\tS (sleeping)\nVmRSS:\t${entry.rss} kB\n`)
        : (entry.threads?.[match[3]] ?? []).join(' ');
    },
    async listTasks(path: string) {
      assert.match(path, /^\/proc\/\d+\/task$/);
      const pid = Number(path.split('/')[2]);
      const entry = tree[pid];
      assert.ok(entry && !(entry instanceof Error));
      return Object.keys(entry.threads ?? { [pid]: [] });
    },
    sleep(ms: number, signal: AbortSignal) {
      waits.push(ms);
      activeSleeps++;
      return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          activeSleeps--;
          signal.removeEventListener('abort', abort);
        };
        const abort = () => {
          cleanup();
          reject(signal.reason);
        };
        wake = () => {
          cleanup();
          resolve();
        };
        signal.addEventListener('abort', abort, { once: true });
        sleeping.resolve();
      });
    },
  };
  return {
    options,
    paths,
    waits,
    get activeSleeps() {
      return activeSleeps;
    },
    settled: () => sleeping.promise,
    setTime(ms: number) {
      clock = ms;
    },
    async advance(ms: number, next: Tree) {
      clock = ms;
      tree = next;
      sleeping = deferred();
      wake();
      await sleeping.promise;
    },
  };
}

test('sums each tree snapshot, tracks replacements and orphans, and time-weights irregular intervals', async () => {
  const f = fixture({
    1: { rss: 100, threads: { 1: [2], 11: [2] } },
    2: { rss: 10 },
  });
  const sampler = startRssSampler(1, f.options);
  assert.deepEqual(f.paths, ['/proc/1/status']); // First poll starts without waiting for the interval.
  await f.settled();
  await f.advance(100, {
    1: { rss: 10, threads: { 1: [], 11: [3] } },
    3: { rss: 100 },
  });
  await f.advance(400, {
    3: { rss: 20, threads: { 3: [4] } },
    4: { rss: 30 },
  });
  f.setTime(500);
  const stopping = sampler.stop();
  assert.equal(sampler.stop(), stopping);
  assert.deepEqual(await stopping, {
    supported: true,
    intervalMs: 250,
    samples: 3,
    peakBytes: 110 * 1024,
    averageBytes: 98 * 1024,
    durationMs: 500,
    errors: [],
  });
  assert.equal(f.paths.filter((path) => path === '/proc/2/status').length, 2);
  assert.equal(f.activeSleeps, 0);
});

test('counts exited and zombie processes as zero without reporting benign exit races', async () => {
  const f = fixture({
    1: { rss: 12, threads: { 1: [2, 3, 4] } },
    2: ioError('ESRCH'),
    3: ioError('ENOENT'),
    4: { rss: 0, status: 'State:\tZ (zombie)\n' },
  });
  const sampler = startRssSampler(1, { ...f.options, intervalMs: 20 });
  await f.settled();
  await f.advance(20, {});
  f.setTime(40);
  const metrics = await sampler.stop();
  assert.equal(metrics.samples, 2);
  assert.equal(metrics.peakBytes, 12 * 1024);
  assert.equal(metrics.averageBytes, 6 * 1024);
  assert.equal(metrics.intervalMs, 20);
  assert.deepEqual(metrics.errors, []);
  assert.deepEqual(f.waits, [20, 20]);
});

test('skips incomplete totals, retains inaccessible descendants, and recovers on the next poll', async () => {
  const f = fixture({ 1: { rss: 10, threads: { 1: [2] } }, 2: { rss: 30 } });
  const sampler = startRssSampler(1, f.options);
  await f.settled();
  await f.advance(100, { 2: ioError('EACCES') });
  await f.advance(200, { 2: { rss: 20 } });
  f.setTime(300);
  const metrics = await sampler.stop();
  assert.equal(metrics.samples, 2);
  assert.equal(metrics.averageBytes, (100 * 1024) / 3);
  assert.deepEqual(metrics.errors, ['/proc/2/status: EACCES']);
});

test('removes exited descendants even when another process makes the poll incomplete', async () => {
  const f = fixture({ 1: { rss: 10, threads: { 1: [2] } }, 2: { rss: 30 } });
  const sampler = startRssSampler(1, f.options);
  await f.settled();
  await f.advance(100, { 1: ioError('EACCES') });
  await f.advance(200, { 1: { rss: 10 }, 2: { rss: 1000 } });
  f.setTime(300);
  const metrics = await sampler.stop();
  assert.equal(metrics.samples, 2);
  assert.equal(metrics.peakBytes, 40 * 1024);
  assert.equal(metrics.averageBytes, 30 * 1024);
  assert.equal(f.paths.filter((path) => path === '/proc/2/status').length, 2);
  assert.deepEqual(metrics.errors, ['/proc/1/status: EACCES']);
});

test('bounds and deduplicates error details and returns null when no poll succeeds', async () => {
  const f = fixture({ 1: ioError('EACCES') });
  const sampler = startRssSampler(1, f.options);
  await f.settled();
  await f.advance(10, { 1: ioError('EACCES') });
  for (let index = 0; index < 12; index++) {
    await f.advance(20 + index, { 1: new Error(`${index}: ${'x'.repeat(500)}`) });
  }
  const metrics = await sampler.stop();
  assert.equal(metrics.samples, 0);
  assert.equal(metrics.peakBytes, null);
  assert.equal(metrics.averageBytes, null);
  assert.equal(metrics.errors.length, 8);
  assert.equal(new Set(metrics.errors).size, 8);
  assert.ok(metrics.errors.every((detail) => detail.length <= 240));
  assert.equal(metrics.errors.filter((detail) => detail.includes('EACCES')).length, 1);
});

test('reports malformed RSS and child-discovery failures instead of publishing partial totals', async () => {
  const f = fixture({ 1: { rss: 1, status: 'VmRSS:\tinvalid kB\n' } });
  const sampler = startRssSampler(1, {
    ...f.options,
    listTasks: async () => {
      throw ioError('EACCES');
    },
  });
  await f.settled();
  const metrics = await sampler.stop();
  assert.equal(metrics.samples, 0);
  assert.deepEqual(metrics.errors, ['/proc/1/status: missing or invalid VmRSS', '/proc/1/task: EACCES']);
});

test('does not overlap a pending poll and aborts its read on stop', async () => {
  const reading = deferred();
  let reads = 0;
  let aborted = 0;
  let clock = 0;
  const sampler = startRssSampler(1, {
    platform: 'linux',
    now: () => clock,
    readText: (_path, signal) =>
      new Promise<string>((_resolve, reject) => {
        reads++;
        signal.addEventListener(
          'abort',
          () => {
            aborted++;
            reject(signal.reason);
          },
          { once: true }
        );
        reading.resolve();
      }),
    listTasks: async () => assert.fail('Must not continue an aborted poll'),
    sleep: async () => assert.fail('Must not schedule after stop'),
  });
  await reading.promise;
  clock = 1000;
  const metrics = await sampler.stop();
  assert.equal(reads, 1);
  assert.equal(aborted, 1);
  assert.equal(metrics.durationMs, 1000);
  assert.equal(metrics.samples, 0);
  assert.equal(metrics.averageBytes, null);
  assert.deepEqual(metrics.errors, []);
});

test('waits for non-abortable task enumeration without continuing the poll or extending duration', async () => {
  const entered = deferred();
  const tasks = deferred<string[]>();
  let clock = 0;
  const sampler = startRssSampler(1, {
    platform: 'linux',
    now: () => clock,
    readText: async (path) => {
      assert.equal(path, '/proc/1/status');
      return 'VmRSS: 10 kB\n';
    },
    listTasks: () => {
      entered.resolve();
      return tasks.promise;
    },
    sleep: async () => assert.fail('Must not sleep after stop'),
  });
  await entered.promise;
  clock = 50;
  const stopped = sampler.stop();
  clock = 100;
  tasks.resolve(['1']);
  const metrics = await stopped;
  assert.equal(metrics.durationMs, 50);
  assert.equal(metrics.samples, 0);
  assert.deepEqual(metrics.errors, []);
});

test('catches unexpected loop failures without an unhandled rejection', async () => {
  const f = fixture({ 1: { rss: 10 } });
  const failed = deferred();
  const sampler = startRssSampler(1, {
    ...f.options,
    sleep: async () => {
      failed.resolve();
      throw new Error('timer failed');
    },
  });
  await failed.promise;
  await new Promise<void>((resolve) => setImmediate(resolve));
  const metrics = await sampler.stop();
  assert.deepEqual(metrics.errors, ['timer failed']);
  assert.equal(metrics.samples, 1);
  assert.equal(metrics.averageBytes, 10 * 1024);
});

test('returns unsupported null metrics on non-Linux platforms without touching proc or scheduling', async () => {
  let clock = 10;
  const unexpected = async () => assert.fail('Unsupported platforms must not poll');
  const sampler = startRssSampler(123, {
    platform: 'darwin',
    now: () => clock,
    readText: unexpected,
    listTasks: unexpected,
    sleep: unexpected,
  });
  clock = 60;
  assert.deepEqual(await sampler.stop(), {
    supported: false,
    intervalMs: 250,
    samples: 0,
    peakBytes: null,
    averageBytes: null,
    durationMs: 50,
    errors: [],
  });
});

test('rejects invalid process IDs and intervals before scheduling', () => {
  for (const pid of [0, -1, NaN, 1.5, Infinity]) {
    assert.throws(() => startRssSampler(pid), RangeError);
  }
  for (const intervalMs of [0, -1, NaN, Infinity, 2 ** 31]) {
    assert.throws(() => startRssSampler(1, { intervalMs }), RangeError);
  }
});

test('Linux smoke: samples a real child and grandchild after an IPC readiness handshake', {
  skip: process.platform !== 'linux',
  timeout: 10000,
}, async (t) => {
  const grandchildCode = `
    global.memory = Buffer.alloc(16 * 1024 * 1024, 1);
    process.on('message', () => process.exit(0));
    process.send({ ready: process.pid });
  `;
  const child = spawn(process.execPath, ['-e', `
    const { spawn } = require('node:child_process');
    global.memory = Buffer.alloc(8 * 1024 * 1024, 1);
    const grandchild = spawn(process.execPath, ['-e', ${JSON.stringify(grandchildCode)}], {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    grandchild.on('message', (message) => process.send(message));
    process.on('message', () => grandchild.send('stop'));
    grandchild.on('exit', () => process.exit(0));
  `], { detached: true, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
          throw error;
        }
      }
      await exited;
    }
  });
  const [message] = await once(child, 'message');
  const grandchildPid = (message as { ready: number }).ready;
  const sampled = deferred();
  const observed = new Map<number, number>();
  const sampler = startRssSampler(child.pid!, {
    async readText(path, signal) {
      const content = await readFile(path, { encoding: 'utf8', signal });
      if (path.endsWith('/status')) {
        observed.set(Number(path.split('/')[2]), Number(/^VmRSS:\s+(\d+)/m.exec(content)?.[1]) * 1024);
      }
      return content;
    },
    sleep(ms, signal) {
      sampled.resolve();
      return delay(ms, undefined, { signal });
    }
  });
  t.after(() => sampler.stop());
  await sampled.promise;
  const metrics = await sampler.stop();
  assert.deepEqual([...observed.keys()].sort(), [child.pid!, grandchildPid].sort());
  assert.ok(observed.get(child.pid!)! > 0);
  assert.ok(observed.get(grandchildPid)! > 0);
  assert.equal(metrics.samples, 1);
  assert.equal(metrics.peakBytes, observed.get(child.pid!)! + observed.get(grandchildPid)!);
  assert.ok(Math.abs(metrics.averageBytes! - metrics.peakBytes!) < 1);
  assert.deepEqual(metrics.errors, []);
  const exited = once(child, 'exit');
  child.send('stop');
  assert.deepEqual(await exited, [0, null]);
});
