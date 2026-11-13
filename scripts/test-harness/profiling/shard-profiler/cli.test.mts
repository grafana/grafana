import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { integer, runProfile, selectSuites, summarizeDirectory } from './run.mts';

async function temporary(t: TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'grafana-profile-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

const configuration = (roster = { include: [] as string[], exclude: [] as string[], groups: [] as string[][] }) => ({
  jestConfig: 'jest.happy-dom.config.js',
  testEnvironment: './public/test/happy-dom-environment.js',
  files: [],
  roster,
});

async function selection(root: string, selectedSuites: unknown, shard = '1/8') {
  await writeFile(path.join(root, 'selection.json'), JSON.stringify({ schemaVersion: 1, shard, selectedSuites }));
  return 'selection.json';
}

test('integer accepts positive safe integers and rejects unsupported bounds', () => {
  assert.equal(integer(undefined, 4, 'workers', 64), 4);
  assert.equal(integer('1', 4, 'workers', 64), 1);
  assert.equal(integer('64', 4, 'workers', 64), 64);
  for (const value of ['0', '-1', '1.2', '1e2', ' 1', '01', 'Infinity', '65', '9007199254740992']) {
    assert.throws(() => integer(value, 4, 'workers', 64), /positive integer/);
  }
});

test('fresh selection delegates sharding to Jest without an unnecessary full inventory', async (t) => {
  const root = await temporary(t);
  const calls: string[][] = [];
  const result = await selectSuites(root, configuration(), '1/8', undefined, async (args) => {
    calls.push(args);
    return [path.join(root, 'b.test.ts'), path.join(root, 'a.test.ts')];
  });
  assert.deepEqual(calls, [['--shard=1/8']]);
  assert.deepEqual(result.selectedSuites, ['a.test.ts', 'b.test.ts']);
});

test('baseline replay uses shared include, exclude and split-suite groups before filtering', async (t) => {
  const root = await temporary(t);
  const file = await selection(root, ['original.test.ts', 'removed.test.ts']);
  const inventory = ['original.test.ts', 'original.jsdom.test.ts', 'added.test.ts', 'unselected.test.ts'];
  const calls: string[][] = [];
  const config = configuration({
    include: ['added.test.ts'], exclude: ['removed.test.ts'],
    groups: [['original.test.ts', 'original.jsdom.test.ts']],
  });
  const discover = async (args: string[]) => {
    calls.push(args);
    return inventory.map((file) => path.join(root, file));
  };
  const result = await selectSuites(root, config, '1/8', file, discover, 'original*');
  assert.deepEqual(calls, [[]]);
  assert.deepEqual(result.selectedSuites, ['original.jsdom.test.ts', 'original.test.ts']);
  assert.deepEqual(result.added, ['added.test.ts', 'original.jsdom.test.ts']);
  assert.deepEqual(result.excluded, ['removed.test.ts']);
  assert.equal(result.rosterSuites, 3);
  await assert.rejects(selectSuites(root, config, '1/8', file, discover, 'unselected*'), /selected no suites/);
});

test('replay rejects mismatched reports, absent suites and unsafe paths', async (t) => {
  const root = await temporary(t);
  const discover = async () => [path.join(root, 'a.test.ts')];
  const file = await selection(root, ['a.test.ts'], '5/8');
  await assert.rejects(selectSuites(root, configuration(), '1/8', file, discover), /requested shard/);
  for (const files of [[], [42], ['/tmp/test.ts'], ['../test.ts'], ['C:\\test.ts'], ['a\\test.ts'], ['bad\0name']]) {
    await selection(root, files);
    await assert.rejects(selectSuites(root, configuration(), '1/8', file, discover), /nonempty|root-relative|inside rootDir/);
  }
  await selection(root, ['absent.test.ts']);
  await assert.rejects(selectSuites(root, configuration(), '1/8', file, discover), /unavailable/);
});

test('discovery rejects malformed output and empty selections', async (t) => {
  const root = await temporary(t);
  for (const result of [null, {}, [], [42]]) {
    await assert.rejects(selectSuites(root, configuration(), '1/8', undefined, async () => result), /nonempty array/);
  }
});

type RunnerMode = 'pass' | 'fail' | 'hang' | 'capture' | 'manifest-write-failure' | 'resist';

// The process fixture exercises orchestration failures without loading application dependencies.
// Real Jest/environment/runtime integration lives in integration.test.cjs.
async function runnerFixture(t: TestContext, mode: RunnerMode = 'pass', fixture: {
  baselineOnly?: boolean;
  inventory?: { shard: string[]; all: string[] };
  stderr?: string;
} = {}) {
  const root = await temporary(t);
  const defaultSuites = mode === 'resist' ? ['complete.test.ts', 'pending.test.ts'] : ['example.test.ts'];
  const files = {
    'package.json': '{}',
    'jest.config.js': `module.exports = {
      testEnvironment: 'jsdom',
      testEnvironmentOptions: { url: 'https://jsdom.fixture.invalid/', customExportConditions: ['browser', 'jsdom-fixture'] },
      setupFiles: ['./jsdom-setup.js'], setupFilesAfterEnv: ['./jsdom-after.js'],
      moduleNameMapper: { '^fixture$': './jsdom-mock.js' },
      globals: { fixtureEnvironment: 'jsdom', 'ts-jest': { tsconfig: 'global.tsconfig.json', diagnostics: { warnOnly: false } } },
      roots: ['<rootDir>/jsdom-tests'], transformIgnorePatterns: ['/jsdom-ignore/'],
      watchPlugins: ['jsdom-watch-plugin'],
      transform: {
        '^.+\\\\.tsx?$': [require.resolve('ts-jest'), { tsconfig: 'fixture.tsconfig.json', diagnostics: { warnOnly: false },
          isolatedModules: false, fixtureOption: { retained: ['ts-jest', 2] } }],
        '^.+\\\\.asset$': ['asset-transform', { source: 'ts-jest' }],
      },
    };`,
    'node_modules/jest-environment-jsdom/index.js': 'throw new Error("The fake runner must not load an environment");',
    'node_modules/ts-jest/index.js': 'throw new Error("The fake runner must not load a transformer");',
    'node_modules/asset-transform/index.js': 'throw new Error("The fake runner must not load a transformer");',
    ...(!fixture.baselineOnly ? {
      'jest.benchmark.happy-dom.json': JSON.stringify({ version: 1, ...configuration(), files: undefined, roster: undefined }),
      'public/test/happy-dom-environment.js': 'throw new Error("The fake runner must not load an environment");',
      'node_modules/@sucrase/jest-plugin/index.js': 'throw new Error("The fake runner must not load a transformer");',
      'jest.happy-dom.config.js': `module.exports = {
        testEnvironment: '<rootDir>/public/test/happy-dom-environment.js',
        testEnvironmentOptions: { url: 'https://happy.fixture.invalid/', customExportConditions: ['browser', 'happy-fixture'] },
        setupFiles: ['./happy-setup.js'], setupFilesAfterEnv: ['./happy-after.js'],
        moduleNameMapper: { '^fixture$': './happy-mock.js' }, globals: { fixtureEnvironment: 'happy-dom', happyOnly: true },
        roots: ['<rootDir>/happy-tests'], transformIgnorePatterns: ['/happy-ignore/'],
        watchPlugins: ['happy-watch-plugin'],
        transform: {
          '^.+\\\\.[jt]sx?$': [require.resolve('@sucrase/jest-plugin'), { jsxRuntime: 'classic', production: false,
            disableESTransforms: true, fixtureOption: { retained: ['sucrase', 3] } }],
          '^.+\\\\.asset$': 'asset-transform',
        },
      };`,
    } : {}),
    'node_modules/jest/package.json': JSON.stringify({ name: 'jest', exports: { './bin/jest': './runner.cjs' } }),
    'descendant.cjs': `
      const fs = require('node:fs');
      const path = require('node:path');
      process.on('SIGTERM', () => fs.writeFileSync(path.join(process.argv[2], 'descendant.sigterm'), String(process.pid)));
      setInterval(() => {}, 1000);
      process.send('ready');
    `,
    'node_modules/jest/runner.cjs': `
      const assert = require('node:assert/strict');
      const { spawn } = require('node:child_process');
      const { createHash } = require('node:crypto');
      const fs = require('node:fs');
      const path = require('node:path');
      const { gzipSync } = require('node:zlib');
      const args = process.argv.slice(2);
      const mode = ${JSON.stringify(mode)};
      const discovery = args.includes('--listTests');
      const config = require(args[args.indexOf('--config') + 1]);
      fs.appendFileSync(path.join(process.cwd(), 'invocations.jsonl'), JSON.stringify({ args, config,
        forceColor: process.env.FORCE_COLOR ?? null }) + '\\n');
      assert.equal(process.env.JEST_JASMINE, undefined);
      assert.equal(process.env.JEST_WORKER_ID, undefined);
      fs.writeFileSync(path.join(process.cwd(), discovery ? 'discovery-env.json' : 'execution-env.json'), JSON.stringify({
        jasmine: process.env.JEST_JASMINE ?? null, worker: process.env.JEST_WORKER_ID ?? null,
        profile: process.env.GRAFANA_SHARD_PROFILE ? JSON.parse(process.env.GRAFANA_SHARD_PROFILE) : null,
      }));
      function writeCapture(outputDir, suite) {
        const record = {
          schemaVersion: 1, suite, pid: process.pid, environment: 'fixture', coverageStart: 'environment',
          startUs: 1000, endUs: 2000, status: 'complete', warnings: [], instrumentationUs: 0,
          points: [], segments: [{ kind: 'body', startUs: 1000, endUs: 2000, test: 1 }],
          tests: [{ id: 1, name: 'example test', attempt: 1, status: 'passed', startUs: 1000, endUs: 2000,
            bodyUs: 1000, hookUs: 0, cpuUserUs: 10, cpuSystemUs: 2, heapDeltaBytes: 64, concurrent: false }],
          modules: [], edges: [], gc: [], cpuProfile: null, heapProfiles: [],
        };
        const hash = createHash('sha256').update(suite).digest('hex').slice(0, 16);
        fs.writeFileSync(path.join(outputDir, 'raw', hash + '-' + process.pid + '-1.json.gz'), gzipSync(JSON.stringify(record)));
      }
      if (discovery) {
        assert.equal(process.env.GRAFANA_SHARD_PROFILE, undefined);
        const cache = args[args.indexOf('--cacheDirectory') + 1];
        fs.mkdirSync(cache, { recursive: true });
        fs.writeFileSync(path.join(cache, 'temporary'), 'discovery');
        const suites = args.some(arg => arg.startsWith('--shard='))
          ? ${JSON.stringify(fixture.inventory?.shard ?? defaultSuites)}
          : ${JSON.stringify(fixture.inventory?.all ?? defaultSuites)};
        console.log(JSON.stringify(suites.map(file => path.join(process.cwd(), file))));
      } else {
        const profile = JSON.parse(process.env.GRAFANA_SHARD_PROFILE);
        assert.equal(profile.cpu, true);
        assert.equal(config.maxWorkers, 1);
        assert.ok(config.testRunner === undefined || config.testRunner === 'jest-circus/runner');
        assert.match(config.runtime, /runtime.cjs$/);
        fs.mkdirSync(config.cacheDirectory, { recursive: true });
        fs.writeFileSync(path.join(config.cacheDirectory, 'temporary'), 'execution');
        if (mode === 'hang') {
          setInterval(() => {}, 1000);
        } else if (mode === 'resist') {
          writeCapture(profile.outputDir, 'complete.test.ts');
          fs.writeFileSync(path.join(profile.outputDir, 'raw', 'unfinished.json.gz.tmp'), 'partial capture');
          process.on('SIGTERM', () => fs.writeFileSync(path.join(profile.outputDir, 'jest.sigterm'), String(process.pid)));
          const descendant = spawn(process.execPath, [path.join(process.cwd(), 'descendant.cjs'), profile.outputDir], {
            stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
          });
          const publish = ready => {
            const target = path.join(process.cwd(), 'processes.json');
            fs.writeFileSync(target + '.tmp', JSON.stringify({ jest: process.pid, descendant: descendant.pid, ready }));
            fs.renameSync(target + '.tmp', target);
          };
          publish(false);
          descendant.on('message', message => { if (message === 'ready') publish(true); });
          setInterval(() => {}, 1000);
        } else {
          if (mode === 'capture' || mode === 'manifest-write-failure') writeCapture(profile.outputDir, 'example.test.ts');
          if (mode === 'manifest-write-failure') {
            fs.copyFileSync(path.join(profile.outputDir, 'run.json'), path.join(profile.outputDir, 'previous-run.json'));
            fs.mkdirSync(path.join(profile.outputDir, 'run.json.tmp'));
          }
          const failed = mode === 'fail';
          const suites = args.slice(args.indexOf('--runTestsByPath') + 1);
          fs.writeFileSync(args[args.indexOf('--outputFile') + 1], JSON.stringify({
            success: !failed, numTotalTestSuites: suites.length, numTotalTests: suites.length,
            testResults: suites.map(name => ({ name, status: failed ? 'failed' : 'passed',
              startTime: 1000, endTime: 1002,
              assertionResults: [{ fullName: 'example test', status: failed ? 'failed' : 'passed', duration: 1 }] }))
          }));
          process.stderr.write(${JSON.stringify(fixture.stderr ?? '')});
          process.exitCode = failed ? 1 : 0;
        }
      }
    `,
  };
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  return { rootDir: root, outputDir: 'output', shard: '1/8', minFreeMiB: 1 };
}

async function optionalFile(filename: string) {
  try { return await readFile(filename, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function waitFor<T>(check: () => Promise<T | undefined>, label: string, timeoutMs = 5000): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  do {
    const value = await check();
    if (value !== undefined) return value;
    await delay(20);
  } while (performance.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

async function processState(pid: number) {
  try {
    const stat = await optionalFile(`/proc/${pid}/stat`);
    if (!stat) return undefined;
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return { state: fields[0], parent: Number(fields[1]), group: Number(fields[2]) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return undefined;
    throw error;
  }
}

function driverScope(t: TestContext) {
  let child: ChildProcess | undefined;
  let rootDir: string | undefined;
  let completion: Promise<{ code: number | null; signal: NodeJS.Signals | null; error?: Error }> | undefined;
  let exited = false;
  let output = '';
  let deadlineExpired = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let cleanupPromise: Promise<void> | undefined;
  let cleanupFailure: unknown;
  const killGroup = (pid: number) => {
    try { process.kill(-pid, 'SIGKILL'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  const cleanup = () => cleanupPromise ??= (async () => {
    if (watchdog) clearTimeout(watchdog);
    const groups = new Set<number>();
    if (rootDir) {
      const text = await optionalFile(path.join(rootDir, 'processes.json'));
      if (text) groups.add(JSON.parse(text).jest);
    }
    // Also find a detached child if startup failed before the stub published its PID file.
    if (child?.pid && !exited && process.platform === 'linux') {
      const children = await optionalFile(`/proc/${child.pid}/task/${child.pid}/children`);
      for (const pid of children?.trim().split(/\s+/).filter(Boolean) || []) groups.add(Number(pid));
    }
    for (const pid of groups) killGroup(pid);
    if (child?.pid && !exited) killGroup(child.pid);
    if (completion) await waitFor(async () => exited ? true : undefined, 'driver cleanup', 1000);
  })();
  // Register before temporary() so an aborted test terminates its processes before removing PID files.
  t.after(cleanup);
  return {
    start(options: Awaited<ReturnType<typeof runnerFixture>>, env: NodeJS.ProcessEnv = {}) {
      rootDir = options.rootDir;
      child = spawn(process.execPath, ['--input-type=module', '--eval', `
        import { writeFileSync } from 'node:fs';
        import { runProfile } from ${JSON.stringify(new URL('./run.mts', import.meta.url).href)};
        const nativeKill = process.kill.bind(process);
        const signals = [];
        process.kill = (pid, signal) => {
          const result = nativeKill(pid, signal);
          signals.push({ pid, signal });
          writeFileSync(${JSON.stringify(path.join(rootDir, 'signals.json'))}, JSON.stringify(signals));
          return result;
        };
        process.exitCode = await runProfile(${JSON.stringify({ ...options, timeoutSeconds: 60 })});
      `], { cwd: rootDir, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      for (const stream of [child.stdout!, child.stderr!]) {
        stream.setEncoding('utf8');
        stream.on('data', (chunk: string) => { output = (output + chunk).slice(-65536); });
      }
      completion = new Promise((resolve) => {
        child!.once('error', (error) => {
          exited = true;
          if (watchdog) clearTimeout(watchdog);
          resolve({ code: null, signal: null, error });
        });
        child!.once('close', (code, signal) => {
          exited = true;
          if (watchdog) clearTimeout(watchdog);
          resolve({ code, signal });
        });
      });
      watchdog = setTimeout(() => {
        deadlineExpired = true;
        void cleanup().catch((error) => { cleanupFailure = error; });
      }, 15000);
      return child;
    },
    async result() {
      assert.ok(completion, 'The driver must be started');
      const result = await completion;
      assert.equal(deadlineExpired, false, `Driver exceeded its 15-second deadline\n${output}`);
      assert.equal(cleanupFailure, undefined);
      assert.equal(result.error, undefined, `${result.error?.stack}\n${output}`);
      return result;
    },
    cleanup,
    get exited() { return exited; },
    get output() { return output; },
  };
}

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

async function invocations(root: string): Promise<Array<{ args: string[]; config: Record<string, unknown>; forceColor: string | null }>> {
  return (await readFile(path.join(root, 'invocations.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
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
  test(`CLI preserves Jest color preference for ${name} without forcing discovery colors`, async (t) => {
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
    const options = await runnerFixture(t);
    assert.equal(await runProfile(options), 0);
    const calls = await invocations(options.rootDir);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].forceColor, env.FORCE_COLOR ?? null);
    assert.equal(calls[1].forceColor, expected);
  });
}

for (const ending of ['', '\n', '\r\n']) {
  test(`CLI compacts terminal paths but preserves colors, failures and the raw log with ending ${JSON.stringify(ending)}`, { timeout: 20000 }, async (t) => {
    const driver = driverScope(t);
    const prefix = '\u001b[31mFAIL\u001b[39m résumé.test.ts\nAssertionError: expected 1, received 2\n' +
      'Test Suites: 1 failed, 1 total\n';
    const suffix = ending ? 'warning without a trailing newline' : '';
    const stderr = prefix + '\u001b[2mRan all test suites within paths\u001b[22m "résumé.test.ts", "other.test.ts".' + ending + suffix;
    const options = await runnerFixture(t, 'fail', { stderr });
    driver.start(options);
    assert.equal((await driver.result()).code, 1);
    assert.ok(driver.output.includes(prefix + 'Ran all selected test suites.' + ending + suffix), driver.output);
    assert.ok(!driver.output.includes('Ran all test suites within paths'), driver.output);
    const log = await readFile(path.join(options.rootDir, options.outputDir, 'jest.log'), 'utf8');
    assert.ok(log.endsWith(stderr), log);
    assert.ok(!log.includes('Ran all selected test suites.'), log);
  });
}

for (const [environment, transformer] of [
  ['jsdom', 'ts-jest'], ['jsdom', 'sucrase'], ['happy-dom', 'sucrase'], ['happy-dom', 'ts-jest'],
] as const) {
  test(`CLI orchestrates ${environment}/${transformer} with only the donor transform table and selected environment roster`, { timeout: 20000 }, async (t) => {
    const options = await runnerFixture(t, 'pass', { inventory: {
      shard: ['seed.test.ts', 'removed.test.ts'],
      all: ['seed.test.ts', 'removed.test.ts', 'shared.test.ts', 'jsdom-added.test.ts', 'jsdom-companion.test.ts',
        'happy-dom-added.test.ts', 'happy-dom-companion.test.ts', 'unselected.test.ts'],
    } });
    const root = options.rootDir;
    await writeFile(path.join(root, 'jest.benchmark.json'), JSON.stringify({ version: 1, include: ['shared.test.ts'] }));
    for (const mode of ['jsdom', 'happy-dom']) {
      await writeFile(path.join(root, `jest.benchmark.${mode}.json`), JSON.stringify({
        version: 1, jestConfig: mode === 'jsdom' ? 'jest.config.js' : 'jest.happy-dom.config.js',
        testEnvironment: mode === 'jsdom' ? 'jsdom' : './public/test/happy-dom-environment.js',
        include: [`${mode}-added.test.ts`], groups: [['seed.test.ts', `${mode}-companion.test.ts`]],
        shards: { '1/8': { exclude: ['removed.test.ts'] } },
      }));
    }
    const require = createRequire(path.join(root, 'package.json'));
    const baseName = environment === 'jsdom' ? 'jest.config.js' : 'jest.happy-dom.config.js';
    const donorName = transformer === 'ts-jest' ? 'jest.config.js' : 'jest.happy-dom.config.js';
    const base = require(`./${baseName}`);
    const donor = require(`./${donorName}`);
    const snapshots = structuredClone([base, donor]);
    const baseEnvironment = environment === 'jsdom'
      ? require.resolve('jest-environment-jsdom') : path.join(root, 'public/test/happy-dom-environment.js');
    const transformerModule = require.resolve(transformer === 'ts-jest' ? 'ts-jest' : '@sucrase/jest-plugin');
    assert.equal(await runProfile({ ...options, environment, transformer }), 0);
    assert.deepEqual([base, donor], snapshots, 'Configuration objects must not be mutated');

    const output = path.join(root, options.outputDir);
    const calls = await invocations(root);
    assert.equal(calls.length, 3, 'Discover the shard, expand the selected environment roster, then execute');
    const discoveryConfig = { ...base, rootDir: root, transform: donor.transform, testEnvironment: baseEnvironment,
      cacheDirectory: path.join(output, 'cache', 'discovery'), maxWorkers: 1, watchPlugins: [] };
    for (const call of calls.slice(0, 2)) {
      assert.deepEqual(call.config, discoveryConfig, 'Discovery must retain all selected-environment config outside transform and harness overrides');
      assert.ok(call.args.includes('--listTests'));
      assert.ok(call.args.includes('--maxWorkers=1'));
      assert.equal(call.args[call.args.indexOf('--config') + 1], path.join(output, 'discovery.jest.config.cjs'));
      assert.equal(call.args[call.args.indexOf('--env') + 1], baseEnvironment);
    }
    assert.ok(calls[0].args.includes('--shard=1/8'));
    assert.ok(!calls[1].args.some((arg) => arg.startsWith('--shard=')));
    assert.deepEqual(calls[2].config, { ...discoveryConfig,
      testEnvironment: fileURLToPath(new URL('./environment.cjs', import.meta.url)),
      runtime: fileURLToPath(new URL('./runtime.cjs', import.meta.url)),
      cacheDirectory: path.join(output, 'cache', 'execution'),
    }, 'Execution must preserve setup files, mappers, globals, environment options and complete donor transform options');
    assert.deepEqual(calls[2].config.transform, calls[0].config.transform);
    assert.equal(calls[2].args[calls[2].args.indexOf('--config') + 1], path.join(output, 'profile.jest.config.cjs'));
    assert.ok(!calls[2].args.includes('--env'), 'Do not bypass the profiling wrapper during execution');
    const selected = [`${environment}-added.test.ts`, `${environment}-companion.test.ts`, 'seed.test.ts', 'shared.test.ts'].sort();
    assert.deepEqual(calls[2].args.slice(calls[2].args.indexOf('--runTestsByPath') + 1), selected.map((file) => path.join(root, file)));
    const execution = JSON.parse(await readFile(path.join(root, 'execution-env.json'), 'utf8'));
    assert.equal(execution.profile.baseEnvironment, baseEnvironment);

    const manifest = JSON.parse(await readFile(path.join(output, 'run.json'), 'utf8'));
    assert.equal(manifest.environment, environment);
    assert.equal(manifest.transformer, transformer);
    assert.equal(manifest.baseEnvironment, baseEnvironment);
    assert.equal(manifest.transformerModule, transformerModule);
    assert.equal(manifest.configFile, baseName);
    assert.equal(manifest.transformConfigFile, donorName);
    const hashes = Object.fromEntries(await Promise.all([...new Set(['jest.config.js', baseName, donorName])]
      .map(async (file) => [file, sha256(await readFile(path.join(root, file)))])));
    assert.deepEqual(manifest.configurationHashes, hashes);
    assert.deepEqual(manifest.rosterConfig, await Promise.all(['jest.benchmark.json', `jest.benchmark.${environment}.json`]
      .map(async (file) => ({ path: file, sha256: sha256(await readFile(path.join(root, file))) }))));
    assert.deepEqual(manifest.selectedSuites, selected);
    assert.equal(manifest.selectionSha256, sha256(JSON.stringify(selected)));
    assert.equal(manifest.rosterSuites, selected.length);
    assert.deepEqual(manifest.added, selected.filter((file) => file !== 'seed.test.ts'));
    assert.deepEqual(manifest.excluded, ['removed.test.ts']);
    assert.equal(manifest.status, 'completed');
    assert.equal(manifest.exitCode, 0);
    assert.match(manifest.profilerHash, /^[a-f0-9]{64}$/);
    const summary = JSON.parse(await readFile(path.join(output, 'summary.json'), 'utf8'));
    assert.equal(summary.metadata.environment, environment);
    assert.equal(summary.metadata.transformer, transformer);
    assert.deepEqual(summary.metadata.configurationHashes, hashes);
    assert.equal(summary.metadata.selectionSha256, manifest.selectionSha256);
    assert.deepEqual(summary.suites.path.map((id: number) => summary.strings[id]), selected);
    assert.ok(!(await readdir(output)).includes('cache'));
  });
}

test('CLI jsdom defaults to ts-jest with no Happy DOM, Sucrase or benchmark files', { timeout: 20000 }, async (t) => {
  const options = await runnerFixture(t, 'pass', { baselineOnly: true });
  const root = options.rootDir;
  assert.ok((await readdir(root, { recursive: true })).every((file) => !/happy|sucrase|benchmark/.test(file)));
  const require = createRequire(path.join(root, 'package.json'));
  const base = require(path.join(root, 'jest.config.js'));
  const snapshot = structuredClone(base);
  assert.equal(await runProfile({ ...options, environment: 'jsdom' }), 0);
  assert.deepEqual(base, snapshot);
  const output = path.join(root, options.outputDir);
  const calls = await invocations(root);
  assert.equal(calls.length, 2, 'An empty roster does not need a full inventory');
  assert.ok(calls[0].args.includes('--shard=1/8'));
  assert.deepEqual(calls[0].config, { ...base, rootDir: root, testEnvironment: require.resolve('jest-environment-jsdom'),
    cacheDirectory: path.join(output, 'cache', 'discovery'), maxWorkers: 1, watchPlugins: [] });
  assert.deepEqual(calls[1].config, { ...calls[0].config,
    testEnvironment: fileURLToPath(new URL('./environment.cjs', import.meta.url)),
    runtime: fileURLToPath(new URL('./runtime.cjs', import.meta.url)),
    cacheDirectory: path.join(output, 'cache', 'execution'),
  });
  assert.deepEqual(calls[1].args.slice(calls[1].args.indexOf('--runTestsByPath') + 1), [path.join(root, 'example.test.ts')]);
  const manifest = JSON.parse(await readFile(path.join(output, 'run.json'), 'utf8'));
  assert.equal(manifest.environment, 'jsdom');
  assert.equal(manifest.transformer, 'ts-jest');
  assert.equal(manifest.configFile, 'jest.config.js');
  assert.equal(manifest.transformConfigFile, 'jest.config.js');
  assert.equal(manifest.baseEnvironment, require.resolve('jest-environment-jsdom'));
  assert.equal(manifest.transformerModule, require.resolve('ts-jest'));
  assert.deepEqual(manifest.configurationHashes, { 'jest.config.js': sha256(await readFile(path.join(root, 'jest.config.js'))) });
  assert.deepEqual(manifest.rosterConfig, []);
  assert.deepEqual(manifest.selectedSuites, ['example.test.ts']);
  assert.equal(manifest.selectionSha256, sha256(JSON.stringify(['example.test.ts'])));
  assert.equal(manifest.rosterSuites, 1);
  assert.deepEqual(manifest.added, []);
  assert.deepEqual(manifest.excluded, []);
  assert.equal(manifest.status, 'completed');
  const execution = JSON.parse(await readFile(path.join(root, 'execution-env.json'), 'utf8'));
  assert.equal(execution.profile.baseEnvironment, manifest.baseEnvironment);
  assert.ok(!(await readdir(output)).includes('cache'));
});

function rejectedCLI(args: string[], cwd: string) {
  // A flag-validation regression must not launch real Jest from the current checkout.
  const guard = `import childProcess from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module';
    childProcess.spawn = () => { throw new Error('Unexpected subprocess during flag validation'); }; syncBuiltinESMExports();`;
  const result = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(guard)}`,
    fileURLToPath(new URL('./run.mts', import.meta.url)), ...args], {
    cwd, encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 65536,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.doesNotMatch(result.stderr, /Unexpected subprocess/);
  return result.stderr;
}

test('CLI rejects invalid environment and transformer flags before creating output', { timeout: 20000 }, async (t) => {
  const root = await temporary(t);
  for (const [flag, values] of [['environment', ['node', 'HappyDOM', '']], ['transformer', ['babel-jest', 'typescript', '']]] as const) {
    for (const [index, value] of values.entries()) {
      const output = path.join(root, `${flag}-${index}`);
      const error = rejectedCLI(['--shard=1/8', `--outputDir=${output}`, `--${flag}=${value}`], root);
      assert.match(error, new RegExp(`--${flag} must be`));
      await assert.rejects(readdir(output), { code: 'ENOENT' });
    }
  }
  assert.deepEqual(await readdir(root), []);
});

test('summary regeneration rejects mode flags instead of silently ignoring them', { timeout: 10000 }, async (t) => {
  const root = await temporary(t);
  await writeFile(path.join(root, 'summary.json'), 'existing summary');
  for (const mode of ['--environment=jsdom', '--transformer=invalid']) {
    assert.match(rejectedCLI([`--summarize=${root}`, mode], root), /uses the recorded environment and transformer/);
    assert.equal(await readFile(path.join(root, 'summary.json'), 'utf8'), 'existing summary');
  }
});

test('CLI rejects --rootDir as unknown rather than adding different-checkout support', { timeout: 10000 }, async (t) => {
  const root = await temporary(t);
  const output = path.join(root, 'output');
  const error = rejectedCLI(['--shard=1/8', `--outputDir=${output}`, `--rootDir=${root}`], root);
  assert.match(error, /Unknown option '--rootDir'/);
  assert.deepEqual(await readdir(root), []);
});

test('CLI clears inherited Jasmine, worker ID and profile settings for discovery and execution', { timeout: 20000 }, async (t) => {
  const driver = driverScope(t);
  const options = await runnerFixture(t);
  try {
    driver.start(options, { JEST_JASMINE: '1', JEST_WORKER_ID: 'outer-worker', GRAFANA_SHARD_PROFILE: '{"inherited":true}' });
    assert.deepEqual(await driver.result(), { code: 0, signal: null }, driver.output);
    const discovery = JSON.parse(await readFile(path.join(options.rootDir, 'discovery-env.json'), 'utf8'));
    const execution = JSON.parse(await readFile(path.join(options.rootDir, 'execution-env.json'), 'utf8'));
    assert.deepEqual(discovery, { jasmine: null, worker: null, profile: null });
    assert.deepEqual(execution, { jasmine: null, worker: null, profile: {
      rootDir: options.rootDir, outputDir: path.join(options.rootDir, 'output'),
      baseEnvironment: path.join(options.rootDir, 'public/test/happy-dom-environment.js'),
      cpu: true, heap: true, cpuIntervalUs: 1000, heapIntervalBytes: 1048576,
    } });
  } finally {
    await driver.cleanup();
  }
});

test('CLI rejects explicit nondefault test runners before creating output or launching Jest', { timeout: 20000 }, async (t) => {
  for (const runner of ['jest-jasmine2', './custom-circus-wrapper.cjs']) {
    const options = await runnerFixture(t);
    const config = path.join(options.rootDir, 'jest.happy-dom.config.js');
    await writeFile(config, `${await readFile(config, 'utf8')}\nmodule.exports.testRunner = ${JSON.stringify(runner)};\n`);
    await assert.rejects(runProfile(options), /requires the default Jest Circus runner/);
    assert.equal(await optionalFile(path.join(options.rootDir, 'discovery-env.json')), undefined);
    await assert.rejects(readdir(path.join(options.rootDir, 'output')), { code: 'ENOENT' });
  }
});

test('CLI accepts an explicitly selected default Circus runner', { timeout: 20000 }, async (t) => {
  const options = await runnerFixture(t);
  const config = path.join(options.rootDir, 'jest.happy-dom.config.js');
  await writeFile(config, `${await readFile(config, 'utf8')}\nmodule.exports.testRunner = 'jest-circus/runner';\n`);
  assert.equal(await runProfile(options), 0);
  const report = JSON.parse(await readFile(path.join(options.rootDir, 'output', 'jest-results.json'), 'utf8'));
  assert.equal(report.success, true);
});

test('failed manifest staging preserves the prior run.json and recoverable captures', { timeout: 20000 }, async (t) => {
  const options = await runnerFixture(t, 'manifest-write-failure');
  await assert.rejects(runProfile(options), { code: 'EISDIR' });
  const output = path.join(options.rootDir, 'output');
  const previous = await readFile(path.join(output, 'previous-run.json'), 'utf8');
  assert.equal(await readFile(path.join(output, 'run.json'), 'utf8'), previous);
  assert.equal(JSON.parse(previous).status, 'running');
  assert.deepEqual(JSON.parse(previous).selectedSuites, ['example.test.ts']);
  assert.ok(!(await readdir(output)).includes('cache'));
  const summary = await summarizeDirectory(output);
  assert.deepEqual(summary.completeness, { expectedSuites: 1, recordedSelectedSuites: 1, missingSelectedSuites: 0 });
  assert.equal(summary.strings[summary.tests.status[0]], 'passed');
});

test('failed manifest rename leaves the old manifest readable and the new staged manifest intact', { timeout: 20000 }, async (t) => {
  const options = await runnerFixture(t, 'capture');
  const output = path.join(options.rootDir, 'output');
  const manifestPath = path.join(output, 'run.json');
  const rename = fs.promises.rename;
  let previous: string | undefined;
  const updates: string[] = [];
  t.mock.method(fs.promises, 'rename', async (from: fs.PathLike, to: fs.PathLike) => {
    if (to === manifestPath) {
      assert.equal(from, path.join(output, 'run.json.tmp'));
      const next = JSON.parse(await readFile(from, 'utf8'));
      updates.push(next.status);
      if (next.status === 'completed') {
        previous = await readFile(manifestPath, 'utf8');
        throw Object.assign(new Error('fixture manifest rename failed'), { code: 'EIO' });
      }
    }
    return rename(from, to);
  });
  await assert.rejects(runProfile(options), { code: 'EIO', message: 'fixture manifest rename failed' });
  assert.deepEqual(updates, ['initializing', 'running', 'completed']);
  assert.equal(await readFile(manifestPath, 'utf8'), previous);
  assert.equal(JSON.parse(previous!).status, 'running');
  assert.equal(JSON.parse(await readFile(path.join(output, 'run.json.tmp'), 'utf8')).status, 'completed');
  assert.ok(!(await readdir(output)).includes('cache'));
  const summary = await summarizeDirectory(output);
  assert.equal(summary.completeness.recordedSelectedSuites, 1);
  assert.equal(summary.strings[summary.tests.name[0]], 'example test');
});

for (const [signal, code, reason] of [['SIGINT', 130, /interrupted/], ['SIGTERM', 143, /terminated/]] as const) {
  test(`Linux ${signal} escalates to group SIGKILL and retains a partial summary and raw captures`, {
    skip: process.platform !== 'linux', timeout: 20000,
  }, async (t) => {
    const driver = driverScope(t);
    const options = await runnerFixture(t, 'resist');
    const output = path.join(options.rootDir, 'output');
    try {
      const coordinator = driver.start(options);
      const pids = await waitFor(async () => {
        assert.equal(driver.exited, false, driver.output);
        const text = await optionalFile(path.join(options.rootDir, 'processes.json'));
        const value = text && JSON.parse(text);
        return value?.ready ? { jest: Number(value.jest), descendant: Number(value.descendant) } : undefined;
      }, 'the resistant Jest process and descendant to become ready');
      const jestState = await processState(pids.jest);
      const descendantState = await processState(pids.descendant);
      assert.equal(jestState?.parent, coordinator.pid);
      assert.equal(jestState?.group, pids.jest);
      assert.equal(descendantState?.parent, pids.jest);
      assert.equal(descendantState?.group, pids.jest, 'The descendant must share the Jest process group');
      const rawDirectory = path.join(output, 'raw');
      const names = (await readdir(rawDirectory)).sort();
      const rawName = names.find((name) => name.endsWith('.json.gz'))!;
      assert.ok(rawName);
      const capturedBytes = await readFile(path.join(rawDirectory, rawName));
      const before = JSON.parse(await readFile(path.join(output, 'run.json'), 'utf8'));
      assert.equal(before.status, 'running');
      assert.deepEqual(before.selectedSuites, ['complete.test.ts', 'pending.test.ts']);

      assert.equal(coordinator.kill(signal), true);
      assert.deepEqual(await driver.result(), { code, signal: null }, driver.output);
      const signals = JSON.parse(await readFile(path.join(options.rootDir, 'signals.json'), 'utf8'));
      assert.deepEqual(signals.slice(0, 2), [
        { pid: -pids.jest, signal: 'SIGTERM' },
        { pid: -pids.jest, signal: 'SIGKILL' },
      ]);
      assert.equal(await readFile(path.join(output, 'jest.sigterm'), 'utf8'), String(pids.jest));
      assert.equal(await readFile(path.join(output, 'descendant.sigterm'), 'utf8'), String(pids.descendant));
      for (const [name, pid] of Object.entries(pids)) {
        await waitFor(async () => {
          const state = await processState(pid);
          // Orphan reaping belongs to PID 1; a zombie has already released its handles and cannot run.
          return !state || state.state === 'Z' || state.state === 'X' ? true : undefined;
        }, `${name} to stop after group SIGKILL`, 1500);
      }
      const manifest = JSON.parse(await readFile(path.join(output, 'run.json'), 'utf8'));
      assert.equal(manifest.exitCode, code);
      assert.equal(manifest.status, 'incomplete');
      assert.match(manifest.stopReason, reason);
      assert.deepEqual(manifest.selectedSuites, before.selectedSuites);
      const summary = JSON.parse(await readFile(path.join(output, 'summary.json'), 'utf8'));
      assert.equal(summary.metadata.exitCode, code);
      assert.deepEqual(summary.completeness, { expectedSuites: 2, recordedSelectedSuites: 1, missingSelectedSuites: 1 });
      assert.deepEqual(summary.suites.path.map((id: number) => summary.strings[id]), ['complete.test.ts', 'pending.test.ts']);
      assert.deepEqual(summary.suites.recordStatus.map((id: number | null) => id === null ? null : summary.strings[id]), ['complete', null]);
      assert.equal(summary.tests.name.length, 1);
      assert.equal(summary.strings[summary.tests.name[0]], 'example test');
      assert.equal(summary.strings[summary.tests.status[0]], 'passed');
      assert.equal(summary.metadata.unreadableRecords, 0, 'An unfinished .tmp capture must not be read as gzip');
      assert.deepEqual((await readdir(rawDirectory)).sort(), names);
      assert.deepEqual(await readFile(path.join(rawDirectory, rawName)), capturedBytes);
      assert.equal(JSON.parse(gunzipSync(capturedBytes).toString()).suite, 'complete.test.ts');
      assert.equal(await readFile(path.join(rawDirectory, 'unfinished.json.gz.tmp'), 'utf8'), 'partial capture');
      assert.equal(await optionalFile(path.join(output, 'jest-results.json')), undefined);
      const retainedFiles = await readdir(output);
      assert.ok(retainedFiles.includes('jest.log'));
      assert.ok(!retainedFiles.includes('cache'));
      assert.ok(!retainedFiles.includes('run.json.tmp'));
    } finally {
      await driver.cleanup();
    }
  });
}

for (const mode of ['pass', 'fail'] as const) {
  test(`CLI preserves ${mode} results, produces partial coverage and removes only its cache`, async (t) => {
    const options = await runnerFixture(t, mode);
    const code = await runProfile(options);
    assert.equal(code, mode === 'pass' ? 0 : 1);
    const output = path.join(options.rootDir, options.outputDir);
    const manifest = JSON.parse(await readFile(path.join(output, 'run.json'), 'utf8'));
    const summary = JSON.parse(await readFile(path.join(output, 'summary.json'), 'utf8'));
    assert.equal(manifest.exitCode, code);
    assert.equal(manifest.status, code ? 'incomplete' : 'completed');
    assert.deepEqual(manifest.selectedSuites, ['example.test.ts']);
    assert.equal(summary.completeness.missingSelectedSuites, 1);
    assert.equal(summary.tests.name.length, 1);
    assert.equal(summary.strings[summary.tests.name[0]], 'example test');
    assert.equal(summary.strings[summary.tests.status[0]], mode === 'pass' ? 'passed' : 'failed');
    assert.deepEqual(summary.suites.processCpuUserUs, [null]);
    assert.ok(!(await readdir(output)).includes('cache'));
    assert.ok(!(await readdir(output)).includes('run.json.tmp'));
    await assert.rejects(runProfile(options), { code: 'EEXIST' });
    assert.deepEqual(JSON.parse(await readFile(path.join(output, 'run.json'), 'utf8')), manifest);
  });
}

test('CLI timeout stops the child and keeps the selected suite as missing coverage', { timeout: 10000 }, async (t) => {
  const options = await runnerFixture(t, 'hang');
  assert.equal(await runProfile({ ...options, timeoutSeconds: 1 }), 124);
  const output = path.join(options.rootDir, options.outputDir);
  const manifest = JSON.parse(await readFile(path.join(output, 'run.json'), 'utf8'));
  const summary = JSON.parse(await readFile(path.join(output, 'summary.json'), 'utf8'));
  assert.match(manifest.stopReason, /exceeded 1 seconds/);
  assert.equal(summary.completeness.missingSelectedSuites, 1);
  assert.deepEqual(summary.suites.wallUs, [null]);
  assert.ok(!(await readdir(output)).includes('cache'));
});

test('CLI disk guard aborts before discovery and leaves a recoverable report', async (t) => {
  const options = await runnerFixture(t);
  assert.equal(await runProfile({ ...options, minFreeMiB: Number.MAX_SAFE_INTEGER }), 1);
  const output = path.join(options.rootDir, options.outputDir);
  const manifest = JSON.parse(await readFile(path.join(output, 'run.json'), 'utf8'));
  assert.match(manifest.stopReason, /Free disk space/);
  assert.deepEqual(await readdir(path.join(output, 'raw')), []);
  assert.equal(JSON.parse(await readFile(path.join(output, 'summary.json'), 'utf8')).metadata.exitCode, 1);
});

test('an irreducible summary budget fails without erasing results or run errors', async (t) => {
  const options = await runnerFixture(t);
  assert.equal(await runProfile({ ...options, maxSummaryBytes: 1 }), 1);
  const output = path.join(options.rootDir, options.outputDir);
  const manifest = JSON.parse(await readFile(path.join(output, 'run.json'), 'utf8'));
  assert.match(manifest.summaryError, /cannot fit/);
  assert.equal(manifest.exitCode, 1);
  const summary = await summarizeDirectory(output, 2000000);
  assert.equal(summary.tests.name.length, 1);
});

test('summary rebuild retains missing suites when a worker report or Jest JSON is corrupt', async (t) => {
  const directory = await temporary(t);
  await mkdir(path.join(directory, 'raw'));
  await writeFile(path.join(directory, 'run.json'), JSON.stringify({ selectedSuites: ['missing.test.ts'] }));
  await writeFile(path.join(directory, 'jest-results.json'), '{');
  await writeFile(path.join(directory, 'raw', 'broken.json.gz'), 'not gzip');
  await writeFile(path.join(directory, 'raw', 'wrong-version.json.gz'), gzipSync(JSON.stringify({ schemaVersion: 99, suite: 'wrong.test.ts' })));
  const summary = await summarizeDirectory(directory);
  assert.equal(summary.metadata.unreadableRecords, 2);
  assert.match(summary.metadata.jestResultsError, /JSON|position|property/);
  assert.equal(summary.completeness.missingSelectedSuites, 1);
  assert.equal(summary.strings[summary.suites.path[0]], 'missing.test.ts');
  assert.equal(JSON.parse(await readFile(path.join(directory, 'record-errors.json'), 'utf8')).length, 2);
});

test('direct run API rejects invalid bounds before it creates output', async (t) => {
  const rootDir = await temporary(t);
  const options = { rootDir, outputDir: 'output', shard: '1/8' };
  await assert.rejects(runProfile({ ...options, workers: 65 }), /workers must/);
  await assert.rejects(runProfile({ ...options, shard: '9/8' }), /Invalid shard/);
  await assert.rejects(runProfile({ ...options, outputDir: '' }), /outputDir/);
  assert.deepEqual(await readdir(rootDir), []);
});
