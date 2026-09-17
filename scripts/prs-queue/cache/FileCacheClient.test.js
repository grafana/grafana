const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { FileCacheClient } = require('./FileCacheClient');

async function withCache(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-client-'));
  try {
    await run(new FileCacheClient({ dir }), dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('pathFor: the key becomes a .cache.json file inside the directory', async () => {
  await withCache((cache, dir) => {
    assert.equal(cache.pathFor('members@team'), path.join(dir, 'members@team.cache.json'));
  });
});

test('read: a key that was never written is a miss', async () => {
  await withCache(async (cache) => {
    assert.equal(await cache.read('absent'), null);
  });
});

test('read: an unparseable file is a miss rather than a throw', async () => {
  await withCache(async (cache) => {
    await fs.writeFile(cache.pathFor('broken'), '{ not json');

    assert.equal(await cache.read('broken'), null);
  });
});

test('read: a directory in place of the file is a miss', async () => {
  await withCache(async (cache) => {
    await fs.mkdir(cache.pathFor('weird'));

    assert.equal(await cache.read('weird'), null);
  });
});

test('write then read returns the payload', async () => {
  await withCache(async (cache) => {
    await cache.write('entry', { members: ['a', 'b'], count: 2 });

    const value = await cache.read('entry');

    assert.deepEqual(value.members, ['a', 'b']);
    assert.equal(value.count, 2);
  });
});

test('write: the entry is stamped with fetchedAt', async () => {
  await withCache(async (cache) => {
    const before = Date.now();
    await cache.write('entry', { members: [] });

    const { fetchedAt } = await cache.read('entry');

    assert.ok(Date.parse(fetchedAt) >= before - 1000);
    assert.ok(Date.parse(fetchedAt) <= Date.now() + 1000);
  });
});

// An explicit fetchedAt value takes precedence over the generated timestamp.
test('write: a payload fetchedAt wins over the stamp', async () => {
  await withCache(async (cache) => {
    await cache.write('entry', { fetchedAt: '2020-01-01T00:00:00.000Z' });

    assert.equal((await cache.read('entry')).fetchedAt, '2020-01-01T00:00:00.000Z');
  });
});

test('write: the directory is created when it does not exist yet', async () => {
  await withCache(async (cache, dir) => {
    const nested = new FileCacheClient({ dir: path.join(dir, 'a', 'b') });

    await nested.write('entry', { ok: true });

    assert.equal((await nested.read('entry')).ok, true);
  });
});

test('write: no temp file is left behind', async () => {
  await withCache(async (cache, dir) => {
    await cache.write('entry', { ok: true });

    assert.deepEqual(await fs.readdir(dir), ['entry.cache.json']);
  });
});

test('write: the file is pretty-printed JSON ending in a newline', async () => {
  await withCache(async (cache) => {
    await cache.write('entry', { members: ['a'] });

    const raw = await fs.readFile(cache.pathFor('entry'), 'utf8');

    assert.ok(raw.endsWith('\n'));
    assert.ok(raw.includes('\n  "members"'));
  });
});

test('write: writing the same key twice replaces the entry', async () => {
  await withCache(async (cache) => {
    await cache.write('entry', { members: ['a'] });
    await cache.write('entry', { members: ['b'] });

    assert.deepEqual((await cache.read('entry')).members, ['b']);
  });
});

test('keys are independent of one another', async () => {
  await withCache(async (cache) => {
    await cache.write('one', { value: 1 });
    await cache.write('two', { value: 2 });

    assert.equal((await cache.read('one')).value, 1);
    assert.equal((await cache.read('two')).value, 2);
  });
});

test('write: concurrent writers publish complete entries without sharing temporary files', async (t) => {
  await withCache(async (cache, dir) => {
    const other = new FileCacheClient({ dir });
    const payloads = Array.from({ length: 4 }, (_, index) => ({
      value: `writer-${index}`,
      body: String(index).repeat(4096),
    }));
    const rename = fs.rename;
    const temporaryFiles = [];
    let release;
    const ready = new Promise((resolve) => {
      release = resolve;
    });
    // Hold every rename until all writers have finished their temporary files.
    t.mock.method(fs, 'rename', async (from, to) => {
      temporaryFiles.push(from);
      if (temporaryFiles.length === payloads.length) {
        release();
      }
      await ready;
      return rename(from, to);
    });

    await Promise.all(payloads.map((payload, index) => (index % 2 ? other : cache).write('entry', payload)));

    assert.equal(new Set(temporaryFiles).size, payloads.length);
    const { fetchedAt, ...stored } = await cache.read('entry');
    assert.ok(Number.isFinite(Date.parse(fetchedAt)));
    assert.ok(payloads.some((payload) => payload.value === stored.value && payload.body === stored.body));
    assert.deepEqual(await fs.readdir(dir), ['entry.cache.json']);
  });
});

test('write: a failed rename preserves the previous entry and removes its temporary file', async (t) => {
  await withCache(async (cache, dir) => {
    await cache.write('entry', { value: 'previous' });
    const error = Object.assign(new Error('rename failed'), { code: 'EACCES' });
    t.mock.method(fs, 'rename', async () => {
      throw error;
    });

    await assert.rejects(cache.write('entry', { value: 'new' }), (caught) => caught === error);

    assert.equal((await cache.read('entry')).value, 'previous');
    assert.deepEqual(await fs.readdir(dir), ['entry.cache.json']);
  });
});

test('write: serialization failure closes and removes the temporary file', async () => {
  await withCache(async (cache, dir) => {
    await cache.write('entry', { value: 'previous' });
    const circular = {};
    circular.self = circular;

    await assert.rejects(cache.write('entry', circular), TypeError);

    assert.equal((await cache.read('entry')).value, 'previous');
    assert.deepEqual(await fs.readdir(dir), ['entry.cache.json']);
  });
});

test('delete: removes only the selected entry and tolerates a missing entry', async () => {
  await withCache(async (cache, dir) => {
    await cache.write('selected', { value: 1 });
    await cache.write('other', { value: 2 });
    await cache.delete('selected');
    await cache.delete('selected');
    assert.deepEqual(await fs.readdir(dir), ['other.cache.json']);
    assert.equal((await cache.read('other')).value, 2);
  });
});

test('disabled cache performs no filesystem reads or writes', async (t) => {
  await withCache(async (cache, dir) => {
    await cache.write('entry', { value: 'original' });
    const before = await fs.readFile(cache.pathFor('entry'), 'utf8');
    const disabled = new FileCacheClient({ dir, enabled: false });
    const mocks = ['readFile', 'mkdir', 'open', 'rename', 'rm'].map((method) =>
      t.mock.method(fs, method, () => assert.fail(`unexpected filesystem operation: ${method}`))
    );
    try {
      assert.equal(await disabled.read('entry'), null);
      await disabled.write('entry', { value: 'replacement' });
      await disabled.write('new', { value: 'new' });
    } finally {
      mocks.forEach((mock) => mock.mock.restore());
    }
    assert.equal(await fs.readFile(cache.pathFor('entry'), 'utf8'), before);
    assert.deepEqual(await fs.readdir(dir), ['entry.cache.json']);
  });
});
