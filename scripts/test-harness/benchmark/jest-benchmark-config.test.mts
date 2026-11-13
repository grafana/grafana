import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';

import { applyRoster, loadBenchmarkConfig } from '../../jest-benchmark-config.mts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'jest-roster-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const empty = { include: [], exclude: [], groups: [] };

test('no optional JSON means an unchanged jsdom roster and no Happy DOM support', async (t) => {
  const root = await fixture(t);
  assert.deepEqual(await loadBenchmarkConfig(root, 'jsdom', '5/8'), {
    jestConfig: 'jest.config.js', testEnvironment: 'jsdom', roster: empty, files: [],
  });
  await assert.rejects(loadBenchmarkConfig(root, 'happy-dom', '5/8'), /Happy DOM is not configured/);
  assert.deepEqual(applyRoster(root, ['source.test.ts'], [], empty), {
    files: [path.join(root, 'source.test.ts')], added: [], excluded: [],
  });
});

test('loads common, environment, and matching shard rules and records exact configuration hashes', async (t) => {
  const root = await fixture(t);
  const common = JSON.stringify({
    version: 1, include: ['shared/*.test.ts'], exclude: ['**/slow.test.ts'], groups: [['a.test.ts', 'b.test.ts']],
    shards: { '5/8': { include: ['five.test.ts'] }, '1/8': { include: ['one.test.ts'] } },
  });
  const environment = JSON.stringify({
    version: 1, jestConfig: 'custom.config.cjs', testEnvironment: './test/environment.cjs',
    include: ['env.test.ts'], shards: { '5/8': { exclude: ['other.test.ts'] } },
  });
  await writeFile(path.join(root, 'jest.benchmark.json'), common);
  await writeFile(path.join(root, 'jest.benchmark.happy-dom.json'), environment);
  const config = await loadBenchmarkConfig(root, 'happy-dom', '5/8');
  assert.equal(config.jestConfig, 'custom.config.cjs');
  assert.equal(config.testEnvironment, './test/environment.cjs');
  assert.deepEqual(config.roster, {
    include: ['shared/*.test.ts', 'five.test.ts', 'env.test.ts'],
    exclude: ['**/slow.test.ts', 'other.test.ts'], groups: [['a.test.ts', 'b.test.ts']],
  });
  assert.deepEqual(config.files, [
    { path: 'jest.benchmark.json', sha256: createHash('sha256').update(common).digest('hex') },
    { path: 'jest.benchmark.happy-dom.json', sha256: createHash('sha256').update(environment).digest('hex') },
  ]);
  const jsdom = await loadBenchmarkConfig(root, 'jsdom', '1/8');
  assert.equal(jsdom.testEnvironment, 'jsdom');
  assert.deepEqual(jsdom.roster.include, ['shared/*.test.ts', 'one.test.ts']);
  assert.equal(jsdom.files.length, 1);
});

for (const [config, expected] of [
  [{ version: 2 }, /version must be 1/],
  [{ version: 1, typo: [] }, /unknown key/],
  [{ version: 1, include: 'file.test.ts' }, /must be an array/],
  [{ version: 1, include: [1] }, /nonempty root-relative/],
  [{ version: 1, groups: [['single.test.ts']] }, /at least two/],
  [{ version: 1, shards: { '0/8': {} } }, /Invalid shard/],
  [{ version: 1, shards: { '1/8': { typo: [] } } }, /unknown key/],
  [{ version: 1, jestConfig: '../outside.js' }, /root-relative/],
  [{ version: 1, jestConfig: '*.js' }, /not a glob/],
  [{ version: 1, testEnvironment: '../outside.js' }, /package name or a/],
  [{ version: 1, testEnvironment: './test/../../outside.js' }, /root-relative/],
  [{ version: 1, include: ['!excluded.test.ts'] }, /negation/],
  [{ version: 1, include: ['/absolute.test.ts'] }, /root-relative/],
  [{ version: 1, include: ['C:\\absolute.test.ts'] }, /root-relative/],
  [{ version: 1, include: ['../outside.test.ts'] }, /root-relative/],
] as const) {
  test(`rejects invalid optional configuration: ${JSON.stringify(config)}`, async (t) => {
    const root = await fixture(t);
    await writeFile(path.join(root, 'jest.benchmark.json'), JSON.stringify(config));
    await assert.rejects(loadBenchmarkConfig(root, 'jsdom', '5/8'), (error: Error) => {
      assert.match(error.message, /jest.benchmark.json/);
      assert.match(error.message, expected);
      return true;
    });
  });
}

test('does not treat malformed JSON or read failures as absent configuration', async (t) => {
  const root = await fixture(t);
  const file = path.join(root, 'jest.benchmark.json');
  await writeFile(file, '{');
  await assert.rejects(loadBenchmarkConfig(root, 'jsdom', '5/8'), /jest.benchmark.json/);
  await rm(file);
  await mkdir(file);
  await assert.rejects(loadBenchmarkConfig(root, 'jsdom', '5/8'), { code: 'EISDIR' });
});

test('literal/glob additions, transitive groups, exclusions, and deduplication determine the final roster', () => {
  const root = path.resolve('fixture');
  const result = applyRoster(root,
    ['src/a.test.ts', 'src/drop.test.ts'],
    ['src/a.test.ts', 'src/b.test.ts', 'src/c.test.ts', 'extra/one.test.ts', 'extra/two.test.ts', 'src/drop.test.ts'],
    {
      include: ['extra/*.test.ts', 'extra/one.test.ts'],
      groups: [['src/b.test.ts', 'src/c.test.ts'], ['src/a.test.ts', 'src/b.test.ts']],
      exclude: ['src/b.test.ts', '**/drop.test.ts', 'extra/two.test.ts'],
    });
  assert.deepEqual(result.files, ['extra/one.test.ts', 'src/a.test.ts', 'src/c.test.ts'].map((file) => path.join(root, file)));
  assert.deepEqual(result.added, ['extra/one.test.ts', 'src/c.test.ts'].map((file) => path.join(root, file)));
  assert.deepEqual(result.excluded, [path.join(root, 'src/drop.test.ts')]);
});

test('inactive groups do not add suites and patterns match only eligible Jest candidates', () => {
  const root = path.resolve('fixture');
  assert.deepEqual(applyRoster(root, ['a.test.ts'], ['a.test.ts', 'b.test.ts', 'c.test.ts'], {
    ...empty, groups: [['b.test.ts', 'c.test.ts']],
  }).files, [path.join(root, 'a.test.ts')]);
  assert.throws(() => applyRoster(root, ['a.test.ts'], ['a.test.ts'], {
    ...empty, include: ['unmatched/*.test.ts'],
  }), /matches no eligible Jest suites/);
  assert.throws(() => applyRoster(root, ['a.test.ts'], ['a.test.ts', 'b.test.ts'], {
    ...empty, groups: [['b.test.ts', 'missing.test.ts']],
  }), /matches no eligible Jest suites/);
});

test('exclusions can remove the complete roster and missing exclusion matches are harmless', () => {
  const root = path.resolve('fixture');
  assert.deepEqual(applyRoster(root, ['dir with spaces/a.test.ts'], [], { ...empty, exclude: ['**/*.test.ts'] }), {
    files: [], added: [], excluded: [path.join(root, 'dir with spaces/a.test.ts')],
  });
  assert.deepEqual(applyRoster(root, ['a.test.ts'], [], { ...empty, exclude: ['other.test.ts'] }).files,
    [path.join(root, 'a.test.ts')]);
  assert.throws(() => applyRoster(root, ['../outside.test.ts'], [], empty), /root-relative/);
});
