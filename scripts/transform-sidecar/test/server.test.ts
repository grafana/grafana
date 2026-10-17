import { Table, tableFromIPC, tableToIPC, Utf8, vectorFromArray } from 'apache-arrow';
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

  it('writes NaN and ±Inf as entities instead of null', async () => {
    const res = await transform({
      frames: [
        {
          schema: { fields: [{ name: 'v', type: 'number' }] },
          data: { values: [[1, null, null, null]], entities: [{ NaN: [1], Inf: [2], NegInf: [3] }] },
        },
      ],
      transformations: [{ id: 'merge', options: {} }],
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.frames[0].data.entities, [{ NaN: [1], Inf: [2], NegInf: [3] }]);
  });

  it('sends a field as raw JSON when its values do not match its type', async () => {
    const res = await transform({
      frames: [
        {
          schema: {
            fields: [
              { name: 'row', type: 'string' },
              { name: 'col', type: 'string' },
              { name: 'v', type: 'number' },
            ],
          },
          data: {
            values: [
              ['r1', 'r2'],
              ['a', 'b'],
              [1, 2],
            ],
          },
        },
      ],
      // groupingToMatrix fills missing cells of number fields with "".
      transformations: [{ id: 'groupingToMatrix', options: { rowField: 'row', columnField: 'col', valueField: 'v' } }],
    });

    assert.equal(res.status, 200);
    const fields = res.body.frames[0].schema.fields;
    const a = fields.find((f: { name: string }) => f.name === 'a');
    assert.equal(a.type, 'number');
    assert.deepEqual(a.typeInfo, { frame: 'json.RawMessage', nullable: true });
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
    const res = await transform({ frames: [], transformations: [{ id: 'groupBy' }, { id: 'spatial' }] });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'unsupported transformations: spatial');
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

  it('also lists the app-level transformations bundled from public/app, minus the theme-dependent ones', async () => {
    const res = await fetch(`${server.baseUrl}/transformations`);
    const { transformations } = await res.json();

    const appLevel = [
      'heatmap',
      'joinByLabels',
      'partitionByValues',
      'prepareTimeSeries',
      'smoothing',
      'timeSeriesTable',
    ];
    assert.deepEqual(
      appLevel.filter((id) => !transformations.includes(id)),
      []
    );
    assert.ok(!transformations.includes('configFromData'));
    assert.ok(!transformations.includes('rowsToFields'));
    assert.equal(transformations.length, 35);
  });

  // Big-endian uint32 length-prefixed parts: a JSON header, then Arrow IPC files (see src/arrow.ts).
  const writeEnvelope = (parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + 4 + p.byteLength, 0));
    const view = new DataView(out.buffer);
    let pos = 0;
    for (const part of parts) {
      view.setUint32(pos, part.byteLength);
      out.set(part, pos + 4);
      pos += 4 + part.byteLength;
    }
    return out;
  };
  const readEnvelope = (bytes: Uint8Array) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const parts: Uint8Array[] = [];
    for (let pos = 0; pos < bytes.byteLength; ) {
      const length = view.getUint32(pos);
      parts.push(bytes.subarray(pos + 4, pos + 4 + length));
      pos += 4 + length;
    }
    return parts;
  };

  it('keeps string offsets intact after values with lone surrogates', async () => {
    // Substrings that cut the emoji's surrogate pair leave a lone high half at the end of a value
    // (head) or a lone low half at the start (tail). TextEncoder writes each lone half as U+FFFD
    // (3 bytes); if the byte count disagreed, every later value in the column would shift.
    const values = ['🚀 launch', 'after', 'é ok', 'plain'];
    const frame = tableToIPC(
      new Table({ head: vectorFromArray(values, new Utf8()), tail: vectorFromArray(values, new Utf8()) }),
      'file'
    );
    const substring = (field: string, start: number, end: number) => ({
      id: 'formatString',
      options: { stringField: field, outputFormat: 'Substring', substringStart: start, substringEnd: end },
    });
    const header = new TextEncoder().encode(
      JSON.stringify({ frames: [], transformations: [substring('head', 0, 1), substring('tail', 1, 3)] })
    );

    const res = await fetch(`${server.baseUrl}/transform`, {
      method: 'POST',
      headers: { 'content-type': 'application/vnd.grafana.transform+arrow' },
      body: writeEnvelope([header, frame]),
    });

    assert.equal(res.status, 200, await res.clone().text());
    const [, out] = readEnvelope(new Uint8Array(await res.arrayBuffer()));
    const table = tableFromIPC(out);
    assert.deepEqual(table.getChild('head')?.toArray(), ['\uFFFD', 'a', 'é', 'p']);
    assert.deepEqual(table.getChild('tail')?.toArray(), ['\uFFFD ', 'ft', ' o', 'la']);
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
