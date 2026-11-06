const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const output = path.join(root, 'local/shard1-profile/results');
const roster = require(path.join(root, 'scripts/test-harness/jsdom-shard-1.metrics.json')).selectedSuites;
const suiteArgs = process.argv.slice(2);
const selected = suiteArgs.length ? suiteArgs : roster;
for (const file of selected) assert(roster.includes(file), `Not in shard 1: ${file}`);
const run = fs.mkdtempSync(path.join(output, suiteArgs.length ? 'smoke-' : 'shard-'));
const cache = path.join(run, 'cache');
const configFile = path.join(run, 'jest.config.cjs');
fs.writeFileSync(configFile, `module.exports = { ...require(${JSON.stringify(path.join(root, 'jest.happy-dom.config.js'))}), rootDir: ${JSON.stringify(root)}, testEnvironment: ${JSON.stringify(path.join(__dirname, 'phase-environment.cjs'))}, cacheDirectory: ${JSON.stringify(cache)}, maxWorkers: 1, watchPlugins: [] };\n`);
const args = [require.resolve('jest/bin/jest'), '--config', configFile, '--ci', '--watch=false', '--watchAll=false', '--json', '--outputFile', path.join(run, 'jest-results.json'), '--logHeapUsage', '--runTestsByPath', ...selected];
const log = fs.openSync(path.join(run, 'jest.log'), 'w');
const started = performance.now();
console.log('One-worker shard-1 diagnostic:', run);
const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, CI: 'true', SHARD1_PHASE_LOG: path.join(run, 'phases.jsonl') }, detached: true, stdio: ['ignore', log, log] });
let stopped;
const stop = (reason) => {
  if (stopped) return;
  stopped = reason;
  console.error(reason);
  process.kill(-child.pid, 'SIGTERM');
};
const timer = setInterval(() => {
  const disk = fs.statfsSync(root);
  if (Number(disk.bavail) * Number(disk.bsize) < 220000000) stop('Stopped before crossing disk reserve');
  if (performance.now() - started > 850000) stop('Stopped at 850-second diagnostic timeout');
}, 1000);
const progress = setInterval(() => {
  const file = path.join(run, 'phases.jsonl');
  const completed = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').length : 0;
  console.log('Completed instrumented suites:', completed, '/', selected.length, 'elapsed seconds:', ((performance.now() - started) / 1000).toFixed(1));
}, 15000);
child.on('error', (error) => { console.error(error); clearInterval(timer); clearInterval(progress); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  clearInterval(timer); clearInterval(progress); fs.closeSync(log);
  const metadata = { node: process.version, selected, workers: 1, coldJestCache: true, wallMs: performance.now() - started, code, signal, stopped, cacheBytesRemoved: true };
  fs.writeFileSync(path.join(run, 'run.json'), JSON.stringify(metadata, null, 2));
  fs.rmSync(cache, { recursive: true, force: true });
  console.log('Diagnostic finished:', JSON.stringify({ run, code, signal, stopped, seconds: metadata.wallMs / 1000 }));
  process.exitCode = code === 0 && !stopped ? 0 : 1;
});
