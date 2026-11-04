const fs = require('node:fs');
const path = require('node:path');
const { performance, PerformanceObserver } = require('node:perf_hooks');
const root = path.resolve(__dirname, '../../..');
const Base = require(path.join(root, 'public/test/happy-dom-environment.js'));

module.exports = class PhaseEnvironment extends Base {
  constructor(config, context) {
    const start = performance.now();
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    super(config, context);
    this.profile = {
      suite: path.relative(root, context.testPath), pid: process.pid,
      start, cpu, points: [{ phase: 'beforeEnvironment', ms: start, memory }],
      hooks: {}, tests: [], gc: { count: 0, durationMs: 0 },
    };
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.profile.gc.count++;
        this.profile.gc.durationMs += entry.duration;
      }
    });
    this.observer.observe({ entryTypes: ['gc'] });
    this.point('environmentConstructed');
  }
  point(phase) {
    this.profile.points.push({ phase, ms: performance.now(), memory: process.memoryUsage() });
  }
  async setup() {
    await super.setup();
    this.point('environmentSetup');
  }
  async handleTestEvent(event, state) {
    if (event.name === 'run_start' || event.name === 'run_finish') {
      this.point(event.name);
      if (process.env.SHARD1_ALLOCATION_PROFILE) {
        const allocations = require('./allocations.cjs');
        await allocations.checkpoint(event.name === 'run_start' ? 'tests-hooks' : 'teardown');
        allocations.retention(event.name);
      }
    }
    if (event.name === 'hook_start') this.hookStart = performance.now();
    if (event.name === 'hook_success' || event.name === 'hook_failure') {
      const entry = this.profile.hooks[event.hook.type] ??= { count: 0, ms: 0 };
      entry.count++;
      entry.ms += performance.now() - this.hookStart;
    }
    if (event.name === 'test_fn_start') this.testStart = performance.now();
    if (event.name === 'test_fn_success' || event.name === 'test_fn_failure') {
      const names = [];
      for (let item = event.test; item?.parent; item = item.parent) names.unshift(item.name);
      this.profile.tests.push({ name: names.join(' > '), ms: performance.now() - this.testStart, failed: event.name === 'test_fn_failure' });
    }
    if (super.handleTestEvent) await super.handleTestEvent(event, state);
  }
  async teardown() {
    this.point('beforeTeardown');
    try { await super.teardown(); }
    finally {
      this.point('afterTeardown');
      if (process.env.SHARD1_ALLOCATION_PROFILE) require('./allocations.cjs').retention('afterEnvironmentTeardown');
      this.profile.cpu = process.cpuUsage(this.profile.cpu);
      this.profile.end = performance.now();
      this.observer.disconnect();
      fs.appendFileSync(process.env.SHARD1_PHASE_LOG, JSON.stringify(this.profile) + '\n');
    }
  }
};
