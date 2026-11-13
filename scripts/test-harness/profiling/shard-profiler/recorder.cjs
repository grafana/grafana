'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { Session } = require('node:inspector');
const { performance, PerformanceObserver } = require('node:perf_hooks');
const hrtime = process.hrtime.bigint.bind(process.hrtime);
const cpuUsage = process.cpuUsage.bind(process);
const memoryUsage = process.memoryUsage.bind(process);
const hostSetImmediate = setImmediate;
const segmentKinds = new Set(['setup', 'body', 'hook', 'framework', 'teardown', 'profiler']);

function readConfig(value = process.env.GRAFANA_SHARD_PROFILE) {
  let config;
  try {
    config = JSON.parse(value);
  } catch (cause) {
    throw new Error('GRAFANA_SHARD_PROFILE must contain a JSON profiling configuration', { cause });
  }
  for (const key of ['rootDir', 'outputDir']) {
    if (typeof config?.[key] !== 'string' || !path.isAbsolute(config[key])) {
      throw new Error(`GRAFANA_SHARD_PROFILE.${key} must be an absolute path`);
    }
  }
  if (config.baseEnvironment !== undefined && (typeof config.baseEnvironment !== 'string' || !path.isAbsolute(config.baseEnvironment))) {
    throw new Error('GRAFANA_SHARD_PROFILE.baseEnvironment must be an absolute path when supplied');
  }
  config = { cpuIntervalUs: 1000, heapIntervalBytes: 1048576, cpu: true, heap: true, ...config };
  for (const key of ['cpuIntervalUs', 'heapIntervalBytes']) {
    if (!Number.isSafeInteger(config[key]) || config[key] <= 0) {
      throw new Error(`GRAFANA_SHARD_PROFILE.${key} must be a positive integer`);
    }
  }
  for (const key of ['cpu', 'heap']) {
    if (typeof config[key] !== 'boolean') {
      throw new Error(`GRAFANA_SHARD_PROFILE.${key} must be a boolean`);
    }
  }
  return config;
}

function testName(test) {
  const names = [];
  for (let item = test; item?.parent; item = item.parent) names.push(item.name);
  return names.reverse().join(' ');
}

class Recorder {
  constructor(config, { suite, environment, coverageStart }, protocol = {}) {
    this.config = config;
    this.now = protocol.now || (() => Number(hrtime()) / 1000);
    this.data = {
      schemaVersion: 1,
      activityTimingVersion: 1,
      activityTimingValid: true,
      suite: this.relative(suite),
      pid: process.pid,
      environment,
      coverageStart,
      startUs: this.now(),
      endUs: null,
      status: 'error',
      warnings: [],
      instrumentationUs: 0,
      points: [],
      segments: [],
      tests: [],
      modules: [],
      edges: [],
      gc: [],
      cpuProfile: null,
      heapProfiles: [],
    };
    this.modules = new Map();
    this.edges = new Set();
    this.moduleStack = [];
    this.testStates = new WeakMap();
    this.activeTests = new Map();
    this.phase = 'setup';
    this.runStarted = false;
    this.runFinished = false;
    this.failed = false;
    this.closed = false;
    this.activityStack = [];
    this.activityCursorUs = Math.round(this.data.startUs);
    this.segment = { kind: 'setup', startUs: this.data.startUs, test: null, transformUs: 0, moduleEvaluationUs: 0, otherUs: 0 };
    this.warn('Module edges are evaluation-parent edges, not a complete cached-import graph; native ESM and host imports are not instrumented.');
    this.warn('instrumentationUs measures recorder bookkeeping and inspector waits, excluding final serialization and disk I/O.');
    this.measure(() => {
      this.point('constructor');
      this.gcOffsetUs = this.now() - performance.now() * 1000;
      try {
        this.observer = new PerformanceObserver((list) => this.measure(() => this.collectGC(list.getEntries())));
        this.observer.observe({ entryTypes: ['gc'] });
      } catch (error) {
        this.warn(`GC observation unavailable: ${error.message}`);
      }
      const startUs = this.now();
      this.startInspector(protocol.Session || Session);
      const endUs = this.now();
      this.transition('profiler', null, startUs);
      this.transition('setup', null, endUs);
    });
  }

  relative(filename) {
    return path.isAbsolute(filename) ? path.relative(this.config.rootDir, filename).split(path.sep).join('/') : filename;
  }

  warn(message) {
    if (!this.data.warnings.includes(message)) this.data.warnings.push(message);
  }

  beginOverhead() {
    if (!this.overheadDepth) this.overheadStart = this.now();
    this.overheadDepth = (this.overheadDepth || 0) + 1;
  }

  endOverhead() {
    if (--this.overheadDepth === 0) this.data.instrumentationUs += this.now() - this.overheadStart;
  }

  measure(fn) {
    this.beginOverhead();
    try {
      return fn();
    } finally {
      this.endOverhead();
    }
  }

  point(label) {
    const cpu = cpuUsage();
    const memory = memoryUsage();
    const point = {
      label,
      tUs: this.now(),
      cpuUserUs: cpu.user,
      cpuSystemUs: cpu.system,
      heapUsed: memory.heapUsed,
      rss: memory.rss,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers,
    };
    this.data.points.push(point);
    return point;
  }

  invalidateActivityTiming(reason) {
    this.data.activityTimingValid = false;
    this.warn(`Exclusive activity timing is invalid: ${reason}. Other profiles remain usable.`);
  }

  flushActivity(tUs) {
    const rounded = Math.round(tUs);
    if (!this.segment || !Number.isSafeInteger(rounded) || rounded < this.activityCursorUs) {
      this.invalidateActivityTiming('missing phase or non-monotonic activity boundary');
      return;
    }
    const kind = this.activityStack.at(-1)?.kind;
    if (kind !== undefined && kind !== 'transform' && kind !== 'moduleEvaluation') {
      this.invalidateActivityTiming('unknown activity on the stack');
      return;
    }
    const column = kind ? `${kind}Us` : 'otherUs';
    this.segment[column] += rounded - this.activityCursorUs;
    this.activityCursorUs = rounded;
  }

  enterActivity(kind, tUs = this.now()) {
    if (this.closed) return null;
    return this.measure(() => {
      this.flushActivity(tUs);
      if (kind !== 'transform' && kind !== 'moduleEvaluation') {
        this.invalidateActivityTiming('unknown activity kind');
        return null;
      }
      const frame = { kind };
      this.activityStack.push(frame);
      return frame;
    });
  }

  exitActivity(frame, tUs = this.now()) {
    if (!frame || !this.segment) return;
    this.measure(() => {
      this.flushActivity(tUs);
      if (this.activityStack.at(-1) !== frame) {
        this.invalidateActivityTiming('activity stack exit order mismatch');
        this.activityStack.length = 0;
        return;
      }
      this.activityStack.pop();
    });
  }

  closeSegment(tUs) {
    this.flushActivity(tUs);
    if (!this.segment) return;
    const { transformUs, moduleEvaluationUs, otherUs } = this.segment;
    if (!segmentKinds.has(this.segment.kind) ||
        ![transformUs, moduleEvaluationUs, otherUs].every((value) => Number.isSafeInteger(value) && value >= 0) ||
        transformUs + moduleEvaluationUs + otherUs !== Math.round(tUs) - Math.round(this.segment.startUs)) {
      this.invalidateActivityTiming('phase activity totals do not partition the rounded phase interval');
    }
    this.data.segments.push({ ...this.segment, endUs: tUs });
    this.segment = null;
  }

  transition(kind, test = null, tUs = this.now()) {
    this.closeSegment(tUs);
    if (!segmentKinds.has(kind)) this.invalidateActivityTiming('unknown phase kind');
    this.segment = { kind, startUs: tUs, test, transformUs: 0, moduleEvaluationUs: 0, otherUs: 0 };
  }

  postSync(method, params = {}) {
    let called = false;
    let failure;
    let result;
    this.session.post(method, params, (error, response) => {
      called = true;
      failure = error;
      result = response;
    });
    if (!called) {
      const error = new Error(`${method} did not complete synchronously; constructor coverage is unavailable`);
      error.code = 'ASYNC_INSPECTOR_POST';
      throw error;
    }
    if (failure) throw failure;
    return result;
  }

  post(method, params = {}) {
    return new Promise((resolve, reject) => {
      this.session.post(method, params, (error, response) => (error ? reject(error) : resolve(response)));
    });
  }

  samplingOptions(includeCollected) {
    return {
      samplingInterval: this.config.heapIntervalBytes,
      ...(includeCollected ? { includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true } : {}),
    };
  }

  startInspector(SessionClass) {
    if (!this.config.cpu && !this.config.heap) return;
    try {
      this.session = new SessionClass();
      this.session.connect();
      if (this.config.cpu) {
        try {
          this.postSync('Profiler.enable');
          this.postSync('Profiler.setSamplingInterval', { interval: this.config.cpuIntervalUs });
          this.postSync('Profiler.start');
          this.cpuRunning = true;
        } catch (error) {
          if (error.code === 'ASYNC_INSPECTOR_POST') throw error;
          this.warn(`CPU profiling unavailable: ${error.message}`);
        }
      }
      if (this.config.heap) {
        try {
          this.postSync('HeapProfiler.enable');
          // Older protocols can silently ignore unknown parameters. Do not claim collected allocations there.
          this.includeCollected = Number(process.versions.node.split('.')[0]) >= 22;
          if (!this.includeCollected) this.warn('Collected-object heap sampling is unverified on Node <22; using explicitly labelled survive-only samples.');
          try {
            this.postSync('HeapProfiler.startSampling', this.samplingOptions(this.includeCollected));
          } catch (error) {
            if (error.code === 'ASYNC_INSPECTOR_POST' || !this.includeCollected) throw error;
            this.warn(`Collected-object heap sampling rejected; falling back to survive-only samples: ${error.message}`);
            this.includeCollected = false;
            this.postSync('HeapProfiler.startSampling', this.samplingOptions(false));
          }
          this.heapRunning = true;
          this.heapAvailable = true;
        } catch (error) {
          if (error.code === 'ASYNC_INSPECTOR_POST') throw error;
          this.warn(`Heap profiling unavailable: ${error.message}`);
        }
      }
    } catch (error) {
      this.warn(`Inspector unavailable: ${error.message}`);
      this.disconnectInspector();
    }
  }

  disconnectInspector() {
    try {
      this.session?.disconnect();
    } catch (error) {
      this.warn(`Inspector disconnect failed: ${error.message}`);
    }
    this.session = null;
    this.cpuRunning = false;
    this.heapRunning = false;
    this.heapAvailable = false;
  }

  async stopHeap() {
    if (!this.heapRunning) return;
    this.heapRunning = false;
    try {
      const { profile } = await this.post('HeapProfiler.stopSampling');
      if (!profile) throw new Error('Inspector returned no sampling profile');
      this.data.heapProfiles.push({ phase: this.phase, profile, includeCollected: this.includeCollected });
    } catch (error) {
      this.heapAvailable = false;
      this.warn(`Heap profile for ${this.phase} unavailable: ${error.message}`);
    }
  }

  async checkpoint(nextPhase, nextKind) {
    this.beginOverhead();
    const start = this.now();
    this.transition('profiler', null, start);
    try {
      await this.stopHeap();
      this.phase = nextPhase;
      if (this.heapAvailable) {
        try {
          await this.post('HeapProfiler.startSampling', this.samplingOptions(this.includeCollected));
          this.heapRunning = true;
        } catch (error) {
          this.heapAvailable = false;
          this.warn(`Heap profiling for ${nextPhase} unavailable: ${error.message}`);
        }
      }
    } finally {
      this.transition(nextKind);
      this.endOverhead();
    }
  }

  collectGC(entries) {
    for (const entry of entries) {
      const startUs = this.gcOffsetUs + entry.startTime * 1000;
      if (startUs < this.data.startUs || (this.data.endUs !== null && startUs > this.data.endUs)) continue;
      this.data.gc.push({
        startUs,
        durationUs: entry.duration * 1000,
        kind: entry.detail?.kind ?? 0,
        flags: entry.detail?.flags ?? 0,
      });
    }
  }

  markOverlap(records = this.activeTests.values()) {
    this.warn('Concurrent test work overlaps or can precede Circus event bounds; affected per-test CPU/heap deltas are null. Body/hook times are event intervals, not concurrent execution attribution.');
    for (const { record } of records) {
      record.concurrent = true;
      record.cpuUserUs = record.cpuSystemUs = record.heapDeltaBytes = null;
    }
  }

  startTest(test) {
    const previous = this.testStates.get(test);
    const point = this.point(`test:${this.data.tests.length + 1}:start`);
    const record = {
      id: this.data.tests.length + 1,
      name: testName(test),
      attempt: (previous?.record.attempt || 0) + 1,
      status: 'incomplete',
      startUs: point.tUs,
      endUs: null,
      bodyUs: 0,
      hookUs: 0,
      cpuUserUs: null,
      cpuSystemUs: null,
      heapDeltaBytes: null,
      concurrent: Boolean(test.concurrent || this.concurrentSuite),
    };
    const item = { record, point, bodyStart: null };
    this.testStates.set(test, item);
    this.activeTests.set(record.id, item);
    this.data.tests.push(record);
    if (this.activeTests.size > 1 || record.concurrent) this.markOverlap();
    this.transition('framework', this.activeTests.size === 1 ? record.id : null, point.tUs);
    return item;
  }

  endBody(item, tUs) {
    if (item?.bodyStart !== null && item?.bodyStart !== undefined) {
      item.record.bodyUs += tUs - item.bodyStart;
      item.bodyStart = null;
    }
  }

  finishTest(test, status) {
    const item = this.testStates.get(test) || this.startTest(test);
    if (!this.activeTests.has(item.record.id)) return;
    const point = this.point(`test:${item.record.id}:done`);
    this.endBody(item, point.tUs);
    Object.assign(item.record, { status, endUs: point.tUs });
    if (!item.record.concurrent) {
      item.record.cpuUserUs = point.cpuUserUs - item.point.cpuUserUs;
      item.record.cpuSystemUs = point.cpuSystemUs - item.point.cpuSystemUs;
      item.record.heapDeltaBytes = point.heapUsed - item.point.heapUsed;
    }
    this.activeTests.delete(item.record.id);
    this.transition('framework', null, point.tUs);
  }

  handleTestEvent(event, state) {
    if (this.closed) return;
    return this.measure(() => {
      const item = event.test && this.testStates.get(event.test);
      switch (event.name) {
        case 'run_start': {
          this.runStarted = true;
          this.point('run_start');
          const containsConcurrent = (block) => block?.children?.some((child) => child.concurrent || containsConcurrent(child));
          this.concurrentSuite = Boolean(containsConcurrent(state?.rootDescribeBlock));
          if (this.concurrentSuite) this.markOverlap();
          return this.checkpoint('tests', 'framework');
        }
        case 'run_finish':
          this.runFinished = true;
          if (state?.unhandledErrors?.length) this.failed = true;
          this.point('run_finish');
          return this.checkpoint('teardown', 'teardown');
        case 'test_start':
          this.startTest(event.test);
          break;
        case 'test_fn_start':
          // Circus emits this even when a failed beforeEach prevents the body from running.
          if (item && !event.test.errors?.length) {
            item.bodyStart = this.now();
            this.transition('body', item.record.id, item.bodyStart);
          }
          break;
        case 'test_fn_success':
        case 'test_fn_failure':
          this.endBody(item, this.now());
          this.transition('framework', item?.record.id ?? null);
          break;
        case 'hook_start': {
          const test = /^(beforeEach|afterEach)$/.test(event.hook.type) ? state?.currentlyRunningTest : null;
          const owner = test && this.testStates.get(test);
          const startUs = this.now();
          this.hook = { startUs, owner };
          this.transition('hook', owner?.record.id ?? null, startUs);
          break;
        }
        case 'hook_success':
        case 'hook_failure': {
          const endUs = this.now();
          if (this.hook?.owner) this.hook.owner.record.hookUs += endUs - this.hook.startUs;
          this.hook = null;
          this.transition('framework', item?.record.id ?? null, endUs);
          break;
        }
        case 'test_done':
          this.finishTest(event.test, event.test.errors?.length ? 'failed' : 'passed');
          break;
        case 'test_skip':
          this.finishTest(event.test, 'skipped');
          break;
        case 'test_todo':
          this.finishTest(event.test, 'todo');
          break;
      }
    });
  }

  enterModule(filename, from) {
    if (this.closed) return null;
    return this.measure(() => {
      let stats = this.modules.get(filename);
      if (!stats) {
        stats = { path: this.relative(filename), evaluations: 0, sourceBytes: null, selfUs: 0, totalUs: 0 };
        this.modules.set(filename, stats);
      }
      stats.evaluations++;
      const parent = from || this.moduleStack.at(-1)?.filename;
      if (parent && parent !== filename) {
        const edge = [this.relative(parent), stats.path];
        const key = JSON.stringify(edge);
        if (!this.edges.has(key)) {
          this.edges.add(key);
          this.data.edges.push(edge);
        }
      }
      const frame = { filename, stats, startUs: this.now(), childrenUs: 0 };
      frame.activity = this.enterActivity('moduleEvaluation', frame.startUs);
      this.moduleStack.push(frame);
      return frame;
    });
  }

  exitModule(frame) {
    if (!frame) return;
    const endUs = this.now();
    this.measure(() => {
      this.exitActivity(frame.activity, endUs);
      if (this.moduleStack.at(-1) !== frame) this.invalidateActivityTiming('module stack exit order mismatch');
      const elapsed = endUs - frame.startUs;
      frame.stats.totalUs += elapsed;
      frame.stats.selfUs += Math.max(0, elapsed - frame.childrenUs);
      this.moduleStack.pop();
      const parent = this.moduleStack.at(-1);
      if (parent) parent.childrenUs += elapsed;
    });
  }

  beginTeardown() {
    if (!this.closed) this.measure(() => this.transition('teardown'));
  }

  finalize() {
    if (!this.finalization) this.finalization = this.finish();
    return this.finalization;
  }

  async finish() {
    this.closed = true;
    this.beginOverhead();
    const point = this.point('afterteardown');
    if (this.activityStack.length || this.moduleStack.length) {
      this.flushActivity(point.tUs);
      this.invalidateActivityTiming('active activity at finalization');
      this.activityStack.length = 0;
    }
    for (const item of this.activeTests.values()) {
      this.endBody(item, point.tUs);
      item.record.endUs = point.tUs;
      // An aborted attempt has no reliable completed CPU/heap interval.
      item.record.cpuUserUs = item.record.cpuSystemUs = item.record.heapDeltaBytes = null;
    }
    if (this.hook?.owner) this.hook.owner.record.hookUs += point.tUs - this.hook.startUs;
    this.transition('profiler', null, point.tUs);
    try {
      await this.stopHeap();
      if (this.cpuRunning) {
        try {
          const { profile } = await this.post('Profiler.stop');
          if (!profile) throw new Error('Inspector returned no CPU profile');
          this.data.cpuProfile = profile;
        } catch (error) {
          this.warn(`CPU profile unavailable: ${error.message}`);
        }
      }
    } finally {
      this.disconnectInspector();
      // GC entries are delivered on a later host turn, not through the environment's fake timers.
      await new Promise(hostSetImmediate);
      this.collectGC(this.observer?.takeRecords() || []);
      this.observer?.disconnect();
      this.observer = null;
      this.data.status = this.runFinished && !this.failed && this.activeTests.size === 0 ? 'complete' : 'error';
      if (!this.runFinished) this.warn('Suite ended before run_finish; its last heap phase includes the aborted run and cleanup.');
      this.measure(() => {
        for (const [filename, stats] of this.modules) {
          try {
            stats.sourceBytes = fs.statSync(filename).size;
          } catch {
            // Virtual, removed, or inaccessible files still retain their evaluation measurements.
          }
          this.data.modules.push(stats);
        }
        this.modules.clear();
        this.edges.clear();
        this.moduleStack.length = 0;
        this.activeTests.clear();
        this.testStates = new WeakMap();
        this.hook = null;
      });
      this.data.endUs = this.now();
      this.closeSegment(this.data.endUs);
      this.activityStack.length = 0;
      this.endOverhead();
    }
    this.outputPath = this.writeRaw();
    return this.outputPath;
  }

  writeRaw() {
    const hash = createHash('sha256').update(this.data.suite).digest('hex').slice(0, 16);
    const prefix = path.join(this.config.outputDir, 'raw', `${hash}-${process.pid}`);
    let temporary;
    let destination;
    let fd;
    let ownsTemporary = false;
    try {
      // Exclusive temporary files reserve attempts without retaining suites in a host-global map.
      for (let attempt = 1; ; attempt++) {
        destination = `${prefix}-${attempt}.json.gz`;
        temporary = `${destination}.tmp`;
        try {
          fd = fs.openSync(temporary, 'wx');
          ownsTemporary = true;
        } catch (error) {
          if (error.code === 'EEXIST') continue;
          throw error;
        }
        if (!fs.existsSync(destination)) break;
        fs.closeSync(fd);
        fd = undefined;
        fs.unlinkSync(temporary);
        ownsTemporary = false;
      }
      fs.writeFileSync(fd, gzipSync(JSON.stringify(this.data)));
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(temporary, destination);
      return destination;
    } catch (cause) {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch {}
      }
      if (ownsTemporary) {
        try { fs.unlinkSync(temporary); } catch {}
      }
      throw new Error(`Cannot write shard profile ${destination}: ${cause.message}`, { cause });
    }
  }
}

function attachRecorder(environment, recorder) {
  if (environment.__grafanaShardProfile) return environment.__grafanaShardProfile;
  environment.__grafanaShardProfile = recorder;
  const originalEvent = environment.handleTestEvent;
  const originalTeardown = environment.teardown;
  environment.handleTestEvent = function (...args) {
    const invokeOriginal = () => {
      try {
        const result = originalEvent?.apply(this, args);
        if (result && typeof result.then === 'function') {
          return Promise.resolve(result).catch((error) => {
            recorder.failed = true;
            throw error;
          });
        }
        return result;
      } catch (error) {
        recorder.failed = true;
        throw error;
      }
    };
    const result = recorder.handleTestEvent(...args);
    return result && typeof result.then === 'function' ? result.then(invokeOriginal) : invokeOriginal();
  };
  environment.teardown = async function (...args) {
    recorder.beginTeardown();
    let result;
    let failure;
    let didFail = false;
    try {
      result = await originalTeardown.apply(this, args);
    } catch (error) {
      didFail = true;
      failure = error;
      recorder.failed = true;
    }
    try {
      await recorder.finalize();
    } catch (error) {
      if (didFail) throw new AggregateError([failure, error], 'Environment teardown and shard profile write failed', { cause: failure });
      throw error;
    }
    if (didFail) throw failure;
    return result;
  };
  return recorder;
}

function finalizeConstructorFailure(recorder) {
  recorder.failed = true;
  recorder.beginTeardown();
  // A constructor cannot await cleanup; keep its original error and report a separate disk failure.
  void recorder.finalize().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { Recorder, readConfig, attachRecorder, finalizeConstructorFailure };
