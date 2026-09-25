const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const { GithubApiClient } = require('./api/GithubApiClient');
const { FileCacheClient } = require('./cache/FileCacheClient');
const { CliError, helpText } = require('./cli/cli');
const { logger } = require('./logger/logger');
const { PrReportsPipeline } = require('./pipeline/PrReportsPipeline');
const { main } = require('./pr-reports');

function captureOutput(t) {
  let output = '';
  t.mock.method(process.stdout, 'write', (text) => {
    output += text;
    return true;
  });
  t.mock.method(logger, 'log', () => {});
  return () => output;
}

test('main: help prints usage without configuring or running the pipeline', async (t) => {
  const output = captureOutput(t);
  const config = t.mock.method(PrReportsPipeline, 'configFor', () => assert.fail('configured on help'));
  const run = t.mock.method(PrReportsPipeline.prototype, 'run', () => assert.fail('ran on help'));

  await main(['--help']);

  assert.equal(output(), helpText());
  assert.equal(config.mock.callCount(), 0);
  assert.equal(run.mock.callCount(), 0);
});

test('main: constructs the pipeline and forwards CLI configuration and options', async (t) => {
  captureOutput(t);
  const run = t.mock.method(PrReportsPipeline.prototype, 'run', async () => {});

  await main(['--repo=grafana/scenes', '--team=grafana/squad', '--format=json']);

  assert.equal(run.mock.callCount(), 1);
  const [config, options] = run.mock.calls[0].arguments;
  assert.deepEqual(config, PrReportsPipeline.configFor('grafana/scenes', 'grafana/squad'));
  assert.deepEqual(options, {
    repo: 'grafana/scenes',
    team: 'grafana/squad',
    format: 'json',
    pr: null,
    help: false,
    refreshCache: false,
    noCache: false,
  });
});

test('main: a single PR uses its URL repo and the injected services to emit JSON', async (t) => {
  const output = captureOutput(t);
  const details = t.mock.method(GithubApiClient.prototype, 'fetchPullRequestDetails', async () => [
    { number: 7, title: 'Single PR', authorAssociation: 'MEMBER', reviewDecision: 'APPROVED' },
  ]);
  t.mock.method(GithubApiClient.prototype, 'fetchTeamMembers', () => assert.fail('single PR searched the team'));

  await main(['--repo=ignored/repo', '--pr=https://github.com/grafana/scenes/pull/7']);

  assert.deepEqual(details.mock.calls[0].arguments, [[7]]);
  assert.deepEqual(JSON.parse(output()), { number: 7, title: 'Single PR', authorType: 'Member', status: 'Approved' });
});

test('main: invalid configuration rejects before running the pipeline', async (t) => {
  const run = t.mock.method(PrReportsPipeline.prototype, 'run', () => assert.fail('ran with invalid configuration'));
  await assert.rejects(main(['--repo=one/two/three']), {
    name: 'CliError',
    message: 'invalid --repo: one/two/three',
  });
  assert.equal(run.mock.callCount(), 0);
});

test('main: a pipeline error reaches the caller unchanged', async (t) => {
  captureOutput(t);
  const error = new CliError('cannot read o/n#7');
  t.mock.method(PrReportsPipeline.prototype, 'run', async () => {
    throw error;
  });
  await assert.rejects(main(['--pr=https://github.com/grafana/scenes/pull/7']), (caught) => caught === error);
});

test('CLI: argument errors print one message to stderr and exit unsuccessfully', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'pr-reports.js'), '--unknown'], {
    encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'unknown option: --unknown\n');
});

test('main: members and PR records use separate cache subfolders', async (t) => {
  const output = captureOutput(t);
  const config = PrReportsPipeline.configFor('grafana/scenes', 'grafana/squad');
  const reads = [];
  const writes = [];
  t.mock.method(FileCacheClient.prototype, 'read', async function (key) {
    reads.push(this.pathFor(key));
    return key === config.membersCacheKey ? { members: ['alice'] } : null;
  });
  t.mock.method(FileCacheClient.prototype, 'write', async function (key) {
    writes.push(this.pathFor(key));
  });
  t.mock.method(GithubApiClient.prototype, 'fetchTeamReviewRequestedPrs', async () => []);
  t.mock.method(GithubApiClient.prototype, 'fetchAuthoredPrs', async () => []);
  t.mock.method(GithubApiClient.prototype, 'fetchReviewRequestedPrs', async () => []);

  await main(['--repo=grafana/scenes', '--team=grafana/squad', '--format=json']);

  assert.deepEqual(reads, [
    path.join(config.root, 'output', 'cache', 'teams', `${config.membersCacheKey}.cache.json`),
    path.join(config.root, 'output', 'cache', 'prs', `${config.cacheKey}.cache.json`),
  ]);
  assert.deepEqual(writes, [path.join(config.root, 'output', 'cache', 'prs', `${config.cacheKey}.cache.json`)]);
  assert.equal(JSON.parse(output()).total, 0);
});

for (const flag of ['--refresh-cache', '--no-cache']) {
  test(`main: ${flag} scopes cache behavior and still writes the Markdown report`, async (t) => {
    const fs = require('node:fs/promises');
    const os = require('node:os');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pr-cache-options-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const config = {
      ...PrReportsPipeline.configFor('grafana/scenes', 'grafana/squad'),
      root,
      prsCacheDir: path.join(root, 'prs'),
      membersCacheDir: path.join(root, 'teams'),
      outputPath: path.join(root, 'reports', 'queue.md'),
    };
    t.mock.method(PrReportsPipeline, 'configFor', () => config);
    const caches = [
      [new FileCacheClient({ dir: config.prsCacheDir }), config.cacheKey, { prs: {} }],
      [new FileCacheClient({ dir: config.membersCacheDir }), config.membersCacheKey, { members: ['old'] }],
    ];
    const before = [];
    for (const [cache, key, value] of caches) {
      await cache.write(key, value);
      await cache.write('unrelated', { keep: true });
      before.push(await fs.readFile(cache.pathFor(key), 'utf8'));
    }
    const output = captureOutput(t);
    t.mock.method(GithubApiClient.prototype, 'fetchTeamMembers', async () => {
      for (const [index, [cache, key]] of caches.entries()) {
        if (flag === '--refresh-cache') {
          await assert.rejects(fs.access(cache.pathFor(key)), { code: 'ENOENT' });
        } else {
          assert.equal(await fs.readFile(cache.pathFor(key), 'utf8'), before[index]);
        }
      }
      return ['fresh'];
    });
    t.mock.method(GithubApiClient.prototype, 'fetchTeamReviewRequestedPrs', async () => []);
    t.mock.method(GithubApiClient.prototype, 'fetchAuthoredPrs', async () => []);
    t.mock.method(GithubApiClient.prototype, 'fetchReviewRequestedPrs', async () => []);
    await main(['--repo=grafana/scenes', '--team=grafana/squad', flag]);
    assert.match(await fs.readFile(config.outputPath, 'utf8'), /0 open PRs/);
    const summary = JSON.parse(output());
    assert.equal(summary.cache.path, flag === '--no-cache' ? null : `prs/${config.cacheKey}.cache.json`);
    for (const [index, [cache, key]] of caches.entries()) {
      assert.equal((await cache.read('unrelated')).keep, true);
      if (flag === '--no-cache') {
        assert.equal(await fs.readFile(cache.pathFor(key), 'utf8'), before[index]);
      }
    }
    if (flag === '--refresh-cache') {
      assert.deepEqual((await caches[0][0].read(config.cacheKey)).prs, {});
    }
  });
}

test('main: single-PR cache flags never delete cache files', async (t) => {
  captureOutput(t);
  t.mock.method(FileCacheClient.prototype, 'delete', () => assert.fail('deleted a cache'));
  t.mock.method(FileCacheClient.prototype, 'read', () => assert.fail('read a cache'));
  t.mock.method(FileCacheClient.prototype, 'write', () => assert.fail('wrote a cache'));
  t.mock.method(GithubApiClient.prototype, 'fetchPullRequestDetails', async () => [{ number: 7 }]);
  for (const flag of ['--refresh-cache', '--no-cache']) {
    await main(['--pr=https://github.com/grafana/scenes/pull/7', flag]);
  }
});

test('main: organization validation precedes configuration, cache deletion, and fetching', async (t) => {
  t.mock.method(PrReportsPipeline, 'configFor', () => assert.fail('configured rejected input'));
  t.mock.method(FileCacheClient.prototype, 'delete', () => assert.fail('deleted cache for rejected input'));
  t.mock.method(GithubApiClient.prototype, 'fetchPullRequestDetails', () => assert.fail('fetched rejected input'));
  for (const argv of [
    ['--repo=acme/project', '--refresh-cache'],
    ['--pr=https://github.com/acme/project/pull/7'],
    ['--pr=https://github.com/grafana/scenes/pull/7', '--team=acme/squad'],
  ]) {
    await assert.rejects(main(argv), CliError);
  }
});
