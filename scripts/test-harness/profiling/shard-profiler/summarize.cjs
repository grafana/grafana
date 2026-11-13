'use strict';

const { createHash } = require('node:crypto');
const path = require('node:path');

const PHASES = ['preTests', 'tests', 'teardown', 'profiler', 'unassigned'];
const ACTIVITY_PHASES = ['preTests', 'body', 'hooks', 'framework', 'teardown', 'profiler', 'unassigned'];
const SEGMENT_PHASES = new Map([['setup', 0], ['body', 1], ['hook', 2], ['framework', 3], ['teardown', 4], ['profiler', 5]]);
const CATEGORIES = ['idle', 'gc', 'profiler', 'node/Jest', 'HappyDOM', 'Sucrase', 'app', 'workspace', 'library', 'other', 'JSDOM', 'ts-jest', 'TypeScript'];
const WALL = ['preTestsUs', 'bodyUs', 'hooksUs', 'frameworkUs', 'teardownUs', 'profilerUs', 'unassignedUs'];
const STRING_COLUMNS = {
  suites: ['path', 'status', 'recordStatus', 'environment', 'coverageStart'],
  tests: ['name', 'status'],
  costs: ['owner'],
  hotspots: ['owner', 'function', 'url'],
  testOwners: ['owner'],
  warnings: ['message'],
};
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const number = (value) => finite(value) ? Math.round(value) : null;
const nonnegative = (value) => finite(value) && value >= 0 ? Math.round(value) : null;
const duration = (start, end) => finite(start) && finite(end) && end >= start ? Math.round(end) - Math.round(start) : null;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const table = (columns) => Object.fromEntries(columns.split(' ').map((column) => [column, []]));
function append(target, row) {
  for (const column of Object.keys(target)) target[column].push(row[column] ?? null);
}

function paths(rootDir = '') {
  function canonical(value) {
    let text = String(value || '').replace(/\\/g, '/');
    if (text.startsWith('file://')) {
      try {
        const url = new URL(text);
        text = (url.hostname && url.hostname !== 'localhost' ? `//${url.hostname}` : '') + decodeURIComponent(url.pathname);
        text = text.replace(/^\/([a-z]:\/)/i, '$1');
      } catch { /* Keep malformed URLs visible rather than inventing a path. */ }
    }
    return text && !/^[a-z]+:/i.test(text.replace(/^[a-z]:\//i, '/')) ? path.posix.normalize(text) : text;
  }
  const root = canonical(rootDir).replace(/\/$/, '');
  const windows = /^[a-z]:/i.test(root);
  const cache = new Map();
  function normalize(value) {
    if (cache.has(value)) return cache.get(value);
    let text = canonical(value);
    const candidate = windows ? text.toLowerCase() : text;
    const prefix = windows ? root.toLowerCase() : root;
    if (root && candidate.startsWith(`${prefix}/`)) text = text.slice(root.length + 1);
    else if (root && candidate === prefix) text = '.';
    cache.set(value, text);
    return text;
  }
  function owner(frame = {}) {
    const name = frame.functionName;
    if (name === '(idle)') return ['idle', '(idle)'];
    if (name === '(garbage collector)' || name === '(gc)') return ['gc', '(gc)'];
    const url = canonical(frame.url);
    if (!url || /^(native |\[native code\])/.test(url)) return null;
    if (/(?:^|\/)scripts\/test-harness\/profiling\/shard-profiler\/(?:recorder|environment|runtime)\.cjs$/.test(url) || /^node:inspector/.test(url)) {
      return ['profiler', 'profiler'];
    }
    // Inspect node_modules before the repository prefix, including nested pnpm and scoped packages.
    const modulePath = `/${url}`;
    const marker = modulePath.lastIndexOf('/node_modules/');
    if (marker !== -1) {
      const parts = modulePath.slice(marker + 14).split('/');
      const pkg = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
      const category = pkg === 'happy-dom' || pkg.startsWith('@happy-dom/') ? 'HappyDOM'
        : pkg === 'sucrase' ? 'Sucrase'
        : pkg === 'jsdom' || pkg === 'jest-environment-jsdom' ? 'JSDOM'
        : pkg === 'ts-jest' ? 'ts-jest'
        : pkg === 'typescript' ? 'TypeScript'
        : /^(?:@jest\/|jest(?:-|$)|expect$)/.test(pkg) ? 'node/Jest' : 'library';
      return [category, pkg];
    }
    if (/^(?:node:|internal\/)/.test(url)) return ['node/Jest', 'node'];
    const relative = normalize(url);
    if (/^public\/app\//.test(relative)) return ['app', 'app'];
    const workspace = /^packages\/([^/]+)(?:\/|$)/.exec(relative);
    if (workspace) return ['workspace', `workspace:${workspace[1]}`];
    if (!/^(?:\/|[a-z]:|\.\.\/|[a-z]+:\/\/)/i.test(relative)) return ['workspace', 'workspace'];
    return ['other', '(other)'];
  }
  return { normalize, owner, clearCache: () => cache.clear() };
}

// Resolve ancestry once per node, without recursion or a stack walk per sample.
function owners(nodes, parents, classify) {
  const memo = new Map();
  const frames = new Map();
  return (id) => {
    if (memo.has(id)) return memo.get(id);
    const pending = [];
    const seen = new Set();
    let result;
    while (nodes.has(id) && !seen.has(id)) {
      if (memo.has(id)) { result = memo.get(id); break; }
      seen.add(id);
      pending.push(id);
      const frame = nodes.get(id).callFrame || {};
      const key = `${frame.functionName || ''}\0${frame.url || ''}`;
      if (!frames.has(key)) frames.set(key, classify(frame));
      result = frames.get(key);
      if (result) break;
      id = parents.get(id);
    }
    result ||= ['other', '(other)'];
    for (const item of pending) memo.set(item, result);
    return result;
  };
}

function concurrentTests(tests) {
  const concurrent = new Set(tests.filter((item) => item.concurrent));
  const ordered = tests.filter((item) => duration(item.startUs, item.endUs) > 0)
    .slice().sort((a, b) => a.startUs - b.startUs);
  let group = [];
  let end = -Infinity;
  function flush() { if (group.length > 1) for (const item of group) concurrent.add(item); }
  for (const item of ordered) {
    if (item.startUs >= end) { flush(); group = []; end = -Infinity; }
    group.push(item);
    end = Math.max(end, item.endUs);
  }
  flush();
  return concurrent;
}

function activityPhase(kind, concurrent) {
  const phase = SEGMENT_PHASES.get(kind) ?? 6;
  return concurrent && phase >= 1 && phase <= 3 ? 6 : phase;
}

function timeline(record, concurrent, warn) {
  const wallUs = duration(record.startUs, record.endUs);
  const wall = Object.fromEntries(WALL.map((name) => [name, wallUs === null ? null : 0]));
  if (wallUs === null) {
    warn('Suite wall bounds are incomplete; phase attribution is unassigned.');
    return { wall, intervals: [] };
  }
  const start = Math.round(record.startUs);
  const end = Math.round(record.endUs);
  const segments = Array.isArray(record.segments) ? record.segments : [];
  let previous = -Infinity;
  let invalid = false;
  for (const segment of segments) {
    if (duration(segment?.startUs, segment?.endUs) === null || segment.startUs < previous) { invalid = true; break; }
    previous = segment.endUs;
  }
  if (invalid || !segments.length) {
    warn(invalid ? 'Out-of-order or overlapping segments; all phase attribution is unassigned.' : 'Phase segments are missing; phase attribution is unassigned.');
    wall.unassignedUs = wallUs;
    return { wall, intervals: [{ start, end, phase: 'unassigned' }] };
  }
  const intervals = [];
  let cursor = start;

  function add(from, to, column, phase) {
    if (to <= from) return;
    wall[column] += to - from;
    intervals.push({ start: from, end: to, phase });
  }
  for (const segment of segments) {
    const from = Math.max(start, Math.min(end, Math.round(segment.startUs)));
    const to = Math.max(start, Math.min(end, Math.round(segment.endUs)));
    add(cursor, from, 'unassignedUs', 'unassigned');
    const phase = activityPhase(segment.kind, concurrent);
    add(from, to, WALL[phase], phase >= 1 && phase <= 3 ? 'tests' : ACTIVITY_PHASES[phase]);
    cursor = Math.max(cursor, to);
  }
  add(cursor, end, 'unassignedUs', 'unassigned');
  if (wall.unassignedUs) warn('Some wall intervals have no reliable phase attribution (gaps, unknown kinds, or concurrent tests).');
  return { wall, intervals };
}

function activityTotals(record, wall, concurrent, warn) {
  if (!record) return null;
  function unavailable(reason) {
    warn(`Exclusive activity timing is unavailable: ${reason}.`);
    return null;
  }
  if (record.activityTimingVersion !== 1) return unavailable('missing or unsupported activityTimingVersion');
  if (record.activityTimingValid !== true) return unavailable('activityTimingValid is not true');
  const wallUs = duration(record.startUs, record.endUs);
  if (!Number.isSafeInteger(wallUs) || !Number.isSafeInteger(Math.round(record.startUs)) || !Number.isSafeInteger(Math.round(record.endUs))) {
    return unavailable('suite bounds are incomplete or unsafe');
  }
  if (!Array.isArray(record.segments) || !record.segments.length) return unavailable('segments are missing or malformed');
  const totals = ACTIVITY_PHASES.map(() => [0, 0, 0]);
  let cursor = record.startUs;
  for (const segment of record.segments) {
    if (!segment || typeof segment.kind !== 'string' || !segment.kind ||
        !finite(segment.startUs) || !finite(segment.endUs) || segment.startUs !== cursor || segment.endUs > record.endUs ||
        !Number.isSafeInteger(Math.round(segment.startUs)) || !Number.isSafeInteger(Math.round(segment.endUs))) {
      return unavailable('segments do not form a complete, ordered suite partition');
    }
    const elapsed = duration(segment.startUs, segment.endUs);
    const values = [segment.transformUs, segment.moduleEvaluationUs, segment.otherUs];
    const validValues = values.every((value) => Number.isSafeInteger(value) && value >= 0);
    const sum = validValues ? values[0] + values[1] + values[2] : null;
    if (!Number.isSafeInteger(elapsed) || !validValues || !Number.isSafeInteger(sum) || sum !== elapsed) {
      return unavailable('segment counters must be nonnegative safe integers and exactly partition rounded wall time');
    }
    const total = totals[activityPhase(segment.kind, concurrent)];
    for (let i = 0; i < values.length; i++) total[i] += values[i];
    cursor = segment.endUs;
  }
  // Do not allocate gaps or clipped segment time to "other", or apportion measured counters across them.
  if (cursor !== record.endUs || totals.some((values, phase) => values[0] + values[1] + values[2] !== wall[WALL[phase]])) {
    return unavailable('segments do not completely partition the existing phase wall totals');
  }
  return totals;
}

function visitIntervals(intervals, start, end, visit) {
  let low = 0;
  let high = intervals.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (intervals[mid].end <= start) low = mid + 1;
    else high = mid;
  }
  let cursor = start;
  for (let i = low; i < intervals.length && intervals[i].start < end; i++) {
    const interval = intervals[i];
    if (interval.start > cursor) visit(null, Math.min(interval.start, end) - cursor, cursor, Math.min(interval.start, end));
    const from = Math.max(cursor, interval.start);
    const to = Math.min(end, interval.end);
    if (to > from) visit(interval, to - from, from, to);
    cursor = Math.max(cursor, to);
  }
  if (cursor < end) visit(null, end - cursor, cursor, end);
}

function moduleStats(modules, normalize) {
  if (!Array.isArray(modules)) return {};
  const unique = new Map();
  let evaluations = 0;
  for (const item of modules) {
    const filename = normalize(item.path);
    const bytes = nonnegative(item.sourceBytes);
    unique.set(filename, bytes === null ? (unique.get(filename) ?? null) : Math.max(unique.get(filename) ?? 0, bytes));
    evaluations = evaluations === null || nonnegative(item.evaluations) === null ? null : evaluations + nonnegative(item.evaluations);
  }
  const sizes = [...unique.values()];
  const unknown = sizes.filter((size) => size === null).length;
  return { moduleUniques: unique.size, moduleEvaluations: evaluations, moduleSourceBytes: unknown ? null : sizes.reduce((a, b) => a + b, 0), moduleSourceUnknown: unknown };
}

function cpuSampleTimeline(profile, warn) {
  const pairedCount = Math.min(profile.samples.length, profile.timeDeltas.length);
  if (profile.samples.length !== profile.timeDeltas.length) warn('CPU samples and timeDeltas differ in length; only paired samples are used.');
  const timestamps = new Float64Array(pairedCount);
  let clock = profile.startTime;
  let count = 0;
  let negativeCount = 0;
  let firstNegative = -1;
  let withinBounds = true;
  for (let i = 0; i < pairedCount; i++) {
    const delta = profile.timeDeltas[i];
    if (!finite(delta) || !finite(clock + delta)) {
      warn('Invalid CPU timeDelta; subsequent samples cannot be timed and are omitted.');
      break;
    }
    clock += delta;
    timestamps[count++] = clock;
    if (delta < 0) {
      negativeCount++;
      if (firstNegative === -1) firstNegative = i;
    }
    if (clock < profile.startTime || clock > profile.endTime) withinBounds = false;
  }
  let order = null;
  if (negativeCount) {
    // Inspector deltas are signed 32-bit timestamp differences, not nonnegative durations.
    // A long profile can hide integer wraparound; do not infer timestamps in that case.
    if (!withinBounds || profile.endTime - profile.startTime > 0x7fffffff) {
      warn('Negative CPU timeDeltas cannot be normalized: timestamps exceed profile bounds or the profile span permits signed 32-bit overflow; samples from the first negative delta onward are omitted.');
      count = firstNegative;
    } else {
      // V8 sample insertion order can differ from timestamp order. Keep each node paired with its timestamp.
      order = Array.from({ length: count }, (_, i) => i);
      order.sort((a, b) => timestamps[a] - timestamps[b] || a - b);
      warn(`Reordered CPU sample/timestamp pairs for ${negativeCount} negative timeDeltas.`);
    }
  }
  return { timestamps, order, count };
}

function cpuCosts(record, intervals, testIntervals, context) {
  const { warn, cost, normalize, classify, top } = context;
  const profile = record.cpuProfile;
  if (!profile) { warn('CPU profile unavailable; sampled time is null.'); return { total: null, hotspots: [], testOwners: [] }; }
  if (!finite(profile.startTime) || !finite(profile.endTime) || profile.endTime < profile.startTime || !Array.isArray(profile.samples) || !Array.isArray(profile.timeDeltas)) {
    warn('CPU profile timing is invalid; sampled time is null.');
    return { total: null, hotspots: [], testOwners: [] };
  }
  const nodes = new Map((profile.nodes || []).map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of nodes.values()) for (const child of node.children || []) parents.set(child, node.id);
  const resolve = owners(nodes, parents, classify);
  const hot = new Map();
  const sampleNodes = new Map();
  const byTest = new Map();
  const suiteBounds = duration(record.startUs, record.endUs) !== null;
  const lower = Math.round(Math.max(profile.startTime, suiteBounds ? record.startUs : profile.startTime));
  const upper = Math.round(Math.min(profile.endTime, suiteBounds ? record.endUs : profile.endTime));
  const { timestamps, order, count } = cpuSampleTimeline(profile, warn);
  let clock = profile.startTime;
  let total = 0;
  let clipped = false;
  for (let i = 0; i < count; i++) {
    const index = order ? order[i] : i;
    const previous = clock;
    clock = timestamps[index];
    const start = Math.max(lower, Math.round(previous));
    const end = Math.min(upper, Math.round(clock));
    if (Math.round(previous) < lower || Math.round(clock) > upper) clipped = true;
    if (end <= start) continue;
    const id = profile.samples[index];
    let node = sampleNodes.get(id);
    if (!node) {
      if (!nodes.has(id)) warn('CPU sample references a missing node; its owner is other.');
      const [category, owner] = resolve(id);
      node = { category, owner, key: `${category}\0${owner}`, costs: new Map() };
      if (top) {
        const frame = nodes.get(id)?.callFrame || {};
        const entry = { category, owner, function: frame.functionName || '(anonymous)', url: normalize(frame.url), line: nonnegative(frame.lineNumber), selfUs: 0 };
        const key = JSON.stringify([category, owner, entry.function, entry.url, entry.line]);
        if (!hot.has(key)) hot.set(key, entry);
        node.hotspot = hot.get(key);
      }
      sampleNodes.set(id, node);
    }
    const { category, owner } = node;
    total += end - start;
    visitIntervals(intervals, start, end, (interval, us, from, to) => {
      const phase = interval?.phase || 'unassigned';
      if (!node.costs.has(phase)) node.costs.set(phase, cost(phase, category, owner));
      node.costs.get(phase).sampleUs += us;
      // A test's event bounds alone do not establish ownership of teardown or ambiguous phases.
      if (phase !== 'tests') return;
      visitIntervals(testIntervals, from, to, (testInterval, testUs) => {
        if (!testInterval) return;
        let entries = byTest.get(testInterval.test);
        if (!entries) byTest.set(testInterval.test, entries = new Map());
        let entry = entries.get(node.key);
        if (!entry) entries.set(node.key, entry = { test: testInterval.test, category, owner, sampleUs: 0 });
        entry.sampleUs += testUs;
      });
    });
    if (node.hotspot) node.hotspot.selfUs += end - start;
  }
  if (clipped) warn('CPU sample intervals were clipped to profile and suite monotonic bounds.');
  const rank = (a, b) => b.selfUs - a.selfUs || compare(a.owner, b.owner) || compare(a.url, b.url) || compare(a.function, b.function) || (a.line ?? -1) - (b.line ?? -1);
  return {
    total,
    hotspots: [...hot.values()].sort(rank).slice(0, top),
    testOwners: [...byTest.values()].map((entries) => [...entries.values()].sort((a, b) => b.sampleUs - a.sampleUs || compare(a.owner, b.owner))[0]),
  };
}

function heapCosts(profiles, { warn, cost, classify }) {
  let heapBytes = null;
  let retainedHeapBytes = null;
  const collectedPhases = new Set();
  const retainedPhases = new Set();
  if (!profiles?.length) warn('Heap profiles unavailable; sampled heap bytes are null.');
  for (const entry of profiles || []) {
    if (!entry.profile?.head) { warn('Heap profile has no allocation tree; it is omitted.'); continue; }
    const nodes = new Map();
    const parents = new Map();
    const stack = [[entry.profile.head, null]];
    while (stack.length) {
      const [node, parent] = stack.pop();
      if (nodes.has(node.id)) continue;
      nodes.set(node.id, node);
      parents.set(node.id, parent);
      for (const child of node.children || []) stack.push([child, node.id]);
    }
    const resolve = owners(nodes, parents, classify);
    const phase = entry.phase === 'setup' ? 'preTests' : PHASES.includes(entry.phase) ? entry.phase : 'unassigned';
    if (phase === 'unassigned') warn('Unknown heap phase; its sampled bytes are unassigned.');
    const collected = entry.includeCollected === true;
    const allocationCosts = new Map();
    (collected ? collectedPhases : retainedPhases).add(phase);
    if (collected) heapBytes ??= 0;
    else { retainedHeapBytes ??= 0; warn('Heap profiles without includeCollected=true describe survivors, not allocation volume.'); }
    function addSize(id, size) {
      const bytes = nonnegative(size);
      if (bytes === null) { warn('Invalid heap sample size is omitted.'); return; }
      if (!bytes) return;
      let target = allocationCosts.get(id);
      if (!target) {
        if (!nodes.has(id)) warn('Heap sample references a missing node; its owner is other.');
        const [category, owner] = resolve(id);
        allocationCosts.set(id, target = cost(phase, category, owner));
      }
      target[collected ? 'heapBytes' : 'retainedHeapBytes'] += bytes;
      if (collected) heapBytes += bytes;
      else retainedHeapBytes += bytes;
    }
    // selfSize is an alternative representation, never an addition to samples.
    const samples = entry.profile.samples;
    if (samples?.length) {
      for (const sample of samples) addSize(sample.nodeId, sample.size);
    } else {
      warn('Heap samples are absent or empty; node selfSize is used once as a fallback.');
      for (const node of nodes.values()) addSize(node.id, node.selfSize);
    }
  }
  return { heapSampleBytes: heapBytes, retainedHeapSampleBytes: retainedHeapBytes, collectedPhases, retainedPhases };
}

function jestDuration(result) {
  for (const [start, end] of [[result?.startTime, result?.endTime], [result?.perfStats?.start, result?.perfStats?.end]]) {
    if (finite(start) && finite(end) && end >= start) return Math.round((end - start) * 1000);
  }
  return finite(result?.perfStats?.runtime) ? nonnegative(result.perfStats.runtime * 1000) : null;
}

function compactStrings(summary) {
  const used = new Set();
  for (const [name, columns] of Object.entries(STRING_COLUMNS)) {
    for (const column of columns) for (const id of summary[name][column]) if (id !== null) used.add(id);
  }
  const ids = [...used].sort((a, b) => a - b);
  const remap = new Map(ids.map((id, index) => [id, index]));
  summary.strings = ids.map((id) => summary.strings[id]);
  for (const [name, columns] of Object.entries(STRING_COLUMNS)) {
    for (const column of columns) summary[name][column] = summary[name][column].map((id) => id === null ? null : remap.get(id));
  }
}

function fitBudget(summary, maxBytes, top) {
  const limit = summary.sizeLimit = { maxBytes, bytes: 0, top, truncated: false, removedTestOwners: 0, removedHotspots: 0, removedCosts: 0, shortenedStrings: 0, stringMaxCodePoints: null };
  function fits() {
    let bytes = Buffer.byteLength(JSON.stringify(summary));
    while (bytes !== limit.bytes) {
      limit.bytes = bytes;
      bytes = Buffer.byteLength(JSON.stringify(summary));
    }
    return bytes <= maxBytes;
  }
  compactStrings(summary);
  if (fits()) return summary;
  for (const [name, count] of [['testOwners', 'removedTestOwners'], ['hotspots', 'removedHotspots'], ['costs', 'removedCosts']]) {
    limit[count] = summary[name][Object.keys(summary[name])[0]].length;
    if (!limit[count]) continue;
    limit.truncated = true;
    for (const column of Object.keys(summary[name])) summary[name][column] = [];
    compactStrings(summary);
    if (fits()) return summary;
  }
  const originals = summary.strings.slice();
  for (const length of [256, 128, 64, 32, 24]) {
    limit.shortenedStrings = 0;
    summary.strings = originals.map((value) => {
      const chars = [...value];
      if (chars.length <= length) return value;
      limit.shortenedStrings++;
      return `${chars.slice(0, length - 17).join('')}~${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
    });
    limit.stringMaxCodePoints = length;
    limit.truncated = true;
    if (fits()) return summary;
  }
  throw new RangeError(`Summary cannot fit maxBytes=${maxBytes}: minimum representation is ${limit.bytes} bytes for ${summary.suites.path.length} suite rows, ${summary.tests.name.length} test rows and ${summary.activities.suite.length} activity rows. Increase maxBytes; no suite, test, or activity rows were dropped.`);
}

/**
 * Returns a JSON-safe columnar object; both exported names are the same function.
 * Records may also be synchronous descriptors: { schemaVersion, suite, startUs, pid, load }.
 * Lazy descriptors are indexed without loading their records.
 */
function buildSummary(records, metadata = {}, { maxBytes = 2000000, top = 8 } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError('maxBytes must be a positive safe integer');
  if (!Number.isSafeInteger(top) || top < 0) throw new RangeError('top must be a nonnegative safe integer');
  top = Math.min(top, 8);
  const { normalize, owner: classify, clearCache } = paths(metadata.rootDir);
  const strings = [];
  const stringIds = new Map();
  function intern(value) {
    if (value === null || value === undefined) return null;
    value = String(value);
    if (!stringIds.has(value)) { stringIds.set(value, strings.length); strings.push(value); }
    return stringIds.get(value);
  }
  const { selectedSuites = [], jestResults, ...smallMetadata } = metadata;
  const summary = {
    schemaVersion: 1,
    format: 'shard-profiler-summary',
    metadata: JSON.parse(JSON.stringify(smallMetadata)),
    phases: PHASES.slice(),
    activityPhases: ACTIVITY_PHASES.slice(),
    categories: CATEGORIES.slice(),
    stringColumns: STRING_COLUMNS,
    semantics: {
      rows: 'Suite and test row indexes are IDs; tests.suite, activities.suite, costs.suite, hotspots.suite and testOwners.test reference them. String columns index strings; costs.phase indexes phases, activities.phase indexes activityPhases, and category indexes categories. Null means unavailable.',
      time: 'Integer microseconds; test startUs is relative to suite start. Hotspot line is zero-based (null if unknown).',
      wall: 'Suite phase columns partition wallUs; unassignedUs covers ambiguity/gaps. instrumentationUs overlaps wall phases and is not added to them. Test body/hooks are recorder event intervals: beforeAll/afterAll belong only to suite hooks; aborted/concurrent intervals are not exclusive execution attribution.',
      activities: 'Cumulative suite elapsed microseconds, not process CPU. Each row exclusively partitions the existing phase wall total into transform pipeline, module evaluation and other time; it is not extra time. Module scope includes wrapper/VM loading outside transforms, not complete static-graph import/resolution accounting. Missing, unsupported or invalid capture data makes all activity counters null. All seven phase rows are core.',
      cpu: 'processCpu* is process user/system CPU between boundary points. sampleUs/selfUs/mainThreadSampleUs is exclusive main-thread sampled time, including idle/GC, not process CPU or background GC. Signed timeDeltas reconstruct timestamps; out-of-order node/timestamp pairs are sorted. Weights cover intervals ending at each chronological sample, starting at profile.startTime, without extrapolating the tail.',
      memory: 'Heap/RSS KiB are rounded first/last point values, not peaks or allocation volume. Test heapDeltaBytes is a boundary delta. heapBytes estimates sampled allocations with includeCollected=true; retainedHeapBytes sums phase-end survivor estimates, not final retained heap. Samples or selfSize fallback are counted, never both.',
      costs: 'CPU body/hooks/framework aggregate into tests to match heap checkpoints. Heap checkpoint phases can include profiler work; they are not exact CPU phase intervals. Missing profile types/checkpoints stay null; zero means no samples for that owner in an available profile type/checkpoint.',
      gc: 'gcUs sums observed GC entry durations, not GC CPU; it is not added to wall phases. An unavailable observer yields null.',
      modules: 'Unique normalized paths; evaluations include repeats; source bytes count each path once (null if any source size is unknown).',
      budget: 'Optional test owners, hotspots, then costs are removed before string shortening. Suite, test and activity rows are never dropped. Shortened strings retain a prefix and SHA-256 suffix; raw records are unchanged.',
    },
    strings,
    suites: table(`path selected status recordStatus environment coverageStart wallUs ${WALL.join(' ')} instrumentationUs processCpuUserUs processCpuSystemUs heapStartKiB heapEndKiB rssStartKiB rssEndKiB gcCount gcUs moduleUniques moduleEvaluations moduleSourceBytes moduleSourceUnknown mainThreadSampleUs heapSampleBytes retainedHeapSampleBytes`),
    tests: table('suite id name attempt status source startUs wallUs bodyUs hooksUs processCpuUserUs processCpuSystemUs heapDeltaBytes concurrent'),
    activities: table('suite phase wallUs transformUs moduleEvaluationUs otherUs'),
    costs: table('suite phase category owner sampleUs heapBytes retainedHeapBytes'),
    hotspots: table('suite category owner function url line selfUs'),
    testOwners: table('test category owner sampleUs'),
    warnings: table('suite message'),
  };
  const selected = new Set(selectedSuites.map(normalize));
  const results = new Map();
  for (const result of jestResults?.testResults || []) {
    const filename = normalize(result.name || result.testFilePath);
    if (!results.has(filename)) results.set(filename, []);
    results.get(filename).push(result);
  }
  const raw = new Map();
  for (const record of records) {
    if (record.schemaVersion !== 1) throw new Error(`Unsupported raw schemaVersion: ${record.schemaVersion}`);
    const filename = normalize(record.suite);
    if (!raw.has(filename)) raw.set(filename, []);
    raw.get(filename).push(record);
  }
  summary.completeness = { expectedSuites: selected.size, recordedSelectedSuites: [...selected].filter((name) => raw.has(name)).length, missingSelectedSuites: [...selected].filter((name) => !raw.has(name)).length };
  if (jestResults) summary.jest = Object.fromEntries(['success', 'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites', 'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests'].filter((key) => jestResults[key] !== undefined).map((key) => [key, jestResults[key]]));
  const filenames = [...new Set([...selected, ...raw.keys(), ...results.keys()])].sort(compare);
  for (const filename of filenames) {
    const captures = (raw.get(filename) || []).slice().sort((a, b) => (a.startUs || 0) - (b.startUs || 0) || (a.pid || 0) - (b.pid || 0));
    const suiteResults = results.get(filename) || [];
    // Jest has no capture ID. A single final result belongs to the last capture, not every retry.
    // Multiple results (for example, projects sharing a path) cannot be joined safely by path alone.
    const entries = suiteResults.length > 1
      ? [...captures.map((capture) => ({ capture })), ...suiteResults.map((result) => ({ capture: null, result }))]
      : (captures.length ? captures : [null]).map((capture, index) => ({ capture, result: index === Math.max(0, captures.length - 1) ? suiteResults[0] : undefined }));
    for (const { capture, result } of entries) {
      const lazy = typeof capture?.load === 'function';
      // Keep loaded profiles local to this capture rather than caching them in the raw map.
      const record = lazy ? capture.load() : capture;
      if (lazy && record?.schemaVersion !== 1) {
        throw new TypeError(`Lazy loader for ${filename} must return a schemaVersion 1 record synchronously`);
      }
      if (lazy && normalize(record.suite) !== filename) {
        throw new Error(`Lazy record suite does not match descriptor: expected ${filename}, got ${normalize(record.suite)}`);
      }
      const suite = summary.suites.path.length;
      const messages = new Set(record?.warnings || []);
      const warn = (message) => messages.add(message);
      if (captures.length > 1) warn('Multiple raw records exist for this suite; each capture is retained as a separate suite row.');
      if (captures.length > 1 && suiteResults.length === 1) warn('Only the last capture receives the final Jest result, by capture order; earlier captures retain recorder completion status.');
      if (suiteResults.length > 1) warn('Multiple Jest results share this suite path; they are retained separately without guessing raw capture associations.');
      if (!record) warn(captures.length
        ? 'Jest result is not matched to a raw capture; durations are fallback values and instrumentation metrics are null.'
        : 'Raw suite record is missing; Jest durations are fallback values and CPU, memory, phase and import metrics are null.');
      if (!result) warn('Jest suite result is unavailable for this capture; status reflects recorder completion or missing coverage, not a verified Jest outcome.');
      const rawTests = record?.tests || [];
      const concurrent = concurrentTests(rawTests);
      const concurrentSuite = concurrent.size > 0 || (record?.warnings || []).some((message) => message.startsWith('Concurrent test work overlaps'));
      if (concurrentSuite) warn('Concurrent or overlapping tests: per-test CPU/heap deltas and sampled owners are unavailable; test phase attribution is unassigned.');
      if (rawTests.some((item) => item.status === 'incomplete')) warn('Incomplete test attempts retain raw event intervals that may include cleanup; no per-test sampled owner is assigned.');
      const testIntervals = [];
      const seen = new Map();
      for (const item of rawTests) {
        // Retries share a name but are rows, not replacements. Only first attempts consume Jest assertions.
        if (!item.attempt || item.attempt === 1) seen.set(item.name, (seen.get(item.name) || 0) + 1);
        const overlap = concurrent.has(item);
        const row = summary.tests.name.length;
        append(summary.tests, { suite, id: item.id, name: intern(item.name), attempt: item.attempt ?? 1, status: intern(item.status), source: 0,
          startUs: duration(record.startUs, item.startUs), wallUs: duration(item.startUs, item.endUs), bodyUs: nonnegative(item.bodyUs), hooksUs: nonnegative(item.hookUs),
          processCpuUserUs: overlap ? null : nonnegative(item.cpuUserUs), processCpuSystemUs: overlap ? null : nonnegative(item.cpuSystemUs), heapDeltaBytes: overlap ? null : number(item.heapDeltaBytes), concurrent: overlap });
        if (!overlap && ['passed', 'failed', 'skipped', 'todo'].includes(item.status) && duration(item.startUs, item.endUs) > 0) testIntervals.push({ start: Math.round(item.startUs), end: Math.round(item.endUs), test: row });
      }
      testIntervals.sort((a, b) => a.start - b.start);
      for (const assertion of result?.assertionResults || []) {
        const name = assertion.fullName || [...(assertion.ancestorTitles || []), assertion.title || ''].join(' ');
        if (seen.get(name) > 0) { seen.set(name, seen.get(name) - 1); continue; }
        if (record) warn('Some Jest assertions have no raw test record; their durations use Jest fallback values.');
        append(summary.tests, { suite, name: intern(name), attempt: assertion.invocations ?? 1, status: intern(assertion.status), source: 1, wallUs: finite(assertion.duration) ? nonnegative(assertion.duration * 1000) : null });
      }
      const row = { path: intern(filename), selected: selected.has(filename), status: intern(result?.status || record?.status || 'missing'), recordStatus: intern(record?.status), environment: intern(record?.environment), coverageStart: intern(record?.coverageStart), wallUs: record ? duration(record.startUs, record.endUs) : jestDuration(result) };
      if (record) {
        const { wall, intervals } = timeline(record, concurrentSuite, warn);
        Object.assign(row, wall, moduleStats(record.modules, normalize), { instrumentationUs: nonnegative(record.instrumentationUs) });
        const points = record.points || [];
        const first = points[0];
        const last = points.length > 1 ? points.at(-1) : null;
        for (const [metric, column] of [['cpuUserUs', 'processCpuUserUs'], ['cpuSystemUs', 'processCpuSystemUs']]) {
          row[column] = first && last && last.tUs >= first.tUs && finite(first[metric]) && finite(last[metric]) ? nonnegative(last[metric] - first[metric]) : null;
        }
        for (const [metric, prefix] of [['heapUsed', 'heap'], ['rss', 'rss']]) {
          row[`${prefix}StartKiB`] = finite(first?.[metric]) ? nonnegative(first[metric] / 1024) : null;
          row[`${prefix}EndKiB`] = finite(last?.[metric]) ? nonnegative(last[metric] / 1024) : null;
        }
        const gcAvailable = Array.isArray(record.gc) && !(record.warnings || []).some((message) => message.startsWith('GC observation unavailable:'));
        row.gcCount = gcAvailable ? record.gc.length : null;
        row.gcUs = gcAvailable && record.gc.every((gc) => nonnegative(gc.durationUs) !== null) ? Math.round(record.gc.reduce((sum, gc) => sum + gc.durationUs, 0)) : null;
        const costs = new Map();
        const context = { warn, normalize, classify, top, cost(phase, category, owner) {
          const key = JSON.stringify([phase, category, owner]);
          if (!costs.has(key)) costs.set(key, { phase, category, owner, sampleUs: 0, heapBytes: 0, retainedHeapBytes: 0 });
          return costs.get(key);
        } };
        const cpu = cpuCosts(record, intervals, testIntervals, context);
        row.mainThreadSampleUs = cpu.total;
        const { collectedPhases, retainedPhases, ...heapTotals } = heapCosts(record.heapProfiles, context);
        Object.assign(row, heapTotals);
        for (const entry of [...costs.values()].sort((a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) || compare(a.category, b.category) || compare(a.owner, b.owner))) {
          append(summary.costs, { ...entry, suite, phase: PHASES.indexOf(entry.phase), category: CATEGORIES.indexOf(entry.category), owner: intern(entry.owner), sampleUs: cpu.total === null ? null : entry.sampleUs, heapBytes: collectedPhases.has(entry.phase) ? entry.heapBytes : null, retainedHeapBytes: retainedPhases.has(entry.phase) ? entry.retainedHeapBytes : null });
        }
        for (const entry of cpu.hotspots) append(summary.hotspots, { ...entry, suite, category: CATEGORIES.indexOf(entry.category), owner: intern(entry.owner), function: intern(entry.function), url: intern(entry.url) });
        for (const entry of cpu.testOwners) append(summary.testOwners, { ...entry, category: CATEGORIES.indexOf(entry.category), owner: intern(entry.owner) });
      }
      append(summary.suites, row);
      const activities = activityTotals(record, row, concurrentSuite, warn);
      for (let phase = 0; phase < ACTIVITY_PHASES.length; phase++) {
        const wallUs = row[WALL[phase]];
        append(summary.activities, { suite, phase, wallUs: Number.isSafeInteger(wallUs) && wallUs >= 0 ? wallUs : null, transformUs: activities?.[phase][0], moduleEvaluationUs: activities?.[phase][1], otherUs: activities?.[phase][2] });
      }
      for (const message of [...messages].sort(compare)) append(summary.warnings, { suite, message: intern(message) });
      // Do not retain URLs from discarded profile frames across the entire shard.
      clearCache();
    }
  }
  summary.semantics.testSource = 'tests.source: 0=recorder, 1=Jest fallback (final outcome only; earlier attempts are unknown).';
  return fitBudget(summary, maxBytes, top);
}

module.exports = { buildSummary, summarize: buildSummary };
