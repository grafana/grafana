import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { text } from 'node:stream/consumers';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyRoster } from '../../jest-benchmark-config.mts';
import { createBenchmarkStderrFilter, runBenchmark } from '../../jest-benchmark.mts';

for (const fragmented of [false, true]) {
  test(`compacts only Jest's final path list, including ANSI and UTF-8 fragments=${fragmented}`, async () => {
    const input = Buffer.from(
      '\u001b[31mFAIL\u001b[39m résumé.test.ts\nAssertionError: expected 1, received 2\n' +
      'Test Suites: 1 failed, 2 passed, 3 total\n' +
      '\u001b[2mRan all test suites within paths\u001b[22m "résumé.test.ts", "other.test.ts".\n' +
      'Test results written to: results.json\nwarning without a trailing newline'
    );
    const filter = createBenchmarkStderrFilter();
    const output = text(filter);
    if (fragmented) {
      for (let index = 0; index < input.length; index++) {
        filter.write(input.subarray(index, index + 1));
      }
    } else {
      filter.write(input);
    }
    filter.end();
    assert.equal(await output,
      '\u001b[31mFAIL\u001b[39m résumé.test.ts\nAssertionError: expected 1, received 2\n' +
      'Test Suites: 1 failed, 2 passed, 3 total\n' +
      'Ran all selected test suites.\n' +
      'Test results written to: results.json\nwarning without a trailing newline'
    );
  });
}

for (const ending of ['', '\n', '\r\n']) {
  test(`compacts the final path list with line ending ${JSON.stringify(ending)}`, async () => {
    const filter = createBenchmarkStderrFilter();
    const output = text(filter);
    filter.end(`Ran all test suites within paths "one.test.ts", "two.test.ts".${ending}`);
    assert.equal(await output, `Ran all selected test suites.${ending}`);
  });
}

function project(t: TestContext, behavior = '', selected = ['example.test.ts'], discoveryBehavior = '') {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'grafana-jest-runner-test-'));
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const packageDir = path.join(rootDir, 'node_modules/jest');
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(path.join(rootDir, 'package.json'), '{}');
  writeFileSync(path.join(rootDir, 'jest.config.js'), 'module.exports = {};\n');
  writeFileSync(path.join(rootDir, 'jest.happy-dom.config.js'), 'module.exports = {};\n');
  writeFileSync(path.join(rootDir, 'jest.benchmark.happy-dom.json'), JSON.stringify({
    version: 1, jestConfig: 'jest.happy-dom.config.js', testEnvironment: './public/test/happy-dom-environment.js',
  }));
  writeFileSync(path.join(rootDir, 'eligible.json'), JSON.stringify(selected.map((file) => path.join(rootDir, file))));
  for (const file of selected) {
    mkdirSync(path.dirname(path.join(rootDir, file)), { recursive: true });
    writeFileSync(path.join(rootDir, file), '');
  }
  writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ exports: { './bin/jest': './jest.cjs' } }));
  writeFileSync(
    path.join(packageDir, 'jest.cjs'),
    `const fs = require('node:fs');
const args = process.argv.slice(2);
const cache = args[args.indexOf('--cacheDirectory') + 1];
const discovery = args.includes('--listTests');
const inventory = discovery && !args.some((arg) => arg.startsWith('--shard='));
fs.writeFileSync(discovery ? (inventory ? 'inventory.json' : 'discovery.json') : 'invocation.json', JSON.stringify({
  args, cache, cacheContents: fs.readdirSync(cache), cwd: process.cwd(), ci: process.env.CI, pid: process.pid,
  nodeOptions: process.env.NODE_OPTIONS ?? '', metricsDirectory: process.env.GRAFANA_BENCHMARK_METRICS_DIR ?? null,
  forceColor: process.env.FORCE_COLOR ?? null,
}));
fs.writeFileSync(cache + '/transform-cache', 'populated during this invocation');
if (discovery) {
  ${discoveryBehavior}
  console.log(JSON.stringify(inventory
    ? JSON.parse(fs.readFileSync('eligible.json', 'utf8')).filter((file) => fs.existsSync(file))
    : ${JSON.stringify(selected.map((file) => path.join(rootDir, file)))}));
} else {
  ${behavior}
}
`
  );
  return rootDir;
}

function configureGroups(rootDir: string, groups: string[][]) {
  writeFileSync(path.join(rootDir, 'jest.benchmark.json'), JSON.stringify({ version: 1, groups }));
  const existing: string[] = JSON.parse(readFileSync(path.join(rootDir, 'eligible.json'), 'utf8'));
  writeFileSync(path.join(rootDir, 'eligible.json'), JSON.stringify([
    ...new Set([...existing, ...groups.flat().map((file) => path.join(rootDir, file))]),
  ]));
}

function invocation(rootDir: string, phase = 'invocation') {
  return JSON.parse(readFileSync(path.join(rootDir, `${phase}.json`), 'utf8')) as {
    args: string[];
    cache: string;
    cacheContents: string[];
    cwd: string;
    ci: string;
    pid: number;
    nodeOptions: string;
    metricsDirectory: string | null;
    forceColor: string | null;
  };
}

for (const { name, tty, depth, env, expected } of [
  { name: '16-color terminal', tty: true, depth: 4, env: {}, expected: '1' },
  { name: '256-color terminal', tty: true, depth: 8, env: {}, expected: '2' },
  { name: 'truecolor terminal', tty: true, depth: 24, env: {}, expected: '3' },
  { name: 'monochrome terminal', tty: true, depth: 1, env: {}, expected: null },
  { name: 'redirected output', tty: false, depth: 24, env: {}, expected: null },
  { name: 'explicit color opt-out', tty: true, depth: 24, env: { FORCE_COLOR: '0' }, expected: '0' },
  { name: 'explicit color in redirected output', tty: false, depth: 1, env: { FORCE_COLOR: '3' }, expected: '3' },
  { name: 'NO_COLOR', tty: true, depth: 24, env: { NO_COLOR: '1' }, expected: null },
  { name: 'NODE_DISABLE_COLORS', tty: true, depth: 24, env: { NODE_DISABLE_COLORS: '1' }, expected: null },
]) {
  test(`preserves Jest color preference for ${name} without enabling colors for discovery`, async (t) => {
    const colorKeys = ['FORCE_COLOR', 'NO_COLOR', 'NODE_DISABLE_COLORS'];
    const previous = colorKeys.map((key) => [key, process.env[key]] as const);
    const descriptors = ['isTTY', 'getColorDepth'].map((key) => [key, Object.getOwnPropertyDescriptor(process.stderr, key)] as const);
    t.after(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(process.stderr, key, descriptor);
        else Reflect.deleteProperty(process.stderr, key);
      }
    });
    for (const key of colorKeys) delete process.env[key];
    Object.assign(process.env, env);
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: tty });
    Object.defineProperty(process.stderr, 'getColorDepth', { configurable: true, value: () => depth });
    t.mock.method(console, 'log', () => {});
    const rootDir = project(t);
    assert.equal(await runBenchmark({ rootDir, shard: '5/8', noMetrics: true }), 0);
    assert.equal(invocation(rootDir).forceColor, expected);
    assert.equal(invocation(rootDir, 'discovery').forceColor, env.FORCE_COLOR ?? null);
  });
}

test('uses the root Jest configuration, jsdom, shard 5/8, and four workers', async (t) => {
  const rootDir = project(t);
  assert.equal(await runBenchmark({ shard: '5/8', rootDir }), 0);
  const recorded = invocation(rootDir);
  assert.deepEqual(recorded.args, [
    '--config',
    path.join(rootDir, 'jest.config.js'),
    '--env=jsdom',
    '--ci',
    '--watch=false',
    '--watchAll=false',
    '--maxWorkers=4',
    '--cacheDirectory',
    recorded.cache,
    '--runTestsByPath',
    path.join(rootDir, 'example.test.ts'),
  ]);
  const discovery = invocation(rootDir, 'discovery');
  assert.deepEqual(discovery.args, [
    '--config',
    path.join(rootDir, 'jest.config.js'),
    '--env=jsdom',
    '--ci',
    '--watch=false',
    '--watchAll=false',
    '--maxWorkers=4',
    '--cacheDirectory',
    discovery.cache,
    '--shard=5/8',
    '--listTests',
    '--json',
  ]);
  assert.notEqual(recorded.cache, discovery.cache);
  assert.equal(existsSync(discovery.cache), false);
  assert.equal(recorded.cwd, realpathSync(rootDir));
  assert.equal(recorded.ci, 'true');
  assert.deepEqual(recorded.cacheContents, []);
  assert.equal(existsSync(recorded.cache), false);
});

for (const environment of ['jsdom', 'happy-dom'] as const) {
  test(`${environment} is passed to both discovery and execution`, async (t) => {
    const rootDir = project(t);
    assert.equal(await runBenchmark({ shard: '5/8', rootDir, environment }), 0);
    const expected = environment === 'jsdom' ? 'jsdom' : path.resolve(rootDir, 'public/test/happy-dom-environment.js');
    const config = environment === 'happy-dom' ? 'jest.happy-dom.config.js' : 'jest.config.js';
    for (const phase of ['discovery', 'invocation']) {
      const { args } = invocation(rootDir, phase);
      assert.deepEqual(args.filter((arg) => arg.startsWith('--env=')), [`--env=${expected}`]);
      assert.equal(args[args.indexOf('--config') + 1], path.join(rootDir, config));
    }
  });
}

function runCli(rootDir: string, args: string[]) {
  const scriptsDir = path.join(rootDir, 'scripts');
  mkdirSync(scriptsDir, { recursive: true });
  const runner = path.join(scriptsDir, 'jest-benchmark.mts');
  for (const file of ['jest-benchmark.mts', 'jest-benchmark-metrics.mts', 'jest-benchmark-rss.mts', 'jest-benchmark-process.cjs', 'jest-benchmark-config.mts']) {
    copyFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), path.join(scriptsDir, file));
  }
  return spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8', timeout: 10000 });
}

for (const environment of [undefined, 'jsdom', 'happy-dom']) {
  test(`CLI selects ${environment ?? 'jsdom by default'} for discovery and execution`, (t) => {
    const rootDir = project(t);
    const result = runCli(rootDir, ['--shard=5/8', ...(environment === undefined ? [] : [`--environment=${environment}`])]);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const expected = environment === 'happy-dom' ? path.resolve(rootDir, 'public/test/happy-dom-environment.js') : 'jsdom';
    for (const phase of ['discovery', 'invocation']) {
      assert.deepEqual(invocation(rootDir, phase).args.filter((arg) => arg.startsWith('--env=')), [`--env=${expected}`]);
    }
    assert.ok(result.stdout.startsWith(`${environment ?? 'jsdom'} | shard 5/8 |`));
    assert.ok(invocation(rootDir, 'discovery').args.includes('--shard=5/8'));
  });
}

for (const absolute of [false, true]) {
  for (const exitCode of [0, 1]) {
    test(`CLI writes execution JSON with absolute=${absolute} and preserves exit ${exitCode}`, (t) => {
      const report = { success: exitCode === 0, testResults: [] };
      const rootDir = project(
        t,
        `fs.writeFileSync(args[args.indexOf('--outputFile') + 1], ${JSON.stringify(JSON.stringify(report))});
process.exitCode = ${exitCode};`
      );
      const outputPath = path.join(rootDir, 'results with spaces.json');
      const result = runCli(rootDir, [
        '--environment=happy-dom',
        '--shard=1/8',
        '--outputFile',
        absolute ? outputPath : 'results with spaces.json',
      ]);
      assert.equal(result.error, undefined);
      assert.equal(result.status, exitCode, result.stderr);
      const { args, cache } = invocation(rootDir);
      assert.ok(args.includes('--json'));
      assert.equal(args[args.indexOf('--outputFile') + 1], outputPath);
      assert.deepEqual(args.slice(args.indexOf('--runTestsByPath') + 1), [path.join(rootDir, 'example.test.ts')]);
      assert.equal(invocation(rootDir, 'discovery').args.includes('--outputFile'), false);
      assert.deepEqual(JSON.parse(readFileSync(outputPath, 'utf8')), report);
      assert.equal(existsSync(cache), false);
    });
  }
}

test('listTests does not write an execution report', (t) => {
  const rootDir = project(t);
  const result = runCli(rootDir, ['--shard=5/8', '--listTests', '--outputFile=results.json']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('example.test.ts'));
  assert.equal(invocation(rootDir, 'discovery').args.includes('--outputFile'), false);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.equal(existsSync(path.join(rootDir, 'results.json')), false);
});

test('CLI forwards JSON-selected custom Jest configuration and environment to discovery and execution', (t) => {
  const rootDir = project(t);
  writeFileSync(path.join(rootDir, 'jest.custom.config.js'), 'module.exports = {};\n');
  writeFileSync(path.join(rootDir, 'custom-environment.cjs'), 'module.exports = class {};\n');
  writeFileSync(path.join(rootDir, 'jest.benchmark.jsdom.json'), JSON.stringify({
    version: 1, jestConfig: 'jest.custom.config.js', testEnvironment: './custom-environment.cjs',
  }));
  const result = runCli(rootDir, ['--environment=jsdom', '--shard=2/3']);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  for (const phase of ['discovery', 'invocation']) {
    const { args } = invocation(rootDir, phase);
    assert.equal(args[args.indexOf('--config') + 1], path.join(rootDir, 'jest.custom.config.js'));
    assert.deepEqual(args.filter((arg) => arg.startsWith('--env=')), [`--env=${path.join(rootDir, 'custom-environment.cjs')}`]);
    assert.ok(args.includes('--maxWorkers=4'));
  }
  assert.ok(invocation(rootDir, 'discovery').args.includes('--shard=2/3'));
  assert.equal(invocation(rootDir).args.some((arg) => arg.startsWith('--shard')), false);
});

for (const shard of ['1/1', '1/8', '8/8', '2/3']) {
  test(`shard ${shard} applies only to discovery`, async (t) => {
    const rootDir = project(t);
    assert.equal(await runBenchmark({ rootDir, shard }), 0);
    assert.deepEqual(invocation(rootDir, 'discovery').args.filter((arg) => arg.startsWith('--shard')), [`--shard=${shard}`]);
    assert.equal(invocation(rootDir).args.some((arg) => arg.startsWith('--shard')), false);
    assert.equal(existsSync(invocation(rootDir, 'discovery').cache), false);
    assert.equal(existsSync(invocation(rootDir).cache), false);
  });
}

for (const environment of ['jsdom', 'happy-dom']) {
  for (const listTests of [false, true]) {
    test(`CLI shard selection preserves groups for ${environment}, listTests=${listTests}`, (t) => {
      const selectedMember = 'fixtures/group-a/first.test.ts';
      const additionalMember = 'fixtures/group-a/second.test.ts';
      const rootDir = project(t, '', [selectedMember]);
      writeFileSync(path.join(rootDir, additionalMember), '');
      configureGroups(rootDir, [[selectedMember, additionalMember]]);
      const result = runCli(rootDir, [`--environment=${environment}`, '--shard=2/3', ...(listTests ? ['--listTests'] : [])]);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.startsWith(`${environment} | shard 2/3 |`));
      const discovery = invocation(rootDir, 'discovery');
      assert.deepEqual(discovery.args.filter((arg) => arg.startsWith('--shard')), ['--shard=2/3']);
      assert.ok(
        discovery.args.includes(
          environment === 'jsdom' ? '--env=jsdom' : `--env=${path.resolve(rootDir, 'public/test/happy-dom-environment.js')}`
        )
      );
      assert.match(result.stdout, /Selected 1 shard suites \+ 1 additions - 0 exclusions = 2 suites\./);
      if (listTests) {
        assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
        assert.ok(result.stdout.endsWith(`${selectedMember}\n${additionalMember}\n`));
      } else {
        const args = invocation(rootDir).args;
        assert.equal(args.some((arg) => arg.startsWith('--shard')), false);
        assert.deepEqual(args.slice(args.indexOf('--runTestsByPath') + 1), [
          path.join(rootDir, selectedMember),
          path.join(rootDir, additionalMember),
        ]);
      }
    });
  }
}

for (const args of [[], ['--environment=happy-dom'], ['--listTests'], ['--selectionFile=baseline.json']]) {
  test(`CLI requires an explicit shard and prints an example: ${args.join(' ') || 'no arguments'}`, (t) => {
    const rootDir = project(t);
    rmSync(path.join(rootDir, 'node_modules'), { recursive: true });
    writeFileSync(path.join(rootDir, 'baseline.json'), JSON.stringify({
      schemaVersion: 1, shard: '5/8', selectedSuites: ['example.test.ts'],
    }));
    const result = runCli(rootDir, args);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'Missing required --shard option. Example: --shard=5/8.');
    assert.equal(result.stdout, '');
    assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
    assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  });
}

test('runner API requires an explicit shard', async (t) => {
  const rootDir = project(t);
  rmSync(path.join(rootDir, 'node_modules'), { recursive: true });
  await assert.rejects(runBenchmark({ rootDir }), /Missing required --shard option\. Example: --shard=5\/8/);
  assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
});

test('invalid shards are rejected before Jest resolution or startup', async (t) => {
  const rootDir = project(t);
  rmSync(path.join(rootDir, 'node_modules'), { recursive: true });
  const log = t.mock.method(console, 'log', () => {});
  for (const shard of [
    '',
    '1',
    '0/8',
    '1/0',
    '9/8',
    '-1/8',
    '1/-8',
    '1.5/8',
    '1/2.5',
    '1e0/8',
    '1/8/9',
    'one/8',
    ' 1/8',
    '1/8 ',
    '1/8\n',
    '01/8',
    '1/08',
    '1/9007199254740992',
    '9007199254740992/9007199254740992',
  ]) {
    await assert.rejects(runBenchmark({ rootDir, shard }), /Invalid shard.*Expected N\/M/);
    const result = runCli(rootDir, [`--shard=${shard}`]);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid shard.*Expected N\/M/);
    assert.equal(result.stdout, '');
  }
  assert.equal(log.mock.callCount(), 0);
  assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
});

test('invalid environments are rejected before Jest resolution or startup', async (t) => {
  const rootDir = project(t);
  rmSync(path.join(rootDir, 'node_modules'), { recursive: true });
  const log = t.mock.method(console, 'log', () => {});
  for (const environment of ['', 'node', 'Happy-dom']) {
    // @ts-expect-error Invalid environments must also be rejected at runtime.
    await assert.rejects(runBenchmark({ shard: '5/8', rootDir, environment }), /Invalid environment.*Expected jsdom or happy-dom/);
    const result = runCli(rootDir, ['--shard=5/8', `--environment=${environment}`]);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid environment.*Expected jsdom or happy-dom/);
    assert.equal(result.stdout, '');
  }
  assert.equal(log.mock.callCount(), 0);
  assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
});

test('each invocation gets an empty cache without clearing other cache directories', async (t) => {
  const rootDir = project(t);
  const existingCache = path.join(rootDir, 'node_modules/.cache');
  mkdirSync(existingCache);
  writeFileSync(path.join(existingCache, 'keep'), 'existing cache');
  assert.equal(await runBenchmark({ shard: '5/8', rootDir }), 0);
  const first = invocation(rootDir);
  assert.equal(await runBenchmark({ shard: '5/8', rootDir }), 0);
  const second = invocation(rootDir);
  assert.notEqual(first.cache, second.cache);
  assert.deepEqual(second.cacheContents, []);
  assert.equal(existsSync(first.cache), false);
  assert.equal(existsSync(second.cache), false);
  assert.equal(readFileSync(path.join(existingCache, 'keep'), 'utf8'), 'existing cache');
});

test('preserves Jest failures and removes the invocation cache', async (t) => {
  const rootDir = project(t, 'process.exitCode = 7;');
  assert.equal(await runBenchmark({ shard: '5/8', rootDir }), 7);
  assert.equal(existsSync(invocation(rootDir).cache), false);
});

test('passes listTests without changing the shard and environment', async (t) => {
  const rootDir = project(t);
  assert.equal(await runBenchmark({ shard: '5/8', rootDir, listTests: true }), 0);
  const recorded = invocation(rootDir, 'discovery');
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.ok(recorded.args.includes('--listTests'));
  assert.ok(recorded.args.includes('--shard=5/8'));
  assert.ok(recorded.args.includes('--env=jsdom'));
  assert.equal(existsSync(recorded.cache), false);
});

test('execution includes group members without applying sharding a second time', async (t) => {
  const selectedMember = 'fixtures/group-a/first.test.ts';
  const additionalMember = 'fixtures/group-a/second.test.ts';
  const rootDir = project(t, '', [selectedMember]);
  writeFileSync(path.join(rootDir, additionalMember), '');
  configureGroups(rootDir, [[selectedMember, additionalMember]]);
  assert.equal(await runBenchmark({ shard: '5/8', rootDir }), 0);
  const args = invocation(rootDir).args;
  assert.equal(args.some((arg) => arg.startsWith('--shard')), false);
  assert.deepEqual(args.slice(args.indexOf('--runTestsByPath') + 1), [
    path.join(rootDir, selectedMember),
    path.join(rootDir, additionalMember),
  ]);
});

const rosterGroups = [
  ['fixtures/group-a/first.test.ts', 'fixtures/group-a/second.test.ts'],
  ['fixtures/group-b/first.test.tsx', 'fixtures/group-b/second.test.tsx'],
  ['fixtures/group-c/first.test.ts', 'fixtures/group-c/second.test.ts'],
];
for (const group of rosterGroups) {
  test(`selection expands the group containing ${group[0]} from either member and deduplicates it`, () => {
    const rootDir = path.resolve('fixture');
    const expected = group.map((file) => path.join(rootDir, file)).sort();
    const rules = { include: [], exclude: [], groups: [group] };
    assert.deepEqual(applyRoster(rootDir, [group[0]], group, rules).files, expected);
    assert.deepEqual(applyRoster(rootDir, [group[1]], group, rules).files, expected);
    assert.deepEqual(applyRoster(rootDir, [...group, group[0]], group, rules).files, expected);
  });
}

test('environments produce identical expanded paths, list output, and selection hashes', async (t) => {
  const selected = ['other.test.ts', ...rosterGroups.map((group) => group[0])];
  const rootDir = project(t, '', selected);
  for (const group of rosterGroups) {
    writeFileSync(path.join(rootDir, group[1]), '/** @jest-environment jsdom */\n');
  }
  configureGroups(rootDir, rosterGroups);
  const expected = ['other.test.ts', ...rosterGroups.flat()].map((file) => path.join(rootDir, file)).sort();
  const log = t.mock.method(console, 'log', () => {});
  const hashes: string[] = [];
  for (const environment of ['jsdom', 'happy-dom'] as const) {
    for (const listTests of [false, true]) {
      log.mock.resetCalls();
      if (listTests) {
        rmSync(path.join(rootDir, 'invocation.json'));
      }
      assert.equal(await runBenchmark({ shard: '5/8', rootDir, environment, listTests }), 0);
      if (!listTests) {
        const args = invocation(rootDir).args;
        assert.deepEqual(args.slice(args.indexOf('--runTestsByPath') + 1), expected);
        assert.equal(args.some((arg) => arg.startsWith('--shard')), false);
      }
      const output = log.mock.calls.map((call) => call.arguments[0]);
      const hash = output.find((line) => line.startsWith('Selection SHA-256:'));
      assert.match(hash ?? '', /^Selection SHA-256: [a-f0-9]{64}$/);
      hashes.push(hash!);
      if (listTests) {
        assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
        assert.equal(
          output.at(-1),
          expected.map((file) => path.relative(rootDir, file).split(path.sep).join('/')).join('\n')
        );
      }
    }
  }
  assert.equal(new Set(hashes).size, 1);
  for (const group of rosterGroups) {
    assert.equal(readFileSync(path.join(rootDir, group[1]), 'utf8'), '/** @jest-environment jsdom */\n');
  }
});

test('selection leaves unrelated suites alone', () => {
  const rootDir = path.resolve('fixture');
  assert.deepEqual(applyRoster(rootDir, ['other.test.ts'], [], { include: [], exclude: [], groups: [] }).files,
    [path.join(rootDir, 'other.test.ts')]);
});

test('discovery failures do not start execution and retain their exit code', async (t) => {
  const rootDir = project(t, '', ['example.test.ts'], 'process.exitCode = 9;');
  assert.equal(await runBenchmark({ shard: '5/8', rootDir }), 9);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.equal(existsSync(invocation(rootDir, 'discovery').cache), false);
});

test('empty discovery results fail rather than running a misleading benchmark', async (t) => {
  const rootDir = project(t, '', []);
  await assert.rejects(runBenchmark({ shard: '5/8', rootDir }), /nonempty array of test paths/);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.equal(existsSync(invocation(rootDir, 'discovery').cache), false);
});

test('missing group members fail rather than silently dropping suites', async (t) => {
  const rootDir = project(t, '', ['fixtures/group-a/first.test.ts']);
  configureGroups(rootDir, [['fixtures/group-a/first.test.ts', 'fixtures/group-a/second.test.ts']]);
  await assert.rejects(runBenchmark({ shard: '5/8', rootDir }), /matches no eligible Jest suites/);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.equal(existsSync(invocation(rootDir, 'discovery').cache), false);
});

test('the overall deadline stops the process and returns a failing exit code', { timeout: 10000 }, async (t) => {
  const rootDir = project(t, 'setInterval(() => {}, 1000);');
  assert.equal(await runBenchmark({ shard: '5/8', rootDir, timeoutMs: 1000 }), 124);
  assert.equal(existsSync(invocation(rootDir).cache), false);
});

function runSubprocess(rootDir: string) {
  const runner = new URL('../../jest-benchmark.mts', import.meta.url).href;
  try {
    return spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { runBenchmark } from ${JSON.stringify(runner)};
process.exitCode = await runBenchmark({ shard: '5/8', rootDir: ${JSON.stringify(rootDir)} });`,
      ],
      { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL' }
    );
  } finally {
    if (existsSync(path.join(rootDir, 'invocation.json'))) {
      try {
        process.kill(-invocation(rootDir).pid, 'SIGKILL');
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
          throw error;
        }
      }
    }
  }
}

for (const [signal, expected] of [['SIGINT', 130], ['SIGTERM', 143]] as const) {
  test(`${signal} cancels the runner and removes its cache`, { skip: process.platform === 'win32' }, (t) => {
    const rootDir = project(t, `process.kill(process.ppid, '${signal}'); setInterval(() => {}, 1000);`);
    const result = runSubprocess(rootDir);
    assert.equal(result.error, undefined);
    assert.equal(result.status, expected);
    assert.equal(existsSync(invocation(rootDir).cache), false);
  });
}

test(
  'cancellation reaches workers and escalates when the coordinator ignores SIGTERM',
  { skip: process.platform === 'win32', timeout: 15000 },
  (t) => {
    const worker = `const fs = require('node:fs');
process.on('SIGTERM', () => { fs.writeFileSync('worker-stopped', 'SIGTERM'); process.exit(0); });
process.send('ready');
setInterval(() => {}, 1000);`;
    const rootDir = project(t, `
process.on('SIGTERM', () => {});
const worker = require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(worker)}], {
  stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
});
worker.on('message', () => process.kill(process.ppid, 'SIGTERM'));
setInterval(() => {}, 1000);`);
    const result = runSubprocess(rootDir);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 143);
    assert.equal(readFileSync(path.join(rootDir, 'worker-stopped'), 'utf8'), 'SIGTERM');
    assert.equal(existsSync(invocation(rootDir).cache), false);
  }
);

for (const [flags, gc] of [[[], true], [['--noGc'], false]] as const) {
  test(`prints and saves execution metrics with ${flags.join(' ') || 'default GC'}, including failed runs and replacement workers`, (t) => {
    const rootDir = project(t, `
const { spawnSync } = require('node:child_process');
for (const [id, module] of [
  ['1', 'jest-runner/build/testWorker.js'], ['2', 'jest-runner/build/testWorker.js'],
  ['1', 'jest-runner/build/testWorker.js'], ['1', 'jest-haste-map/build/worker.js'],
]) {
  const result = spawnSync(process.execPath, ['node_modules/jest-worker/build/workers/processChild.js', 'node_modules/' + module], {
    env: { ...process.env, JEST_WORKER_ID: id },
  });
  if (result.status !== 0) throw new Error(result.stderr.toString());
}
process.exitCode = 7;`);
    const worker = path.join(rootDir, 'node_modules/jest-worker/build/workers/processChild.js');
    mkdirSync(path.dirname(worker), { recursive: true });
    writeFileSync(worker, "process.emit('message', [0, false, process.argv[2], []]); process.exit(0);");
    const result = runCli(rootDir, ['--shard=5/8', '--metricsFile=metrics with spaces.json', ...flags]);
    assert.equal(result.status, 7, result.stderr);
    assert.match(result.stdout, /^  Jest execution +[\d.]+ s$/m);
    assert.match(result.stdout, /^  Exit code +7$/m);
    assert.match(result.stdout, /^Memory \(summed RSS @ 250ms\)/m);
    assert.match(result.stdout, /^  Test-worker starts +3$/m);
    assert.match(result.stdout, /^  Test-worker replacements +1$/m);
    assert.match(result.stdout, /^  Haste-map worker starts +1$/m);
    assert.match(result.stdout, gc ? /^GC \(observed aggregate\)$/m : /^GC \(observed aggregate\) +disabled \(--noGc\)$/m);
    const report = JSON.parse(readFileSync(path.join(rootDir, 'metrics with spaces.json'), 'utf8'));
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.exitCode, 7);
    assert.equal(report.gcEnabled, gc);
    assert.equal(report.node, process.version);
    assert.equal(report.shard, '5/8');
    assert.equal(report.maxWorkers, 4);
    assert.equal(report.coldJestCache, true);
    assert.equal(report.selectedSuiteCount, 1);
    assert.deepEqual(report.selectedSuites, ['example.test.ts']);
    assert.match(report.selectionHash, /^[a-f0-9]{64}$/);
    assert.match(report.configurationHashes['jest.config.js'], /^[a-f0-9]{64}$/);
    assert.ok(report.executionMs > 0 && report.totalMs >= report.executionMs);
    assert.equal(report.rss.intervalMs, 250);
    if (process.platform === 'linux') {
      assert.ok(report.rss.peakBytes > 0);
      assert.ok(report.rss.averageBytes > 0);
      assert.ok(report.rss.samples > 0);
    } else {
      assert.equal(report.rss.supported, false);
      assert.equal(report.rss.peakBytes, null);
    }
    assert.equal(report.processes.workerStarts, 3);
    assert.equal(report.processes.workerReplacements, 1);
    assert.equal(report.processes.hasteMapWorkerStarts, 1);
    assert.equal(report.processes.otherWorkerStarts, 0);
    assert.equal(report.processes.processStarts, 5);
    assert.equal(report.processes.incompleteProcesses, 0);
    assert.equal(report.processes.gc !== null, gc);
    for (const process of report.processes.processes) {
      assert.equal(process.gc !== null, gc);
    }
    assert.deepEqual(report.processes.errors, []);
    assert.equal(invocation(rootDir, 'discovery').metricsDirectory, null);
    assert.equal(invocation(rootDir, 'discovery').nodeOptions.includes('jest-benchmark-process.cjs'), false);
    assert.ok(invocation(rootDir).nodeOptions.includes('jest-benchmark-process.cjs'));
    assert.equal(existsSync(invocation(rootDir).metricsDirectory!), false);
  });
}

for (const noMetrics of [false, true]) {
  test(`execution hides the final path dump without hiding failures, metrics disabled=${noMetrics}`, (t) => {
    const rootDir = project(t, `
process.stderr.write('FAIL failing.test.ts\\nAssertionError: useful failure details\\nTest Suites: 1 failed, 1 total\\n');
process.stderr.write('Ran all test suites within paths "failing.test.ts", "other.test.ts".\\n');
process.exitCode = 7;`);
    const result = runCli(rootDir, ['--shard=5/8', ...(noMetrics ? ['--noMetrics'] : [])]);
    assert.equal(result.status, 7, result.stderr);
    assert.equal(result.stderr,
      'FAIL failing.test.ts\nAssertionError: useful failure details\nTest Suites: 1 failed, 1 total\n' +
      'Ran all selected test suites.\n'
    );
    assert.match(result.stdout, /^  Jest execution +[\d.]+ s$/m);
    assert.match(result.stdout, /^  Exit code +7$/m);
    assert.match(result.stdout, noMetrics ? /^Instrumentation +disabled \(--noMetrics\)$/m : /^Memory \(summed RSS @ 250ms\)/m);
  });
}

for (const flags of [[], ['--noGc']]) {
  test(`noMetrics disables all instrumentation with ${flags.join(' ') || 'default GC'} but saves timing metadata`, (t) => {
    const rootDir = project(t);
    const destination = path.join(rootDir, 'disabled.json');
    const result = runCli(rootDir, ['--shard=5/8', '--noMetrics', ...flags, `--metricsFile=${destination}`]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^Instrumentation +disabled \(--noMetrics\)$/m);
    assert.equal(invocation(rootDir).metricsDirectory, null);
    assert.equal(invocation(rootDir).nodeOptions.includes('jest-benchmark-process.cjs'), false);
    const report = JSON.parse(readFileSync(destination, 'utf8'));
    assert.equal(report.metricsEnabled, false);
    assert.equal(report.gcEnabled, false);
    assert.equal(report.rss, null);
    assert.equal(report.processes, null);
    assert.ok(report.executionMs > 0);
  });
}

test('CLI benchmarks its own checkout from another working directory using default configuration and no groups', (t) => {
  const rootDir = project(t, '', ['fixtures/group-a/first.test.ts']);
  rmSync(path.join(rootDir, 'jest.happy-dom.config.js'));
  rmSync(path.join(rootDir, 'jest.benchmark.happy-dom.json'));
  assert.notEqual(process.cwd(), rootDir);
  const result = runCli(rootDir, ['--shard=1/8', '--metricsFile=baseline.json']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(invocation(rootDir).cwd, realpathSync(rootDir));
  const report = JSON.parse(readFileSync(path.join(rootDir, 'baseline.json'), 'utf8'));
  assert.equal(report.rootDir, rootDir);
  assert.deepEqual(report.rosterConfig.files, []);
  assert.deepEqual(report.rosterConfig.rules, { include: [], exclude: [], groups: [] });
  assert.equal(existsSync(path.join(rootDir, 'inventory.json')), false);
  assert.deepEqual(report.selectedSuites, ['fixtures/group-a/first.test.ts']);
  assert.equal(report.processes.processStarts, 1);
  assert.match(result.stdout, /shard 1\/8 \| 4 workers/);
});

test('Happy DOM is unavailable without optional environment configuration', (t) => {
  const rootDir = project(t);
  rmSync(path.join(rootDir, 'jest.benchmark.happy-dom.json'));
  const result = runCli(rootDir, ['--shard=5/8', '--environment=happy-dom']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Happy DOM is not configured in this checkout/);
  assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
});

test('JSON file/glob additions and exclusions adjust the selected shard and are recorded in metrics', (t) => {
  const rootDir = project(t, '', ['public/app/a.test.ts', 'public/app/slow.test.ts']);
  const extra = ['public/app/extra/one.test.ts', 'public/app/extra/skip.test.ts'];
  mkdirSync(path.join(rootDir, 'public/app/extra'), { recursive: true });
  for (const file of extra) {
    writeFileSync(path.join(rootDir, file), '');
  }
  writeFileSync(path.join(rootDir, 'eligible.json'), JSON.stringify([
    'public/app/a.test.ts', 'public/app/slow.test.ts', ...extra,
  ].map((file) => path.join(rootDir, file))));
  writeFileSync(path.join(rootDir, 'jest.benchmark.json'), JSON.stringify({
    version: 1, include: ['public/app/extra/*.test.ts'],
    shards: { '5/8': { exclude: ['**/slow.test.ts'] }, '1/8': { include: ['missing.test.ts'] } },
  }));
  writeFileSync(path.join(rootDir, 'jest.benchmark.jsdom.json'), JSON.stringify({
    version: 1, exclude: ['**/skip.test.ts'],
  }));
  const result = runCli(rootDir, ['--shard=5/8', '--metricsFile=roster.json']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Selected 2 shard suites \+ 1 additions - 1 exclusions = 2 suites/);
  const report = JSON.parse(readFileSync(path.join(rootDir, 'roster.json'), 'utf8'));
  assert.deepEqual(report.selectedSuites, ['public/app/a.test.ts', 'public/app/extra/one.test.ts']);
  assert.deepEqual(report.rosterConfig.added, ['public/app/extra/one.test.ts']);
  assert.deepEqual(report.rosterConfig.excluded, ['public/app/slow.test.ts']);
  assert.deepEqual(report.rosterConfig.files.map((file: { path: string }) => file.path),
    ['jest.benchmark.json', 'jest.benchmark.jsdom.json']);
  assert.match(report.rosterConfig.files[0].sha256, /^[a-f0-9]{64}$/);
  assert.ok(invocation(rootDir, 'discovery').args.includes('--shard=5/8'));
  assert.equal(invocation(rootDir, 'inventory').args.some((arg) => arg.startsWith('--shard=')), false);
  assert.notEqual(invocation(rootDir, 'inventory').cache, invocation(rootDir).cache);
});

test('exclusion-only rules do not request an inventory and an empty final roster is rejected', (t) => {
  const rootDir = project(t);
  writeFileSync(path.join(rootDir, 'jest.benchmark.json'), JSON.stringify({ version: 1, exclude: ['**/*.test.ts'] }));
  const result = runCli(rootDir, ['--shard=5/8']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Benchmark roster is empty/);
  assert.equal(existsSync(path.join(rootDir, 'inventory.json')), false);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
});

test('inventory failures preserve their exit code without starting execution', async (t) => {
  const rootDir = project(t, '', ['a.test.ts', 'b.test.ts'], 'if (inventory) process.exit(8);');
  configureGroups(rootDir, [['a.test.ts', 'b.test.ts']]);
  assert.equal(await runBenchmark({ shard: '5/8', rootDir }), 8);
  assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  assert.equal(existsSync(invocation(rootDir, 'inventory').cache), false);
});


for (const excludeUnavailable of [false, true]) {
  test(`replays eligible baseline suites without JSON additions, exclude unavailable=${excludeUnavailable}`, (t) => {
    const rootDir = project(t, '', ['public/app/source.test.ts', 'public/app/other.test.ts']);
    writeFileSync(path.join(rootDir, 'baseline.json'), JSON.stringify({
      schemaVersion: 1, shard: '5/8', selectedSuites: [
        'public/app/source.test.ts', ...(excludeUnavailable ? ['removed.test.ts'] : []),
      ],
    }));
    if (excludeUnavailable) {
      writeFileSync(path.join(rootDir, 'jest.benchmark.json'), JSON.stringify({
        version: 1, exclude: ['removed.test.ts'],
      }));
    }
    const result = runCli(rootDir, ['--shard=5/8', '--selectionFile=baseline.json']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
    const inventory = invocation(rootDir, 'inventory');
    const execution = invocation(rootDir);
    assert.equal(inventory.args.some((arg) => arg.startsWith('--shard=')), false);
    assert.notEqual(inventory.cache, execution.cache);
    assert.deepEqual(execution.args.slice(execution.args.indexOf('--runTestsByPath') + 1), [
      path.join(rootDir, 'public/app/source.test.ts'),
    ]);
  });
}

test('replays baseline selection without shard discovery, then expands groups', (t) => {
  const selectedMember = 'fixtures/group-a/first.test.ts';
  const additionalMember = 'fixtures/group-a/second.test.ts';
  const rootDir = project(t, '', ['different-shard-boundary.test.ts', selectedMember, additionalMember]);
  configureGroups(rootDir, [[selectedMember, additionalMember]]);
  writeFileSync(path.join(rootDir, 'baseline.json'), JSON.stringify({
    schemaVersion: 1, shard: '1/8', selectedSuites: [selectedMember],
  }));
  const result = runCli(rootDir, ['--shard=1/8', '--selectionFile=baseline.json', '--metricsFile=replay.json']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Selected 1 baseline suites \+ 1 additions/);
  assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
  const args = invocation(rootDir).args;
  assert.deepEqual(args.slice(args.indexOf('--runTestsByPath') + 1), [
    path.join(rootDir, selectedMember), path.join(rootDir, additionalMember),
  ]);
  const report = JSON.parse(readFileSync(path.join(rootDir, 'replay.json'), 'utf8'));
  assert.equal(report.selectionSource, path.join(rootDir, 'baseline.json'));
  assert.deepEqual(report.selectedSuites, [selectedMember, additionalMember]);
});

for (const [report, message] of [
  [{ schemaVersion: 1, shard: '1/8', selectedSuites: ['example.test.ts'] }, /requested shard/],
  [{ schemaVersion: 1, shard: '5/8', selectedSuites: [] }, /nonempty selectedSuites/],
  [{ schemaVersion: 1, shard: '5/8', selectedSuites: ['../outside.test.ts'] }, /inside rootDir/],
  [{ schemaVersion: 1, shard: '5/8', selectedSuites: ['missing.test.ts'] }, /unavailable in the Jest inventory/],
] as const) {
  test(`rejects an invalid baseline selection: ${JSON.stringify(report)}`, (t) => {
    const rootDir = project(t);
    writeFileSync(path.join(rootDir, 'baseline.json'), JSON.stringify(report));
    const result = runCli(rootDir, ['--shard=5/8', '--selectionFile=baseline.json']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
    assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
  });
}

for (const environment of ['jsdom', 'happy-dom'] as const) {
  test(`leaves ${environment} test eligibility to the checkout's Jest configuration`, async (t) => {
    const rootDir = project(t);
    const config = environment === 'jsdom' ? 'jest.config.js' : 'jest.happy-dom.config.js';
    writeFileSync(path.join(rootDir, config), "module.exports = { testPathIgnorePatterns: ['/node_modules/', '/custom-plugin/'] };\n");
    assert.equal(await runBenchmark({ shard: '5/8', rootDir, environment }), 0);
    for (const phase of ['discovery', 'invocation']) {
      const args = invocation(rootDir, phase).args;
      assert.equal(args[args.indexOf('--config') + 1], path.join(rootDir, config));
      assert.equal(args.some((arg) => arg.startsWith('--testPathIgnorePatterns')), false);
    }
    assert.ok(invocation(rootDir, 'discovery').args.includes('--shard=5/8'));
  });
}

for (const file of ['scripts/test-harness/helper.test.ts', 'public/app/ignored.test.ts']) {
  test(`rejects a replay suite excluded by Jest: ${file}`, (t) => {
    const rootDir = project(t, '', ['public/app/source.test.ts']);
    mkdirSync(path.dirname(path.join(rootDir, file)), { recursive: true });
    writeFileSync(path.join(rootDir, file), '');
    writeFileSync(path.join(rootDir, 'baseline.json'), JSON.stringify({
      schemaVersion: 1, shard: '5/8', selectedSuites: ['public/app/source.test.ts', file],
    }));
    const result = runCli(rootDir, ['--shard=5/8', '--selectionFile=baseline.json']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Selected tests are unavailable in the Jest inventory/);
    assert.equal(existsSync(path.join(rootDir, 'invocation.json')), false);
  });
}


test('listTests does not enable instrumentation or write metrics', (t) => {
  const rootDir = project(t);
  const result = runCli(rootDir, ['--shard=5/8', '--listTests', '--metricsFile=metrics.json']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(invocation(rootDir, 'discovery').metricsDirectory, null);
  assert.equal(existsSync(path.join(rootDir, 'metrics.json')), false);
  assert.doesNotMatch(result.stdout, /Memory \(summed RSS @ 250ms\)/);
});

for (const args of [
  ['--outputFile=same.json', '--metricsFile=./same.json'],
  ['--selectionFile=baseline.json', '--metricsFile=./baseline.json'],
]) {
  test(`rejects incompatible metrics options: ${args.join(' ')}`, (t) => {
    const rootDir = project(t);
    const result = runCli(rootDir, ['--shard=5/8', ...args]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must use different paths|must not overwrite/);
    assert.equal(existsSync(path.join(rootDir, 'discovery.json')), false);
  });
}

for (const exitCode of [0, 7]) {
  test(`metrics write errors preserve failures and fail successful runs (Jest exit ${exitCode})`, (t) => {
    const rootDir = project(t, `process.exitCode = ${exitCode};`);
    const result = runCli(rootDir, ['--shard=5/8', '--metricsFile=missing-directory/metrics.json']);
    assert.equal(result.status, exitCode || 1);
    assert.match(result.stderr, /Could not write benchmark metrics/);
    assert.match(result.stdout, /^Memory \(summed RSS @ 250ms\)/m);
    assert.equal(existsSync(invocation(rootDir).cache), false);
  });
}

test('reports incomplete process snapshots after a timeout and preserves exit 124', { timeout: 10000 }, async (t) => {
  const rootDir = project(t, 'setInterval(() => {}, 1000);');
  const log = t.mock.method(console, 'log', () => {});
  const code = await runBenchmark({ shard: '5/8', rootDir, metricsFile: 'timeout.json', timeoutMs: 1000 });
  assert.equal(code, 124);
  const report = JSON.parse(readFileSync(path.join(rootDir, 'timeout.json'), 'utf8'));
  assert.equal(report.exitCode, 124);
  assert.equal(report.processes.incompleteProcesses, 1);
  assert.equal(report.processes.processes[0].complete, false);
  assert.ok(log.mock.calls.some((call) => /GC .*INCOMPLETE/.test(call.arguments[0])));
  assert.equal(existsSync(invocation(rootDir).cache), false);
});

test('rejects unknown CLI options before starting a run', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../../jest-benchmark.mts', import.meta.url)), '--workers=1'],
    { encoding: 'utf8', timeout: 10000 }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option '--workers'/);
  assert.doesNotMatch(result.stdout, /cold Jest cache/);
});
