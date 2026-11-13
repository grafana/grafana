import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';

import { applyRoster, loadBenchmarkConfig } from '../../../jest-benchmark-config.mts';
import { benchmarkMetadata } from '../../../jest-benchmark-metrics.mts';
import { createBenchmarkStderrFilter } from '../../../jest-benchmark.mts';

import { loadProfileConfiguration } from './configuration.mts';

const require = createRequire(import.meta.url);
const { buildSummary } = require('./summarize.cjs');
const directory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export function integer(value: string | undefined, fallback: number, name: string, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  const result = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(result) || result > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  }
  return result;
}

export async function selectSuites(
  rootDir: string,
  config: Awaited<ReturnType<typeof loadBenchmarkConfig>>,
  shard: string,
  selectionFile: string | undefined,
  discover: (args: string[]) => Promise<unknown>,
  suiteFilter?: string
) {
  let selected: unknown;
  if (selectionFile) {
    const report = JSON.parse(await readFile(path.resolve(rootDir, selectionFile), 'utf8'));
    if (report.schemaVersion !== 1 || report.shard !== shard) {
      throw new Error('--selectionFile must be a benchmark metrics report for the requested shard.');
    }
    if (!Array.isArray(report.selectedSuites) || !report.selectedSuites.length) {
      throw new Error('--selectionFile must contain a nonempty selectedSuites array.');
    }
    selected = report.selectedSuites.map((file: unknown) => {
      if (typeof file !== 'string' || !file || path.isAbsolute(file) || path.win32.isAbsolute(file) || file.includes('\\') || file.includes('\0')) {
        throw new Error('Selection paths must be root-relative paths.');
      }
      const absolute = path.resolve(rootDir, file);
      const relative = path.relative(rootDir, absolute);
      if (relative === '..' || relative.startsWith(`..${path.sep}`)) throw new Error('Selection paths must stay inside rootDir.');
      return absolute;
    });
  } else {
    selected = await discover([`--shard=${shard}`]);
  }
  if (!Array.isArray(selected) || !selected.length || !selected.every((file) => typeof file === 'string')) {
    throw new Error('Jest discovery must return a nonempty array of suite paths.');
  }
  const needsInventory = selectionFile || config.roster.include.length || config.roster.groups.length;
  const candidates = needsInventory ? await discover([]) : selected;
  if (!Array.isArray(candidates) || !candidates.every((file) => typeof file === 'string')) {
    throw new Error('Jest inventory must return an array of suite paths.');
  }
  const roster = applyRoster(rootDir, selected, candidates, config.roster);
  const eligible = new Set(candidates);
  if (roster.files.some((file) => !eligible.has(file))) throw new Error('Selected suites are unavailable in the Jest inventory.');
  const relative = (file: string) => path.relative(rootDir, file).split(path.sep).join('/');
  const files = roster.files.filter((file) => !suiteFilter || path.posix.matchesGlob(relative(file), suiteFilter));
  if (!files.length) throw new Error('The configured roster and suite filter selected no suites.');
  return {
    files,
    selectedSuites: files.map(relative),
    rosterSuites: roster.files.length,
    added: roster.added.map(relative),
    excluded: roster.excluded.map(relative),
  };
}

export async function summarizeDirectory(outputDir: string, maxBytes?: number) {
  const manifest = JSON.parse(await readFile(path.join(outputDir, 'run.json'), 'utf8'));
  let jestResults;
  let jestResultsError: string | undefined;
  try {
    jestResults = JSON.parse(await readFile(path.join(outputDir, 'jest-results.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      jestResultsError = error instanceof Error ? error.message : String(error);
    }
  }
  const files = (await readdir(path.join(outputDir, 'raw'))).filter((file) => file.endsWith('.json.gz')).sort();
  const descriptors = [];
  const recordErrors: string[] = [];
  for (const file of files) {
    const load = () => JSON.parse(gunzipSync(fs.readFileSync(path.join(outputDir, 'raw', file))).toString('utf8'));
    try {
      const { schemaVersion, suite, startUs, pid } = load();
      if (schemaVersion !== 1 || typeof suite !== 'string' || !suite) {
        throw new Error('Expected a schemaVersion 1 raw suite record.');
      }
      descriptors.push({ schemaVersion, suite, startUs, pid, load });
    } catch (error) {
      recordErrors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (recordErrors.length) {
    await writeFile(path.join(outputDir, 'record-errors.json'), JSON.stringify(recordErrors, null, 2));
  } else {
    await rm(path.join(outputDir, 'record-errors.json'), { force: true });
  }
  const summary = buildSummary(descriptors, {
    ...manifest,
    jestResults,
    unreadableRecords: recordErrors.length,
    jestResultsError,
  }, { maxBytes: maxBytes ?? manifest.maxSummaryBytes ?? 2_000_000 });
  const data = JSON.stringify(summary);
  const temporary = path.join(outputDir, 'summary.json.tmp');
  await writeFile(temporary, data);
  await fs.promises.rename(temporary, path.join(outputDir, 'summary.json'));
  console.log(`Profile summary: ${path.join(outputDir, 'summary.json')} (${Buffer.byteLength(data)} bytes)`);
  console.log(`Recorded ${summary.completeness.recordedSelectedSuites}/${summary.completeness.expectedSuites} selected suites; ${summary.tests.name.length} test rows; ${summary.warnings.message.length} warnings.`);
  if (summary.sizeLimit.truncated) console.warn('The summary size limit removed optional detail or shortened strings. Full data remains in raw profiles.');
  return summary;
}

export interface ProfileOptions {
  // Fixture tests inject a root; the CLI uses the checkout containing this script.
  rootDir?: string;
  environment?: 'jsdom' | 'happy-dom';
  transformer?: 'ts-jest' | 'sucrase';
  shard: string;
  outputDir: string;
  selectionFile?: string;
  suiteFilter?: string;
  workers?: number;
  cpuIntervalUs?: number;
  heapIntervalBytes?: number;
  noCpu?: boolean;
  noHeap?: boolean;
  maxSummaryBytes?: number;
  timeoutSeconds?: number;
  minFreeMiB?: number;
}

export async function runProfile(options: ProfileOptions): Promise<number> {
  if (process.platform === 'win32') throw new Error('Shard profiling requires POSIX process-group cleanup. Use Linux or macOS.');
  if (!options.outputDir) throw new Error('A new outputDir is required.');
  const rootDir = path.resolve(options.rootDir ?? defaultRoot);
  const outputDir = path.resolve(rootDir, options.outputDir);
  const workers = integer(String(options.workers ?? 1), 1, 'workers', 64);
  const timeoutSeconds = options.timeoutSeconds ?? 3600;
  const minFreeMiB = options.minFreeMiB ?? 256;
  for (const [name, value] of Object.entries({ workers, timeoutSeconds, minFreeMiB, cpuIntervalUs: options.cpuIntervalUs ?? 1000,
    heapIntervalBytes: options.heapIntervalBytes ?? 1048576, maxSummaryBytes: options.maxSummaryBytes ?? 2000000 })) {
    integer(String(value), value, name);
  }
  const {
    environment, transformer, benchmark: configuration, baseConfigPath,
    transformConfigPath, configuredEnvironment, transformerModule, jest,
  } = await loadProfileConfiguration(rootDir, options.shard, options.environment, options.transformer);
  await mkdir(path.dirname(outputDir), { recursive: true });
  await mkdir(outputDir); // Refuse to replace an earlier run or its raw profiles.
  await mkdir(path.join(outputDir, 'raw'));
  const cache = path.join(outputDir, 'cache');
  const started = performance.now();
  const profilerHash = createHash('sha256');
  for (const file of ['run.mts', 'configuration.mts', 'recorder.cjs', 'environment.cjs', 'runtime.cjs', 'summarize.cjs']) {
    profilerHash.update(file).update(await readFile(path.join(directory, file)));
  }
  const metadata: Record<string, any> = {
    schemaVersion: 1, rootDir, shard: options.shard, workers, startedAt: new Date().toISOString(),
    environment, transformer, coldJestCache: true,
    configFile: configuration.jestConfig,
    transformConfigFile: path.relative(rootDir, transformConfigPath).split(path.sep).join('/'),
    baseEnvironment: configuredEnvironment, transformerModule,
    cpuIntervalUs: options.cpuIntervalUs ?? 1000, heapIntervalBytes: options.heapIntervalBytes ?? 1048576,
    cpu: !options.noCpu, heap: !options.noHeap, maxSummaryBytes: options.maxSummaryBytes ?? 2000000,
    timeoutSeconds, minFreeMiB, suiteFilter: options.suiteFilter ?? null,
    rosterConfig: configuration.files, selectedSuites: [], status: 'initializing', profilerHash: profilerHash.digest('hex'),
    ...(await benchmarkMetadata(rootDir, configuration.jestConfig)),
  };
  metadata.configurationHashes[metadata.transformConfigFile] = createHash('sha256')
    .update(await readFile(transformConfigPath)).digest('hex');
  const generatedConfig = (profile: boolean) => `module.exports = {
  ...require(${JSON.stringify(baseConfigPath)}),
  rootDir: ${JSON.stringify(rootDir)},
  transform: require(${JSON.stringify(transformConfigPath)}).transform,
  testEnvironment: ${JSON.stringify(profile ? path.join(directory, 'environment.cjs') : configuredEnvironment)},
  ${profile ? `runtime: ${JSON.stringify(path.join(directory, 'runtime.cjs'))},` : ''}
  cacheDirectory: ${JSON.stringify(path.join(cache, profile ? 'execution' : 'discovery'))},
  maxWorkers: ${workers},
  watchPlugins: [],
};\n`;
  const save = async () => {
    const temporary = path.join(outputDir, 'run.json.tmp');
    await writeFile(temporary, JSON.stringify(metadata, null, 2));
    await fs.promises.rename(temporary, path.join(outputDir, 'run.json'));
  };
  await save();
  const fd = fs.openSync(path.join(outputDir, 'jest.log'), 'wx');
  let child: ChildProcess | undefined;
  let stopped: number | undefined;
  let forceKill: ReturnType<typeof setTimeout> | undefined;
  const kill = (signal: NodeJS.Signals) => {
    if (!child?.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
        metadata.cleanupError = String(error);
        console.error(`Cannot signal the Jest process group: ${error}`);
      }
    }
  };
  const stop = (code: number, reason: string) => {
    if (stopped !== undefined) return;
    stopped = code;
    metadata.stopReason = reason;
    console.error(reason);
    kill('SIGTERM');
    forceKill = setTimeout(() => kill('SIGKILL'), 5000);
  };
  const interrupt = () => stop(130, 'Profile interrupted. Completed raw suite records will be retained.');
  const terminate = () => stop(143, 'Profile terminated. Completed raw suite records will be retained.');
  const resourceCheck = () => {
    try {
      const disk = fs.statfsSync(outputDir);
      if (disk.bavail * disk.bsize < minFreeMiB * 1048576) stop(1, `Free disk space fell below ${minFreeMiB} MiB.`);
      if (performance.now() - started > timeoutSeconds * 1000) stop(124, `Profiling exceeded ${timeoutSeconds} seconds.`);
    } catch (error) {
      stop(1, `Cannot monitor profile resources: ${error}`);
    }
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  const monitor = setInterval(resourceCheck, 500);
  const runJest = async (args: string[], profile = false) => {
    resourceCheck();
    if (stopped !== undefined) throw new Error(metadata.stopReason);
    const env: NodeJS.ProcessEnv = { ...process.env, CI: 'true' };
    // Piped stderr hides the original terminal from Jest.
    if (profile && process.stderr.isTTY && env.FORCE_COLOR === undefined &&
      env.NO_COLOR === undefined && env.NODE_DISABLE_COLORS === undefined) {
      const depth = process.stderr.getColorDepth();
      if (depth >= 4) env.FORCE_COLOR = depth >= 24 ? '3' : depth >= 8 ? '2' : '1';
    }
    delete env.GRAFANA_SHARD_PROFILE;
    delete env.JEST_JASMINE;
    delete env.JEST_WORKER_ID;
    if (profile) env.GRAFANA_SHARD_PROFILE = JSON.stringify({ rootDir, outputDir, baseEnvironment: configuredEnvironment,
      cpu: metadata.cpu, heap: metadata.heap,
      cpuIntervalUs: metadata.cpuIntervalUs, heapIntervalBytes: metadata.heapIntervalBytes });
    child = spawn(process.execPath, [jest, '--ci', '--watch=false', '--watchAll=false', `--maxWorkers=${workers}`, ...args], {
      cwd: rootDir, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout!.setEncoding('utf8');
    child.stderr!.setEncoding('utf8');
    const log = (data: string) => {
      try { fs.writeSync(fd, data); }
      catch (error) { stop(1, `Cannot write jest.log: ${error}`); }
    };
    child.stdout!.on('data', (data: string) => { log(data); if (profile) process.stdout.write(data); else stdout += data; });
    child.stderr!.on('data', log);
    const stderr = profile ? child.stderr!.pipe(createBenchmarkStderrFilter()) : child.stderr!;
    stderr.pipe(process.stderr, { end: false });
    const code = await new Promise<number>((resolve, reject) => {
      child!.once('error', reject);
      child!.once('close', (code) => resolve(code ?? 1));
    });
    if (stopped !== undefined) kill('SIGKILL');
    child = undefined;
    return { code: stopped ?? code, stdout };
  };
  let code = 1;
  try {
    const discoveryConfig = path.join(outputDir, 'discovery.jest.config.cjs');
    await writeFile(discoveryConfig, generatedConfig(false));
    const discover = async (args: string[]) => {
      const result = await runJest(['--config', discoveryConfig, '--env', configuredEnvironment,
        '--cacheDirectory', path.join(cache, 'discovery'), '--listTests', '--json', ...args]);
      if (result.code !== 0) throw new Error(`Jest discovery exited with ${result.code}. See jest.log.`);
      return JSON.parse(result.stdout);
    };
    const selection = await selectSuites(rootDir, configuration, options.shard, options.selectionFile, discover, options.suiteFilter);
    Object.assign(metadata, selection, { files: undefined, selectionSha256: createHash('sha256').update(JSON.stringify(selection.selectedSuites)).digest('hex'),
      discoveryMs: Math.round(performance.now() - started), status: 'running' });
    await save();
    const profileConfig = path.join(outputDir, 'profile.jest.config.cjs');
    await writeFile(profileConfig, generatedConfig(true));
    console.log(`Profiling ${selection.files.length} suites from shard ${options.shard}: ${environment}/${transformer}, ${workers} worker(s), CPU sampling ${metadata.cpu ? 'on' : 'off'}, heap sampling ${metadata.heap ? 'on' : 'off'}. Profiling adds overhead.`);
    const executionStarted = performance.now();
    const result = await runJest(['--config', profileConfig, '--json', '--outputFile', path.join(outputDir, 'jest-results.json'), '--runTestsByPath', ...selection.files], true);
    code = result.code;
    metadata.executionMs = Math.round(performance.now() - executionStarted);
  } catch (error) {
    metadata.error = error instanceof Error ? error.message : String(error);
    console.error(metadata.error);
    code = stopped ?? 1;
  } finally {
    clearInterval(monitor);
    if (forceKill) clearTimeout(forceKill);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    fs.closeSync(fd);
    await rm(cache, { recursive: true, force: true });
    Object.assign(metadata, { status: code === 0 ? 'completed' : 'incomplete', exitCode: code, totalMs: Math.round(performance.now() - started) });
    await save();
    try {
      await summarizeDirectory(outputDir);
    } catch (error) {
      metadata.summaryError = error instanceof Error ? error.message : String(error);
      console.error(`Cannot build summary: ${metadata.summaryError}. Raw profiles remain in ${outputDir}.`);
      if (code === 0) code = 1;
      Object.assign(metadata, { status: 'incomplete', exitCode: code });
      await save();
    }
  }
  return code;
}

async function main() {
  const { values } = parseArgs({ options: {
    shard: { type: 'string' }, outputDir: { type: 'string' }, selectionFile: { type: 'string' }, suiteFilter: { type: 'string' },
    environment: { type: 'string' }, transformer: { type: 'string' },
    workers: { type: 'string' }, cpuIntervalUs: { type: 'string' }, heapIntervalBytes: { type: 'string' },
    maxSummaryBytes: { type: 'string' }, timeoutSeconds: { type: 'string' }, minFreeMiB: { type: 'string' },
    noCpu: { type: 'boolean' }, noHeap: { type: 'boolean' }, summarize: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: npm run test:profile:shard -- --shard=1/8 --outputDir=local/profile-shard-1 [--environment=happy-dom|jsdom] [--transformer=sucrase|ts-jest] [--selectionFile=baseline.metrics.json] [--workers=1] [--suiteFilter=glob] [--noCpu] [--noHeap]\nDefaults: happy-dom/sucrase; --environment=jsdom defaults to ts-jest. Uses the current checkout and its installed dependencies.\nRebuild summary: npm run test:profile:shard -- --summarize=local/profile-shard-1 [--maxSummaryBytes=2000000]');
    return;
  }
  if (values.summarize) {
    if (values.environment !== undefined || values.transformer !== undefined) {
      throw new Error('--summarize uses the recorded environment and transformer. Do not pass mode flags.');
    }
    await summarizeDirectory(path.resolve(defaultRoot, values.summarize), integer(values.maxSummaryBytes, 2000000, 'maxSummaryBytes'));
    return;
  }
  if (!values.shard || !values.outputDir) throw new Error('--shard=N/M and a new --outputDir are required. Use --help for an example.');
  if (values.environment !== undefined && values.environment !== 'jsdom' && values.environment !== 'happy-dom') {
    throw new Error('--environment must be jsdom or happy-dom.');
  }
  if (values.transformer !== undefined && values.transformer !== 'ts-jest' && values.transformer !== 'sucrase') {
    throw new Error('--transformer must be ts-jest or sucrase.');
  }
  process.exitCode = await runProfile({
    environment: values.environment, transformer: values.transformer,
    shard: values.shard, outputDir: values.outputDir, selectionFile: values.selectionFile, suiteFilter: values.suiteFilter,
    workers: integer(values.workers, 1, 'workers', 64), cpuIntervalUs: integer(values.cpuIntervalUs, 1000, 'cpuIntervalUs'),
    heapIntervalBytes: integer(values.heapIntervalBytes, 1048576, 'heapIntervalBytes'), maxSummaryBytes: integer(values.maxSummaryBytes, 2000000, 'maxSummaryBytes'),
    timeoutSeconds: integer(values.timeoutSeconds, 3600, 'timeoutSeconds'), minFreeMiB: integer(values.minFreeMiB, 256, 'minFreeMiB'),
    noCpu: values.noCpu, noHeap: values.noHeap,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
}
