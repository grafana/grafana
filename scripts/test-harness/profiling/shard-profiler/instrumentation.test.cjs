'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { gunzipSync } = require('node:zlib');
const { test } = require('node:test');
const { Recorder, readConfig, attachRecorder } = require('./recorder.cjs');

function fixture(t, overrides = {}, protocol = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-profiler-'));
  fs.mkdirSync(path.join(directory, 'raw'));

  const config = readConfig(JSON.stringify({ rootDir: directory, outputDir: directory, cpu: false, heap: false, ...overrides }));
  let now = 1000;
  const recorder = new Recorder(config, {
    suite: path.join(directory, 'suite.test.cjs'), environment: 'unit-environment', coverageStart: 'environment',
  }, { now: () => now, ...protocol });
  t.after(async () => {
    await recorder.finalize().catch(() => {});
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, config, recorder, at: (value) => { now = value; } };
}

function readRaw(filename) {
  return JSON.parse(gunzipSync(fs.readFileSync(filename)));
}

function assertActivityTiming(data, valid = true) {
  assert.equal(data.activityTimingVersion, 1);
  assert.equal(data.activityTimingValid, valid, data.warnings.join('\n'));
  for (const segment of data.segments) {
    const values = [segment.transformUs, segment.moduleEvaluationUs, segment.otherUs];
    assert.ok(values.every((value) => Number.isSafeInteger(value) && value >= 0));
    assert.equal(values.reduce((sum, value) => sum + value, 0), Math.round(segment.endUs) - Math.round(segment.startUs));
  }
}

function activityRows(data) {
  return data.segments.filter((segment) => Math.round(segment.endUs) > Math.round(segment.startUs))
    .map(({ kind, transformUs, moduleEvaluationUs, otherUs }) => ({ kind, transformUs, moduleEvaluationUs, otherUs }));
}

function circusTest(name, extra = {}) {
  return { name, errors: [], parent: { name: 'group', parent: { name: 'ROOT_DESCRIBE_BLOCK' } }, ...extra };
}

function sessionProtocol({ reject, asyncStart = false } = {}) {
  const calls = [];
  let disconnected = false;
  class ProtocolSession {
    connect() { calls.push(['connect']); }
    disconnect() { disconnected = true; calls.push(['disconnect']); }
    post(method, params, callback) {
      calls.push([method, params]);
      const error = reject?.(method, params);
      const response = method === 'Profiler.stop'
        ? { profile: { nodes: [], startTime: 1000, endTime: 2000, samples: [], timeDeltas: [] } }
        : method === 'HeapProfiler.stopSampling'
          ? { profile: { head: { id: 1, selfSize: 0, children: [] }, samples: [] } }
          : {};
      if (asyncStart || method.endsWith('stop') || method.endsWith('stopSampling')) {
        queueMicrotask(() => callback(error, response));
      } else {
        callback(error, response);
      }
    }
  }
  return { Session: ProtocolSession, calls, disconnected: () => disconnected };
}

test('configuration validates paths, switches and intervals without changing defaults', () => {
  assert.throws(() => readConfig(''), /JSON profiling configuration/);
  assert.throws(() => readConfig('{'), /JSON profiling configuration/);
  assert.throws(() => readConfig('{"rootDir":"relative"}'), /rootDir must be an absolute path/);
  assert.throws(() => readConfig('{"rootDir":"/root","outputDir":"/out","cpuIntervalUs":0}'), /positive integer/);
  assert.throws(() => readConfig('{"rootDir":"/root","outputDir":"/out","heap":"yes"}'), /must be a boolean/);
  assert.deepEqual(readConfig('{"rootDir":"/root","outputDir":"/out"}'), {
    rootDir: '/root', outputDir: '/out', cpuIntervalUs: 1000, heapIntervalBytes: 1048576, cpu: true, heap: true,
  });
  for (const baseEnvironment of ['', 'jest-environment-jsdom', './environment.cjs', null, 42, {}]) {
    assert.throws(() => readConfig(JSON.stringify({ rootDir: '/root', outputDir: '/out', baseEnvironment })),
      /baseEnvironment must be an absolute path/);
  }
  assert.equal(readConfig('{"rootDir":"/root","outputDir":"/out","baseEnvironment":"/env/jsdom.cjs"}').baseEnvironment, '/env/jsdom.cjs');
});

function loadProfileEnvironment(t, config) {
  const filename = require.resolve('./environment.cjs');
  const previousModule = require.cache[filename];
  const previousConfig = process.env.GRAFANA_SHARD_PROFILE;
  t.after(() => {
    delete require.cache[filename];
    if (previousModule) require.cache[filename] = previousModule;
    if (previousConfig === undefined) delete process.env.GRAFANA_SHARD_PROFILE;
    else process.env.GRAFANA_SHARD_PROFILE = previousConfig;
  });
  process.env.GRAFANA_SHARD_PROFILE = JSON.stringify(config);
  delete require.cache[filename];
  return require(filename);
}

for (const [name, statement, legacy] of [
  ['class', 'module.exports = FixtureEnvironment;', false],
  ['TestEnvironment', 'exports.TestEnvironment = FixtureEnvironment;', false],
  ['default', 'exports.default = FixtureEnvironment;', false],
  ['legacy Happy DOM path', 'module.exports = FixtureEnvironment;', true],
]) {
  test(`environment wrapper accepts ${name} and preserves constructor options and lifecycle callbacks`, async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-environment-'));
    const baseEnvironment = path.join(directory, legacy ? 'public/test/happy-dom-environment.js' : 'environment.cjs');
    let environment;
    t.after(async () => {
      try { if (environment && !environment.__grafanaShardProfile.closed) await environment.teardown(); }
      finally { delete require.cache[baseEnvironment]; fs.rmSync(directory, { recursive: true, force: true }); }
    });
    fs.mkdirSync(path.join(directory, 'raw'));
    fs.mkdirSync(path.dirname(baseEnvironment), { recursive: true });
    fs.writeFileSync(baseEnvironment, `class FixtureEnvironment {
      constructor(config, context) {
        this.constructionUs = Number(process.hrtime.bigint()) / 1000;
        this.config = config; this.context = context; this.calls = [];
      }
      setup(...args) { this.calls.push(['setup', this, ...args]); return this.context.token; }
      handleTestEvent(...args) { this.calls.push(['event', this, ...args]); return this.context.token; }
      teardown(...args) { this.calls.push(['teardown', this, ...args]); return this.context.token; }
    }
    ${statement}`);
    const Environment = loadProfileEnvironment(t, { rootDir: directory, outputDir: directory, cpu: false, heap: false,
      ...(!legacy ? { baseEnvironment } : {}) });
    const config = { projectConfig: { testEnvironment: require.resolve('./environment.cjs'),
      testEnvironmentOptions: { url: 'https://fixture.invalid/', customExportConditions: ['browser', 'fixture'] } } };
    const context = { testPath: path.join(directory, 'suite.test.cjs'), console, docblockPragmas: { fixture: 'pragma' }, token: Symbol('token') };
    environment = new Environment(config, context);
    assert.equal(environment.config, config);
    assert.equal(environment.context, context);
    assert.equal(environment.setup, Object.getPrototypeOf(Environment.prototype).setup);
    assert.equal(environment.setup('setup argument'), context.token);
    const event = { name: 'add_test' };
    const state = {};
    assert.equal(environment.handleTestEvent(event, state), context.token);
    await environment.handleTestEvent({ name: 'run_start' }, state);
    await environment.handleTestEvent({ name: 'run_finish' }, state);
    assert.equal(await environment.teardown('teardown argument'), context.token);
    assert.deepEqual(environment.calls[0], ['setup', environment, 'setup argument']);
    assert.deepEqual(environment.calls[1], ['event', environment, event, state]);
    assert.deepEqual(environment.calls.at(-1), ['teardown', environment, 'teardown argument']);
    const data = readRaw(environment.__grafanaShardProfile.outputPath);
    assert.equal(data.environment, `FixtureEnvironment (${baseEnvironment})`);
    assert.equal(data.coverageStart, 'environment');
    assert.equal(data.status, 'complete');
    assert.ok(data.points[0].tUs <= environment.constructionUs);
    assert.ok(data.points.find((point) => point.label === 'environment_constructed').tUs >= environment.constructionUs);
    assertActivityTiming(data);
  });
}

test('selected installed jsdom receives options and context without loading Happy DOM dependencies', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-jsdom-environment-'));
  let environment;
  t.after(async () => {
    try { if (environment && !environment.__grafanaShardProfile.closed) await environment.teardown(); }
    finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
  fs.mkdirSync(path.join(directory, 'raw'));
  const loadedBefore = new Set(Object.keys(require.cache));
  const baseEnvironment = require.resolve('jest-environment-jsdom');
  const Environment = loadProfileEnvironment(t, { rootDir: directory, outputDir: directory, baseEnvironment, cpu: false, heap: false });
  const coreRequire = createRequire(createRequire(require.resolve('jest')).resolve('@jest/core'));
  const { options: projectConfig } = await coreRequire('jest-config').normalize({ rootDir: directory,
    testEnvironment: baseEnvironment, testEnvironmentOptions: { url: 'https://fixture.invalid/path',
      html: '<!DOCTYPE html><p>initial markup</p>', userAgent: 'jsdom fixture', customExportConditions: ['fixture', 'browser'] } }, {});
  let constructionUs;
  projectConfig.testEnvironmentOptions.beforeParse = () => { constructionUs = Number(process.hrtime.bigint()) / 1000; };
  environment = new Environment({ projectConfig, globalConfig: projectConfig }, { console, testPath: path.join(directory, 'suite.test.ts') });
  assert.equal(environment.global.location.href, 'https://fixture.invalid/path');
  assert.equal(environment.global.document.querySelector('p').textContent, 'initial markup');
  assert.equal(environment.global.navigator.userAgent, 'jsdom fixture');
  assert.deepEqual(environment.exportConditions(), ['fixture', 'browser']);
  await environment.handleTestEvent({ name: 'run_start' }, {});
  await environment.handleTestEvent({ name: 'run_finish' }, {});
  await environment.teardown();
  assert.equal(environment.global, null);
  const data = readRaw(environment.__grafanaShardProfile.outputPath);
  assert.equal(data.environment, `JSDOMEnvironment (${baseEnvironment})`);
  assert.equal(data.coverageStart, 'environment');
  assert.ok(data.points[0].tUs < constructionUs);
  assert.ok(data.points.find((point) => point.label === 'environment_constructed').tUs > constructionUs);
  assert.deepEqual(Object.keys(require.cache).filter((filename) => !loadedBefore.has(filename) &&
    /\/node_modules\/(?:@happy-dom|happy-dom)\/|\/public\/test\/happy-dom-environment\.js$/.test(filename)), []);
  assertActivityTiming(data);
});

test('base environment modules without a constructor fail with the selected module path', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-invalid-environment-'));
  const baseEnvironment = path.join(directory, 'environment.cjs');
  t.after(() => { delete require.cache[baseEnvironment]; fs.rmSync(directory, { recursive: true, force: true }); });
  fs.writeFileSync(baseEnvironment, 'module.exports = { default: {} };');
  assert.throws(() => loadProfileEnvironment(t, { rootDir: directory, outputDir: directory, baseEnvironment }),
    (error) => error instanceof TypeError && error.message.includes(baseEnvironment) && /must export a class/.test(error.message));
});

test('base environment constructor failures preserve the original error and finalize the recorder', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-environment-error-'));
  const baseEnvironment = path.join(directory, 'environment.cjs');
  let finalized;
  t.after(async () => {
    try { await finalized; }
    finally { delete require.cache[baseEnvironment]; fs.rmSync(directory, { recursive: true, force: true }); }
  });
  fs.mkdirSync(path.join(directory, 'raw'));
  fs.writeFileSync(baseEnvironment, 'exports.default = class BrokenEnvironment { constructor(config, context) { throw context.failure; } };');
  const finalize = Recorder.prototype.finalize;
  t.mock.method(Recorder.prototype, 'finalize', function () { finalized = finalize.call(this); return finalized; });
  const Environment = loadProfileEnvironment(t, { rootDir: directory, outputDir: directory, baseEnvironment, cpu: false, heap: false });
  const failure = new Error('original constructor failure');
  assert.throws(() => new Environment({ projectConfig: {} }, { testPath: path.join(directory, 'suite.test.ts'), failure }),
    (error) => error === failure);
  const data = readRaw(await finalized);
  assert.equal(data.status, 'error');
  assert.equal(data.coverageStart, 'environment');
  assert.equal(data.points.some((point) => point.label === 'environment_constructed'), false);
  assertActivityTiming(data);
});

test('test attempts include full intervals, separate bodies/hooks, retries, skipped and todo', async (t) => {
  const { recorder: r, at } = fixture(t);
  const current = circusTest('case');
  const state = { currentlyRunningTest: current };
  const hook = { type: 'beforeEach' };
  at(1100); await r.handleTestEvent({ name: 'run_start' }, state);
  at(1200); r.handleTestEvent({ name: 'test_start', test: current }, state);
  at(1210); r.handleTestEvent({ name: 'hook_start', hook }, state);
  at(1240); r.handleTestEvent({ name: 'hook_success', hook, test: current }, state);
  at(1250); r.handleTestEvent({ name: 'test_fn_start', test: current }, state);
  current.errors.push(new Error('first attempt fails'));
  at(1300); r.handleTestEvent({ name: 'test_fn_failure', test: current }, state);
  at(1310); r.handleTestEvent({ name: 'hook_start', hook: { type: 'afterEach' } }, state);
  at(1330); r.handleTestEvent({ name: 'hook_success', test: current }, state);
  at(1350); r.handleTestEvent({ name: 'test_done', test: current }, state);
  current.errors = [];
  r.handleTestEvent({ name: 'test_retry', test: current }, state);
  at(1400); r.handleTestEvent({ name: 'test_start', test: current }, state);
  at(1410); r.handleTestEvent({ name: 'test_fn_start', test: current }, state);
  at(1430); r.handleTestEvent({ name: 'test_fn_success', test: current }, state);
  at(1440); r.handleTestEvent({ name: 'test_done', test: current }, state);
  at(1450); r.handleTestEvent({ name: 'test_skip', test: circusTest('skipped') }, state);
  at(1460); r.handleTestEvent({ name: 'test_todo', test: circusTest('future') }, state);
  at(1500); await r.handleTestEvent({ name: 'run_finish' }, state);
  at(1600); r.beginTeardown();
  const data = readRaw(await r.finalize());
  assert.equal(data.status, 'complete');
  assert.deepEqual(data.tests.map(({ id, name, attempt, status, startUs, endUs, bodyUs, hookUs }) =>
    ({ id, name, attempt, status, startUs, endUs, bodyUs, hookUs })), [
    { id: 1, name: 'group case', attempt: 1, status: 'failed', startUs: 1200, endUs: 1350, bodyUs: 50, hookUs: 50 },
    { id: 2, name: 'group case', attempt: 2, status: 'passed', startUs: 1400, endUs: 1440, bodyUs: 20, hookUs: 0 },
    { id: 3, name: 'group skipped', attempt: 1, status: 'skipped', startUs: 1450, endUs: 1450, bodyUs: 0, hookUs: 0 },
    { id: 4, name: 'group future', attempt: 1, status: 'todo', startUs: 1460, endUs: 1460, bodyUs: 0, hookUs: 0 },
  ]);
  assert.deepEqual(data.segments.filter((s) => s.kind === 'hook').map((s) => [s.test, s.startUs, s.endUs]), [[1, 1210, 1240], [1, 1310, 1330]]);
  assert.deepEqual(data.points.filter((p) => !p.label.startsWith('test:')).map((p) => p.label), ['constructor', 'run_start', 'run_finish', 'afterteardown']);
  for (const item of data.tests) {
    assert.equal(item.concurrent, false);
    assert.ok(item.cpuUserUs >= 0 && item.cpuSystemUs >= 0);
    assert.equal(typeof item.heapDeltaBytes, 'number');
  }
  for (let i = 1; i < data.segments.length; i++) assert.equal(data.segments[i].startUs, data.segments[i - 1].endUs);
  assert.equal(r.observer, null);
  assert.equal(r.activeTests.size, 0);
});

test('concurrent declarations invalidate even serial event intervals in Jest 29', async (t) => {
  const { recorder: r } = fixture(t);
  const concurrent = circusTest('parallel', { concurrent: true });
  const serial = circusTest('serial');
  const state = { rootDescribeBlock: { children: [{ children: [concurrent, serial] }] } };
  await r.handleTestEvent({ name: 'run_start' }, state);
  for (const current of [serial, concurrent]) {
    r.handleTestEvent({ name: 'test_start', test: current }, state);
    r.handleTestEvent({ name: 'test_done', test: current }, state);
  }
  await r.handleTestEvent({ name: 'run_finish' }, state);
  const data = readRaw(await r.finalize());
  assert.deepEqual(data.tests.map((x) => [x.concurrent, x.cpuUserUs, x.cpuSystemUs, x.heapDeltaBytes]), [
    [true, null, null, null], [true, null, null, null],
  ]);
  assert.ok(data.warnings.some((x) => /precede Circus event bounds/.test(x)));
});

test('overlapping starts invalidate both attempts and beforeEach failures do not invent body time', async (t) => {
  const { recorder: r, at } = fixture(t);
  const first = circusTest('first', { errors: [new Error('beforeEach failed')] });
  const second = circusTest('second');
  await r.handleTestEvent({ name: 'run_start' });
  r.handleTestEvent({ name: 'test_start', test: first });
  r.handleTestEvent({ name: 'test_start', test: second });
  at(1100); r.handleTestEvent({ name: 'test_fn_start', test: first });
  at(1200); r.handleTestEvent({ name: 'test_done', test: first });
  at(1300); r.handleTestEvent({ name: 'test_fn_start', test: second });
  at(1400);
  const data = readRaw(await r.finalize());
  assert.equal(data.status, 'error');
  assert.deepEqual(data.tests.map((x) => [x.status, x.bodyUs, x.concurrent, x.cpuUserUs, x.heapDeltaBytes]), [
    ['failed', 0, true, null, null], ['incomplete', 100, true, null, null],
  ]);
  assert.equal(data.tests[1].endUs, 1400);
});

test('nested evaluations have inclusive/self time, unique nodes and evaluation-parent edges', async (t) => {
  const { recorder: r, directory, at } = fixture(t);
  const parent = path.join(directory, 'parent.cjs');
  const child = path.join(directory, 'child.json');
  fs.writeFileSync(parent, '12345');
  fs.writeFileSync(child, '{}');
  const outer = r.enterModule(parent);
  at(1020); const inner = r.enterModule(child);
  at(1050); r.exitModule(inner);
  at(1100); r.exitModule(outer);
  at(1110); const isolated = r.enterModule(child, parent);
  at(1120); r.exitModule(isolated);
  assert.equal(r.modules.get(parent).sourceBytes, null);
  fs.writeFileSync(parent, '1234567');
  const data = readRaw(await r.finalize());
  assert.deepEqual(data.modules, [
    { path: 'parent.cjs', evaluations: 1, sourceBytes: 7, selfUs: 70, totalUs: 100 },
    { path: 'child.json', evaluations: 2, sourceBytes: 2, selfUs: 40, totalUs: 40 },
  ]);
  assert.deepEqual(data.edges, [['parent.cjs', 'child.json']]);
  assert.equal(r.modules.size, 0);
  assert.equal(r.moduleStack.length, 0);
});

test('exclusive activities count nested transforms and evaluations once without changing module totals', async (t) => {
  const { recorder: r, directory, at } = fixture(t);
  at(1001.4); const outer = r.enterModule(path.join(directory, 'outer.cjs'));
  at(1003.6); const transform = r.enterActivity('transform');
  at(1004.1); const nestedTransform = r.enterActivity('transform');
  at(1006.4); r.exitActivity(nestedTransform);
  at(1007.6); r.exitActivity(transform);
  at(1009.2); const inner = r.enterModule(path.join(directory, 'inner.cjs'));
  at(1011.8); const innerTransform = r.enterActivity('transform');
  at(1013.4); r.exitActivity(innerTransform);
  at(1014.7); r.exitModule(inner);
  at(1017.3); r.exitModule(outer);
  at(1018.6);
  const data = readRaw(await r.finalize());
  assertActivityTiming(data);
  assert.deepEqual(activityRows(data), [{ kind: 'setup', transformUs: 5, moduleEvaluationUs: 11, otherUs: 3 }]);
  assert.deepEqual(data.modules.map((module) => [module.path, Math.round(module.totalUs), Math.round(module.selfUs)]), [
    ['outer.cjs', 16, 10], ['inner.cjs', 6, 6],
  ]);
  assert.equal(r.activityStack.length, 0);
});

test('module evaluation nested inside a transform temporarily takes precedence over its parent', async (t) => {
  const { recorder: r, directory, at } = fixture(t);
  at(1002); const outer = r.enterActivity('transform');
  at(1004); const module = r.enterModule(path.join(directory, 'nested.cjs'));
  at(1006); const inner = r.enterActivity('transform');
  at(1008); r.exitActivity(inner);
  at(1011); r.exitModule(module);
  at(1013); r.exitActivity(outer);
  at(1015);
  const data = readRaw(await r.finalize());
  assertActivityTiming(data);
  assert.deepEqual(activityRows(data), [{ kind: 'setup', transformUs: 6, moduleEvaluationUs: 5, otherUs: 4 }]);
});

test('rounding activity boundaries preserves sub-microsecond work without aggregation drift', async (t) => {
  const { recorder: r, at } = fixture(t);
  for (let index = 0; index < 20; index++) {
    at(1000 + index * 0.2);
    const frame = r.enterActivity('transform');
    at(1000 + (index + 1) * 0.2);
    r.exitActivity(frame);
  }
  const data = readRaw(await r.finalize());
  assertActivityTiming(data);
  assert.deepEqual(activityRows(data), [{ kind: 'setup', transformUs: 4, moduleEvaluationUs: 0, otherUs: 0 }]);
});

test('active activities flush at phase boundaries and resume in the next phase', async (t) => {
  const { recorder: r, directory, at } = fixture(t);
  at(1010); const module = r.enterModule(path.join(directory, 'phase.cjs'));
  at(1020); const transform = r.enterActivity('transform');
  at(1025); r.transition('body', 7);
  at(1030); r.exitActivity(transform);
  at(1040); r.transition('hook', 7);
  at(1045); r.exitModule(module);
  at(1050); r.transition('framework');
  at(1060);
  const data = readRaw(await r.finalize());
  assertActivityTiming(data);
  assert.deepEqual(activityRows(data), [
    { kind: 'setup', transformUs: 5, moduleEvaluationUs: 10, otherUs: 10 },
    { kind: 'body', transformUs: 5, moduleEvaluationUs: 10, otherUs: 0 },
    { kind: 'hook', transformUs: 0, moduleEvaluationUs: 5, otherUs: 5 },
    { kind: 'framework', transformUs: 0, moduleEvaluationUs: 0, otherUs: 10 },
  ]);
});

test('activity stack corruption and unfinished activities invalidate timing without losing raw output', async (t) => {
  for (const mode of ['out-of-order', 'unfinished']) {
    await t.test(mode, async (t) => {
      const { recorder: r, at } = fixture(t);
      const outer = r.enterActivity('moduleEvaluation');
      if (mode === 'out-of-order') {
        const inner = r.enterActivity('transform');
        at(1005); r.exitActivity(outer);
        at(1006); r.exitActivity(inner);
      }
      at(1010);
      const data = readRaw(await r.finalize());
      assertActivityTiming(data, false);
      assert.ok(data.warnings.some((warning) => mode === 'unfinished'
        ? /active activity at finalization/.test(warning) : /stack exit order mismatch/.test(warning)));
      assert.equal(r.activityStack.length, 0);
      assert.equal(data.points.at(-1).label, 'afterteardown');
    });
  }
});

test('phase corruption invalidates activity timing instead of repairing totals silently', async (t) => {
  for (const mode of ['counter', 'clock', 'phase', 'missing']) {
    await t.test(mode, async (t) => {
      const { recorder: r, at } = fixture(t);
      await r.handleTestEvent({ name: 'run_start' });
      await r.handleTestEvent({ name: 'run_finish' });
      if (mode === 'counter') r.segment.otherUs++;
      if (mode === 'clock') { at(999); r.transition('body'); }
      if (mode === 'phase') r.transition('unknown');
      if (mode === 'missing') r.segment = null;
      at(1010);
      const data = readRaw(await r.finalize());
      assert.equal(data.activityTimingValid, false);
      assert.equal(data.status, 'complete', 'Activity validity must not replace the suite outcome');
      assert.ok(data.warnings.some((warning) => /Exclusive activity timing is invalid/.test(warning)));
      if (mode === 'counter') assert.equal(data.segments.find((segment) => segment.kind === 'teardown').otherUs, 11);
    });
  }
});

test('heap sampling rotates only at run boundaries and async stops are awaited', async (t) => {
  const protocol = sessionProtocol();
  const { recorder: r } = fixture(t, { cpu: true, heap: true }, protocol);
  const initialCommands = protocol.calls.length;
  await r.handleTestEvent({ name: 'run_start' });
  const boundaryCommands = protocol.calls.length;
  const current = circusTest('one');
  r.handleTestEvent({ name: 'test_start', test: current });
  r.handleTestEvent({ name: 'test_done', test: current });
  assert.equal(protocol.calls.length, boundaryCommands);
  assert.ok(boundaryCommands > initialCommands);
  await r.handleTestEvent({ name: 'run_finish' });
  const data = readRaw(await r.finalize());
  assert.deepEqual(data.heapProfiles.map((p) => [p.phase, p.includeCollected]), [
    ['setup', true], ['tests', true], ['teardown', true],
  ]);
  assert.deepEqual(protocol.calls.filter(([m]) => m === 'HeapProfiler.startSampling').map(([, options]) => options), Array(3).fill({
    samplingInterval: 1048576, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true,
  }));
  assert.equal(protocol.calls.filter(([m]) => m === 'Profiler.start').length, 1);
  assert.equal(protocol.calls.filter(([m]) => m === 'Profiler.stop').length, 1);
  assert.equal(data.cpuProfile.startTime, 1000);
  assert.equal(protocol.disconnected(), true);
});

test('rejected collected-object flags produce labelled survive-only fallback', async (t) => {
  const protocol = sessionProtocol({ reject: (method, params) =>
    method === 'HeapProfiler.startSampling' && params.includeObjectsCollectedByMajorGC ? new Error('unsupported flags') : null });
  const { recorder: r } = fixture(t, { heap: true }, protocol);
  const data = readRaw(await r.finalize());
  assert.equal(data.heapProfiles[0].includeCollected, false);
  assert.ok(data.warnings.some((x) => /falling back to survive-only/.test(x)));
  assert.equal(protocol.disconnected(), true);
});

test('asynchronous Inspector startup is rejected rather than missing constructor coverage silently', async (t) => {
  const protocol = sessionProtocol({ asyncStart: true });
  const { recorder: r } = fixture(t, { cpu: true, heap: true }, protocol);
  const data = readRaw(await r.finalize());
  assert.equal(data.cpuProfile, null);
  assert.deepEqual(data.heapProfiles, []);
  assert.ok(data.warnings.some((x) => /did not complete synchronously/.test(x)));
  assert.equal(protocol.disconnected(), true);
});

test('Inspector stop errors leave raw output and do not replace an environment error', async (t) => {
  const protocol = sessionProtocol({ reject: (method) => method.endsWith('stop') || method.endsWith('stopSampling') ? new Error('inspector stop failed') : null });
  const { recorder: r } = fixture(t, { cpu: true, heap: true }, protocol);
  const failure = new Error('original teardown failure');
  const environment = { teardown() { throw failure; } };
  attachRecorder(environment, r);
  await assert.rejects(environment.teardown(), (error) => error === failure);
  const data = readRaw(r.outputPath);
  assert.equal(data.status, 'error');
  assert.equal(data.cpuProfile, null);
  assert.deepEqual(data.heapProfiles, []);
  assert.ok(data.warnings.some((x) => /CPU profile unavailable: inspector stop failed/.test(x)));
  assert.ok(data.warnings.some((x) => /Heap profile for setup unavailable/.test(x)));
});

test('environment callbacks retain receivers, arguments, return values and errors', async (t) => {
  const { recorder: r } = fixture(t);
  const calls = [];
  const token = Symbol('result');
  const failure = new Error('original callback error');
  const environment = {
    handleTestEvent(event, state) {
      calls.push([this, event, state]);
      if (event.name === 'sync_failure') throw failure;
      if (event.name === 'async_failure') return Promise.reject(failure);
      return event.name === 'async_value' ? Promise.resolve(token) : token;
    },
    teardown(...args) { calls.push([this, ...args]); return token; },
  };
  attachRecorder(environment, r);
  assert.equal(attachRecorder(environment, r), r);
  const event = { name: 'add_test' };
  const state = {};
  assert.equal(environment.handleTestEvent(event, state), token);
  assert.deepEqual(calls[0], [environment, event, state]);
  assert.equal(await environment.handleTestEvent({ name: 'async_value' }, state), token);
  assert.throws(() => environment.handleTestEvent({ name: 'sync_failure' }, state), (error) => error === failure);
  await assert.rejects(environment.handleTestEvent({ name: 'async_failure' }, state), (error) => error === failure);
  assert.equal(await environment.teardown('argument'), token);
  assert.deepEqual(calls.at(-1), [environment, 'argument']);
  assert.equal(readRaw(r.outputPath).status, 'error');
});

test('GC timestamps use the hrtime/performance offset and retain kind/flags', async (t) => {
  const { recorder: r } = fixture(t);
  r.gcOffsetUs = 900;
  r.collectGC([
    { startTime: 0, duration: 1, detail: { kind: 1, flags: 2 } },
    { startTime: 0.2, duration: 0.03, detail: { kind: 4, flags: 8 } },
  ]);
  assert.deepEqual(r.data.gc, [{ startUs: 1100, durationUs: 30, kind: 4, flags: 8 }]);
  await r.finalize();
});

test('raw output is atomic gzip with separate attempts and idempotent finalization', async (t) => {
  const { recorder: first, config, directory } = fixture(t);
  const firstPromise = first.finalize();
  assert.equal(first.finalize(), firstPromise);
  const firstPath = await firstPromise;
  const second = new Recorder(config, { suite: path.join(directory, 'suite.test.cjs'), environment: 'other', coverageStart: 'runtime' });
  const secondPath = await second.finalize();
  const hash = createHash('sha256').update('suite.test.cjs').digest('hex').slice(0, 16);
  assert.equal(path.basename(firstPath), `${hash}-${process.pid}-1.json.gz`);
  assert.equal(path.basename(secondPath), `${hash}-${process.pid}-2.json.gz`);
  assert.equal(readRaw(firstPath).environment, 'unit-environment');
  assert.equal(readRaw(secondPath).coverageStart, 'runtime');
  assert.deepEqual(fs.readdirSync(path.join(directory, 'raw')).sort(), [path.basename(firstPath), path.basename(secondPath)].sort());
});

test('disk failures propagate with the destination after observer and Inspector cleanup', async (t) => {
  const protocol = sessionProtocol();
  const { recorder: r, directory } = fixture(t, { cpu: true }, protocol);
  fs.rmdirSync(path.join(directory, 'raw'));
  await assert.rejects(r.finalize(), /Cannot write shard profile .*\.json\.gz: ENOENT/);
  assert.equal(r.observer, null);
  assert.equal(protocol.disconnected(), true);
});

async function installedRuntime(t, sources, setupFiles = [], options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-runtime-'));
  fs.mkdirSync(path.join(directory, 'raw'));
  const oldConfig = process.env.GRAFANA_SHARD_PROFILE;
  process.env.GRAFANA_SHARD_PROFILE = JSON.stringify({ rootDir: directory, outputDir: directory, cpu: false, heap: false });
  let runtime;
  let environment;
  t.after(async () => {
    try {
      if (runtime && !runtime.isTornDown) runtime.teardown();
      if (environment && !environment.__grafanaShardProfile?.closed) await environment.teardown();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
      if (oldConfig === undefined) delete process.env.GRAFANA_SHARD_PROFILE;
      else process.env.GRAFANA_SHARD_PROFILE = oldConfig;
    }
  });
  for (const [filename, source] of Object.entries(sources)) fs.writeFileSync(path.join(directory, filename), source);
  const coreRequire = createRequire(createRequire(require.resolve('jest')).resolve('@jest/core'));
  const runtimeRequire = createRequire(coreRequire.resolve('jest-runtime'));
  const configRequire = createRequire(coreRequire.resolve('jest-config'));
  const { options: config } = await coreRequire('jest-config').normalize({
    rootDir: directory, cacheDirectory: path.join(directory, 'cache'), testEnvironment: 'node', transform: options.transform || {},
    setupFiles: setupFiles.map((filename) => path.join(directory, filename)),
  }, {});
  const NodeEnvironment = configRequire('jest-environment-node').default;
  environment = new NodeEnvironment({ projectConfig: config, globalConfig: config }, { console, testPath: path.join(directory, 'suite.test.cjs') });
  const Runtime = require('./runtime.cjs');
  const { ModuleMap } = runtimeRequire('jest-haste-map');
  const resolver = Runtime.createResolver(config, ModuleMap.create(directory));
  const transformer = await runtimeRequire('@jest/transform').createScriptTransformer(config);
  if (options.now) {
    attachRecorder(environment, new Recorder(readConfig(), {
      suite: path.join(directory, 'suite.test.cjs'), environment: 'NodeEnvironment', coverageStart: 'runtime',
    }, { now: options.now }));
  }
  runtime = new Runtime(config, environment, resolver, transformer, new Map(), { collectCoverage: false }, path.join(directory, 'suite.test.cjs'), config);
  const recorder = environment.__grafanaShardProfile;

  return { directory, runtime, environment, recorder, config, Runtime, coreRequire, transformer, resolver, NodeEnvironment };
}

test('installed CJS runtime keeps caching/isolates intact and captures JS, JSON and native loads once', async (t) => {
  const { directory, runtime, environment, recorder, Runtime, coreRequire } = await installedRuntime(t, {
    'suite.test.cjs': 'globalThis.runs = (globalThis.runs || 0) + 1; module.exports = { value: require("./dep.cjs") + require("./data.json").n, runs: globalThis.runs };',
    'dep.cjs': 'module.exports = 2;',
    'data.json': '{"n":3}',
    'broken.node': 'not a native binary',
  });
  const suite = path.join(directory, 'suite.test.cjs');
  const first = runtime.requireModule(suite);
  assert.equal(first.value, 5);
  assert.equal(first.runs, 1);
  assert.equal(runtime.requireModule(suite), first);
  runtime.isolateModules(() => {
    const isolated = runtime.requireModule(suite);
    assert.equal(isolated.value, 5);
    assert.equal(isolated.runs, 2);
  });
  runtime.resetModules();
  assert.equal(runtime.requireModule(suite).runs, 3);
  assert.throws(() => runtime.requireModule(path.join(directory, 'broken.node')));
  await environment.handleTestEvent({ name: 'run_start' }, {});
  await environment.handleTestEvent({ name: 'run_finish' }, {});
  runtime.teardown();
  await environment.teardown();
  const data = readRaw(recorder.outputPath);
  assert.equal(data.coverageStart, 'runtime');
  assertActivityTiming(data);
  assert.match(data.environment, /NodeEnvironment/);
  assert.deepEqual(data.modules.map((m) => [m.path, m.evaluations]), [
    ['suite.test.cjs', 3], ['dep.cjs', 3], ['data.json', 3], ['broken.node', 1],
  ]);
  assert.deepEqual(data.edges, [['suite.test.cjs', 'dep.cjs'], ['suite.test.cjs', 'data.json']]);
  for (const module of data.modules) {
    assert.ok(module.sourceBytes > 0);
    assert.ok(module.totalUs >= module.selfUs && module.selfUs >= 0);
  }
  assert.equal(runtime.shardRecorder, null);
  assert.throws(() => Runtime.assertSupportedRuntime(coreRequire('jest-runtime').default, '30.0.0'), /Unsupported jest-runtime 30/);
});

test('installed runtime separates full CJS transforms, JSON transforms, compilation, evaluation and cache hits', async (t) => {
  let now = 1000;
  const { runtime, environment, recorder: r, transformer, directory } = await installedRuntime(t, {
    'suite.test.cjs': 'globalThis.advanceTime(19); module.exports = require("./data.json").n;',
    'data.json': '{"n":3}',
    'transformer.cjs': 'module.exports = { process(code, filename) { return { code, map: { version: 3, sources: [filename], names: [], mappings: "" } }; } };',
  }, [], { now: () => now, transform: { '^.+\\.cjs$': '<rootDir>/transformer.cjs' } });
  environment.global.advanceTime = (amount) => { now += amount; };
  const top = () => r.activityStack.at(-1)?.kind;
  const readFile = runtime.readFile;
  t.mock.method(runtime, 'readFile', function (...args) {
    assert.equal(top(), args[0].endsWith('.json') ? 'moduleEvaluation' : 'transform');
    now += 2;
    return Reflect.apply(readFile, this, args);
  });
  const transform = transformer.transform;
  t.mock.method(transformer, 'transform', function (...args) {
    assert.equal(this, transformer);
    assert.equal(top(), 'transform');
    now += 3;
    return Reflect.apply(transform, this, args);
  });
  const transformJson = transformer.transformJson;
  const wrappedJson = t.mock.method(transformer, 'transformJson', function (...args) {
    assert.equal(this, transformer);
    assert.equal(top(), 'transform');
    now += 11;
    return Reflect.apply(transformJson, this, args);
  });
  for (const [map, amount] of [[runtime._fileTransforms, 5], [runtime._sourceMapRegistry, 7]]) {
    const set = map.set;
    t.mock.method(map, 'set', function (...args) {
      assert.equal(this, map);
      assert.equal(top(), 'transform');
      now += amount;
      return Reflect.apply(set, this, args);
    });
  }
  const compile = runtime.createScriptFromCode;
  t.mock.method(runtime, 'createScriptFromCode', function (...args) {
    assert.equal(top(), 'moduleEvaluation');
    now += 13;
    return Reflect.apply(compile, this, args);
  });
  const parse = environment.global.JSON.parse;
  t.mock.method(environment.global.JSON, 'parse', function (...args) {
    assert.equal(top(), 'moduleEvaluation');
    now += 23;
    return Reflect.apply(parse, this, args);
  });
  const suite = path.join(directory, 'suite.test.cjs');
  assert.equal(runtime.requireModule(suite), 3);
  assert.equal(now, 1085);
  now += 4;
  assert.equal(runtime.requireModule(suite), 3);
  assert.equal(runtime.requireModule(path.join(directory, 'data.json')).n, 3);
  assert.equal(now, 1089, 'Module cache hits must not enter transform or evaluation scopes');
  assert.match(runtime.transformFile(suite), /module.exports/);
  assert.equal(now, 1106, 'Transform-cache lookup, reads and runtime map updates still belong to transformUs');
  runtime.isolateModules(() => assert.equal(runtime.requireModule(path.join(directory, 'data.json')).n, 3));
  assert.equal(now, 1142);
  assert.equal(runtime._scriptTransformer, transformer);
  assert.equal(transformer.transformJson, wrappedJson, 'JSON instrumentation must not modify the shared method');
  runtime.teardown();
  await environment.teardown();
  const data = readRaw(r.outputPath);
  assertActivityTiming(data);
  assert.deepEqual(activityRows(data), [{ kind: 'setup', transformUs: 56, moduleEvaluationUs: 82, otherUs: 4 }]);
  assert.deepEqual(data.modules.map((module) => [module.path, module.evaluations, module.totalUs, module.selfUs]), [
    ['suite.test.cjs', 1, 85, 49], ['data.json', 2, 72, 72],
  ]);
});

test('internal-module reads bypass transformation activity', async (t) => {
  let now = 1000;
  const { runtime, environment, recorder: r, directory } = await installedRuntime(t, {
    'internal.cjs': 'globalThis.advanceTime(7); module.exports = 42;',
    'internal.json': '{"n":3}',
  }, [], { now: () => now });
  environment.global.advanceTime = (amount) => { now += amount; };
  const read = runtime.readFile;
  t.mock.method(runtime, 'readFile', function (...args) {
    assert.notEqual(r.activityStack.at(-1)?.kind, 'transform');
    now += 3;
    return Reflect.apply(read, this, args);
  });
  assert.equal(runtime.requireInternalModule(path.join(directory, 'internal.cjs')), 42);
  assert.equal(runtime.requireInternalModule(path.join(directory, 'internal.json')).n, 3);
  assert.match(runtime.transformFile(path.join(directory, 'internal.cjs'), { isInternalModule: true }), /module.exports/);
  runtime.teardown();
  await environment.teardown();
  const data = readRaw(r.outputPath);
  assertActivityTiming(data);
  assert.deepEqual(activityRows(data), [{ kind: 'setup', transformUs: 0, moduleEvaluationUs: 13, otherUs: 3 }]);
});

test('transform, JSON parse, VM compilation and module exceptions unwind activity scopes and restore the transformer', async (t) => {
  const { runtime, environment, recorder: r, directory, transformer } = await installedRuntime(t, {
    'transform-failure.cjs': 'module.exports = 1;',
    'transform-failure.json': '{}',
    'parse-failure.json': '{',
    'compile-failure.cjs': 'module.exports = ;',
    'body-failure.cjs': 'throw new Error("module body failure");',
    'ok.cjs': 'module.exports = 42;',
  });
  const failure = new Error('transform failure');
  for (const name of ['transform', 'transformJson']) {
    const original = transformer[name];
    t.mock.method(transformer, name, function (...args) {
      assert.equal(this, transformer);
      if (args[0].includes('transform-failure')) throw failure;
      return Reflect.apply(original, this, args);
    });
  }
  const jsonMethod = transformer.transformJson;
  for (const filename of ['transform-failure.cjs', 'transform-failure.json', 'parse-failure.json', 'compile-failure.cjs', 'body-failure.cjs']) {
    assert.throws(() => runtime.requireModule(path.join(directory, filename)), filename.startsWith('transform-')
      ? (error) => error === failure : /JSON|Unexpected|property|module body failure/);
    assert.equal(r.activityStack.length, 0, filename);
    assert.equal(r.moduleStack.length, 0, filename);
    assert.equal(runtime._scriptTransformer, transformer, filename);
    assert.equal(transformer.transformJson, jsonMethod, filename);
  }
  assert.equal(runtime.requireModule(path.join(directory, 'ok.cjs')), 42);
  runtime.teardown();
  await environment.teardown();
  assertActivityTiming(readRaw(r.outputPath));
});

test('two installed runtimes sharing a transformer keep JSON activity and caches isolated', async (t) => {
  let now = 1000;
  const { runtime, environment, recorder: first, directory, transformer, config, Runtime, resolver, NodeEnvironment } = await installedRuntime(t, {
    'data.json': '{"n":3}',
  }, [], { now: () => now });
  const peerPath = path.join(directory, 'peer.test.cjs');
  const peerEnvironment = new NodeEnvironment({ projectConfig: config, globalConfig: config }, { console, testPath: peerPath });
  const second = attachRecorder(peerEnvironment, new Recorder(readConfig(), {
    suite: peerPath, environment: 'NodeEnvironment', coverageStart: 'runtime',
  }, { now: () => now }));
  let peer;
  try {
    peer = new Runtime(config, peerEnvironment, resolver, transformer, new Map(), { collectCoverage: false }, peerPath, config);
    const original = transformer.transformJson;
    const wrapped = t.mock.method(transformer, 'transformJson', function (...args) {
      assert.equal(this, transformer);
      now += 5;
      return Reflect.apply(original, this, args);
    });
    const filename = path.join(directory, 'data.json');
    const firstValue = runtime.requireModule(filename);
    const secondValue = peer.requireModule(filename);
    assert.equal(firstValue.n, 3);
    assert.equal(secondValue.n, 3);
    assert.notEqual(firstValue, secondValue, 'Module registries must remain per-runtime');
    assert.equal(runtime.requireModule(filename), firstValue);
    assert.equal(peer.requireModule(filename), secondValue);
    assert.equal(wrapped.mock.calls.length, 2);
    assert.equal(transformer.transformJson, wrapped);
    assert.equal(runtime._scriptTransformer, transformer);
    assert.equal(peer._scriptTransformer, transformer);
    runtime.teardown();
    await environment.teardown();
  } finally {
    peer?.teardown();
    await peerEnvironment.teardown();
  }
  for (const recorder of [first, second]) {
    const data = readRaw(recorder.outputPath);
    assertActivityTiming(data);
    assert.deepEqual(activityRows(data), [{ kind: 'setup', transformUs: 5, moduleEvaluationUs: 0, otherUs: 5 }]);
    assert.equal(data.modules[0].evaluations, 1);
  }
});

test('reentrant JSON transformation restores nested runtime wrappers and counts each interval once', async (t) => {
  let now = 1000;
  const { runtime, environment, recorder: r, transformer, directory } = await installedRuntime(t, {
    'outer.json': '{"n":1}', 'inner.json': '{"n":2}',
  }, [], { now: () => now });
  const original = transformer.transformJson;
  const wrapped = t.mock.method(transformer, 'transformJson', function (...args) {
    assert.equal(this, transformer);
    if (args[0].endsWith('outer.json')) {
      now += 3;
      assert.equal(runtime.requireModule(path.join(directory, 'inner.json')).n, 2);
      now += 7;
    } else {
      now += 5;
    }
    return Reflect.apply(original, this, args);
  });
  assert.equal(runtime.requireModule(path.join(directory, 'outer.json')).n, 1);
  assert.equal(wrapped.mock.calls.length, 2);
  assert.equal(runtime._scriptTransformer, transformer);
  assert.equal(transformer.transformJson, wrapped);
  runtime.teardown();
  await environment.teardown();
  const data = readRaw(r.outputPath);
  assertActivityTiming(data);
  assert.deepEqual(activityRows(data), [{ kind: 'setup', transformUs: 15, moduleEvaluationUs: 0, otherUs: 0 }]);
  assert.deepEqual(data.modules.map((module) => [module.path, module.totalUs, module.selfUs]), [
    ['outer.json', 15, 10], ['inner.json', 5, 5],
  ]);
});

test('a promise from the synchronous JSON interface invalidates timing without changing the parse failure', async (t) => {
  const { runtime, environment, recorder: r, transformer, directory } = await installedRuntime(t, { 'data.json': '{}' });
  t.mock.method(transformer, 'transformJson', () => Promise.resolve('{}'));
  assert.throws(() => runtime.requireModule(path.join(directory, 'data.json')), /JSON|Unexpected/);
  assert.equal(runtime._scriptTransformer, transformer);
  assert.equal(r.activityStack.length, 0);
  runtime.teardown();
  await environment.teardown();
  const data = readRaw(r.outputPath);
  assertActivityTiming(data, false);
  assert.ok(data.warnings.some((warning) => /transformJson returned a promise/.test(warning)));
});

test('native asynchronous transforms invalidate timing without charging await time to transformation', async (t) => {
  let now = 1000;
  const { runtime, environment, recorder: r, directory, transformer } = await installedRuntime(t, {
    'async.cjs': 'module.exports = 1;',
    'sync.cjs': 'globalThis.advanceTime(10); module.exports = 42;',
  }, [], { now: () => now });
  environment.global.advanceTime = (amount) => { now += amount; };
  let resume;
  const gate = new Promise((resolve) => { resume = resolve; });
  const transformAsync = transformer.transformAsync;
  t.mock.method(transformer, 'transformAsync', async function (...args) {
    assert.equal(this, transformer);
    await gate;
    return Reflect.apply(transformAsync, this, args);
  });
  const pending = runtime.transformFileAsync(path.join(directory, 'async.cjs'));
  assert.equal(r.data.activityTimingValid, false);
  assert.equal(r.activityStack.length, 0);
  now = 1010;
  assert.equal(runtime.requireModule(path.join(directory, 'sync.cjs')), 42);
  now = 1100;
  resume();
  assert.equal(await pending, 'module.exports = 1;');
  assert.equal(r.activityStack.length, 0);
  now = 1110;
  runtime.teardown();
  await environment.teardown();
  const data = readRaw(r.outputPath);
  assertActivityTiming(data, false);
  assert.deepEqual(activityRows(data), [{ kind: 'setup', transformUs: 0, moduleEvaluationUs: 10, otherUs: 100 }]);
  assert.ok(data.warnings.some((warning) => /native asynchronous transformFileAsync is unsupported/.test(warning)));
});

test('runtime compatibility checks require the activity instrumentation entry points', async (t) => {
  const { Runtime, coreRequire, environment, config, resolver, directory } = await installedRuntime(t, {});
  const BaseRuntime = coreRequire('jest-runtime').default;
  for (const method of ['transformFile', 'transformFileAsync', 'loadEsmModule', 'linkAndEvaluateModule']) {
    const prototype = Object.create(BaseRuntime.prototype);
    prototype[method] = undefined;
    assert.throws(() => Runtime.assertSupportedRuntime({ prototype }, '29.7.0'), /Unsupported jest-runtime 29/);
  }
  // Use an uninstrumented environment so rejecting this constructor cannot finalize the live fixture's recorder.
  const originalRecorder = environment.__grafanaShardProfile;
  delete environment.__grafanaShardProfile;
  try {
    assert.throws(() => new Runtime(config, environment, resolver, {}, new Map(), { collectCoverage: false }, path.join(directory, 'suite.test.cjs'), config),
      /Unsupported Jest 29 ScriptTransformer: transformJson/);
  } finally {
    environment.__grafanaShardProfile = originalRecorder;
  }
});

for (const [name, source] of [
  ['import', 'throw new Error("early setup failed");'],
  ['sync function', 'module.exports = function () { throw new Error("early setup failed"); };'],
  ['async function', 'module.exports = async function () { throw new Error("early setup failed"); };'],
]) {
  test(`early setup ${name} failures finalize before rejecting to the Jest 29 setup loop`, async (t) => {
    const { runtime, directory, recorder } = await installedRuntime(t, { 'setup.cjs': source }, ['setup.cjs']);
    const setup = runtime.requireModule(path.join(directory, 'setup.cjs'));
    await assert.rejects(setup(), /early setup failed/);
    assert.equal(runtime.isTornDown, true);
    const data = readRaw(recorder.outputPath);
    assert.equal(data.status, 'error');
    assert.equal(data.modules[0].path, 'setup.cjs');
    assert.ok(data.warnings.some((x) => /before Jest 29 entered its teardown guard/.test(x)));
  });
}

test('early ESM setup failures also finalize, without claiming CJS module coverage', async (t) => {
  const { runtime, directory, recorder } = await installedRuntime(t, {
    'setup.mjs': 'export const = ;',
  }, ['setup.mjs']);
  await assert.rejects(runtime.unstable_importModule(path.join(directory, 'setup.mjs')), /VM API|Unexpected token/);
  assert.equal(runtime.isTornDown, true);
  const data = readRaw(recorder.outputPath);
  assert.equal(data.status, 'error');
  assert.deepEqual(data.modules, []);
  assert.ok(data.warnings.some((x) => /native ESM and host imports are not instrumented/.test(x)));
  assertActivityTiming(data, false);
  assert.ok(data.warnings.some((warning) => /native ESM unstable_importModule is unsupported/.test(warning)));
});

test('ordinary suite import failures still throw synchronously and finalize in teardown', async (t) => {
  const { runtime, directory, recorder, environment } = await installedRuntime(t, {
    'suite.test.cjs': 'throw new Error("suite import failed");',
  });
  assert.throws(() => runtime.requireModule(path.join(directory, 'suite.test.cjs')), /suite import failed/);
  runtime.teardown();
  await environment.teardown();
  const data = readRaw(recorder.outputPath);
  assert.equal(data.status, 'error');
  assert.deepEqual(data.tests, []);
  assert.equal(data.modules[0].evaluations, 1);
});

test('successful setup function wrappers preserve this, arguments and sync results without changing exports', async (t) => {
  const { runtime, directory } = await installedRuntime(t, {
    'setup.cjs': 'module.exports = function (n) { return this.base + n; };',
  }, ['setup.cjs']);
  const filename = path.join(directory, 'setup.cjs');
  const setup = runtime.requireModule(filename);
  assert.equal(setup.call({ base: 4 }, 3), 7);
  const exported = runtime.requireModule(filename);
  assert.notEqual(setup, exported);
  assert.equal(exported.call({ base: 2 }, 3), 5);
});

test('real Inspector smoke writes CPU and three collected-object heap phases', { skip: process.env.GRAFANA_SHARD_PROFILE_SMOKE !== '1' }, async (t) => {
  const { recorder: r } = fixture(t, { cpu: true, heap: true }, { now: () => Number(process.hrtime.bigint()) / 1000 });
  await r.handleTestEvent({ name: 'run_start' }, {});
  const values = Array.from({ length: 1000 }, (_, i) => ({ value: String(i) }));
  assert.equal(values[999].value, '999');
  await r.handleTestEvent({ name: 'run_finish' }, {});
  const data = readRaw(await r.finalize());
  assert.ok(data.cpuProfile.nodes.length > 0);
  assert.ok(data.cpuProfile.startTime >= data.startUs && data.cpuProfile.endTime <= data.endUs);
  assert.deepEqual(data.heapProfiles.map((p) => [p.phase, p.includeCollected]), [['setup', true], ['tests', true], ['teardown', true]]);
});
