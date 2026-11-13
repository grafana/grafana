# Shard profiler

This tool profiles Jest with jsdom/ts-jest or Happy DOM/Sucrase. It writes raw profiles and a compact, columnar JSON summary.

The profiler uses the checked-out commit, its installed dependencies, and its benchmark configuration and roster rules.
It does not switch commits, select another checkout, change the benchmark runner, or add tests to source shards.

## Run a shard

Use the repository's Node version and installed frontend dependencies. Validation used Node 26.13.0 and Jest 29.7.0 on Linux.

Run this command from the repository root:

```sh
npm run test:profile:shard -- \
  --environment=happy-dom \
  --shard=1/8 \
  --selectionFile=scripts/test-harness/jsdom-shard-1.metrics.json \
  --outputDir=local/profile-happy-dom-shard-1 \
  --workers=1
```

The output directory must not exist. The tool preserves earlier runs instead of replacing them.

`--selectionFile` replays a baseline benchmark's `selectedSuites`. The shared roster rules then apply includes, exclusions, and split-suite groups.
Without this argument, Jest selects the requested shard from the selected environment's current inventory.

The default is `--environment=happy-dom`, which selects Sucrase. `--environment=jsdom` selects ts-jest by default.
Both modes preserve the checkout's transformer configuration, including diagnostics, source-map configuration, and compiler options.
The profiler does not disable type-checking or substitute an inline TypeScript configuration.

Existing `@jest-environment` overrides remain intact.
Those suites have `coverageStart: "runtime"` because instrumentation starts after their environment and runtime construction.

The default is one worker. Standard Circus and the existing environment optimizations remain active.
Jest can replace the worker at its configured memory limit.

## Compare checked-out commits

Before each run, check out the commit to measure.
Use that commit's installed dependency versions and the same Node version for each comparison.
Keep the profiler version, worker count, sampling configuration, and baseline selection file consistent.

For the original baseline, add only the benchmark runner and profiler tooling.
The jsdom mode needs the original `jest.config.js` and its dependencies. It does not need Happy DOM files, Sucrase, or benchmark JSON configuration.
The profiler imports shared helpers from the benchmark runner, so those scripts must remain available.

If the checkout lacks the npm alias, invoke the profiler directly:

```sh
node scripts/test-harness/profiling/shard-profiler/run.mts --help
```

### Establish the baseline selection

On the baseline commit, run the existing benchmark:

```sh
npm run test:bench:jsdom -- \
  --shard=1/8 \
  --metricsFile=jsdom-shard-1.baseline.metrics.json \
  --outputFile=jsdom-shard-1.baseline.jest.json
```

Keep that metrics file for every later comparison.

Then run the baseline profile:

```sh
npm run test:profile:shard -- \
  --environment=jsdom \
  --transformer=ts-jest \
  --shard=1/8 \
  --selectionFile=jsdom-shard-1.baseline.metrics.json \
  --outputDir=local/profile-baseline-shard-1 \
  --workers=1
```

After checkout of the optimized commit, use the same selection file and a new output directory.
These modes support separate comparisons:

| Checked-out code | Environment | Transformer | Comparison |
| --- | --- | --- | --- |
| Baseline | `jsdom` | `ts-jest` | Original workload |
| Optimized | `jsdom` | `ts-jest` | Changes with the original DOM environment and transformer |
| Optimized | `happy-dom` | `sucrase` | Full optimized configuration |

**Selecting jsdom/ts-jest does not revert other changes.** Setup files, mocks, dependency patches, and other configuration still come from the checked-out commit.
A comparison of test changes alone requires matching setup and dependencies in both revisions.

Roster groups include the jsdom companions of split suites on the optimized commit.
The resulting physical file count can differ from the baseline. The selection report records additions and exclusions.

### Optional mixed modes

The transformer can be selected separately:

```sh
--environment=jsdom --transformer=sucrase
--environment=happy-dom --transformer=ts-jest
```

Mixed modes require both transformer configurations in the checkout.
Only the transform table comes from the other mode's configuration.
The selected environment's setup files, globals, mappers, and roster remain unchanged.
The tool does not merge transform patterns or invent compiler options.

`run.json` and `summary.json` record the environment, transformer, source configuration paths, and configuration hashes.
CPU and allocation categories distinguish jsdom, ts-jest, TypeScript, Happy DOM, and Sucrase.

## Start with a small selection

To profile one suite within the selected shard, add a filter:

```sh
npm run test:profile:shard -- \
  --shard=1/8 \
  --selectionFile=scripts/test-harness/jsdom-shard-1.metrics.json \
  --suiteFilter='**/arrayUtils.test.ts' \
  --outputDir=local/profile-array-utils
```

The filter applies after the roster rules. It cannot add a suite from another shard.
An empty selection causes an error.

To select a file without its shard number, use `--shard=1/1` with an exact `--suiteFilter` path.
Omit `--selectionFile` in that case. Only matching files run, although discovery covers the eligible inventory.

## Files

| File | Contents |
| --- | --- |
| `summary.json` | Compact per-suite and per-test metrics, owner costs, hotspots, and coverage information |
| `raw/*.json.gz` | One raw capture per suite attempt, with CPU profiles, allocation profiles, module evaluations, edges, events, and boundary measurements |
| `jest-results.json` | Jest's final results, including assertions and failure messages |
| `run.json` | Revision, machine information, configuration hashes, selection, sampling intervals, and exit status |
| `jest.log` | Discovery and test output |
| `discovery.jest.config.cjs`, `profile.jest.config.cjs` | Generated Jest configurations for discovery and execution |
| `record-errors.json` | Unreadable raw records, if any |

Raw captures use hashed suite names, process IDs, and attempt numbers. Their `suite` property contains the readable path.
Each capture is compressed and written after suite teardown. A killed worker can leave a missing capture.
The summary preserves missing suites with unavailable metrics as `null`.

Raw profiles have no size limit. The tool processes one raw capture at a time during summary generation.
Temporary Jest caches are separate from normal benchmark caches. The tool removes its caches after the run.

## Metrics and limits

| Metric | Meaning |
| --- | --- |
| Suite wall phases | Pre-test setup/imports, test bodies, hooks, framework work, teardown, profiler work, and unassigned time |
| Exclusive activities | Transform pipeline, module evaluation, and other elapsed time within each suite phase |
| Test intervals | Wall time, body time, hook time, process CPU deltas, and heap deltas for each attempt |
| Process CPU | User/system CPU between boundary measurements, including background threads in that process |
| Sampled CPU | Exclusive main-thread sampled time, attributed by phase and dependency owner |
| Heap boundaries | Heap and RSS at measured boundaries, not peak memory |
| Allocation samples | Estimated allocation bytes per phase and owner, including collected objects where Inspector supports this |
| GC | Observed GC event counts and durations, not GC CPU consumption |
| Module footprint | Unique evaluated modules, repeated evaluations, and unique source bytes |
| Raw module detail | Per-module self/inclusive evaluation time and evaluation-parent edges |

Times use integer microseconds. Boundary memory columns use KiB. Heap deltas, source sizes, and allocation estimates use bytes.

`preTestsUs` includes environment construction, setup files, framework initialization, and suite imports. `hooksUs` includes all hooks.
Per-test hooks exclude `beforeAll` and `afterAll` because those hooks belong to the suite.
The CPU owner table combines bodies, hooks, and framework work into the `tests` phase to match allocation checkpoints.

Owners include jsdom, ts-jest, TypeScript, Happy DOM, Sucrase, Jest/Node, app source, workspace packages, and individual dependencies.
Native frames without a source URL inherit the nearest recognized caller.
Function locations come from V8. The summarizer does not remap locations through source maps.

**Heap deltas are not allocation volume or evidence of leaks.** They include GC effects and can be negative.
Allocation samples are estimates, not heap snapshots. A survivor-only fallback is labeled separately.
Survivor totals across phases do not represent the final retained heap.

Concurrent tests do not receive per-test process CPU, heap deltas, or sampled-owner attribution.
Their event intervals remain visible, but shared work cannot receive exclusive attribution.
Retries remain separate rows.

Module counts cover modules evaluated through Jest's CommonJS runtime, including repeated evaluations through `isolateModules`.
They exclude native ESM and host-loaded modules.
Edges describe evaluation parents, not every cached import. These data do not represent a complete static dependency graph.

### Import, transform, and test breakdown

The `activities` table partitions each suite phase into three exclusive counters:

| Counter | Scope |
| --- | --- |
| `transformUs` | The JavaScript transform pipeline and JSON transformer calls |
| `moduleEvaluationUs` | Module loading and evaluation outside measured transformation |
| `otherUs` | Time outside both instrumented activities |

The JavaScript pipeline includes source reads, cache access, source maps, and transformer work.
It also includes cache hits and files that do not need Sucrase processing.
The JSON timer covers `transformJson`. JSON reads and parsing belong to module evaluation.

Module evaluation includes module initialization, wrapper compilation, and Jest's module setup.
It is not a complete import-cost metric. Resolution, cached import lookups, and host imports do not have separate timers.
Their time belongs to the enclosing activity, or to `otherUs` outside an instrumented activity.
Nested modules count once. Nested transformation does not also count as module evaluation.

Each activity row satisfies:

```text
transformUs + moduleEvaluationUs + otherUs = wallUs
```

Rows use these phases: `preTests`, `body`, `hooks`, `framework`, `teardown`, `profiler`, and `unassigned`.
Imports inside a test body belong to `body`. Imports inside a hook belong to `hooks`.
`body.otherUs` measures test-body elapsed time outside the instrumented import and transform work.

These counters measure elapsed time, not process CPU or sampled CPU.
They include pauses and instrumentation overhead within their intervals.
Across workers, their sums represent cumulative suite time, not the shard's wall time.
The matrix partitions existing phase totals. It does not add more time to those totals.
Raw module `selfUs` and `totalUs` still include transformation. They are diagnostic views, not additional matrix totals.

Native asynchronous transforms and native ESM invalidate this breakdown because their waits can overlap other work.
Concurrent test phases move to `unassigned`, without a guessed body or hook attribution.
Other profiling data remain available.

Older captures lack these timers. Their activity counters are `null`, even after summary regeneration.
A new profile run is necessary for this breakdown. The counters also work with `--noCpu --noHeap`.

### Measurement overhead

This is a diagnostic run, not a replacement for the normal benchmark.
CPU sampling, allocation sampling, event recording, and compression add time and memory.
They can also change GC and worker replacement behavior.

`instrumentationUs` overlaps wall phases. Do not add it to suite wall time.
It measures bookkeeping and Inspector waits, but excludes final serialization and disk writes.
It does not measure all sampling overhead or support exact overhead subtraction.

Suite process CPU ends after environment teardown, before profile shutdown and compression.
Suite profiles exclude discovery, coordinator startup, worker bootstrap, and loading the environment module itself.
`run.json` reports discovery and execution wall times separately. Total wall time excludes summary generation.

For whole-process CPU totals, use the existing `/usr/bin/time` wrapper around the profile command.
Those totals include the profiler's own work. They are not comparable to unprofiled benchmark totals.

## Read the compact summary

Each table is an object of arrays. Columns at the same index describe one row.
String columns reference the shared `strings` array. `stringColumns` lists these columns.
`costs.phase` and `category` reference the `phases` and `categories` arrays.
`activities.phase` references the separate `activityPhases` array.

For example:

```js
const summary = require('./local/profile-happy-dom-shard-1/summary.json');
const suiteIndex = 0;
const suitePath = summary.strings[summary.suites.path[suiteIndex]];
const moduleCount = summary.suites.moduleUniques[suiteIndex];
const testIndex = 0;
const testName = summary.strings[summary.tests.name[testIndex]];
const testSuiteIndex = summary.tests.suite[testIndex];
```

The tables contain:

- `suites`: phase totals, CPU, memory, GC, and module footprint.
- `tests`: test attempts and their measured intervals.
- `activities`: seven rows per suite, with exclusive transform, module-evaluation, and other time by phase.
- `costs`: sampled CPU and allocation estimates by suite, phase, and owner.
- `hotspots`: up to eight functions per suite, ranked by exclusive sampled time.
- `testOwners`: the largest sampled CPU owner for each eligible test.
- `warnings`: coverage limits, fallback behavior, and incomplete measurements.

`completeness` reports selected suites with and without captures. `semantics` explains units and table relationships.
`tests.source` distinguishes recorder rows from Jest fallback rows. `null` means unavailable, not zero.

The default summary limit is **2,000,000 bytes**, without compression.
If necessary, the summarizer removes optional owner rows, hotspots, and cost rows, in that order.
Then it shortens long strings with hash suffixes. `sizeLimit` reports each reduction.
Suite, test, and activity rows remain intact. Raw captures remain unchanged.
An irreducible summary causes an error instead of silently exceeding the limit.

To show a shard-wide breakdown from the compact report:

```js
const summary = require('./local/profile-happy-dom-shard-1/summary.json');
const a = summary.activities;
const totals = summary.activityPhases.map((phase) => ({
  phase, measuredSuites: 0, missingSuites: 0,
  transformMs: 0, moduleEvaluationMs: 0, otherMs: 0, wallMs: 0,
}));
for (let i = 0; i < a.suite.length; i++) {
  const row = totals[a.phase[i]];
  if (a.transformUs[i] === null) {
    row.missingSuites++;
    continue;
  }
  row.measuredSuites++;
  row.transformMs += a.transformUs[i] / 1000;
  row.moduleEvaluationMs += a.moduleEvaluationUs[i] / 1000;
  row.otherMs += a.otherUs[i] / 1000;
  row.wallMs += a.wallUs[i] / 1000;
}
console.table(totals);
```

The example excludes unavailable captures from all totals and reports their count.
Multiple captures of the same suite remain separate contributions.

To rebuild the summary without rerunning tests:

```sh
npm run test:profile:shard -- \
  --summarize=local/profile-happy-dom-shard-1 \
  --maxSummaryBytes=2000000
```

## Configuration

| Argument | Default | Purpose |
| --- | --- | --- |
| `--environment=happy-dom\|jsdom` | `happy-dom` | DOM environment and benchmark configuration |
| `--transformer=sucrase\|ts-jest` | Environment default | Transformer configuration to use |
| `--shard=N/M` | Required | Shard to select |
| `--outputDir=path` | Required | New output directory |
| `--selectionFile=path` | None | Baseline benchmark metrics report |
| `--suiteFilter=glob` | None | Filter the selected suites |
| `--workers=N` | `1` | Maximum Jest workers |
| `--cpuIntervalUs=N` | `1000` | CPU sample interval in microseconds |
| `--heapIntervalBytes=N` | `1048576` | Mean allocation sampling interval in bytes |
| `--noCpu` | Off | Disable CPU sampling |
| `--noHeap` | Off | Disable allocation sampling |
| `--maxSummaryBytes=N` | `2000000` | Maximum summary size |
| `--timeoutSeconds=N` | `3600` | Discovery and execution time limit |
| `--minFreeMiB=N` | `256` | Free-space threshold for the output filesystem |

Smaller sampling intervals increase detail and overhead.
Both sampling types are enabled by default.
Boundary metrics and module instrumentation remain active with `--noCpu` or `--noHeap`.

The runner requires POSIX process groups (Linux or macOS). The custom runtime requires Jest 29's private instrumentation methods.
Unsupported runtime APIs cause an error rather than silent loss of module coverage.

The runner checks time and disk space every 500 ms during discovery and execution.
On interruption or resource exhaustion, it stops Jest's process group and summarizes completed captures.
The disk threshold is a polling guard, not a hard storage quota.
Abrupt termination, such as `SIGKILL` or power loss, requires a later `--summarize` run.

## Inspect or share raw profiles

Each raw capture contains a standard Inspector `cpuProfile` object and phase-specific `heapProfiles`.
Extract `cpuProfile` into a `.cpuprofile` file for a compatible DevTools CPU viewer.
Extract a `heapProfiles[i].profile` object into a `.heapprofile` file for an allocation-sampling viewer.

Raw captures can contain machine paths, test names, and function names. Jest results can contain assertion values and logs.
Review these files before sharing them.
The compact `summary.json` is the first file to share for optimization analysis.

## Validate changes to this tool

```sh
node --test --test-concurrency=1 \
  scripts/test-harness/profiling/shard-profiler/*.test.cjs \
  scripts/test-harness/profiling/shard-profiler/*.test.mts \
  scripts/test-harness/jest-test-boundaries.test.cjs
```

The integration tests require the installed Jest, Happy DOM, jsdom, Sucrase, and ts-jest dependencies.
They run temporary fixtures with one worker and remove their profiles and caches afterward.
