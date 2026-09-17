const assert = require('node:assert/strict');
const test = require('node:test');

const { parseArgs, helpText, CliError } = require('./cli');

test('parseArgs: defaults', () => {
  assert.deepEqual(parseArgs([]), {
    format: 'markdown',
    repo: 'grafana/grafana',
    team: 'dashboards-squad',
    pr: null,
    help: false,
  });
});

test('parseArgs: help flags', () => {
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-h']).help, true);
});

test('parseArgs: format, both syntaxes', () => {
  assert.equal(parseArgs(['--format', 'json']).format, 'json');
  assert.equal(parseArgs(['--format=json']).format, 'json');
  assert.equal(parseArgs(['--format', 'markdown']).format, 'markdown');
  assert.equal(parseArgs(['--format=markdown']).format, 'markdown');
});

test('parseArgs: last format wins', () => {
  assert.equal(parseArgs(['--format=json', '--format=markdown']).format, 'markdown');
});

test('parseArgs: invalid format throws', () => {
  assert.throws(() => parseArgs(['--format', 'xml']), { name: 'CliError', message: 'invalid --format: xml' });
  assert.throws(() => parseArgs(['--format']), { message: 'invalid --format: (missing)' });
});

test('parseArgs: repo and team are stored unvalidated', () => {
  assert.equal(parseArgs(['--repo', 'o/n']).repo, 'o/n');
  assert.equal(parseArgs(['--repo=o/n']).repo, 'o/n');
  assert.equal(parseArgs(['--team', 'org/slug']).team, 'org/slug');
  assert.equal(parseArgs(['--team=slug']).team, 'slug');
  assert.equal(parseArgs(['--repo', 'not-a-repo']).repo, 'not-a-repo');
});

test('parseArgs: a flag as a value is consumed as the value', () => {
  assert.equal(parseArgs(['--repo', '--team']).repo, '--team');
  assert.throws(() => parseArgs(['--repo', '--team', 'x']), { message: 'unexpected argument: x' });
});

test('parseArgs: unknown option throws', () => {
  assert.throws(() => parseArgs(['--nope']), { message: 'unknown option: --nope' });
  assert.throws(() => parseArgs(['-x']), { message: 'unknown option: -x' });
});

test('parseArgs: positional argument throws', () => {
  assert.throws(() => parseArgs(['foo']), { message: 'unexpected argument: foo' });
});

test('parseArgs: all options combined', () => {
  assert.deepEqual(parseArgs(['--format', 'json', '--repo', 'a/b', '--team', 'x/y']), {
    format: 'json',
    repo: 'a/b',
    team: 'x/y',
    pr: null,
    help: false,
  });
});

test('parseArgs: pr url, both syntaxes', () => {
  const expected = { repo: 'grafana/grafana', number: 12 };
  assert.deepEqual(parseArgs(['--pr', 'https://github.com/grafana/grafana/pull/12']).pr, expected);
  assert.deepEqual(parseArgs(['--pr=https://github.com/grafana/grafana/pull/12']).pr, expected);
});

test('parseArgs: a pr url keeps whatever the browser appended', () => {
  for (const suffix of ['', '/', '/files', '/files#diff-abc', '?w=1', '#issuecomment-1']) {
    assert.deepEqual(parseArgs([`--pr=https://github.com/o/n/pull/7${suffix}`]).pr, { repo: 'o/n', number: 7 });
  }
});

test('parseArgs: invalid pr url throws', () => {
  for (const value of [
    '',
    undefined,
    'grafana/grafana#12',
    '12',
    'https://github.com/grafana/grafana/pull/abc',
    'https://github.com/grafana/grafana/issues/12',
    'https://example.com/grafana/grafana/pull/12',
  ]) {
    assert.throws(() => parseArgs(['--pr', value]), CliError, `expected throw for ${value}`);
  }
});

test('parseArgs: a pr url implies json and overrides the repo', () => {
  const opts = parseArgs(['--repo', 'ignored/repo', '--pr', 'https://github.com/o/n/pull/7']);
  assert.equal(opts.format, 'json');
  assert.equal(opts.repo, 'o/n');
});

test('parseArgs: a pr url with an explicit --format json is accepted', () => {
  assert.equal(parseArgs(['--format=json', '--pr=https://github.com/o/n/pull/7']).format, 'json');
});

test('parseArgs: a pr url with --format markdown throws, whatever the order', () => {
  const message = '--pr supports --format json only';
  assert.throws(() => parseArgs(['--pr=https://github.com/o/n/pull/7', '--format=markdown']), { message });
  assert.throws(() => parseArgs(['--format=markdown', '--pr=https://github.com/o/n/pull/7']), { message });
});

test('helpText: documents every option', () => {
  const text = helpText();
  for (const flag of ['--format json|markdown', '--repo owner/name', '--team [org/]slug', '--pr <url>', '-h, --help']) {
    assert.ok(text.includes(flag), `help is missing ${flag}`);
  }
});
