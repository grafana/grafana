import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { after, before, describe, it } from 'node:test';

const serverFile = new URL('../dist/server.cjs', import.meta.url).pathname;

function startServer(env: Record<string, string>): Promise<{ child: ChildProcess; baseUrl: string }> {
  const child = spawn(process.execPath, ['--enable-source-maps', serverFile], {
    env: { ...process.env, TRANSFORM_SIDECAR_PORT: '0', ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  return new Promise((resolve, reject) => {
    child.once('exit', (code) =>
      reject(new Error(`server exited early with code ${code}; run "node build.mjs" first?`))
    );
    createInterface({ input: child.stdout! }).on('line', (line) => {
      const entry = JSON.parse(line);
      if (entry.msg === 'listening') {
        resolve({ child, baseUrl: `http://127.0.0.1:${entry.port}` });
      }
    });
  });
}

const stringNumberFrame = (svc: string[], v: number[]) => ({
  schema: {
    fields: [
      { name: 'svc', type: 'string' },
      { name: 'v', type: 'number' },
    ],
  },
  data: { values: [svc, v] },
});

describe('transform sidecar', () => {
  let server: { child: ChildProcess; baseUrl: string };

  before(async () => {
    server = await startServer({ TRANSFORM_SIDECAR_WORKERS: '1' });
  });

  after(() => {
    server.child.kill('SIGTERM');
  });

  const transform = async (body: unknown) => {
    const res = await fetch(`${server.baseUrl}/transform`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  it('groups rows and aggregates the mean', async () => {
    const res = await transform({
      frames: [stringNumberFrame(['api', 'api', 'worker'], [100, 260, 40])],
      transformations: [
        {
          id: 'groupBy',
          options: {
            fields: {
              svc: { operation: 'groupby', aggregations: [] },
              v: { operation: 'aggregate', aggregations: ['mean'] },
            },
          },
        },
      ],
    });

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.frames.map((f: { data: { values: unknown[] } }) => f.data.values),
      [
        [
          ['api', 'worker'],
          [180, 40],
        ],
      ]
    );
  });

  it('adds Go typeInfo to every output field', async () => {
    const res = await transform({
      frames: [
        {
          schema: {
            fields: [
              { name: 'time', type: 'time' },
              { name: 'svc', type: 'string' },
              { name: 'v', type: 'number' },
              { name: 'up', type: 'boolean' },
            ],
          },
          data: { values: [[1000], ['a'], [1], [true]] },
        },
      ],
      transformations: [{ id: 'merge', options: {} }],
    });

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.frames[0].schema.fields.map((f: { typeInfo: unknown }) => f.typeInfo),
      [
        { frame: 'time.Time', nullable: true },
        { frame: 'string', nullable: true },
        { frame: 'float64', nullable: true },
        { frame: 'bool', nullable: true },
      ]
    );
  });

  it('applies transformations in order and skips disabled ones', async () => {
    const res = await transform({
      frames: [stringNumberFrame(['b', 'c', 'a'], [2, 3, 1])],
      transformations: [
        { id: 'sortBy', options: { sort: [{ field: 'v', desc: true }] } },
        { id: 'limit', options: { limitField: 1 }, disabled: true },
        { id: 'organize', options: { renameByName: { v: 'value' } } },
      ],
    });

    assert.equal(res.status, 200);
    const [frame] = res.body.frames;
    // organize renames through config.displayName, so consumers must keep field config.
    assert.deepEqual(
      frame.schema.fields.map((f: { name: string; config: { displayName?: string } }) => [
        f.name,
        f.config.displayName,
      ]),
      [
        ['svc', undefined],
        ['v', 'value'],
      ]
    );
    assert.deepEqual(frame.data.values, [
      ['c', 'b', 'a'],
      [3, 2, 1],
    ]);
  });

  it('interpolates variables in transformation options', async () => {
    const res = await transform({
      frames: [stringNumberFrame(['a'], [1])],
      transformations: [{ id: 'filterFieldsByName', options: { include: { names: ['${field}'] } } }],
      vars: { field: 'v' },
    });

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.frames[0].schema.fields.map((f: { name: string }) => f.name),
      ['v']
    );
  });

  it('rejects unsupported transformation ids instead of passing data through', async () => {
    const res = await transform({ frames: [], transformations: [{ id: 'groupBy' }, { id: 'heatmap' }] });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'unsupported transformations: heatmap');
  });

  it('rejects malformed requests', async () => {
    assert.equal((await transform('{not json')).status, 400);
    assert.equal((await transform({ transformations: [] })).status, 400);
  });

  it('lists supported transformations', async () => {
    const res = await fetch(`${server.baseUrl}/transformations`);
    const { transformations } = await res.json();

    assert.ok(transformations.includes('joinByField'));
    assert.ok(!transformations.includes('seriesToColumns'));
  });

  it('returns 413 when the body exceeds the size limit', async () => {
    const small = await startServer({ TRANSFORM_SIDECAR_MAX_BODY_BYTES: '64' });
    try {
      const res = await fetch(`${small.baseUrl}/transform`, {
        method: 'POST',
        body: JSON.stringify({ frames: [stringNumberFrame(['a'.repeat(100)], [1])], transformations: [] }),
      });
      assert.equal(res.status, 413);
    } finally {
      small.child.kill('SIGTERM');
    }
  });
});
