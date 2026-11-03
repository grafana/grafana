import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';

import { collectProcessMetrics, printMetrics } from '../../jest-benchmark-metrics.mts';

for (const gcEnabled of [true, false]) {
  test(`aggregates GC=${gcEnabled} and distinguishes test replacements from other worker pools`, async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'jest-metrics-test-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const testWorker = {
      role: 'worker',
      workerModule: '/node_modules/jest-runner/build/testWorker.js',
      workerId: '1',
      complete: true,
    };
    const entries = [
      {
        role: 'coordinator', workerId: null, workerModule: null, complete: true,
        gc: { count: 1, durationMs: 2, byKind: { minor: { count: 1, durationMs: 2 } } },
      },
      {
        ...testWorker,
        gc: {
          count: 3, durationMs: 10,
          byKind: { major: { count: 2, durationMs: 8 }, minor: { count: 1, durationMs: 2 } },
        },
      },
      {
        ...testWorker, complete: false,
        gc: { count: 1, durationMs: 3, byKind: { major: { count: 1, durationMs: 3 } } },
      },
      { ...testWorker, workerId: '2', gc: null },
      { ...testWorker, ppid: 99, gc: null },
      { ...testWorker, workerModule: '/node_modules/jest-haste-map/build/worker.js', gc: null },
      { ...testWorker, workerModule: '/some-other-worker.js', gc: null },
      { role: 'child', workerId: '2', workerModule: null, complete: true, gc: null },
    ];
    for (const [index, entry] of entries.entries()) {
      await writeFile(path.join(directory, `${index}.json`), JSON.stringify({ pid: 100 + index, ppid: 1, ...entry }));
    }
    await writeFile(path.join(directory, 'unfinished.json.tmp'), '{');
    const result = await collectProcessMetrics(directory, gcEnabled);
    assert.equal(result.workerStarts, 4);
    assert.equal(result.workerReplacements, 1);
    assert.equal(result.hasteMapWorkerStarts, 1);
    assert.equal(result.otherWorkerStarts, 1);
    assert.equal(result.processStarts, 8);
    assert.equal(result.incompleteProcesses, 1);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.gc, gcEnabled ? {
      count: 5,
      durationMs: 15,
      byKind: { minor: { count: 2, durationMs: 4 }, major: { count: 3, durationMs: 11 } },
    } : null);
  });
}

test('reports missing instrumentation and unreadable reports instead of silently claiming complete counts', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jest-metrics-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'corrupt.json'), '{');
  const processes = await collectProcessMetrics(directory, true);
  assert.equal(processes.errors.length, 2);
  assert.match(processes.errors[0], /Cannot read process metrics corrupt.json/);
  assert.match(processes.errors[1], /coordinator did not report/);
  const log = t.mock.method(console, 'log', () => {});
  const error = t.mock.method(console, 'error', () => {});
  printMetrics({ ...summaryInput(), processes });
  assert.equal(log.mock.callCount(), 1);
  const table = log.mock.calls[0].arguments[0];
  assert.match(table, /^Processes +INCOMPLETE$/m);
  assert.match(table, /^GC \(observed aggregate\) +INCOMPLETE$/m);
  assert.deepEqual(error.mock.calls.map((call) => call.arguments),
    processes.errors.map((warning) => [`Benchmark metrics warning: ${warning}`]));
});

function summaryInput(): Parameters<typeof printMetrics>[0] {
  return {
    executionMs: 12345,
    totalMs: 15678,
    exitCode: 1,
    metricsEnabled: true,
    rss: {
      supported: true, intervalMs: 250, samples: 50,
      peakBytes: 256.25 * 1024 ** 2, averageBytes: 128.125 * 1024 ** 2,
      durationMs: 12345, errors: [],
    },
    processes: {
      processStarts: 8, workerStarts: 4, workerReplacements: 1,
      hasteMapWorkerStarts: 1, otherWorkerStarts: 1, incompleteProcesses: 0,
      gc: {
        count: 5, durationMs: 15,
        byKind: { major: { count: 3, durationMs: 11 }, minor: { count: 2, durationMs: 4 } },
      },
      processes: [], errors: [],
    },
  };
}

function render(t: TestContext, input = summaryInput()) {
  const output: Array<{ method: string; args: unknown[] }> = [];
  t.mock.method(console, 'log', (...args: unknown[]) => { output.push({ method: 'log', args }); });
  t.mock.method(console, 'error', (...args: unknown[]) => { output.push({ method: 'error', args }); });
  printMetrics(input);
  assert.equal(output[0].method, 'log');
  assert.equal(output.filter(({ method }) => method === 'log').length, 1);
  assert.equal(output[0].args.length, 1);
  return { table: String(output[0].args[0]), warnings: output.slice(1) };
}

const timingTable = `
Benchmark summary
Timing
  Jest execution                    12.35 s
  Total (discovery/setup included)  15.68 s
  Exit code                         1`;

test('prints one plain-text hierarchical table with aligned values and explicit units', (t) => {
  const { table, warnings } = render(t);
  assert.equal(table, `${timingTable}
Memory (summed RSS @ 250ms)
  Sampled peak                      256.3 MiB
  Time-weighted average             128.1 MiB
  Samples                           50
Processes
  Node process starts               8
  Test-worker starts                4
  Test-worker replacements          1
  Haste-map worker starts           1
  Other worker starts               1
GC (observed aggregate)
  Duration                          0.015 s
  Events                            5
  Major duration                    0.011 s
  Minor duration                    0.004 s
  Missing final reports             0`);
  assert.deepEqual(warnings, []);
});

test('uses the actual sampling interval in the memory heading without a separate interval row', (t) => {
  const input = summaryInput();
  input.rss!.intervalMs = 500;
  const { table } = render(t, input);
  assert.match(table, /^Memory \(summed RSS @ 500ms\)$/m);
  assert.doesNotMatch(table, /Sampling interval/);
});

test('shows disabled GC without fabricated GC values', (t) => {
  const input = summaryInput();
  input.processes!.gc = null;
  const { table, warnings } = render(t, input);
  assert.match(table, /^GC \(observed aggregate\) +disabled \(--noGc\)$/m);
  assert.doesNotMatch(table, /  (Duration|Events|Major duration|Minor duration|Missing final reports)/);
  assert.match(table, /256\.3 MiB/);
  assert.deepEqual(warnings, []);
});

for (const withMetrics of [true, false]) {
  test(`shows only timing and instrumentation status when metrics are disabled (data present=${withMetrics})`, (t) => {
    const input = summaryInput();
    input.metricsEnabled = false;
    if (withMetrics) {
      input.rss!.errors.push('Ignored disabled instrumentation');
      input.processes!.incompleteProcesses = 1;
    } else {
      input.rss = null;
      input.processes = null;
    }
    const { table, warnings } = render(t, input);
    assert.equal(table, `${timingTable}\nInstrumentation                     disabled (--noMetrics)`);
    assert.deepEqual(warnings, []);
  });
}

for (const supported of [true, false]) {
  test(`reports unavailable RSS without zero memory values (supported=${supported})`, (t) => {
    const input = summaryInput();
    Object.assign(input.rss!, { supported, samples: 0, peakBytes: null, averageBytes: null });
    const { table, warnings } = render(t, input);
    const reason = supported ? 'no valid samples' : 'requires Linux /proc';
    assert.ok(table.includes(`  Sampled peak                      unavailable (${reason})`));
    assert.ok(table.includes(`  Time-weighted average             unavailable (${reason})`));
    assert.match(table, /^  Samples +0$/m);
    assert.match(table, /^Memory \(summed RSS @ 250ms\)$/m);
    assert.doesNotMatch(table, /Sampling interval/);
    assert.doesNotMatch(table, /MiB/);
    assert.deepEqual(warnings, []);
  });
}

for (const missing of ['rss', 'processes', 'both']) {
  test(`reports unavailable metrics when ${missing} is missing`, (t) => {
    const input = summaryInput();
    if (missing !== 'processes') {
      input.rss = null;
    }
    if (missing !== 'rss') {
      input.processes = null;
    }
    const { table, warnings } = render(t, input);
    if (!input.rss) {
      assert.match(table, /^Memory \(summed RSS\)$/m);
      for (const label of ['Sampled peak', 'Time-weighted average', 'Samples']) {
        assert.match(table, new RegExp(`^  ${label} +unavailable$`, 'm'));
      }
    } else {
      assert.match(table, /256\.3 MiB/);
    }
    if (!input.processes) {
      assert.match(table, /^Processes +unavailable$/m);
      assert.match(table, /^  Node process starts +unavailable$/m);
      assert.doesNotMatch(table, /Missing final reports/);
      assert.match(table, /^GC \(observed aggregate\) +unavailable$/m);
      assert.doesNotMatch(table, /--noGc|  Duration/);
    } else {
      assert.match(table, /^  Node process starts +8$/m);
    }
    assert.deepEqual(warnings, []);
  });
}

test('marks partial sections and prints individual warnings after the table', (t) => {
  const input = summaryInput();
  input.rss!.errors.push('Cannot sample a process', 'Cannot read /proc');
  input.processes!.errors.push('Cannot read process metrics worker.json');
  input.processes!.incompleteProcesses = 2;
  const { table, warnings } = render(t, input);
  assert.match(table, /^Memory \(summed RSS @ 250ms\) +INCOMPLETE$/m);
  assert.match(table, /^Processes +INCOMPLETE$/m);
  assert.match(table, /^GC \(observed aggregate\) +INCOMPLETE$/m);
  assert.match(table, /^  Missing final reports +2$/m);
  assert.match(table, /256\.3 MiB/);
  assert.match(table, /0\.015 s/);
  assert.deepEqual(warnings, [
    'Cannot sample a process',
    'Cannot read /proc',
    'Cannot read process metrics worker.json',
  ].map((warning) => ({ method: 'error', args: [`Benchmark metrics warning: ${warning}`] })));
});

test('missing final reports appear only in the GC table without a duplicate warning', (t) => {
  const input = summaryInput();
  input.processes!.incompleteProcesses = 1;
  const { table, warnings } = render(t, input);
  assert.match(table, /^Memory \(summed RSS @ 250ms\)$/m);
  assert.match(table, /^Processes$/m);
  assert.match(table, /^GC \(observed aggregate\) +INCOMPLETE$/m);
  assert.match(table, /GC \(observed aggregate\)[\s\S]*\n  Missing final reports +1$/);
  assert.doesNotMatch(table.split('GC (observed aggregate)')[0], /Missing final reports/);
  assert.deepEqual(warnings, []);
});
