'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildSummary, summarize } = require('./summarize.cjs');

const rootDir = '/repo';
function record(overrides = {}) {
  return {
    schemaVersion: 1, suite: 'public/app/a.test.ts', pid: 17, environment: 'HappyDOM', coverageStart: 'environment',
    startUs: 1000, endUs: 2000, status: 'complete', warnings: [], instrumentationUs: 75,
    points: [
      { label: 'constructor', tUs: 1000, cpuUserUs: 100, cpuSystemUs: 30, heapUsed: 4096, rss: 16384 },
      { label: 'test:1:start', tUs: 1200, cpuUserUs: 200, cpuSystemUs: 40, heapUsed: 1024000, rss: 2048000 },
      { label: 'afterteardown', tUs: 1900, cpuUserUs: 700, cpuSystemUs: 130, heapUsed: 3072, rss: 17408 },
    ],
    segments: [
      { kind: 'setup', startUs: 1000, endUs: 1200, test: null },
      { kind: 'hook', startUs: 1200, endUs: 1300, test: 1 },
      { kind: 'body', startUs: 1300, endUs: 1700, test: 1 },
      { kind: 'framework', startUs: 1700, endUs: 1800, test: null },
      { kind: 'teardown', startUs: 1800, endUs: 1900, test: null },
      { kind: 'profiler', startUs: 1900, endUs: 2000, test: null },
    ],
    tests: [{ id: 1, name: 'group test', attempt: 1, status: 'passed', startUs: 1200, endUs: 1700, bodyUs: 400, hookUs: 100, cpuUserUs: 350, cpuSystemUs: 20, heapDeltaBytes: -1024, concurrent: false }],
    modules: [
      { path: '/repo/public/app/a.ts', evaluations: 3, sourceBytes: 100, selfUs: 200, totalUs: 500 },
      { path: 'node_modules/library/index.js', evaluations: 1, sourceBytes: 50, selfUs: 100, totalUs: 100 },
    ],
    gc: [{ startUs: 1250, durationUs: 30, kind: 1, flags: 0 }, { startUs: 1500, durationUs: 20, kind: 4, flags: 0 }],
    cpuProfile: null, heapProfiles: [], ...overrides,
  };
}

function activityRecord(overrides = {}) {
  const input = record();
  const counters = [[60, 100, 40], [10, 20, 70], [100, 200, 100], [0, 10, 90], [0, 5, 95], [0, 0, 100]];
  return { ...input, activityTimingVersion: 1, activityTimingValid: true,
    segments: input.segments.map((segment, i) => ({ ...segment, transformUs: counters[i][0], moduleEvaluationUs: counters[i][1], otherUs: counters[i][2] })),
    ...overrides,
  };
}

function frame(functionName, url = '', lineNumber = 0) {
  return { functionName, scriptId: '1', url, lineNumber, columnNumber: 0 };
}

function cpuProfile() {
  return {
    startTime: 900, endTime: 2100,
    nodes: [
      { id: 1, callFrame: frame('(root)'), children: [2, 4, 5, 6, 7] },
      { id: 2, callFrame: frame('render', 'file:///repo/public/app/render.ts', 9), children: [3] },
      { id: 3, callFrame: frame('nativeCall', '', -1) },
      { id: 4, callFrame: frame('(idle)') },
      { id: 5, callFrame: frame('(garbage collector)') },
      { id: 6, callFrame: frame('query', '/repo/node_modules/.pnpm/happy-dom@20.0.0/node_modules/happy-dom/lib/query.js', 4) },
      { id: 7, callFrame: frame('post', '/repo/scripts/test-harness/profiling/shard-profiler/recorder.cjs', 100) },
    ],
    samples: [3, 4, 6, 5, 7], timeDeltas: [300, 100, 400, 100, 300],
  };
}

function heapProfile(phase = 'tests', includeCollected = true) {
  return { phase, includeCollected, profile: {
    head: { id: 1, callFrame: frame('(root)'), selfSize: 0, children: [
      { id: 2, callFrame: frame('render', '/repo/public/app/render.ts'), selfSize: 9000, children: [
        { id: 3, callFrame: frame('nativeAllocation'), selfSize: 7000, children: [] },
      ] },
      { id: 4, callFrame: frame('query', '/repo/node_modules/happy-dom/lib/query.js'), selfSize: 3000, children: [] },
    ] },
    samples: [{ size: 128, nodeId: 3, ordinal: 1 }, { size: 64, nodeId: 3, ordinal: 2 }, { size: 256, nodeId: 4, ordinal: 3 }],
  } };
}

function rows(summary, name) {
  const columns = summary[name];
  return columns[Object.keys(columns)[0]].map((_, i) => Object.fromEntries(Object.keys(columns).map((column) => {
    let value = columns[column][i];
    if (summary.stringColumns[name]?.includes(column) && value !== null) value = summary.strings[value];
    if (column === 'phase') value = (name === 'activities' ? summary.activityPhases : summary.phases)[value];
    if (column === 'category') value = summary.categories[value];
    return [column, value];
  })));
}

function messages(summary) { return rows(summary, 'warnings').map((row) => row.message).join('\n'); }
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}

function assertTables(summary) {
  for (const name of ['suites', 'tests', 'activities', 'costs', 'hotspots', 'testOwners', 'warnings']) {
    assert.equal(Array.isArray(summary[name]), false, `${name} is an object of arrays`);
    const columns = Object.values(summary[name]);
    for (const column of columns) {
      assert.ok(Array.isArray(column));
      assert.equal(column.length, columns[0].length);
      assert.ok(column.every((value) => value === null || typeof value !== 'object'));
    }
  }
  assert.equal(summary.activities.suite.length, summary.suites.path.length * 7);
  for (const [i, entry] of rows(summary, 'activities').entries()) {
    assert.equal(entry.suite, Math.floor(i / 7));
    assert.equal(summary.activities.phase[i], i % 7);
    const wallUs = summary.suites[`${entry.phase}Us`][entry.suite];
    assert.equal(entry.wallUs, Number.isSafeInteger(wallUs) && wallUs >= 0 ? wallUs : null);
    if (entry.transformUs !== null) assert.equal(entry.transformUs + entry.moduleEvaluationUs + entry.otherUs, entry.wallUs);
  }
  assert.equal(summary.sizeLimit.bytes, Buffer.byteLength(JSON.stringify(summary)));
}

test('exports one API, preserves inputs, and reports disjoint wall, boundary memory, process CPU and unique module bytes', () => {
  assert.equal(summarize, buildSummary);
  const input = freeze(record());
  const metadata = freeze({ rootDir, selectedSuites: [input.suite], workers: 4, revision: 'abc', node: '22', config: { cpu: false } });
  const summary = buildSummary([input], metadata);
  assertTables(summary);
  const suite = rows(summary, 'suites')[0];
  assert.deepEqual([suite.wallUs, suite.preTestsUs, suite.bodyUs, suite.hooksUs, suite.frameworkUs, suite.teardownUs, suite.profilerUs, suite.unassignedUs], [1000, 200, 400, 100, 100, 100, 100, 0]);
  assert.deepEqual([suite.instrumentationUs, suite.processCpuUserUs, suite.processCpuSystemUs], [75, 600, 100]);
  assert.deepEqual([suite.heapStartKiB, suite.heapEndKiB, suite.rssStartKiB, suite.rssEndKiB], [4, 3, 16, 17]);
  assert.deepEqual([suite.gcCount, suite.gcUs, suite.moduleUniques, suite.moduleEvaluations, suite.moduleSourceBytes], [2, 50, 2, 4, 150]);
  assert.deepEqual(rows(summary, 'tests')[0], { suite: 0, id: 1, name: 'group test', attempt: 1, status: 'passed', source: 0, startUs: 200, wallUs: 500, bodyUs: 400, hooksUs: 100, processCpuUserUs: 350, processCpuSystemUs: 20, heapDeltaBytes: -1024, concurrent: false });
  assert.equal(suite.mainThreadSampleUs, null);
  assert.equal(suite.heapSampleBytes, null);
  assert.equal(suite.retainedHeapSampleBytes, null);
  assert.match(messages(summary), /CPU profile unavailable/);
  assert.match(messages(summary), /Heap profiles unavailable/);
  assert.equal(summary.metadata.workers, 4);
  assert.equal(summary.metadata.selectedSuites, undefined);
  assert.deepEqual(summary.completeness, { expectedSuites: 1, recordedSelectedSuites: 1, missingSelectedSuites: 0 });
});

test('exclusive activity rows aggregate segments by their own phase dictionary without adding to existing wall or CPU costs', () => {
  const input = activityRecord({ cpuProfile: cpuProfile(), heapProfiles: [heapProfile()] });
  input.segments.splice(2, 1,
    { kind: 'body', startUs: 1300, endUs: 1450, transformUs: 60, moduleEvaluationUs: 50, otherUs: 40 },
    { kind: 'body', startUs: 1450, endUs: 1700, transformUs: 40, moduleEvaluationUs: 150, otherUs: 60 });
  input.modules[0].selfUs = 999999;
  input.modules[0].totalUs = 9999999;
  const summary = buildSummary([freeze(input)], { rootDir });
  const legacy = buildSummary([{ ...input, activityTimingVersion: undefined }], { rootDir });
  assert.deepEqual(summary.activityPhases, ['preTests', 'body', 'hooks', 'framework', 'teardown', 'profiler', 'unassigned']);
  assert.deepEqual(rows(summary, 'activities'), [
    { suite: 0, phase: 'preTests', wallUs: 200, transformUs: 60, moduleEvaluationUs: 100, otherUs: 40 },
    { suite: 0, phase: 'body', wallUs: 400, transformUs: 100, moduleEvaluationUs: 200, otherUs: 100 },
    { suite: 0, phase: 'hooks', wallUs: 100, transformUs: 10, moduleEvaluationUs: 20, otherUs: 70 },
    { suite: 0, phase: 'framework', wallUs: 100, transformUs: 0, moduleEvaluationUs: 10, otherUs: 90 },
    { suite: 0, phase: 'teardown', wallUs: 100, transformUs: 0, moduleEvaluationUs: 5, otherUs: 95 },
    { suite: 0, phase: 'profiler', wallUs: 100, transformUs: 0, moduleEvaluationUs: 0, otherUs: 100 },
    { suite: 0, phase: 'unassigned', wallUs: 0, transformUs: 0, moduleEvaluationUs: 0, otherUs: 0 },
  ]);
  for (const table of ['suites', 'tests', 'costs', 'hotspots', 'testOwners']) assert.deepEqual(rows(summary, table), rows(legacy, table));
  assert.equal(summary.activities.wallUs.reduce((sum, us) => sum + us, 0), 1000);
  assertTables(summary);
});

test('legacy versions and invalid activity flags keep every activity counter null, including zero-wall phases', () => {
  for (const overrides of [
    { activityTimingVersion: undefined }, { activityTimingVersion: 2 }, { activityTimingVersion: '1' },
    { activityTimingValid: undefined }, { activityTimingValid: false }, { activityTimingValid: 'true' },
  ]) {
    const summary = buildSummary([activityRecord(overrides)], { rootDir });
    assert.deepEqual(summary.activities.wallUs, [200, 400, 100, 100, 100, 100, 0]);
    for (const key of ['transformUs', 'moduleEvaluationUs', 'otherUs']) assert.deepEqual(summary.activities[key], Array(7).fill(null));
    assert.match(messages(summary), /Exclusive activity timing is unavailable/);
  }
});

test('missing raw captures retain seven unavailable activity rows without assigning Jest wall to a phase', () => {
  const summary = buildSummary([], { rootDir, selectedSuites: ['missing.test.ts'], jestResults: { testResults: [{ name: 'missing.test.ts', startTime: 10, endTime: 11, status: 'failed' }] } });
  assert.equal(summary.suites.wallUs[0], 1000);
  assert.deepEqual(summary.activities.suite, Array(7).fill(0));
  for (const key of ['wallUs', 'transformUs', 'moduleEvaluationUs', 'otherUs']) assert.deepEqual(summary.activities[key], Array(7).fill(null));
  assertTables(summary);
});

test('missing, fractional, negative, unsafe, nonnumeric and nonpartitioning activity counters invalidate the whole capture', () => {
  for (const counters of [
    { transformUs: undefined }, { moduleEvaluationUs: undefined }, { otherUs: undefined },
    { transformUs: null }, { moduleEvaluationUs: -1 }, { transformUs: 60.1 }, { otherUs: '40' },
    { transformUs: 60n }, { otherUs: Symbol('invalid') },
    { transformUs: Infinity }, { otherUs: NaN }, { transformUs: Number.MAX_SAFE_INTEGER + 1 },
    { transformUs: Number.MAX_SAFE_INTEGER, moduleEvaluationUs: 1, otherUs: 0 }, { otherUs: 39 },
  ]) {
    const input = activityRecord();
    Object.assign(input.segments[0], counters);
    const summary = buildSummary([input], { rootDir });
    assert.deepEqual(summary.activities.wallUs, [200, 400, 100, 100, 100, 100, 0]);
    for (const key of ['transformUs', 'moduleEvaluationUs', 'otherUs']) assert.deepEqual(summary.activities[key], Array(7).fill(null));
    assert.match(messages(summary), /Exclusive activity timing is unavailable/);
  }
});

test('incomplete, clipped, overlapping, out-of-order or malformed segments never produce invented activity residuals', () => {
  const good = activityRecord().segments;
  const changes = [
    { segments: undefined }, { segments: null }, { segments: {} }, { segments: [] }, { segments: [null] },
    { segments: [good[0]] },
    { segments: [good[0], { ...good[1], startUs: 1200.1 }, ...good.slice(2)] },
    { segments: [good[0], { ...good[1], startUs: 1199.9 }, ...good.slice(2)] },
    { segments: [good[0], good[2], good[1], ...good.slice(3)] },
    { segments: [{ ...good[0], startUs: 900, otherUs: 140 }, ...good.slice(1)] },
    { segments: [...good.slice(0, -1), { ...good.at(-1), endUs: 2001, otherUs: 101 }] },
    { segments: [...good, { kind: 'profiler', startUs: 2000, endUs: 2000 }] },
    { segments: [{ ...good[0], endUs: 1200n }, ...good.slice(1)] },
    { segments: [{ ...good[0], kind: undefined }, ...good.slice(1)] },
    { segments: [{ ...good[0], kind: '' }, ...good.slice(1)] },
    { endUs: null },
    { startUs: 0, endUs: Number.MAX_SAFE_INTEGER + 1, segments: [{ kind: 'setup', startUs: 0, endUs: Number.MAX_SAFE_INTEGER + 1, transformUs: Number.MAX_SAFE_INTEGER, moduleEvaluationUs: 1, otherUs: 0 }] },
  ];
  for (const change of changes) {
    const summary = buildSummary([activityRecord(change)], { rootDir });
    assert.equal(summary.activities.suite.length, 7);
    for (const key of ['transformUs', 'moduleEvaluationUs', 'otherUs']) assert.deepEqual(summary.activities[key], Array(7).fill(null));
    assert.match(messages(summary), /Exclusive activity timing is unavailable/);
    assertTables(summary);
  }
  const overlap = buildSummary([activityRecord(changes[7])], { rootDir });
  assert.deepEqual(overlap.activities.wallUs, [0, 0, 0, 0, 0, 0, 1000]);
});

test('concurrent or overlapping test phases merge exclusive activity counters into unassigned exactly like wall time', () => {
  const original = activityRecord();
  for (const tests of [
    [{ ...original.tests[0], concurrent: true }],
    [...original.tests, { ...original.tests[0], id: 2, name: 'overlap', startUs: 1300, endUs: 1600 }],
    [],
  ]) {
    const summary = buildSummary([activityRecord({ tests, warnings: tests.length ? [] : ['Concurrent test work overlaps or can precede Circus event bounds.'] })], { rootDir });
    assert.deepEqual(summary.activities.wallUs, [200, 0, 0, 0, 100, 100, 600]);
    assert.deepEqual(summary.activities.transformUs, [60, 0, 0, 0, 0, 0, 110]);
    assert.deepEqual(summary.activities.moduleEvaluationUs, [100, 0, 0, 0, 5, 0, 230]);
    assert.deepEqual(summary.activities.otherUs, [40, 0, 0, 0, 95, 100, 260]);
    assertTables(summary);
  }
});

test('activity partitions use differences of rounded endpoints, not rounded elapsed differences', () => {
  const summary = buildSummary([activityRecord({ startUs: 1000.49, endUs: 1002.51, tests: [], segments: [
    { kind: 'setup', startUs: 1000.49, endUs: 1000.51, transformUs: 1, moduleEvaluationUs: 0, otherUs: 0 },
    { kind: 'body', startUs: 1000.51, endUs: 1001.49, transformUs: 0, moduleEvaluationUs: 0, otherUs: 0 },
    { kind: 'hook', startUs: 1001.49, endUs: 1001.51, transformUs: 0, moduleEvaluationUs: 1, otherUs: 0 },
    { kind: 'framework', startUs: 1001.51, endUs: 1002.51, transformUs: 0, moduleEvaluationUs: 0, otherUs: 1 },
  ] })], { rootDir });
  assert.equal(summary.suites.wallUs[0], 3);
  assert.deepEqual(summary.activities.wallUs, [1, 0, 1, 1, 0, 0, 0]);
  assert.deepEqual(summary.activities.transformUs, [1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(summary.activities.moduleEvaluationUs, [0, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual(summary.activities.otherUs, [0, 0, 0, 1, 0, 0, 0]);
  assertTables(summary);
});

test('a valid zero-duration capture has measured zero activity for all seven phases', () => {
  const summary = buildSummary([activityRecord({ endUs: 1000, tests: [], segments: [
    { kind: 'setup', startUs: 1000, endUs: 1000, transformUs: 0, moduleEvaluationUs: 0, otherUs: 0 },
  ] })], { rootDir });
  for (const key of ['wallUs', 'transformUs', 'moduleEvaluationUs', 'otherUs']) assert.deepEqual(summary.activities[key], Array(7).fill(0));
  assertTables(summary);
});

test('unknown phase kinds retain valid measured activity under unassigned', () => {
  const input = activityRecord();
  input.segments[0].kind = 'unknown';
  const summary = buildSummary([input], { rootDir });
  assert.equal(summary.activities.wallUs[0], 0);
  assert.deepEqual(rows(summary, 'activities')[6], { suite: 0, phase: 'unassigned', wallUs: 200, transformUs: 60, moduleEvaluationUs: 100, otherUs: 40 });
  assertTables(summary);
});

test('weights actual inspector CPU samples, clips bounds, splits phase intervals and attributes native leaves to their nearest owner', () => {
  const summary = buildSummary([record({ cpuProfile: cpuProfile() })], { rootDir });
  const suite = rows(summary, 'suites')[0];
  assert.equal(suite.mainThreadSampleUs, 1000);
  assert.equal(suite.processCpuUserUs, 600);
  assert.deepEqual(rows(summary, 'costs').map(({ phase, category, owner, sampleUs, heapBytes }) => [phase, category, owner, sampleUs, heapBytes]), [
    ['preTests', 'app', 'app', 200, null],
    ['tests', 'HappyDOM', 'happy-dom', 400, null],
    ['tests', 'gc', '(gc)', 100, null],
    ['tests', 'idle', '(idle)', 100, null],
    ['teardown', 'profiler', 'profiler', 100, null],
    ['profiler', 'profiler', 'profiler', 100, null],
  ]);
  assert.deepEqual(rows(summary, 'hotspots').map(({ function: name, owner, url, line, selfUs }) => [name, owner, url, line, selfUs]), [
    ['query', 'happy-dom', 'node_modules/.pnpm/happy-dom@20.0.0/node_modules/happy-dom/lib/query.js', 4, 400],
    ['nativeCall', 'app', '', null, 200],
    ['post', 'profiler', 'scripts/test-harness/profiling/shard-profiler/recorder.cjs', 100, 200],
    ['(garbage collector)', '(gc)', '', 0, 100],
    ['(idle)', '(idle)', '', 0, 100],
  ]);
  assert.deepEqual(rows(summary, 'testOwners'), [{ test: 0, category: 'HappyDOM', owner: 'happy-dom', sampleUs: 400 }]);
  assert.match(messages(summary), /clipped/);
  assertTables(summary);
});

test('splits a single sample across every phase and test boundary without charging it twice', () => {
  const profile = { startTime: 1000, endTime: 2000, nodes: [{ id: 1, callFrame: frame('render', '/repo/public/app/render.ts') }], samples: [1], timeDeltas: [1000] };
  const summary = buildSummary([record({ cpuProfile: profile })], { rootDir });
  assert.deepEqual(rows(summary, 'costs').map(({ phase, sampleUs }) => [phase, sampleUs]), [['preTests', 200], ['tests', 600], ['teardown', 100], ['profiler', 100]]);
  assert.deepEqual(rows(summary, 'testOwners'), [{ test: 0, category: 'app', owner: 'app', sampleUs: 500 }]);
  assert.equal(summary.hotspots.selfUs[0], 1000);
});

test('beforeAll/afterAll are suite hooks, not test bodies or per-test hooks', () => {
  const input = record({ segments: [
    { kind: 'setup', startUs: 1000, endUs: 1100 },
    { kind: 'profiler', startUs: 1100, endUs: 1150 },
    { kind: 'framework', startUs: 1150, endUs: 1200 },
    { kind: 'hook', startUs: 1200, endUs: 1300, test: null },
    { kind: 'framework', startUs: 1300, endUs: 1400 },
    { kind: 'hook', startUs: 1400, endUs: 1450, test: 1 },
    { kind: 'body', startUs: 1450, endUs: 1600, test: 1 },
    { kind: 'hook', startUs: 1600, endUs: 1650, test: 1 },
    { kind: 'framework', startUs: 1650, endUs: 1700 },
    { kind: 'hook', startUs: 1700, endUs: 1750, test: null },
    { kind: 'framework', startUs: 1750, endUs: 1800 },
    { kind: 'profiler', startUs: 1800, endUs: 1850 },
    { kind: 'teardown', startUs: 1850, endUs: 1950 },
    { kind: 'profiler', startUs: 1950, endUs: 2000 },
  ], cpuProfile: { startTime: 1000, endTime: 2000, nodes: [{ id: 1, callFrame: frame('work', '/repo/public/app/work.ts') }], samples: [1], timeDeltas: [1000] } });
  input.tests[0] = { ...input.tests[0], startUs: 1400, endUs: 1650, bodyUs: 150, hookUs: 100 };
  const summary = buildSummary([input], { rootDir });
  assert.deepEqual([summary.suites.bodyUs[0], summary.suites.hooksUs[0], summary.suites.frameworkUs[0], summary.suites.profilerUs[0]], [150, 250, 250, 150]);
  assert.deepEqual([summary.tests.wallUs[0], summary.tests.bodyUs[0], summary.tests.hooksUs[0]], [250, 150, 100]);
  assert.deepEqual(summary.testOwners.sampleUs, [250]);
  assert.deepEqual(rows(summary, 'costs').map(({ phase, sampleUs }) => [phase, sampleUs]), [['preTests', 100], ['tests', 650], ['teardown', 100], ['profiler', 150]]);
});

test('a failed beforeEach retains hook time without inventing a test body', () => {
  const input = record({ segments: [
    { kind: 'setup', startUs: 1000, endUs: 1200 },
    { kind: 'hook', startUs: 1200, endUs: 1400, test: 1 },
    { kind: 'framework', startUs: 1400, endUs: 1800 },
    { kind: 'teardown', startUs: 1800, endUs: 1900 },
    { kind: 'profiler', startUs: 1900, endUs: 2000 },
  ] });
  input.tests[0] = { ...input.tests[0], status: 'failed', bodyUs: 0, hookUs: 200 };
  const summary = buildSummary([input], { rootDir, jestResults: { testResults: [{ name: input.suite, status: 'failed', assertionResults: [{ fullName: 'group test', status: 'failed', duration: 0.5 }] }] } });
  assert.deepEqual([summary.suites.bodyUs[0], summary.suites.hooksUs[0], summary.suites.frameworkUs[0]], [0, 200, 400]);
  assert.deepEqual([summary.tests.wallUs[0], summary.tests.bodyUs[0], summary.tests.hooksUs[0]], [500, 0, 200]);
  assert.equal(rows(summary, 'tests')[0].status, 'failed');
  assert.equal(rows(summary, 'suites')[0].status, 'failed');
});

test('aborted test event counters remain visible without assigning cleanup samples to the incomplete attempt', () => {
  const input = record({ status: 'error', cpuProfile: cpuProfile() });
  input.tests[0] = { ...input.tests[0], status: 'incomplete', endUs: 1900, bodyUs: 600, cpuUserUs: null, cpuSystemUs: null, heapDeltaBytes: null };
  const summary = buildSummary([input], { rootDir });
  assert.equal(summary.tests.bodyUs[0], 600);
  assert.equal(summary.tests.processCpuUserUs[0], null);
  assert.deepEqual(summary.testOwners.test, []);
  assert.equal(summary.suites.mainThreadSampleUs[0], 1000);
  assert.match(messages(summary), /Incomplete test attempts/);
});

test('CPU samples reuse resolved call frames instead of rebuilding hotspots for each sample', () => {
  let reads = 0;
  const callFrame = { ...frame('work'), get url() { reads++; return '/repo/public/app/work.ts'; } };
  const profile = { startTime: 1000, endTime: 2000, nodes: [{ id: 1, callFrame }], samples: Array(1000).fill(1), timeDeltas: Array(1000).fill(1) };
  const summary = buildSummary([record({ cpuProfile: profile })], { rootDir });
  assert.equal(summary.suites.mainThreadSampleUs[0], 1000);
  assert.deepEqual(summary.hotspots.selfUs, [1000]);
  assert.equal(rows(summary, 'hotspots')[0].url, 'public/app/work.ts');
  assert.ok(reads <= 4, `read the same frame URL ${reads} times`);
});

test('heap samples, not selfSize plus samples, count allocations; survivor-only profiles remain separate', () => {
  const fallback = heapProfile('teardown', false);
  delete fallback.profile.samples;
  const summary = buildSummary([record({ cpuProfile: cpuProfile(), heapProfiles: [heapProfile(), heapProfile('setup', false), fallback] })], { rootDir });
  const suite = rows(summary, 'suites')[0];
  assert.equal(suite.heapSampleBytes, 448);
  assert.equal(suite.retainedHeapSampleBytes, 19448);
  const costs = rows(summary, 'costs');
  assert.deepEqual(costs.filter((entry) => entry.heapBytes).map(({ phase, owner, sampleUs, heapBytes }) => [phase, owner, sampleUs, heapBytes]), [
    ['tests', 'happy-dom', 400, 256], ['tests', 'app', 0, 192],
  ]);
  assert.deepEqual(costs.filter((entry) => entry.retainedHeapBytes).map(({ phase, owner, retainedHeapBytes }) => [phase, owner, retainedHeapBytes]), [
    ['preTests', 'happy-dom', 256], ['preTests', 'app', 192], ['teardown', 'happy-dom', 3000], ['teardown', 'app', 16000],
  ]);
  assert.equal(costs.find(({ phase, owner }) => phase === 'preTests' && owner === 'app').heapBytes, null);
  assert.equal(costs.find(({ phase, owner }) => phase === 'tests' && owner === 'app').retainedHeapBytes, null);
  assert.equal(costs.find(({ phase, owner }) => phase === 'tests' && owner === '(idle)').heapBytes, 0);
  assert.match(messages(summary), /survivors, not allocation volume/);
  assert.match(messages(summary), /selfSize is used once/);
  assert.equal(summary.tests.heapDeltaBytes[0], -1024);
});

test('empty heap samples use node selfSize once and absent CPU stays null in heap-only costs', () => {
  const heap = heapProfile('setup');
  heap.profile.samples = [];
  const summary = buildSummary([record({ heapProfiles: [heap] })], { rootDir });
  assert.equal(summary.suites.heapSampleBytes[0], 19000);
  assert.deepEqual(rows(summary, 'costs').map(({ owner, sampleUs, heapBytes }) => [owner, sampleUs, heapBytes]), [['happy-dom', null, 3000], ['app', null, 16000]]);
});

test('normalizes Windows and file URLs and recognizes pnpm/scoped/local packages before the repository prefix', () => {
  const urls = [
    'file:///C:/work/repo/public/app/a%20b.ts',
    'C:\\work\\repo\\packages\\grafana-ui\\src\\index.ts',
    'C:/work/repo/node_modules/.pnpm/@scope+lib@1/node_modules/@scope/lib/index.js',
    'C:\\work\\repo\\node_modules\\sucrase\\dist\\index.js',
    'C:/work/repo/node_modules/@jest/core/index.js',
    'node:internal/timers',
    'node:inspector',
    'C:/work/repo/node_modules/local-package/index.js',
    'C:/outside/file.js',
  ];
  const profile = { startTime: 1000, endTime: 2000, nodes: urls.map((url, i) => ({ id: i + 1, callFrame: frame(`f${i}`, url) })), samples: urls.map((_, i) => i + 1), timeDeltas: urls.map(() => 100) };
  const summary = buildSummary([record({ suite: 'file:///C:/work/repo/public/app/a%20b.test.ts', cpuProfile: profile })], { rootDir: 'C:\\work\\repo', selectedSuites: ['public/app/a b.test.ts'] }, { top: 100 });
  assert.equal(rows(summary, 'suites')[0].path, 'public/app/a b.test.ts');
  assert.equal(summary.completeness.missingSelectedSuites, 0);
  assert.deepEqual(rows(summary, 'costs').map(({ category, owner }) => `${category}:${owner}`).sort(), [
    'app:app', 'workspace:workspace:grafana-ui', 'library:@scope/lib', 'Sucrase:sucrase', 'node/Jest:@jest/core', 'node/Jest:node', 'profiler:profiler', 'library:local-package', 'other:(other)',
  ].sort());
  assert.equal(summary.hotspots.selfUs.length, 8);
  assert.equal(summary.sizeLimit.top, 8);
  assert.ok(rows(summary, 'hotspots').some((entry) => entry.url === 'public/app/a b.ts' && entry.line === 0));
});

test('appends JSDOM, ts-jest and TypeScript categories without changing existing category indices', () => {
  const summary = buildSummary([record()], { rootDir });
  assert.deepEqual(summary.categories, ['idle', 'gc', 'profiler', 'node/Jest', 'HappyDOM', 'Sucrase', 'app', 'workspace', 'library', 'other', 'JSDOM', 'ts-jest', 'TypeScript']);
});

for (const windows of [false, true]) {
  test(`attributes CPU and heap samples to exact jsdom/compiler packages, including native leaves (${windows ? 'Windows' : 'POSIX'})`, () => {
    const root = windows ? 'C:\\work\\repo' : rootDir;
    const forwardRoot = root.replace(/\\/g, '/');
    const cases = [
      ['node_modules/jsdom/lib/api.js', 'JSDOM', 'jsdom'],
      ['node_modules/jest-environment-jsdom/build/index.js', 'JSDOM', 'jest-environment-jsdom'],
      ['node_modules/.pnpm/ts-jest@29.0.0/node_modules/ts-jest/dist/index.js', 'ts-jest', 'ts-jest'],
      ['node_modules/.pnpm/typescript@5.0.0/node_modules/typescript/lib/typescript.js', 'TypeScript', 'typescript'],
      ['public/app/typescript.ts', 'app', 'app'],
      ['node_modules/typescript-helper/index.js', 'library', 'typescript-helper'],
      ['node_modules/jsdom-helper/index.js', 'library', 'jsdom-helper'],
      ['node_modules/@scope/ts-jest/index.js', 'library', '@scope/ts-jest'],
    ];
    const head = { id: 1, callFrame: frame('(root)'), selfSize: 0, children: [] };
    const nodes = [{ id: 1, callFrame: head.callFrame, children: [] }];
    const samples = [];
    const heapSamples = [];
    for (const [i, [relative]] of cases.entries()) {
      const absolute = `${forwardRoot}/${relative}`;
      const url = i % 2 === 0 ? (windows ? absolute.replace(/\//g, '\\') : absolute) : `file://${windows ? '/' : ''}${absolute}`;
      const parent = { id: 2 + i * 2, callFrame: frame(`function${i}`, url), selfSize: 9999, children: [] };
      const leaf = { id: parent.id + 1, callFrame: frame(`native${i}`, '', -1), selfSize: 9999, children: [] };
      parent.children.push(leaf);
      head.children.push(parent);
      nodes[0].children.push(parent.id);
      nodes.push({ id: parent.id, callFrame: parent.callFrame, children: [leaf.id] }, { id: leaf.id, callFrame: leaf.callFrame, children: [] });
      samples.push(parent.id, leaf.id);
      heapSamples.push({ nodeId: parent.id, size: (i + 1) * 8 }, { nodeId: leaf.id, size: (i + 1) * 16 });
    }
    const summary = buildSummary([record({
      tests: [], segments: [{ kind: 'setup', startUs: 1000, endUs: 2000 }],
      cpuProfile: { startTime: 1000, endTime: 1800, nodes, samples, timeDeltas: samples.map(() => 50) },
      heapProfiles: [{ phase: 'preTests', includeCollected: true, profile: { head, samples: heapSamples } }],
    })], { rootDir: root });
    const costs = rows(summary, 'costs');
    assert.equal(costs.length, cases.length);
    for (const [i, [, category, owner]] of cases.entries()) {
      const cost = costs.find((row) => row.owner === owner);
      assert.ok(cost, owner);
      assert.deepEqual([cost.phase, cost.category, cost.sampleUs, cost.heapBytes], ['preTests', category, 100, (i + 1) * 24]);
    }
    assert.equal(summary.suites.mainThreadSampleUs[0], 800);
    assert.equal(summary.suites.heapSampleBytes[0], 864);
    assertTables(summary);
  });
}

test('keeps selected missing/failed suites and Jest-only suites with null instrumentation and final-duration fallback', () => {
  const metadata = { rootDir, selectedSuites: ['public/app/z.test.ts', 'public/app/a.test.ts', 'public/app/missing.test.ts'], jestResults: {
    success: false, numTotalTests: 2, testResults: [
      { name: '/repo/public/app/z.test.ts', status: 'failed', startTime: 10, endTime: 30, assertionResults: [{ fullName: 'cannot start', status: 'failed', duration: 1.25, invocations: 2 }] },
      { name: '/repo/public/app/extra.test.ts', status: 'pending', assertionResults: [{ fullName: 'skipped', status: 'pending', duration: null }] },
    ],
  } };
  const summary = buildSummary([record()], metadata);
  const suites = rows(summary, 'suites');
  assert.deepEqual(suites.map(({ path, status }) => [path, status]), [['public/app/a.test.ts', 'complete'], ['public/app/extra.test.ts', 'pending'], ['public/app/missing.test.ts', 'missing'], ['public/app/z.test.ts', 'failed']]);
  assert.deepEqual(summary.completeness, { expectedSuites: 3, recordedSelectedSuites: 1, missingSelectedSuites: 2 });
  assert.equal(suites[3].wallUs, 20000);
  for (const column of ['processCpuUserUs', 'heapStartKiB', 'moduleUniques', 'moduleSourceBytes', 'gcCount', 'preTestsUs', 'mainThreadSampleUs']) assert.equal(suites[3][column], null, column);
  assert.deepEqual(rows(summary, 'tests').slice(1).map(({ suite, name, attempt, source, wallUs, bodyUs, processCpuUserUs, concurrent }) => [suite, name, attempt, source, wallUs, bodyUs, processCpuUserUs, concurrent]), [
    [1, 'skipped', 1, 1, null, null, null, null], [3, 'cannot start', 2, 1, 1250, null, null, null],
  ]);
  assert.equal(summary.metadata.jestResults, undefined);
  assert.equal(summary.metadata.selectedSuites, undefined);
  assert.deepEqual(summary.jest, { success: false, numTotalTests: 2 });
  assert.match(messages(summary), /Raw suite record is missing/);
});

test('one final Jest result is not copied into earlier raw captures or used to duplicate missing assertions', () => {
  const first = record({ startUs: 900, status: 'error', tests: [] });
  const last = record();
  const summary = buildSummary([last, first], { rootDir, jestResults: { testResults: [{ name: last.suite, status: 'passed', assertionResults: [
    { fullName: 'group test', status: 'passed', duration: 0.5 },
    { fullName: 'missing raw test', status: 'passed', duration: 0.1 },
  ] }] } });
  assert.deepEqual(rows(summary, 'suites').map(({ status, recordStatus }) => [status, recordStatus]), [['error', 'error'], ['passed', 'complete']]);
  assert.deepEqual(rows(summary, 'tests').map(({ suite, name, source }) => [suite, name, source]), [[1, 'group test', 0], [1, 'missing raw test', 1]]);
  assert.match(messages(summary), /Only the last capture receives/);
});

test('duplicate Jest suite results remain separate when their raw captures cannot be matched reliably', () => {
  const input = record();
  const summary = buildSummary([input], { rootDir, selectedSuites: [input.suite], jestResults: { testResults: [
    { name: input.suite, status: 'passed', startTime: 10, endTime: 11, assertionResults: [{ fullName: 'group test', status: 'passed', duration: 0.5 }] },
    { name: `/repo/${input.suite}`, status: 'failed', startTime: 20, endTime: 22, assertionResults: [{ fullName: 'other project', status: 'failed', duration: 0.2 }] },
  ] } });
  assert.deepEqual(rows(summary, 'suites').map(({ status, recordStatus, wallUs, processCpuUserUs }) => [status, recordStatus, wallUs, processCpuUserUs]), [
    ['complete', 'complete', 1000, 600], ['passed', null, 1000, null], ['failed', null, 2000, null],
  ]);
  assert.deepEqual(rows(summary, 'tests').map(({ suite, name, source }) => [suite, name, source]), [[0, 'group test', 0], [1, 'group test', 1], [2, 'other project', 1]]);
  assert.equal(summary.completeness.missingSelectedSuites, 0);
  assert.match(messages(summary), /Multiple Jest results/);
  assert.match(messages(summary), /not matched to a raw capture/);
});

test('without Jest results, recorder completion is not advertised as a verified suite outcome', () => {
  const input = record();
  input.tests[0].status = 'failed';
  const summary = buildSummary([input], { rootDir });
  assert.equal(rows(summary, 'suites')[0].recordStatus, 'complete');
  assert.equal(rows(summary, 'tests')[0].status, 'failed');
  assert.match(messages(summary), /not a verified Jest outcome/);
});

test('Jest fallback suite durations preserve fractional milliseconds and distinguish zero from missing', () => {
  const summary = buildSummary([], { rootDir, selectedSuites: ['a', 'b', 'c', 'd', 'e'], jestResults: { testResults: [
    { name: 'a', startTime: 10.25, endTime: 11.5 },
    { name: 'b', perfStats: { start: 20.1, end: 21.65 } },
    { name: 'c', perfStats: { runtime: 0.125 } },
    { name: 'd', startTime: 10, endTime: 10 },
    { name: 'e' },
  ] } });
  assert.deepEqual(summary.suites.wallUs, [1250, 1550, 125, 0, null]);
});

test('preserves retry attempts, duplicate test names, raw order and missing Jest assertions without duplicating final retry outcomes', () => {
  const input = record({ tests: [
    { id: 1, name: 'same', attempt: 1, status: 'failed', startUs: 1200, endUs: 1300 },
    { id: 2, name: 'same', attempt: 2, status: 'passed', startUs: 1300, endUs: 1400 },
    { id: 3, name: 'same', attempt: 1, status: 'passed', startUs: 1400, endUs: 1500 },
  ] });
  const metadata = { rootDir, jestResults: { testResults: [{ name: '/repo/public/app/a.test.ts', status: 'passed', assertionResults: [
    { fullName: 'same', status: 'passed', duration: 0.1 }, { fullName: 'same', status: 'passed', duration: 0.1 }, { fullName: 'missing', status: 'failed', duration: 0 },
  ] }] } };
  const summary = buildSummary([input], metadata);
  assert.deepEqual(rows(summary, 'tests').map(({ id, name, attempt, status, wallUs }) => [id, name, attempt, status, wallUs]), [[1, 'same', 1, 'failed', 100], [2, 'same', 2, 'passed', 100], [3, 'same', 1, 'passed', 100], [null, 'missing', 1, 'failed', 0]]);
  assert.match(messages(summary), /Some Jest assertions have no raw test record/);
  assert.equal(rows(summary, 'suites')[0].status, 'passed');
});

test('nested recorder names match Jest fullName and ancestor/title fallbacks using spaces, not > separators', () => {
  const input = record();
  input.tests = [
    { ...input.tests[0], name: 'outer inner renders > details' },
    { ...input.tests[0], id: 2, name: 'outer inner second', startUs: 1700, endUs: 1800 },
  ];
  const summary = buildSummary([input], { rootDir, jestResults: { testResults: [{ name: input.suite, status: 'passed', assertionResults: [
    { fullName: 'outer inner renders > details', ancestorTitles: ['outer', 'inner'], title: 'renders > details', status: 'passed', duration: 0.5 },
    { ancestorTitles: ['outer', 'inner'], title: 'second', status: 'passed', duration: 0.1 },
  ] }] } });
  assert.deepEqual(rows(summary, 'tests').map(({ name, source }) => [name, source]), [['outer inner renders > details', 0], ['outer inner second', 0]]);
  assert.doesNotMatch(messages(summary), /Some Jest assertions have no raw test record/);
});

test('lazy descriptors load once in header-sorted capture order, process before the next load, and match eager output', () => {
  const inputs = [
    record({ suite: 'public/app/z.test.ts', pid: 99, cpuProfile: cpuProfile(), heapProfiles: [heapProfile()] }),
    record({ startUs: 1100, pid: 3, cpuProfile: cpuProfile(), heapProfiles: [heapProfile()] }),
    record({ pid: 20, cpuProfile: cpuProfile(), heapProfiles: [heapProfile()] }),
    record({ suite: 'public/app/b.test.ts' }),
    record({ pid: 10, cpuProfile: cpuProfile(), heapProfiles: [heapProfile()] }),
  ];
  const metadata = { rootDir, selectedSuites: ['public/app/missing.test.ts', ...inputs.map((input) => input.suite)], jestResults: { testResults: [
    { name: '/repo/public/app/a.test.ts', status: 'passed', assertionResults: [{ fullName: 'group test', status: 'passed', duration: 0.5 }] },
  ] } };
  const expected = buildSummary(inputs, metadata);
  const events = [];
  const calls = [0, 0, 0, 0, 0];
  const descriptors = inputs.map((input, index) => {
    if (index === 3) return input;
    const { schemaVersion, suite, startUs, pid } = input;
    const serialized = JSON.stringify(input);
    return Object.freeze({ schemaVersion, suite: `/repo/${suite}`, startUs, pid, load() {
      calls[index]++;
      events.push(`load:${index}`);
      const loaded = JSON.parse(serialized);
      const heapProfiles = loaded.heapProfiles;
      Object.defineProperty(loaded, 'heapProfiles', { get() {
        events.push(`process:${index}`);
        return heapProfiles;
      } });
      return loaded;
    } });
  });
  const actual = buildSummary(Object.freeze(descriptors), metadata);
  assert.deepEqual(calls, [1, 1, 1, 0, 1]);
  assert.deepEqual(events, ['load:4', 'process:4', 'load:2', 'process:2', 'load:1', 'process:1', 'load:0', 'process:0']);
  assert.deepEqual(actual, expected);
  assertTables(actual);
});

test('lazy descriptors validate loaded schema/suite and propagate load failures without treating them as missing records', () => {
  for (const loaded of [null, { schemaVersion: 2 }, Promise.resolve(record())]) {
    let calls = 0;
    const descriptor = { schemaVersion: 1, suite: 'public/app/a.test.ts', startUs: 1000, pid: 17, load() { calls++; return loaded; } };
    assert.throws(() => buildSummary([descriptor], { rootDir }), /must return a schemaVersion 1 record synchronously/);
    assert.equal(calls, 1);
  }
  const descriptor = { schemaVersion: 1, suite: 'public/app/a.test.ts', startUs: 1000, pid: 17, load: () => record({ suite: 'public/app/wrong.test.ts' }) };
  assert.throws(() => buildSummary([descriptor], { rootDir }), /Lazy record suite does not match descriptor: expected public\/app\/a.test.ts, got public\/app\/wrong.test.ts/);
  const failure = new Error('Cannot decode raw capture');
  let calls = 0;
  assert.throws(() => buildSummary([{ ...descriptor, load() { calls++; throw failure; } }], { rootDir }), (error) => error === failure);
  assert.equal(calls, 1);
});

test('suite order and output are deterministic regardless of record and selected-roster order', () => {
  const a = record({ suite: 'public/app/z.test.ts' });
  const b = record({ suite: 'public/app/b.test.ts' });
  const one = buildSummary([a, b], { rootDir, selectedSuites: [a.suite, b.suite] });
  const two = buildSummary([b, a], { rootDir, selectedSuites: [b.suite, a.suite] });
  assert.deepEqual(one, two);
  assert.deepEqual(rows(one, 'tests').map(({ suite, name }) => [suite, name]), [[0, 'group test'], [1, 'group test']]);
});

test('overlapping or out-of-order segments are unassigned instead of double-counted', () => {
  for (const segments of [
    [{ kind: 'body', startUs: 1000, endUs: 1600 }, { kind: 'hook', startUs: 1500, endUs: 2000 }],
    [{ kind: 'body', startUs: 1500, endUs: 2000 }, { kind: 'setup', startUs: 1000, endUs: 1500 }],
  ]) {
    const summary = buildSummary([record({ segments, cpuProfile: cpuProfile() })], { rootDir });
    assert.deepEqual([summary.suites.wallUs[0], summary.suites.unassignedUs[0], summary.suites.bodyUs[0], summary.suites.preTestsUs[0]], [1000, 1000, 0, 0]);
    assert.ok(rows(summary, 'costs').every(({ phase }) => phase === 'unassigned'));
    assert.equal(summary.costs.sampleUs.reduce((sum, us) => sum + us, 0), 1000);
    assert.deepEqual(summary.testOwners.test, []);
    assert.match(messages(summary), /Out-of-order or overlapping segments/);
  }
});

test('overlapping tests null per-test attribution and mark test phases unassigned, even without recorder concurrency flags', () => {
  const input = record();
  input.tests.push({ ...input.tests[0], id: 2, name: 'overlap', startUs: 1300, endUs: 1600 });
  input.cpuProfile = cpuProfile();
  const summary = buildSummary([input], { rootDir });
  assert.deepEqual(summary.tests.concurrent, [true, true]);
  assert.deepEqual(summary.tests.processCpuUserUs, [null, null]);
  assert.deepEqual(summary.tests.processCpuSystemUs, [null, null]);
  assert.deepEqual(summary.tests.heapDeltaBytes, [null, null]);
  assert.equal(summary.suites.unassignedUs[0], 600);
  assert.equal(summary.suites.preTestsUs[0], 200);
  assert.equal(summary.testOwners.test.length, 0);
  assert.equal(summary.suites.processCpuUserUs[0], 600);
  assert.match(messages(summary), /Concurrent or overlapping tests/);
});

test('a concurrent-suite warning preserves ambiguity even when failure prevents test records', () => {
  const summary = buildSummary([record({ tests: [], cpuProfile: cpuProfile(), warnings: [
    'Concurrent test work overlaps or can precede Circus event bounds; affected per-test CPU/heap deltas are null. Body/hook times are event intervals, not concurrent execution attribution.',
  ] })], { rootDir });
  assert.equal(summary.suites.unassignedUs[0], 600);
  assert.equal(summary.suites.bodyUs[0], 0);
  assert.ok(rows(summary, 'costs').every(({ phase }) => phase !== 'tests'));
});

test('failed GC observation is unavailable, not a measured zero collections', () => {
  const summary = buildSummary([record({ gc: [], warnings: ['GC observation unavailable: unsupported entry type'] })], { rootDir });
  assert.equal(summary.suites.gcCount[0], null);
  assert.equal(summary.suites.gcUs[0], null);
  const measured = buildSummary([record({ gc: [] })], { rootDir });
  assert.equal(measured.suites.gcCount[0], 0);
  assert.equal(measured.suites.gcUs[0], 0);
});

test('partial records keep unavailable metrics null and gaps are unassigned, not invented framework time', () => {
  const partial = record({ endUs: null, points: [], modules: undefined, gc: undefined, segments: [] });
  const summary = buildSummary([partial], { rootDir });
  for (const column of ['wallUs', 'bodyUs', 'profilerUs', 'processCpuUserUs', 'heapStartKiB', 'heapEndKiB', 'moduleUniques', 'gcUs']) assert.equal(summary.suites[column][0], null, column);
  const gaps = buildSummary([record({ segments: [{ kind: 'body', startUs: 1300, endUs: 1700 }] })], { rootDir });
  assert.deepEqual([gaps.suites.bodyUs[0], gaps.suites.frameworkUs[0], gaps.suites.unassignedUs[0]], [400, 0, 600]);
});

test('repeated module evaluation does not multiply source bytes, and unknown source sizes do not become zero', () => {
  const summary = buildSummary([record({ modules: [
    { path: '/repo/a.ts', evaluations: 2, sourceBytes: 100 }, { path: 'file:///repo/a.ts', evaluations: 3, sourceBytes: 100 }, { path: 'b.ts', evaluations: 1, sourceBytes: 50 },
  ] })], { rootDir });
  assert.deepEqual([summary.suites.moduleUniques[0], summary.suites.moduleEvaluations[0], summary.suites.moduleSourceBytes[0]], [2, 6, 150]);
  const unknown = buildSummary([record({ modules: [{ path: 'a.ts', evaluations: 1, sourceBytes: null }] })]);
  assert.deepEqual([unknown.suites.moduleSourceBytes[0], unknown.suites.moduleSourceUnknown[0]], [null, 1]);
});

test('signed CPU deltas reorder timestamp/node pairs without clamping time or dropping later samples', () => {
  const names = ['first', 'lateA', 'earlyA', 'middle', 'lateB', 'earlyB', 'last'];
  const profile = freeze({ startTime: 1000, endTime: 1400,
    nodes: names.map((name, i) => ({ id: i + 1, callFrame: frame(name, i === 2 ? '/repo/node_modules/happy-dom/index.js' : i === 5 ? '/repo/node_modules/sucrase/index.js' : '/repo/public/app/work.ts') })),
    samples: [1, 2, 3, 4, 5, 6, 7], timeDeltas: [100, 24, -4, 15, 100, -3, 102],
  });
  const summary = buildSummary([record({ cpuProfile: profile })], { rootDir });
  assert.equal(summary.suites.mainThreadSampleUs[0], 334);
  assert.deepEqual(Object.fromEntries(rows(summary, 'hotspots').map((row) => [row.function, row.selfUs])), { first: 100, last: 99, earlyB: 97, earlyA: 20, middle: 11, lateA: 4, lateB: 3 });
  assert.deepEqual(rows(summary, 'costs').map(({ phase, owner, sampleUs }) => [phase, owner, sampleUs]), [
    ['preTests', 'happy-dom', 20], ['preTests', 'sucrase', 65], ['preTests', 'app', 115],
    ['tests', 'sucrase', 32], ['tests', 'app', 102],
  ]);
  assert.deepEqual(rows(summary, 'testOwners'), [{ test: 0, category: 'app', owner: 'app', sampleUs: 102 }]);
  assert.match(messages(summary), /Reordered CPU sample\/timestamp pairs for 2 negative timeDeltas/);
  assert.doesNotMatch(messages(summary), /Invalid CPU timeDelta/);
});

test('reordered equal timestamps preserve input tie order and do not extrapolate a profile tail', () => {
  const profile = freeze({ startTime: 1000, endTime: 1500,
    nodes: ['first', 'later', 'earlier', 'tie', 'last'].map((name, i) => ({ id: i + 1, callFrame: frame(name, '/repo/public/app/work.ts') })),
    samples: [1, 2, 3, 4, 5], timeDeltas: [100, 200, -100, 100, 100],
  });
  const summary = buildSummary([record({ cpuProfile: profile })], { rootDir });
  assert.equal(summary.suites.mainThreadSampleUs[0], 400);
  assert.deepEqual(Object.fromEntries(rows(summary, 'hotspots').map((row) => [row.function, row.selfUs])), { earlier: 100, first: 100, last: 100, later: 100 });
  assert.equal(summary.costs.sampleUs.reduce((sum, us) => sum + us, 0), 400);
});

test('normalized CPU samples still clip to suite bounds without double counting', () => {
  const profile = cpuProfile();
  profile.timeDeltas = [300, -4, 400, 100, 404];
  const summary = buildSummary([record({ cpuProfile: freeze(profile) })], { rootDir });
  assert.equal(summary.suites.mainThreadSampleUs[0], 1000);
  assert.equal(summary.costs.sampleUs.reduce((sum, us) => sum + us, 0), 1000);
  assert.deepEqual(rows(summary, 'costs').filter(({ phase }) => phase === 'preTests').map(({ owner, sampleUs }) => [owner, sampleUs]), [['app', 4], ['(idle)', 196]]);
  assert.match(messages(summary), /clipped/);
});

test('negative deltas with impossible timestamps or possible integer overflow are not repaired by guessing', () => {
  for (const changes of [
    { timeDeltas: [300, -500, 400, 100, 300] },
    { timeDeltas: [300, -1, 2000, 100, 300] },
    { endTime: 2147484600, timeDeltas: [300, -1, 400, 100, 300] },
  ]) {
    const summary = buildSummary([record({ cpuProfile: { ...cpuProfile(), ...changes } })], { rootDir });
    assert.equal(summary.suites.mainThreadSampleUs[0], 200);
    assert.match(messages(summary), /Negative CPU timeDeltas cannot be normalized/);
    assert.doesNotMatch(messages(summary), /Reordered CPU/);
  }
});

test('a finite out-of-order prefix can be normalized before an unreadable delta stops timing', () => {
  const profile = cpuProfile();
  profile.timeDeltas = [300, -4, null, 100, 300];
  const summary = buildSummary([record({ cpuProfile: profile })], { rootDir });
  assert.equal(summary.suites.mainThreadSampleUs[0], 200);
  assert.deepEqual(rows(summary, 'costs').map(({ owner, sampleUs }) => [owner, sampleUs]), [['app', 4], ['(idle)', 196]]);
  assert.match(messages(summary), /Invalid CPU timeDelta/);
  assert.match(messages(summary), /Reordered CPU sample\/timestamp pairs for 1 negative timeDeltas/);
});

test('invalid CPU timing never substitutes hit counts or invents time after a broken delta', () => {
  const profile = cpuProfile();
  profile.timeDeltas = [300, null, 400, 100, 300];
  const partial = buildSummary([record({ cpuProfile: profile })], { rootDir });
  assert.equal(partial.suites.mainThreadSampleUs[0], 200);
  assert.match(messages(partial), /Invalid CPU timeDelta/);
  delete profile.timeDeltas;
  const missing = buildSummary([record({ cpuProfile: profile })], { rootDir });
  assert.equal(missing.suites.mainThreadSampleUs[0], null);
  assert.equal(missing.costs.suite.length, 0);
  assert.match(messages(missing), /CPU profile timing is invalid/);
});

test('deep CPU and heap ancestry is iterative and leaf ownership is inherited', () => {
  const depth = 12000;
  const nodes = Array.from({ length: depth }, (_, i) => ({ id: i + 1, callFrame: frame('native', i === 0 ? '/repo/node_modules/deep/index.js' : ''), children: i + 1 < depth ? [i + 2] : [] }));
  let head = { id: depth, callFrame: frame('native'), selfSize: 1, children: [] };
  for (let id = depth - 1; id >= 1; id--) head = { id, callFrame: nodes[id - 1].callFrame, selfSize: 0, children: [head] };
  const summary = buildSummary([record({ cpuProfile: { startTime: 1000, endTime: 2000, nodes, samples: [depth, depth], timeDeltas: [500, 500] }, heapProfiles: [{ phase: 'tests', includeCollected: true, profile: { head, samples: [{ nodeId: depth, size: 123 }] } }] })], { rootDir });
  assert.equal(summary.suites.mainThreadSampleUs[0], 1000);
  assert.equal(summary.suites.heapSampleBytes[0], 123);
  assert.ok(rows(summary, 'costs').every(({ owner }) => owner === 'deep'));
  assert.equal(rows(summary, 'hotspots')[0].selfUs, 1000);
});

function capacityFixture() {
  let count = 0;
  return Array.from({ length: 352 }, (_, suite) => {
    const tests = Array.from({ length: suite < 76 ? 13 : 12 }, (_, index) => {
      const id = ++count;
      return { id: index + 1, name: `suite ${suite} test ${id} ${'checks a realistic dashboard interaction '.repeat(4)}`.slice(0, 150), attempt: 1, status: 'passed', startUs: 1200 + index * 40, endUs: 1230 + index * 40, bodyUs: 20, hookUs: 5, cpuUserUs: 20, cpuSystemUs: 1, heapDeltaBytes: -100, concurrent: false };
    });
    return activityRecord({ suite: `public/app/feature${suite}/view.test.tsx`, tests, cpuProfile: cpuProfile(), heapProfiles: [heapProfile()] });
  });
}

test('352 suites and 4300 realistic named test rows fit 2,000,000 bytes without discarding details or shortening names', () => {
  const records = capacityFixture();
  const selectedSuites = records.map((item) => item.suite);
  const summary = buildSummary(records, { rootDir, selectedSuites, workers: 8, revision: 'abc', node: '22.16.0', config: { cpu: true, heap: true }, jestResults: { testResults: records.map((item) => ({ name: `/repo/${item.suite}`, status: 'passed', assertionResults: item.tests.map((t) => ({ fullName: t.name, status: 'passed', duration: 0.03 })) })) } });
  assert.equal(summary.suites.path.length, 352);
  assert.equal(summary.tests.name.length, 4300);
  assert.equal(summary.completeness.missingSelectedSuites, 0);
  assert.equal(summary.sizeLimit.truncated, false);
  assert.equal(summary.sizeLimit.shortenedStrings, 0);
  assert.equal(summary.hotspots.suite.length, 1760);
  assert.ok(summary.sizeLimit.bytes <= 2000000, `${summary.sizeLimit.bytes} bytes`);
  assert.equal(summary.tests.wallUs.reduce((sum, us) => sum + us, 0), 129000);
  assert.equal(summary.activities.suite.length, 2464);
  assert.equal(summary.activities.transformUs.reduce((sum, us) => sum + us, 0), 59840);
  assert.equal(summary.activities.moduleEvaluationUs.reduce((sum, us) => sum + us, 0), 117920);
  assert.equal(summary.activities.otherUs.reduce((sum, us) => sum + us, 0), 174240);
  assertTables(summary);
});

test('a lazy 352-suite shard with dense owner details stays within budget without losing core rows or suite totals', () => {
  let loads = 0;
  const descriptors = capacityFixture().map((input, suiteIndex) => ({ schemaVersion: 1, suite: input.suite, startUs: input.startUs, pid: input.pid, load() {
    loads++;
    const nodes = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, callFrame: frame(`work${i}`, `/repo/node_modules/pkg-${suiteIndex}-${i}-${'owner'.repeat(10)}/index.js`) }));
    return { ...input, cpuProfile: { startTime: 1000, endTime: 2000, nodes, samples: nodes.map(({ id }) => id), timeDeltas: Array(200).fill(5) } };
  } }));
  const summary = buildSummary(descriptors, { rootDir, selectedSuites: descriptors.map(({ suite }) => suite) });
  assert.equal(loads, 352);
  assert.equal(summary.suites.path.length, 352);
  assert.equal(summary.tests.name.length, 4300);
  assert.equal(summary.completeness.missingSelectedSuites, 0);
  assert.equal(summary.suites.mainThreadSampleUs.reduce((sum, us) => sum + us, 0), 352000);
  assert.equal(summary.suites.heapSampleBytes.reduce((sum, bytes) => sum + bytes, 0), 157696);
  assert.ok(summary.sizeLimit.removedCosts > 0);
  assert.equal(summary.activities.suite.length, 2464);
  assert.equal(summary.activities.wallUs.reduce((sum, us) => sum + us, 0), 352000);
  assert.equal(summary.activities.transformUs.reduce((sum, us) => sum + us, 0), 59840);
  assert.equal(summary.activities.moduleEvaluationUs.reduce((sum, us) => sum + us, 0), 117920);
  assert.equal(summary.activities.otherUs.reduce((sum, us) => sum + us, 0), 174240);
  assert.ok(summary.activities.transformUs.every((us) => us !== null));
  assert.equal(summary.sizeLimit.shortenedStrings, 0);
  assert.ok(summary.sizeLimit.bytes <= 2000000);
  assertTables(summary);
});

test('budget drops optional details before deterministic Unicode string shortening and retains every suite/test row', () => {
  const input = record({ cpuProfile: cpuProfile(), heapProfiles: [heapProfile()] });
  input.tests = Array.from({ length: 40 }, (_, id) => ({ ...input.tests[0], id: id + 1, name: `${'測試😀'.repeat(300)} distinct ${id}`, startUs: 1200 + id * 10, endUs: 1205 + id * 10 }));
  const summary = buildSummary([input], { rootDir }, { maxBytes: 14000 });
  assert.equal(summary.tests.name.length, 40);
  assert.equal(summary.suites.path.length, 1);
  assert.ok(summary.sizeLimit.bytes <= 14000);
  assert.ok(summary.sizeLimit.shortenedStrings >= 40);
  assert.ok(summary.sizeLimit.removedHotspots > 0);
  assert.ok(summary.sizeLimit.removedCosts > 0);
  assert.ok(summary.sizeLimit.removedTestOwners > 0);
  const names = rows(summary, 'tests').map(({ name }) => name);
  assert.equal(new Set(names).size, 40);
  assert.match(names[0], /^測試😀.*~[a-f0-9]{16}$/u);
  assert.equal(summary.costs.suite.length, 0);
  assert.equal(summary.suites.heapSampleBytes[0], 448);
  assert.equal(summary.suites.mainThreadSampleUs[0], 1000);
  assert.deepEqual(buildSummary([input], { rootDir }, { maxBytes: 14000 }), summary);
  assertTables(summary);
});

test('budget can remove optional rows without shortening names and includes its own final UTF-8 byte count', () => {
  const input = record({ cpuProfile: cpuProfile(), heapProfiles: [heapProfile()] });
  const full = buildSummary([input], { rootDir });
  const limited = buildSummary([input], { rootDir }, { maxBytes: full.sizeLimit.bytes - 100 });
  assert.equal(limited.sizeLimit.truncated, true);
  assert.equal(limited.sizeLimit.shortenedStrings, 0);
  assert.equal(limited.tests.name.length, 1);
  assert.equal(limited.suites.path.length, 1);
  assertTables(limited);
});

test('an impossible budget throws with row counts instead of silently dropping tests', () => {
  assert.throws(() => buildSummary([activityRecord()], {}, { maxBytes: 100 }), /minimum representation is \d+ bytes for 1 suite rows, 1 test rows and 7 activity rows.*no suite, test, or activity rows were dropped/);
  assert.throws(() => buildSummary([], {}, { maxBytes: 0 }), /maxBytes must be/);
  assert.throws(() => buildSummary([], {}, { top: -1 }), /top must be/);
  assert.throws(() => buildSummary([record({ schemaVersion: 2 })]), /Unsupported raw schemaVersion: 2/);
});
