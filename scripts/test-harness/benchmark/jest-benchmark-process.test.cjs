const assert = require('node:assert/strict');
const { spawnSync, fork } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jest benchmark process '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const metrics = path.join(root, 'metrics');
  fs.mkdirSync(metrics, { mode: 0o700 });
  const preload = path.join(root, 'preload with spaces.cjs');
  fs.copyFileSync(path.join(__dirname, '../../jest-benchmark-process.cjs'), preload);
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GRAFANA_BENCHMARK_') || key === 'JEST_WORKER_ID' || key === 'NODE_OPTIONS') {
      delete env[key];
    }
  }
  env.GRAFANA_BENCHMARK_METRICS_DIR = metrics;
  env.NODE_OPTIONS = `--require ${JSON.stringify(preload)}`;

  function script(name, source) {
    const filename = path.join(root, name);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, source);
    return filename;
  }

  function run(entry, overrides = {}, args = []) {
    const result = spawnSync(process.execPath, [...args, entry], {
      env: { ...env, ...overrides },
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    return result;
  }

  function reports() {
    return fs.readdirSync(metrics).filter((name) => name.endsWith('.json')).map((name) => ({
      filename: name,
      ...JSON.parse(fs.readFileSync(path.join(metrics, name), 'utf8')),
    }));
  }

  return { metrics, env, script, run, reports };
}

function checkReport(report, { role = 'child', workerId = null, workerModule = null, complete = true, gc = false } = {}) {
  assert.ok(Number.isInteger(report.pid) && report.pid > 0);
  assert.ok(Number.isInteger(report.ppid) && report.ppid > 0);
  assert.equal(report.role, role);
  assert.equal(report.workerId, workerId);
  assert.equal(report.workerModule, workerModule);
  assert.equal(report.complete, complete);
  assert.equal(new Date(report.startedAt).toISOString(), report.startedAt);
  assert.ok(Number.isFinite(report.lifetimeMs) && report.lifetimeMs >= 0);
  if (!gc) {
    assert.equal(report.gc, null);
    return;
  }
  const counters = report.gc;
  assert.deepEqual(Object.keys(counters.byKind).sort(), ['incremental', 'major', 'minor', 'other', 'weakcb']);
  let count = 0;
  let durationMs = 0;
  for (const bucket of Object.values(counters.byKind)) {
    assert.ok(Number.isInteger(bucket.count) && bucket.count >= 0);
    assert.ok(Number.isFinite(bucket.durationMs) && bucket.durationMs >= 0);
    count += bucket.count;
    durationMs += bucket.durationMs;
  }
  assert.equal(counters.count, count);
  assert.ok(Math.abs(counters.durationMs - durationMs) < 0.000001);
}

test('unset metrics directory opts out, even with GC enabled', (t) => {
  const f = fixture(t);
  const result = f.run(f.script('child.cjs', ''), {
    GRAFANA_BENCHMARK_METRICS_DIR: undefined,
    GRAFANA_BENCHMARK_GC: '1',
  });
  assert.equal(result.stderr, '');
  assert.deepEqual(fs.readdirSync(f.metrics), []);
});

test('startup is incomplete and normal exit replaces the same report without GC', (t) => {
  const f = fixture(t);
  const result = f.run(f.script('child.cjs', `
    const fs = require('node:fs');
    const path = require('node:path');
    const dir = process.env.GRAFANA_BENCHMARK_METRICS_DIR;
    const files = fs.readdirSync(dir);
    console.log(JSON.stringify({ filename: files[0], ...JSON.parse(fs.readFileSync(path.join(dir, files[0]))) }));
  `));
  const startup = JSON.parse(result.stdout);
  checkReport(startup, { complete: false });
  const [final] = f.reports();
  checkReport(final);
  assert.equal(final.filename, startup.filename);
  assert.equal(final.pid, startup.pid);
  assert.equal(final.ppid, process.pid);
  assert.equal(final.startedAt, startup.startedAt);
  assert.ok(final.lifetimeMs >= startup.lifetimeMs);
  assert.deepEqual(fs.readdirSync(f.metrics), [final.filename]);
  assert.equal(result.stderr, '');
});

test('coordinator and forked workers inherit NODE_OPTIONS, but unrelated descendants remain children', (t) => {
  const f = fixture(t);
  const worker = f.script(
    'node_modules/.pnpm/jest-worker@29.7.0/node_modules/jest-worker/build/workers/processChild.js',
    "process.on('message', () => process.disconnect());"
  );
  const workerModule = f.script('jest-runner/build/testWorker.js', '');
  const child = f.script('unrelated child.cjs', '');
  const coordinator = f.script('jest with spaces/bin/jest.js', `
    const { fork, spawnSync } = require('node:child_process');
    const { once } = require('node:events');
    (async () => {
      const worker = fork(${JSON.stringify(worker)}, [], {
        execArgv: [], env: { ...process.env, JEST_WORKER_ID: '7' },
      });
      worker.send([0, false, ${JSON.stringify(workerModule)}, []]);
      const [code] = await once(worker, 'exit');
      if (code !== 0) process.exitCode = 1;
      const child = spawnSync(process.execPath, [${JSON.stringify(child)}], {
        env: { ...process.env, JEST_WORKER_ID: '7' },
      });
      if (child.status !== 0) process.exitCode = 1;
    })().catch(() => { process.exitCode = 1; });
  `);
  f.run(coordinator, { GRAFANA_BENCHMARK_JEST_ENTRY: coordinator, JEST_WORKER_ID: 'parent' });
  const reports = f.reports();
  assert.equal(reports.length, 3);
  const parent = reports.find((report) => report.role === 'coordinator');
  checkReport(parent, { role: 'coordinator', workerId: 'parent' });
  for (const role of ['worker', 'child']) {
    const report = reports.find((report) => report.role === role);
    checkReport(report, { role, workerId: '7', workerModule: role === 'worker' ? workerModule : null });
    assert.equal(report.ppid, parent.pid);
  }
});

test('short-lived replacement workers with the same worker ID have independent reports', (t) => {
  const f = fixture(t);
  const worker = f.script('jest-worker/build/workers/processChild.js', 'process.exit(0);');
  for (let i = 0; i < 3; i++) {
    f.run(worker, { JEST_WORKER_ID: '1' });
  }
  const reports = f.reports();
  assert.equal(reports.length, 3);
  assert.equal(new Set(reports.map((report) => report.filename)).size, 3);
  for (const report of reports) {
    checkReport(report, { role: 'worker', workerId: '1' });
  }
});

test('init IPC identifies both worker pools and removes only the preload listener', { timeout: 10000 }, async (t) => {
  const f = fixture(t);
  const entry = f.script('jest-worker/build/workers/processChild.js', `
    const initialListeners = process.listeners('message');
    function otherListener(message) {
      const listeners = process.listeners('message');
      process.send({
        message,
        ownListenerPresent: initialListeners.some((listener) => listeners.includes(listener)),
        otherListenerPresent: listeners.includes(otherListener),
      });
      if (message === 'done') process.disconnect();
    }
    process.on('message', otherListener);
  `);
  for (const moduleName of ['jest-haste-map/build/worker.js', 'jest-runner/build/testWorker.js']) {
    const workerModule = f.script(moduleName, '');
    const child = fork(entry, [], {
      env: { ...f.env, JEST_WORKER_ID: '1' },
      execArgv: [],
      silent: true,
    });
    const exited = once(child, 'exit');
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await exited;
    });
    async function send(message, ownListenerPresent) {
      const received = once(child, 'message');
      child.send(message);
      const [reply] = await received;
      assert.deepEqual(reply, { message, ownListenerPresent, otherListenerPresent: true });
      return f.reports().find((report) => report.pid === child.pid);
    }
    let startup;
    for (const message of [null, 'unrelated', { 0: 0, 2: workerModule }, [1, false, workerModule], [0], [0, false, 42], [0, false, '']]) {
      const report = await send(message, true);
      checkReport(report, { role: 'worker', workerId: '1', complete: false });
      startup ??= report;
      assert.deepEqual(report, startup);
    }
    const initialized = await send([0, false, workerModule, []], false);
    checkReport(initialized, { role: 'worker', workerId: '1', workerModule, complete: false });
    assert.equal(initialized.filename, startup.filename);
    assert.ok(initialized.lifetimeMs >= startup.lifetimeMs);
    assert.equal(initialized.ppid, process.pid);
    const unchanged = await send([0, false, workerModule + '.ignored', []], false);
    assert.deepEqual(unchanged, initialized);
    await send('done', false);
    assert.deepEqual(await exited, [0, null]);
    checkReport(f.reports().find((report) => report.pid === child.pid), {
      role: 'worker', workerId: '1', workerModule,
    });
  }
  assert.equal(f.reports().length, 2);
  assert.equal(new Set(f.reports().map((report) => report.workerModule)).size, 2);
});

test('worker entry without JEST_WORKER_ID is a child, and GC requires exactly 1', (t) => {
  const f = fixture(t);
  f.run(f.script('jest-worker/build/workers/processChild.js', ''), { GRAFANA_BENCHMARK_GC: 'true' });
  checkReport(f.reports()[0]);
});

test('GC counters are collected on normal exit without keeping the process alive', (t) => {
  const f = fixture(t);
  f.run(f.script('gc.cjs', `
    global.gc();
    setTimeout(() => {
      global.gc();
      setTimeout(() => {}, 50);
    }, 50);
  `), { GRAFANA_BENCHMARK_GC: '1' }, ['--expose-gc']);
  const reports = f.reports();
  assert.equal(reports.length, 1);
  checkReport(reports[0], { gc: true });
  assert.ok(reports[0].gc.byKind.major.count >= 2);
});

test('immediate exit writes a final snapshot without waiting for GC notifications', (t) => {
  const f = fixture(t);
  f.run(f.script('immediate gc.cjs', 'global.gc(); process.exit(0);'), {
    GRAFANA_BENCHMARK_GC: '1',
  }, ['--expose-gc']);
  const reports = f.reports();
  assert.equal(reports.length, 1);
  checkReport(reports[0], { gc: true });
});

test('worker threads do not create duplicate process reports', (t) => {
  const f = fixture(t);
  f.run(f.script('threads.cjs', `
    const { Worker } = require('node:worker_threads');
    new Worker('', { eval: true });
  `), { GRAFANA_BENCHMARK_GC: '1' });
  assert.equal(f.reports().length, 1);
  checkReport(f.reports()[0], { gc: true });
});

test('checkpoint replaces startup and a killed process leaves an incomplete report', { timeout: 15000 }, async (t) => {
  const f = fixture(t);
  const entry = f.script('long lived.cjs', `
    global.gc();
    process.send('ready');
    setInterval(() => {}, 1000);
  `);
  const child = fork(entry, [], {
    env: { ...f.env, GRAFANA_BENCHMARK_GC: '1' },
    execArgv: ['--expose-gc'],
    silent: true,
  });
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
  });
  await once(child, 'message');
  const [startup] = f.reports();
  checkReport(startup, { complete: false, gc: true });
  assert.equal(startup.gc.count, 0);
  const deadline = Date.now() + 9000;
  let checkpoint;
  do {
    await delay(50);
    [checkpoint] = f.reports();
  } while (checkpoint.lifetimeMs === startup.lifetimeMs && Date.now() < deadline);
  assert.ok(checkpoint.lifetimeMs > startup.lifetimeMs);
  assert.ok(checkpoint.gc.byKind.major.count >= 1);
  assert.equal(checkpoint.filename, startup.filename);
  child.kill('SIGKILL');
  const [code, signal] = await exited;
  assert.equal(code, null);
  assert.equal(signal, 'SIGKILL');
  assert.equal(f.reports().length, 1);
  checkReport(f.reports()[0], { complete: false, gc: true });
});

test('write failures warn only once and preserve the child exit code', (t) => {
  const f = fixture(t);
  const result = f.run(f.script('failure.cjs', 'process.exit(0);'), {
    GRAFANA_BENCHMARK_METRICS_DIR: path.join(f.metrics, 'missing directory'),
  });
  assert.match(result.stderr, /Jest benchmark: could not write process metrics:/);
  assert.equal(result.stderr.trim().split('\n').length, 1);
  assert.deepEqual(f.reports(), []);
});
