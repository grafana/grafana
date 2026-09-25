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
    refreshCache: false,
    noCache: false,
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

test('parseArgs: Grafana repositories and teams support both syntaxes', () => {
  assert.equal(parseArgs(['--repo', 'grafana/scenes']).repo, 'grafana/scenes');
  assert.equal(parseArgs(['--repo=grafana/scenes']).repo, 'grafana/scenes');
  assert.equal(parseArgs(['--team', 'grafana/slug']).team, 'grafana/slug');
  assert.equal(parseArgs(['--team=slug']).team, 'slug');
  assert.equal(parseArgs(['--repo', 'scenes']).repo, 'grafana/scenes');
  assert.equal(parseArgs(['--repo=scenes']).repo, 'grafana/scenes');
});

test('parseArgs: a flag as a value is consumed as the value', () => {
  assert.throws(() => parseArgs(['--repo', '--team']), { message: 'invalid --repo: --team' });
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
  assert.deepEqual(parseArgs(['--format', 'json', '--repo', 'grafana/scenes', '--team', 'grafana/squad']), {
    format: 'json',
    repo: 'grafana/scenes',
    team: 'grafana/squad',
    pr: null,
    help: false,
    refreshCache: false,
    noCache: false,
  });
});

test('parseArgs: pr url, both syntaxes', () => {
  const expected = { repo: 'grafana/grafana', number: 12 };
  assert.deepEqual(parseArgs(['--pr', 'https://github.com/grafana/grafana/pull/12']).pr, expected);
  assert.deepEqual(parseArgs(['--pr=https://github.com/grafana/grafana/pull/12']).pr, expected);
});

test('parseArgs: a pr url keeps whatever the browser appended', () => {
  for (const suffix of ['', '/', '/files', '/files#diff-abc', '?w=1', '#issuecomment-1']) {
    assert.deepEqual(parseArgs([`--pr=https://github.com/grafana/scenes/pull/7${suffix}`]).pr, {
      repo: 'grafana/scenes',
      number: 7,
    });
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
  const opts = parseArgs(['--repo', 'ignored/repo', '--pr', 'https://github.com/grafana/scenes/pull/7']);
  assert.equal(opts.format, 'json');
  assert.equal(opts.repo, 'grafana/scenes');
});

test('parseArgs: a pr url with an explicit --format json is accepted', () => {
  assert.equal(parseArgs(['--format=json', '--pr=https://github.com/grafana/scenes/pull/7']).format, 'json');
});

test('parseArgs: a pr url with --format markdown throws, whatever the order', () => {
  const message = '--pr supports --format json only';
  assert.throws(() => parseArgs(['--pr=https://github.com/grafana/scenes/pull/7', '--format=markdown']), { message });
  assert.throws(() => parseArgs(['--format=markdown', '--pr=https://github.com/grafana/scenes/pull/7']), { message });
});

test('helpText: documents every option', () => {
  const text = helpText();
  for (const flag of [
    '--format json|markdown',
    '--repo [grafana/]name',
    '--team [grafana/]slug',
    '--pr <url>',
    '-h, --help',
  ]) {
    assert.ok(text.includes(flag), `help is missing ${flag}`);
  }
});

test('parseArgs: cache flags are opt-in and mutually exclusive', () => {
  assert.equal(parseArgs(['--refresh-cache']).refreshCache, true);
  assert.equal(parseArgs(['--no-cache']).noCache, true);
  for (const argv of [
    ['--refresh-cache', '--no-cache'],
    ['--no-cache', '--refresh-cache'],
  ]) {
    assert.throws(() => parseArgs(argv), {
      name: 'CliError',
      message: '--refresh-cache cannot be combined with --no-cache',
    });
  }
  assert.match(helpText(), /--refresh-cache/);
  assert.match(helpText(), /--no-cache/);
});

test('parseArgs: rejects non-Grafana repositories in queue and single-PR modes', () => {
  for (const owner of ['acme', 'grafana-fork', 'grafana.example']) {
    for (const argv of [
      ['--repo', `${owner}/project`],
      [`--repo=${owner}/project`],
      ['--pr', `https://github.com/${owner}/project/pull/7`],
      [`--pr=https://github.com/${owner}/project/pull/7`, '--repo=grafana/grafana'],
    ]) {
      assert.throws(() => parseArgs(argv), /only supports repositories owned by grafana/);
    }
  }
});

test('parseArgs: accepts Grafana ownership case-insensitively without changing values', () => {
  assert.equal(parseArgs(['--repo=Grafana/scenes']).repo, 'Grafana/scenes');
  assert.equal(parseArgs(['--team=Grafana/squad']).team, 'Grafana/squad');
  assert.deepEqual(parseArgs(['--pr=https://github.com/Grafana/scenes/pull/7']).pr, {
    repo: 'Grafana/scenes',
    number: 7,
  });
});

test('parseArgs: rejects non-Grafana team overrides including in single-PR mode', () => {
  for (const argv of [
    ['--team=acme/squad'],
    ['--team', 'acme/squad', '--pr=https://github.com/grafana/scenes/pull/7'],
  ]) {
    assert.throws(() => parseArgs(argv), /--team only supports teams in the grafana organization/);
  }
  for (const argv of [['--team'], ['--team='], ['--team=one/two/three'], ['--repo']]) {
    assert.throws(() => parseArgs(argv), CliError);
  }
});

test('parseArgs: repository shorthand produces the same options as the qualified name', () => {
  for (const name of ['grafana', 'scenes', 'grafana-app-sdk', 'some.repo']) {
    assert.deepEqual(parseArgs(['--repo', ` ${name} `]), parseArgs([`--repo=grafana/${name}`]));
  }
  for (const value of ['', '/scenes', 'grafana/', 'one/two/three', '--team']) {
    assert.throws(() => parseArgs([`--repo=${value}`]), /invalid --repo/);
  }
  assert.equal(parseArgs(['--repo=scenes', '--pr=https://github.com/grafana/grafana/pull/7']).repo, 'grafana/grafana');
});
