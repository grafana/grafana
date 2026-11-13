const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const suite = process.argv[2];
assert(require(path.join(root, 'scripts/test-harness/jsdom-shard-1.metrics.json')).selectedSuites.includes(suite));
const directPublic = process.argv.includes('--direct-public');
const resolver = directPublic ? { moduleDirectories: ['node_modules'], modulePaths: [path.join(root, 'public')] } : {};
const directory = fs.mkdtempSync(path.join(root, `local/shard1-profile/results/alloc${directPublic ? '-resolver' : ''}-`));
const cache = path.join(directory, 'cache');
const config = path.join(directory, 'jest.config.cjs');
fs.writeFileSync(config, `module.exports = { ...require(${JSON.stringify(path.join(root, 'jest.happy-dom.config.js'))}), rootDir: ${JSON.stringify(root)}, testEnvironment: ${JSON.stringify(path.join(__dirname, 'phase-environment.cjs'))}, workerIdleMemoryLimit: undefined, cacheDirectory: ${JSON.stringify(cache)}, watchPlugins: [], ...${JSON.stringify(resolver)} };\n`);
const runs = {};
try {
  for (const mode of ['cold', 'warm']) {
    const disk = fs.statfsSync(root);
    assert(Number(disk.bavail) * Number(disk.bsize) > 400000000, 'Insufficient disk headroom for allocation run');
    const prefix = path.join(directory, mode);
    const fd = fs.openSync(`${prefix}.log`, 'w');
    const started = performance.now();
    console.log('Allocation profile:', suite, mode, directory);
    const result = spawnSync(process.execPath, ['--expose-gc', '--require', path.join(__dirname, 'allocations.cjs'), require.resolve('jest/bin/jest'), '--config', config, '--ci', '--watch=false', '--watchAll=false', '--runInBand', '--json', '--outputFile', `${prefix}.results.json`, '--runTestsByPath', suite], {
      cwd: root, env: { ...process.env, CI: 'true', SHARD1_PHASE_LOG: `${prefix}.phases.jsonl`, SHARD1_ALLOCATION_PROFILE: prefix }, stdio: ['ignore', fd, fd], timeout: 180000,
    });
    fs.closeSync(fd);
    runs[mode] = { status: result.status, signal: result.signal, error: result.error?.message, wallMs: performance.now() - started };
    console.log(JSON.stringify(runs[mode]));
    if (result.status !== 0) { process.exitCode = 1; break; }
  }
} finally {
  fs.writeFileSync(path.join(directory, 'run.json'), JSON.stringify({ suite, resolver, samplingInterval: 1048576, includeCollectedObjects: true, forcedGcAtPhaseBoundaries: true, runs }, null, 2));
  fs.rmSync(cache, { recursive: true, force: true });
}
