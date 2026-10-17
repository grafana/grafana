import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { PoolBusyError, PoolTimeoutError, WorkerCrashError, WorkerPool } from '../src/pool.ts';

const workerFile = new URL('./fixtures/echoWorker.mjs', import.meta.url);

interface EchoPayload {
  echo?: unknown;
  blockMs?: number;
  crash?: boolean;
}

describe('WorkerPool', () => {
  const pools: Array<WorkerPool<EchoPayload, unknown>> = [];
  const createPool = (size: number, queueLimit: number, timeoutMs: number) => {
    const pool = new WorkerPool<EchoPayload, unknown>(workerFile.pathname, { size, queueLimit, timeoutMs });
    pools.push(pool);
    return pool;
  };

  after(() => Promise.all(pools.map((p) => p.close())));

  it('returns each result to the caller that submitted it', async () => {
    const pool = createPool(2, 10, 1000);

    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => pool.run({ echo: n })));

    assert.deepEqual(results, [1, 2, 3, 4, 5]);
  });

  it('times out a blocked worker and keeps serving with a replacement', async () => {
    const pool = createPool(1, 10, 100);

    await assert.rejects(pool.run({ blockMs: 2000, echo: 'late' }), PoolTimeoutError);

    assert.equal(await pool.run({ echo: 'after' }), 'after');
  });

  it('runs a queued job after the job ahead of it times out', async () => {
    const pool = createPool(1, 10, 100);

    const [blocked, queued] = await Promise.allSettled([pool.run({ blockMs: 2000 }), pool.run({ echo: 'queued' })]);

    assert.equal(blocked.status, 'rejected');
    assert.ok(blocked.reason instanceof PoolTimeoutError);
    assert.deepEqual(queued, { status: 'fulfilled', value: 'queued' });
  });

  it('rejects a crashed job and replaces the worker', async () => {
    const pool = createPool(1, 10, 1000);

    await assert.rejects(pool.run({ crash: true }), WorkerCrashError);

    assert.equal(await pool.run({ echo: 'recovered' }), 'recovered');
  });

  it('rejects new work once every worker is busy and the queue is full', async () => {
    const pool = createPool(1, 1, 500);
    const running = pool.run({ blockMs: 200, echo: 'running' });
    const queued = pool.run({ echo: 'queued' });

    await assert.rejects(pool.run({ echo: 'overflow' }), PoolBusyError);

    assert.equal(await running, 'running');
    assert.equal(await queued, 'queued');
  });
});
