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

  await main(['--repo=a/b', '--team=x/y', '--format=json']);

  assert.equal(run.mock.callCount(), 1);
  const [config, options] = run.mock.calls[0].arguments;
  assert.deepEqual(config, PrReportsPipeline.configFor('a/b', 'x/y'));
  assert.deepEqual(options, { repo: 'a/b', team: 'x/y', format: 'json', pr: null, help: false });
});

test('main: a single PR uses its URL repo and the injected services to emit JSON', async (t) => {
  const output = captureOutput(t);
  const details = t.mock.method(GithubApiClient.prototype, 'fetchPullRequestDetails', async () => [
    { number: 7, title: 'Single PR', authorAssociation: 'MEMBER', reviewDecision: 'APPROVED' },
  ]);
  t.mock.method(GithubApiClient.prototype, 'fetchTeamMembers', () => assert.fail('single PR searched the team'));

  await main(['--repo=ignored/repo', '--pr=https://github.com/o/n/pull/7']);

  assert.deepEqual(details.mock.calls[0].arguments, [[7]]);
  assert.deepEqual(JSON.parse(output()), { number: 7, title: 'Single PR', authorType: 'Member', status: 'Approved' });
});

test('main: invalid configuration rejects before running the pipeline', async (t) => {
  const run = t.mock.method(PrReportsPipeline.prototype, 'run', () => assert.fail('ran with invalid configuration'));
  await assert.rejects(main(['--repo=invalid']), { name: 'CliError', message: 'invalid --repo: invalid' });
  assert.equal(run.mock.callCount(), 0);
});

test('main: a pipeline error reaches the caller unchanged', async (t) => {
  captureOutput(t);
  const error = new CliError('cannot read o/n#7');
  t.mock.method(PrReportsPipeline.prototype, 'run', async () => {
    throw error;
  });
  await assert.rejects(main(['--pr=https://github.com/o/n/pull/7']), (caught) => caught === error);
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
  const config = PrReportsPipeline.configFor('a/b', 'x/y');
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

  await main(['--repo=a/b', '--team=x/y', '--format=json']);

  assert.deepEqual(reads, [
    path.join(config.root, 'output', 'cache', 'teams', `${config.membersCacheKey}.cache.json`),
    path.join(config.root, 'output', 'cache', 'prs', `${config.cacheKey}.cache.json`),
  ]);
  assert.deepEqual(writes, [path.join(config.root, 'output', 'cache', 'prs', `${config.cacheKey}.cache.json`)]);
  assert.equal(JSON.parse(output()).total, 0);
});
