'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { gunzipSync } = require('node:zlib');
const { buildSummary } = require('./summarize.cjs');

const rootDir = path.resolve(__dirname, '../../../..');
const base = require(path.join(rootDir, 'jest.happy-dom.config.js'));
const coreRequire = createRequire(createRequire(require.resolve('jest')).resolve('@jest/core'));
const configRequire = createRequire(coreRequire.resolve('jest-config'));
const jestBin = require.resolve('jest/bin/jest');
const MiB = 1048576;
const reserveBytes = 220 * MiB;
const maxArtifactBytes = 32 * MiB;
const timeoutMs = 60000;

function freeBytes(directory) {
  const stats = fs.statfsSync(directory);
  return stats.bavail * stats.bsize;
}

function treeBytes(directory) {
  let bytes = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) bytes += treeBytes(filename);
    else if (entry.isFile()) bytes += fs.statSync(filename).size;
  }
  return bytes;
}

function relative(filename) {
  return path.relative(rootDir, filename).split(path.sep).join('/');
}

function rows(summary, name) {
  const columns = summary[name];
  return Object.values(columns)[0].map((_, index) => Object.fromEntries(Object.keys(columns).map((column) => {
    let value = columns[column][index];
    if (summary.stringColumns[name]?.includes(column) && value !== null) value = summary.strings[value];
    return [column, value];
  })));
}

async function runJest(config, outputDir, suites, profile, measureArtifacts, baseEnvironment) {
  const label = profile ? 'profile' : 'baseline';
  const configPath = path.join(outputDir, `${label}.config.json`);
  const resultPath = path.join(outputDir, `${label}.results.json`);
  const cacheDirectory = path.join(outputDir, `${label}-cache`);
  fs.writeFileSync(configPath, JSON.stringify({ ...config, cacheDirectory }));
  const env = { ...process.env, CI: 'true', FORCE_COLOR: '0' };
  delete env.JEST_JASMINE;
  delete env.JEST_WORKER_ID;
  delete env.GRAFANA_SHARD_PROFILE;
  if (profile) {
    env.GRAFANA_SHARD_PROFILE = JSON.stringify({ rootDir, outputDir, baseEnvironment, cpu: true, heap: true, cpuIntervalUs: 1000, heapIntervalBytes: MiB });
  }
  const child = spawn(process.execPath, [jestBin, '--config', configPath, '--ci', '--watch=false', '--watchAll=false',
    '--maxWorkers=1', '--json', '--outputFile', resultPath, '--runTestsByPath', ...suites], {
    cwd: rootDir, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  let stopped;
  let totalOutput = 0;
  const stop = (reason) => {
    if (stopped) return;
    stopped = reason;
    if (!child.pid) return;
    try {
      if (process.platform === 'win32') child.kill('SIGKILL');
      else process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      totalOutput += Buffer.byteLength(chunk);
      log = (log + chunk).slice(-65536);
      if (totalOutput > 4 * MiB) stop('Jest output exceeded 4 MiB');
    });
  }
  const timer = setTimeout(() => stop(`Jest did not exit naturally within ${timeoutMs} ms`), timeoutMs);
  const monitor = setInterval(() => {
    try {
      measureArtifacts();
      if (freeBytes(rootDir) < reserveBytes || freeBytes(outputDir) < reserveBytes) stop('Free space fell below the 220 MiB reserve');
    } catch (error) {
      stop(error.message);
    }
  }, 100);
  try {
    const { code, signal } = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    assert.equal(stopped, undefined, `${stopped}\n${log}`);
    assert.equal(signal, null, log);
    assert.ok(fs.existsSync(resultPath), `Jest did not write its result JSON (exit ${code})\n${log}`);
    measureArtifacts();
    return { code, log, report: JSON.parse(fs.readFileSync(resultPath, 'utf8')), cacheBytes: treeBytes(cacheDirectory) };
  } finally {
    clearTimeout(timer);
    clearInterval(monitor);
    fs.rmSync(cacheDirectory, { recursive: true, force: true });
  }
}

async function runFixture(t, options) {
  for (const directory of [rootDir, os.tmpdir()]) {
    assert.ok(freeBytes(directory) > reserveBytes + maxArtifactBytes, `Integration requires 220 MiB reserve plus 32 MiB headroom on ${directory}`);
  }
  assert.match(coreRequire('jest-runtime/package.json').version, /^29\./);
  const fixtureDir = fs.mkdtempSync(path.join(__dirname, '.integration-'));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grafana-shard-profiler-integration-'));
  let peakBytes = 0;
  const measureArtifacts = () => {
    peakBytes = Math.max(peakBytes, treeBytes(fixtureDir) + treeBytes(outputDir));
    assert.ok(peakBytes < maxArtifactBytes, `Integration artifacts exceeded 32 MiB: ${peakBytes} bytes`);
  };
  try {
    fs.mkdirSync(path.join(outputDir, 'raw'));
    const files = {
      'setup.ts': '(globalThis as any).setupValue = 42;',
      'after-env.ts': 'beforeAll(() => { expect((globalThis as any).setupValue).toBe(42); });',
      // An explicit order proves a failed suite releases its Inspector session before the next suite.
      'sequencer.cjs': `const Base = require(${JSON.stringify(configRequire.resolve('@jest/test-sequencer'))}).default;
        module.exports = class extends Base { sort(tests) { return tests.sort((a, b) => a.path.localeCompare(b.path)); } };`,
      ...options.files({ fixtureDir, outputDir }),
    };
    for (const [filename, content] of Object.entries(files)) fs.writeFileSync(path.join(fixtureDir, filename), content);
    const suites = Object.keys(files).filter((file) => /\.test\.tsx?$/.test(file)).sort().map((file) => path.join(fixtureDir, file));
    const config = {
      ...(options.jestConfig || base),
      rootDir,
      roots: [fixtureDir],
      testPathIgnorePatterns: ['/node_modules/'],
      setupFiles: (options.setupFiles || ['setup.ts']).map((file) => path.join(fixtureDir, file)),
      setupFilesAfterEnv: (options.setupFilesAfterEnv || ['after-env.ts']).map((file) => path.join(fixtureDir, file)),
      testEnvironment: path.join(__dirname, 'environment.cjs'),
      runtime: path.join(__dirname, 'runtime.cjs'),
      testRunner: configRequire.resolve('jest-circus/runner'),
      testSequencer: path.join(fixtureDir, 'sequencer.cjs'),
      maxWorkers: 1,
      maxConcurrency: 2,
      testTimeout: 5000,
      watchPlugins: [],
      reporters: ['default'],
      collectCoverage: false,
    };
    let baseline;
    if (options.baseline) {
      baseline = await runJest({ ...config, runtime: undefined,
        testEnvironment: options.baseEnvironment || path.join(rootDir, 'public/test/happy-dom-environment.js') },
        outputDir, suites, false, measureArtifacts);
      assert.equal(baseline.code, options.expectedExit || 0, baseline.log);
    }
    const execution = await runJest(config, outputDir, suites, true, measureArtifacts, options.baseEnvironment);
    assert.equal(execution.code, options.expectedExit || 0, execution.log);
    const rawFiles = fs.readdirSync(path.join(outputDir, 'raw')).sort();
    assert.equal(rawFiles.length, suites.length, `Expected one raw file per suite\n${execution.log}`);
    const records = rawFiles.map((filename) => {
      assert.match(filename, /^[a-f0-9]{16}-\d+-\d+\.json\.gz$/);
      const record = JSON.parse(gunzipSync(fs.readFileSync(path.join(outputDir, 'raw', filename))));
      const hash = createHash('sha256').update(record.suite).digest('hex').slice(0, 16);
      assert.equal(filename, `${hash}-${record.pid}-1.json.gz`);
      return record;
    }).sort((a, b) => a.startUs - b.startUs);
    assert.deepEqual(records.map((record) => record.suite).sort(), suites.map(relative).sort());
    assert.equal(new Set(records.map((record) => record.pid)).size, 1, 'All suites should reuse one Jest worker');
    for (let i = 0; i < records.length; i++) {
      validateRecord(records[i]);
      if (i) assert.ok(records[i].startUs >= records[i - 1].endUs, 'Sequential suites must not retain overlapping recorders');
    }
    const summary = buildSummary(records, { rootDir, selectedSuites: suites.map(relative), workers: 1, jestResults: execution.report });
    validateSummary(summary, records);
    const rawBytes = treeBytes(path.join(outputDir, 'raw'));
    t.diagnostic(`${suites.length} profiled suites; ${records.reduce((sum, record) => sum + record.tests.length, 0)} raw test attempts; ` +
      `${rawBytes} compressed raw bytes; ${execution.cacheBytes} cache bytes; ${peakBytes} peak artifact bytes; ` +
      `${Math.floor(freeBytes(rootDir) / MiB)} MiB project space free`);
    return { ...execution, baseline, records, summary, fixtureDir, files };
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    assert.equal(fs.existsSync(outputDir), false);
    assert.equal(fs.existsSync(fixtureDir), false);
  }
}

function validateRecord(record) {
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.activityTimingVersion, 1);
  assert.equal(record.activityTimingValid, true, record.warnings.join('\n'));
  assert.ok(record.endUs > record.startUs);
  assert.ok(record.instrumentationUs >= 0 && record.instrumentationUs <= record.endUs - record.startUs);
  assert.equal(record.points[0].label, 'constructor');
  assert.equal(record.points.at(-1).label, 'afterteardown');
  for (let i = 0; i < record.points.length; i++) {
    const point = record.points[i];
    assert.ok(point.tUs >= record.startUs && point.tUs <= record.endUs);
    assert.ok(point.heapUsed > 0 && point.rss > 0);
    if (i) {
      assert.ok(point.tUs >= record.points[i - 1].tUs);
      assert.ok(point.cpuUserUs >= record.points[i - 1].cpuUserUs);
      assert.ok(point.cpuSystemUs >= record.points[i - 1].cpuSystemUs);
    }
  }
  const cpu = record.cpuProfile;
  assert.ok(cpu?.nodes.length > 0 && cpu.samples.length > 0, `${record.suite}: missing CPU samples`);
  assert.equal(cpu.samples.length, cpu.timeDeltas.length);
  assert.ok(cpu.startTime >= record.startUs && cpu.endTime <= record.endUs, 'Inspector and hrtime clocks must share bounds');
  assert.ok(cpu.endTime > cpu.startTime);
  assert.ok(cpu.endTime >= record.points.at(-1).tUs, 'CPU profiling must include environment teardown');
  if (record.coverageStart === 'environment') {
    const constructed = record.points.find((point) => point.label === 'environment_constructed');
    assert.ok(constructed.tUs > cpu.startTime, 'CPU profiling must start before base environment construction completes');
  }
  assert.deepEqual(record.heapProfiles.map((entry) => entry.phase), record.status === 'complete' ? ['setup', 'tests', 'teardown'] : ['setup']);
  for (const heap of record.heapProfiles) {
    assert.equal(heap.includeCollected, true);
    assert.ok(heap.profile.head);
    assert.ok(Array.isArray(heap.profile.samples));
  }
  assert.equal(record.warnings.some((message) => /Inspector unavailable|CPU profil.*unavailable|Heap profil.*unavailable|survive-only/.test(message)), false,
    record.warnings.join('\n'));
  let cursor = record.startUs;
  for (const segment of record.segments) {
    assert.equal(segment.startUs, cursor);
    assert.ok(segment.endUs >= segment.startUs);
    const counters = [segment.transformUs, segment.moduleEvaluationUs, segment.otherUs];
    assert.ok(counters.every((value) => Number.isSafeInteger(value) && value >= 0));
    assert.equal(counters.reduce((total, value) => total + value, 0), Math.round(segment.endUs) - Math.round(segment.startUs));
    cursor = segment.endUs;
  }
  assert.equal(cursor, record.endUs);
  assert.equal(new Set(record.tests.map((item) => item.id)).size, record.tests.length);
  for (const item of record.tests) {
    assert.ok(item.startUs >= record.startUs && item.endUs <= record.endUs && item.endUs >= item.startUs);
    assert.ok(item.bodyUs >= 0 && item.hookUs >= 0 && item.bodyUs + item.hookUs <= item.endUs - item.startUs);
    if (item.concurrent) assert.deepEqual([item.cpuUserUs, item.cpuSystemUs, item.heapDeltaBytes], [null, null, null]);
    else {
      assert.ok(item.cpuUserUs >= 0 && item.cpuSystemUs >= 0);
      assert.equal(typeof item.heapDeltaBytes, 'number');
    }
  }
  assert.equal(new Set(record.modules.map((module) => module.path)).size, record.modules.length);
  for (const module of record.modules) {
    assert.ok(module.evaluations >= 1 && module.totalUs >= module.selfUs && module.selfUs >= 0);
  }
  assert.equal(new Set(record.edges.map((edge) => JSON.stringify(edge))).size, record.edges.length);
  for (const gc of record.gc) {
    assert.ok(gc.startUs >= record.startUs && gc.startUs <= record.endUs && gc.durationUs >= 0);
    assert.equal(typeof gc.kind, 'number');
    assert.equal(typeof gc.flags, 'number');
  }
}

function validateSummary(summary, records) {
  assert.deepEqual(summary.completeness, { expectedSuites: records.length, recordedSelectedSuites: records.length, missingSelectedSuites: 0 });
  const suites = rows(summary, 'suites');
  const tests = rows(summary, 'tests');
  assert.equal(suites.length, records.length);
  assert.equal(new Set(suites.map((suite) => suite.path)).size, records.length);
  assert.equal(tests.length, records.reduce((sum, record) => sum + record.tests.length, 0), 'Jest final assertions must not duplicate raw retry rows');
  assert.ok(tests.every((item) => item.source === 0), 'Every fixture assertion should match a raw record, without fallback rows');
  assert.equal(new Set(tests.map((item) => `${item.suite}:${item.id}`)).size, tests.length);
  assert.equal(summary.sizeLimit.truncated, false);
  const costs = rows(summary, 'costs');
  assert.equal(new Set(costs.map((cost) => JSON.stringify([cost.suite, cost.phase, cost.category, cost.owner]))).size, costs.length);
  for (const [index, suite] of suites.entries()) {
    const record = records.find((item) => item.suite === suite.path);
    assert.equal(suite.recordStatus, record.status);
    assert.equal(suite.moduleUniques, record.modules.length);
    assert.equal(suite.moduleEvaluations, record.modules.reduce((sum, module) => sum + module.evaluations, 0));
    assert.ok(suite.mainThreadSampleUs > 0 && suite.mainThreadSampleUs <= suite.wallUs);
    assert.ok(suite.heapSampleBytes >= 0);
    assert.equal(suite.preTestsUs + suite.bodyUs + suite.hooksUs + suite.frameworkUs + suite.teardownUs + suite.profilerUs + suite.unassignedUs, suite.wallUs);
    const activities = rows(summary, 'activities').filter((activity) => activity.suite === index);
    assert.deepEqual(activities.map((activity) => summary.activityPhases[activity.phase]),
      ['preTests', 'body', 'hooks', 'framework', 'teardown', 'profiler', 'unassigned']);
    assert.equal(activities.reduce((total, activity) => total + activity.wallUs, 0), suite.wallUs);
    for (const activity of activities) {
      assert.equal(activity.transformUs + activity.moduleEvaluationUs + activity.otherUs, activity.wallUs);
    }
    const sampledUs = costs.filter((cost) => cost.suite === index).reduce((sum, cost) => sum + cost.sampleUs, 0);
    assert.ok(Math.abs(sampledUs - suite.mainThreadSampleUs) <= costs.length, 'Cost rows must not double count sampled CPU');
  }
  for (const name of ['suites', 'tests', 'activities', 'costs', 'hotspots', 'testOwners', 'warnings']) {
    const columns = Object.values(summary[name]);
    assert.ok(columns.every((column) => column.length === columns[0].length));
  }
}

function outcomes(report) {
  return report.testResults.map((suite) => ({ name: suite.name, status: suite.status,
    tests: suite.assertionResults.map((item) => ({ name: item.fullName, status: item.status, invocations: item.invocations })),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

test('real Jest 29 preserves HappyDOM/Sucrase outcomes, retries, isolation, jsdom overrides and concurrent attribution', { timeout: 150000 }, async (t) => {
  const result = await runFixture(t, {
    baseline: true,
    baseEnvironment: path.join(rootDir, 'public/test/happy-dom-environment.js'),
    files: () => ({
      'shared.ts': `const state = globalThis as any;
        state.fixtureLoads = (state.fixtureLoads || 0) + 1;
        export const value: number = state.fixtureLoads;
        export const data = require('./data.json');`,
      'data.json': '{"answer":42}',
      'hook-only.ts': 'export const heading: string = "hook import";',
      'hook-data.json': '{"clean":true}',
      'a-happy.test.ts': `import { value, data } from './shared';
        jest.retryTimes(1);
        describe('profile', () => {
          let attempt = 0;
          beforeEach(() => {
            expect(require('./hook-only').heading).toBe('hook import');
            document.body.innerHTML = '<main></main>';
          });
          afterEach(() => {
            expect(require('./hook-data.json').clean).toBe(true);
            document.body.replaceChildren();
          });
          test('renders with hooks and the standard Circus timer optimization', async () => {
            expect(value).toBe(1);
            expect(data.answer).toBe(42);
            expect(document.doctype?.name).toBe('html');
            document.querySelector('main')!.textContent = 'fixture';
            expect(document.body.textContent).toBe('fixture');
            const HostError = require('node:vm').runInThisContext('Error');
            const descriptor = Object.getOwnPropertyDescriptor(HostError, 'prepareStackTrace');
            let stacks = 0;
            try {
              HostError.prepareStackTrace = () => { stacks++; return 'fixture'; };
              const timer = setTimeout(() => {}, 10);
              clearTimeout(timer);
            } finally {
              if (descriptor) Object.defineProperty(HostError, 'prepareStackTrace', descriptor);
              else delete HostError.prepareStackTrace;
            }
            expect(stacks).toBe(0);
            await new Promise<void>(resolve => setTimeout(resolve, 2));
          });
          test('retries once', () => { expect(++attempt).toBe(2); });
          test('isolates cached TS and JSON evaluations', async () => {
            expect(require('./shared').value).toBe(1);
            for (const expected of [2, 3]) {
              jest.isolateModules(() => {
                const isolated = require('./shared');
                expect(isolated.value).toBe(expected);
                expect(isolated.data.answer).toBe(42);
                expect(require('./shared')).toBe(isolated);
              });
            }
            await jest.isolateModulesAsync(async () => {
              const isolated = await import('./shared');
              expect(isolated.value).toBe(4);
            });
            expect(require('./shared').value).toBe(1);
          });
          test.skip('skipped', () => { throw new Error('must not execute'); });
          test.todo('future');
        });`,
      'b-jsdom.test.ts': `/** @jest-environment jsdom */
        test('explicit jsdom fallback', () => {
          const count: number = 2;
          expect(navigator.userAgent).toMatch(/jsdom/i);
          expect((globalThis as any).happyDOM).toBeUndefined();
          document.body.innerHTML = '<p>fallback</p>'.repeat(count);
          expect(document.querySelectorAll('p')).toHaveLength(2);
        });`,
      'c-concurrent.test.ts': `let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const started: string[] = [];
        test.concurrent('first concurrent body', async () => {
          started.push('first'); await gate; expect(started).toEqual(['first', 'second']);
        });
        test.concurrent('second concurrent body', async () => {
          started.push('second'); release(); await gate; expect(started).toEqual(['first', 'second']);
        });
        test('serial observer of concurrent work', () => { expect(started).toEqual(['first', 'second']); });`,
    }),
  });
  assert.deepEqual(outcomes(result.report), outcomes(result.baseline.report), 'Profiling must preserve unprofiled Jest outcomes');
  assert.deepEqual([result.report.numPassedTests, result.report.numPendingTests, result.report.numTodoTests, result.report.numFailedTests], [7, 1, 1, 0]);
  const happy = result.records.find((record) => record.suite.endsWith('/a-happy.test.ts'));
  assert.equal(happy.status, 'complete');
  assert.equal(happy.coverageStart, 'environment');
  assert.match(happy.environment, /GrafanaHappyDOMEnvironment/);
  assert.deepEqual(happy.tests.filter((item) => item.name === 'profile retries once').map((item) => [item.attempt, item.status]), [[1, 'failed'], [2, 'passed']]);
  assert.equal(happy.tests.filter((item) => item.status === 'skipped').length, 1);
  assert.equal(happy.tests.filter((item) => item.status === 'todo').length, 1);
  assert.ok(happy.tests.filter((item) => item.status === 'passed').every((item) => item.bodyUs > 0 && item.hookUs > 0));
  for (const filename of ['shared.ts', 'data.json']) {
    const module = happy.modules.find((item) => item.path === relative(path.join(result.fixtureDir, filename)));
    assert.equal(module.evaluations, 4, `${filename} must include both sync and async isolates without counting cache hits`);
    assert.equal(module.sourceBytes, Buffer.byteLength(result.files[filename]));
  }
  assert.ok(happy.edges.some(([from, to]) => from.endsWith('/shared.ts') && to.endsWith('/data.json')));
  const happyIndex = rows(result.summary, 'suites').findIndex((suite) => suite.path === happy.suite);
  const activities = rows(result.summary, 'activities').filter((activity) => activity.suite === happyIndex);
  for (const phase of ['preTests', 'body', 'hooks']) {
    const activity = activities.find((activity) => result.summary.activityPhases[activity.phase] === phase);
    assert.ok(activity.transformUs > 0 && activity.moduleEvaluationUs > 0, `Expected imports in ${phase}`);
    assert.ok(activity.otherUs > 0, `Expected non-import work in ${phase}`);
  }
  for (const filename of ['hook-only.ts', 'hook-data.json']) {
    assert.equal(happy.modules.find((module) => module.path.endsWith(`/${filename}`)).evaluations, 1);
  }
  const jsdom = result.records.find((record) => record.suite.endsWith('/b-jsdom.test.ts'));
  assert.equal(jsdom.coverageStart, 'runtime');
  assert.match(jsdom.environment, /JSDOMEnvironment/);
  assert.equal(jsdom.points.some((point) => point.label === 'environment_constructed'), false);
  assert.ok(jsdom.warnings.some((warning) => /begins after runtime construction/.test(warning)));
  const concurrent = result.records.find((record) => record.suite.endsWith('/c-concurrent.test.ts'));
  assert.equal(concurrent.tests.length, 3);
  assert.ok(concurrent.tests.every((item) => item.concurrent));
  assert.ok(concurrent.warnings.some((warning) => /Concurrent test work/.test(warning)));
  const summaryTests = rows(result.summary, 'tests');
  const concurrentIndexes = new Set(summaryTests.flatMap((item, index) => item.concurrent ? [index] : []));
  assert.ok(rows(result.summary, 'testOwners').every((owner) => !concurrentIndexes.has(owner.test)));
  const concurrentIndex = rows(result.summary, 'suites').findIndex((suite) => suite.path === concurrent.suite);
  const concurrentActivities = rows(result.summary, 'activities').filter((activity) => activity.suite === concurrentIndex);
  for (const activity of concurrentActivities.filter((activity) => ['body', 'hooks', 'framework'].includes(result.summary.activityPhases[activity.phase]))) {
    assert.deepEqual([activity.wallUs, activity.transformUs, activity.moduleEvaluationUs, activity.otherUs], [0, 0, 0, 0]);
  }
  assert.ok(concurrentActivities.find((activity) => result.summary.activityPhases[activity.phase] === 'unassigned').wallUs > 0);
});

function jsdomTypeScriptConfig() {
  const config = require(path.join(rootDir, 'jest.config.js'));
  const tsJest = require.resolve('ts-jest');
  const compiler = createRequire(tsJest).resolve('typescript');
  assert.ok(path.isAbsolute(compiler), 'Use the compiler installed with ts-jest, not a root TypeScript dependency');
  let found = false;
  const transform = Object.fromEntries(Object.entries(config.transform).map(([pattern, entry]) => {
    const [transformer, options = {}] = Array.isArray(entry) ? entry : [entry];
    if (transformer !== tsJest) return [pattern, entry];
    found = true;
    return [pattern, [transformer, { ...options,
      // Keep fixtures independent of the application TS project without changing diagnostics or other transformer options.
      tsconfig: { target: 'ES2022', module: 'CommonJS', jsx: 'react-jsx', esModuleInterop: true, isolatedModules: true },
    }]];
  }));
  assert.equal(found, true, 'The checked-out base configuration must use the installed ts-jest transformer');
  return { ...config, transform };
}

test('real jsdom/ts-jest preserves TS and TSX outcomes, constructor options, isolates and docblock overrides', { timeout: 150000 }, async (t) => {
  const jestConfig = jsdomTypeScriptConfig();
  const baseEnvironment = require.resolve('jest-environment-jsdom');
  const result = await runFixture(t, {
    baseline: true,
    baseEnvironment,
    jestConfig: { ...jestConfig, testEnvironmentOptions: { ...jestConfig.testEnvironmentOptions,
      url: 'https://fixture.invalid/profile', html: '<!DOCTYPE html><main>from environment options</main>', userAgent: 'fixture jsdom' } },
    files: () => ({
      'shared.ts': `const state = globalThis as any;
        state.fixtureLoads = (state.fixtureLoads || 0) + 1;
        export const value: number = state.fixtureLoads;
        export const data = require('./data.json');`,
      'data.json': '{"answer":42}',
      'status.tsx': `export function Status({ value }: { value: number }) { return <output>value:{value}</output>; }`,
      'hook-only.ts': 'export const heading: string = "hook import";',
      'a-jsdom.test.tsx': `import { renderToStaticMarkup } from 'react-dom/server.node';
        import { Status } from './status';
        import { value, data } from './shared';
        jest.retryTimes(1);
        describe('jsdom TypeScript', () => {
          let attempt = 0;
          beforeAll(() => {
            expect(document.querySelector('main')!.textContent).toBe('from environment options');
            expect(location.href).toBe('https://fixture.invalid/profile');
            expect(navigator.userAgent).toBe('fixture jsdom');
            expect((globalThis as any).happyDOM).toBeUndefined();
          });
          beforeEach(() => { expect(require('./hook-only').heading).toBe('hook import'); });
          afterEach(() => { document.body.replaceChildren(); });
          test('renders transformed TSX with typed TS imports', () => {
            expect(value).toBe(1);
            document.body.innerHTML = renderToStaticMarkup(<Status value={data.answer} />);
            expect(document.querySelector('output')!.textContent).toBe('value:42');
          });
          test('isolates typed modules and JSON without duplicating cached loads', () => {
            expect(require('./shared').value).toBe(1);
            for (const expected of [2, 3]) {
              jest.isolateModules(() => {
                const isolated = require('./shared');
                expect(isolated.value).toBe(expected);
                expect(isolated.data.answer).toBe(42);
                expect(require('./shared')).toBe(isolated);
              });
            }
          });
          test('retries once', () => { expect(++attempt).toBe(2); });
          test.skip('skipped TS case', () => { throw new Error('must not execute'); });
          test.todo('future TS case');
        });`,
      'b-override.test.ts': `/**
         * @jest-environment jsdom
         * @jest-environment-options {"url":"https://override.invalid/","userAgent":"docblock jsdom"}
         */
        test('docblock jsdom coexists with the jsdom wrapper', () => {
          const count: number = 2;
          expect(location.href).toBe('https://override.invalid/');
          expect(navigator.userAgent).toBe('docblock jsdom');
          expect(document.querySelector('main')!.textContent).toBe('from environment options');
          document.body.innerHTML = '<p>typed fallback</p>'.repeat(count);
          expect(document.querySelectorAll('p')).toHaveLength(2);
        });`,
    }),
  });
  assert.deepEqual(outcomes(result.report), outcomes(result.baseline.report), 'Profiling must preserve jsdom/ts-jest outcomes');
  assert.deepEqual([result.report.numPassedTests, result.report.numPendingTests, result.report.numTodoTests, result.report.numFailedTests], [4, 1, 1, 0]);
  const [jsdom, override] = result.records;
  assert.ok(jsdom.suite.endsWith('/a-jsdom.test.tsx'));
  assert.equal(jsdom.coverageStart, 'environment');
  assert.equal(jsdom.environment, `JSDOMEnvironment (${baseEnvironment})`);
  assert.equal(jsdom.status, 'complete');
  assert.deepEqual(jsdom.tests.filter((item) => item.name === 'jsdom TypeScript retries once').map((item) => [item.attempt, item.status]),
    [[1, 'failed'], [2, 'passed']]);
  for (const [filename, evaluations] of [['shared.ts', 3], ['data.json', 3], ['status.tsx', 1], ['hook-only.ts', 1], ['a-jsdom.test.tsx', 1]]) {
    const module = jsdom.modules.find((item) => item.path === relative(path.join(result.fixtureDir, filename)));
    assert.equal(module.evaluations, evaluations, `${filename} must not count cache hits as evaluations`);
    assert.equal(module.sourceBytes, Buffer.byteLength(result.files[filename]));
    assert.ok(module.totalUs > 0 && module.selfUs > 0);
  }
  assert.ok(jsdom.edges.some(([from, to]) => from.endsWith('/a-jsdom.test.tsx') && to.endsWith('/status.tsx')));
  assert.ok(jsdom.edges.some(([from, to]) => from.endsWith('/shared.ts') && to.endsWith('/data.json')));
  const index = rows(result.summary, 'suites').findIndex((suite) => suite.path === jsdom.suite);
  const activities = rows(result.summary, 'activities').filter((activity) => activity.suite === index);
  for (const phase of ['preTests', 'body', 'hooks']) {
    const activity = activities.find((item) => result.summary.activityPhases[item.phase] === phase);
    assert.ok(activity.transformUs > 0 && activity.moduleEvaluationUs > 0, `Expected ts-jest imports in ${phase}`);
    assert.ok(activity.otherUs > 0);
  }
  assert.ok(override.suite.endsWith('/b-override.test.ts'));
  assert.equal(override.coverageStart, 'runtime');
  assert.match(override.environment, /JSDOMEnvironment/);
  assert.equal(override.points.some((point) => point.label === 'environment_constructed'), false);
  assert.ok(override.warnings.some((warning) => /begins after runtime construction/.test(warning)));
  assert.equal(override.tests[0].status, 'passed');
});

const survivor = `test('survives the prior suite failure', () => {
  expect((globalThis as any).setupValue).toBe(42);
  expect(document.doctype?.name).toBe('html');
});`;

function validateFailure(result, message, earlySetup) {
  assert.deepEqual([result.report.numFailedTestSuites, result.report.numPassedTestSuites, result.report.numPassedTests], [1, 1, 1]);
  const failed = result.report.testResults.find((suite) => suite.name.endsWith('/a-error.test.ts'));
  assert.ok(failed.message.includes(message), failed.message);
  const [error, complete] = result.records;
  assert.ok(error.suite.endsWith('/a-error.test.ts'));
  assert.equal(error.status, 'error');
  assert.deepEqual(error.tests, []);
  assert.equal(error.points.some((point) => point.label === 'run_start'), false);
  assert.equal(error.warnings.some((warning) => /custom runtime performed cleanup/.test(warning)), earlySetup);
  assert.equal(complete.status, 'complete');
  assert.equal(complete.tests[0].status, 'passed');
  assert.ok(complete.suite.endsWith('/b-survivor.test.ts'));
  assert.equal(error.pid, complete.pid);
  assert.deepEqual(rows(result.summary, 'suites').map((suite) => [suite.status, suite.recordStatus]), [['failed', 'error'], ['passed', 'complete']]);
}

test('real suite import failure finalizes profiles before the same worker runs another suite', { timeout: 90000 }, async (t) => {
  const result = await runFixture(t, {
    expectedExit: 1,
    files: () => ({
      'broken.ts': 'throw new Error("integration suite import failed"); export const value: number = 1;',
      'a-error.test.ts': 'import { value } from "./broken"; test("unreachable", () => expect(value).toBe(1));',
      'b-survivor.test.ts': survivor,
    }),
  });
  validateFailure(result, 'integration suite import failed', false);
  assert.equal(result.records[0].modules.find((module) => module.path.endsWith('/broken.ts')).evaluations, 1);
});

test('real Sucrase failure unwinds transform timing before the next suite', { timeout: 90000 }, async (t) => {
  const result = await runFixture(t, {
    expectedExit: 1,
    files: () => ({
      'broken.ts': 'export const value: number = ;',
      'a-error.test.ts': 'import { value } from "./broken"; test("unreachable", () => expect(value).toBe(1));',
      'b-survivor.test.ts': survivor,
    }),
  });
  validateFailure(result, 'Unexpected token', false);
  const setup = rows(result.summary, 'activities').find((activity) => activity.suite === 0 && result.summary.activityPhases[activity.phase] === 'preTests');
  assert.ok(setup.transformUs > 0);
  assert.ok(setup.moduleEvaluationUs > 0);
});

test('real ts-jest syntax errors match baseline failures and finalize jsdom before the next suite', { timeout: 150000 }, async (t) => {
  const result = await runFixture(t, {
    baseline: true,
    baseEnvironment: require.resolve('jest-environment-jsdom'),
    jestConfig: jsdomTypeScriptConfig(),
    expectedExit: 1,
    files: () => ({
      'broken.ts': 'export const value: number = ;',
      'a-error.test.ts': 'import { value } from "./broken"; test("unreachable", () => expect(value).toBe(1));',
      'b-survivor.test.ts': survivor,
    }),
  });
  assert.deepEqual(outcomes(result.report), outcomes(result.baseline.report));
  validateFailure(result, 'Expression expected', false);
  assert.match(result.baseline.report.testResults.find((suite) => suite.name.endsWith('/a-error.test.ts')).message, /TS1109/);
  assert.match(result.report.testResults.find((suite) => suite.name.endsWith('/a-error.test.ts')).message, /TS1109/);
  for (const record of result.records) {
    assert.equal(record.coverageStart, 'environment');
    assert.match(record.environment, /JSDOMEnvironment/);
  }
  assert.equal(result.records[0].modules.find((module) => module.path.endsWith('/broken.ts')).evaluations, 1);
  const setup = rows(result.summary, 'activities').find((activity) => activity.suite === 0 && result.summary.activityPhases[activity.phase] === 'preTests');
  assert.ok(setup.transformUs > 0 && setup.moduleEvaluationUs > 0);
});

for (const mode of ['import', 'async-function', 'after-env']) {
  test(`real ${mode} setup failure cleans up before the next suite`, { timeout: 90000 }, async (t) => {
    const result = await runFixture(t, {
      expectedExit: 1,
      setupFiles: mode === 'after-env' ? ['setup.ts'] : ['failure-setup.ts', 'setup.ts'],
      setupFilesAfterEnv: mode === 'after-env' ? ['failure-setup.ts', 'after-env.ts'] : ['after-env.ts'],
      files: ({ outputDir }) => {
        const failOnce = `const fs = require('node:fs'); const marker = ${JSON.stringify(path.join(outputDir, 'failed-once'))};
          if (!fs.existsSync(marker)) { fs.writeFileSync(marker, '1'); throw new Error('integration ${mode} setup failed'); }`;
        return {
          'failure-setup.ts': mode === 'async-function' ? `module.exports = async () => { await Promise.resolve(); ${failOnce} };` : failOnce,
          'a-error.test.ts': 'test("unreachable", () => { throw new Error("setup did not fail"); });',
          'b-survivor.test.ts': survivor,
        };
      },
    });
    validateFailure(result, `integration ${mode} setup failed`, mode !== 'after-env');
    assert.equal(result.records[0].modules.find((module) => module.path.endsWith('/failure-setup.ts')).evaluations, 1);
  });
}
