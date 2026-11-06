# Optimized shard 1: time and allocation investigation

Date: 2026-11-03. Source commit: `c53c7de5a06fefebb9c6d05e28a5ea4ec90d2a5c`.

## Scope and limits

This investigation uses the 352 paths in `scripts/test-harness/jsdom-shard-1.metrics.json`. It does not profile shard 5.
The production Jest configuration, source tests, dependency manifests, and registered patches remain unchanged.

The local shard diagnostic uses one worker, a cold Jest cache, and the existing 1 GB worker-recycling limit.
The bench-machine run uses four workers. Absolute local times are not directly comparable to its 131.86-second result.
The local dependency layout preserves locked versions and patches, but is not a normal pnpm installation. Resolution costs can depend on that layout.

Targeted CPU runs use fresh processes with cold and warm transform caches. They disable worker recycling and use the existing profiler.
Allocation runs are separate. Inspector samples allocations at 1 MiB intervals and includes objects collected by minor and major GC.
Allocation runs force GC at phase boundaries to estimate surviving heap. They are not benchmark timing runs.

Allocation totals are statistical estimates of JavaScript allocation churn, not peak RSS or exact allocated bytes.
Native backing stores, allocator fragmentation, compiled code, and reserved heap are not fully described by these samples.
No heap snapshots were taken, so this investigation does not establish retaining paths or prove a leak.

## Shard-wide phase timing

The local diagnostic took 744.81 seconds. It recorded 351 environment logs; one suite explicitly selects jsdom and bypasses the wrapper.
Of those logs, 349 reached test execution. The other two failed during imports.

| Phase | Aggregate time |
| --- | ---: |
| Environment construction, setup, imports, and collection before tests | 527.94 s |
| Test bodies and hooks | 187.21 s |
| Teardown and remaining environment work | 3.60 s |

Pre-test work accounts for approximately 73.5% of the attributed interval.
Hooks alone account for 6.58 seconds, while test bodies account for 178.38 seconds.
These are alternate breakdowns of the same time, not additional costs.
The remaining process time includes worker starts, discovery, reporting, and the jsdom override suite.

The run used 16 worker processes. Most workers accumulated approximately 960–1,040 MiB of observed heap before replacement.
Phase-boundary RSS measurements reached roughly 1.3–1.6 GiB in those workers. These are sampled observations, not continuous peak measurements.

### Slowest suites

| Suite | Local elapsed time |
| --- | ---: |
| `GrafanaReceiverForm.test.tsx` | 20.65 s |
| `PolicyTreeSelector.integration.test.tsx` | 18.75 s |
| `DashboardSidebar.test.tsx` | 14.41 s |
| `SharedPreferences.test.tsx` | 11.51 s |
| `AddPanelToNotebookModalBody.test.tsx` | 11.24 s |
| `RuleEditorCloudOnlyAllowed.test.tsx` | 9.64 s |

### Validation status

The first full run had 349 passing suites and three failures:

- `dashboardSchemaExtensions.test.ts` needed the optional `codemirror-json5` dependency.
- `Connections2.test.tsx` needed root resolution for the undeclared `framework-utils` import.
- `DashboardMigratorToBackend.test.ts` failed 56 cases because generated backend migration fixtures were absent.

The two dependency gaps are now in the retained installation plan. Their targeted rerun passed all 22 tests.
The backend fixtures remain absent. The complete shard was not rerun after dependency correction.
The failed run is diagnostic evidence, not a successful benchmark.

## Import-heavy suites

### DashboardSidebar

Both CPU-profiled runs passed all 83 tests and loaded 5,252 distinct modules through 5,620 executions.

| Measure | Cold | Warm |
| --- | ---: | ---: |
| Process wall time | 19.12 s | 10.69 s |
| Before tests | 17.35 s | 9.26 s |
| Test bodies | 0.556 s | 0.551 s |
| Actual transformer calls | 2,278 | 0 |
| Module execution/loading cost bucket | 3.73 s | 3.57 s |
| Module-resolution cost bucket | 2.32 s | 2.08 s |
| V8 script-creation cost bucket | 1.47 s | 1.30 s |

Warm transforms do not remove the import graph or its execution cost.

The first-import graph exposes these concrete boundaries:

1. `groupSelectionInto` imports `groupLayout`, which imports `AutoGridItem` and conditional rendering.
   `ConditionalRenderingGroup` imports variable lookup helpers from `utils/variables.ts`.
   That module imports the V2 dashboard deserializer for unrelated variable-construction code.
2. `addPanelsOnLoadBehavior.ts` eagerly imports `DashboardModel` and legacy panel conversion.
   Those imports occur even when no stored panel DTO exists.
3. Legacy dashboard initialization reaches plugin extension registration and then Explore state.
   `getExploreExtensionConfigs.tsx` eagerly imports state actions used only by a click handler.
4. The `@grafana/runtime` barrel reaches `LocationService`, which reaches the `@grafana/ui` barrel.

These are first-import relationships, not exclusive ownership. Other imports can still reach the same dependencies after a boundary changes.
Inclusive import times overlap and must not be added as predicted savings.

### Shared setup floor

`packages/grafana-data/src/dataframe/timeCompare.test.ts` passed all 30 tests in both CPU runs.
Its warm test bodies took 0.058 seconds, but it loaded 1,481 distinct modules through 1,844 executions.
Warm Jest bootstrap/setup took 1.56 seconds in the fresh process.

The warm inclusive setup chain includes:

- `public/test/setupTests.ts`: 0.942 s.
- `@grafana/test-utils` and its matchers: 0.405 s.
- `jest-canvas-mock-compare`: 0.337 s.
- Its Jest 30 snapshot implementation: 0.275 s.

The main runner uses Jest 29. The canvas matcher adds the separately locked Jest 30 snapshot dependency graph.
The setup also loads Testing Library and DOM matchers for this data-only suite.
The existing EventBus isolation causes 223 RxJS module re-executions in this profile.

## Allocation churn and surviving heap

### Estimated JavaScript allocations

| Suite and phase | Cold | Warm |
| --- | ---: | ---: |
| Sidebar: startup/imports | 2,506 MiB | 1,072 MiB |
| Sidebar: tests/hooks | 76 MiB | 95 MiB |
| Receiver form: startup/imports | 2,290 MiB | 1,065 MiB |
| Receiver form: tests/hooks | 2,061 MiB | 2,010 MiB |

Cold startup includes Haste-map discovery. Its dependency extractor alone accounts for approximately 144–178 MiB of sampled string replacements.
This is a process-level cold-start cost, not a cost to multiply by every suite.

Sucrase accounts for approximately 726–798 MiB of cold startup allocations in these profiles.
That includes tokenization, transformation, and source-map work. Warm runs perform no transformations.
Warm import allocation remains substantial: path operations account for approximately 439–461 MiB.

### Receiver-form body allocations

The warm receiver-form allocation run passed all 32 tests and three snapshots.

| Attribution group | Estimated allocations | Share of tests/hooks |
| --- | ---: | ---: |
| Happy DOM | 816 MiB | 40.6% |
| React | 293 MiB | 14.6% |
| Redux Toolkit | 193 MiB | 9.6% |
| React DOM | 120 MiB | 6.0% |

Happy DOM hotspots include selector matching, selector cache insertion, event-target maps, node construction, and media-query parsing.
`QuerySelector.matches` accounts for approximately 179 MiB in the warm body profile.
React JSX construction and Redux reducers also allocate heavily.

These totals combine samples with the same function and package across call stacks.
Native frames without a URL are attributed to their nearest ancestor with a URL.
They are not exact ownership measurements of retained objects.

### After forced GC

| Warm run | Heap before test bodies | Heap after tests | Heap after environment teardown | RSS after teardown |
| --- | ---: | ---: | ---: | ---: |
| Sidebar | 293 MiB | 301 MiB | 268 MiB | 572 MiB |
| Receiver form | 282 MiB | 375 MiB | 283 MiB | 903 MiB |

Most receiver-body allocation is temporary. Its surviving heap returns close to the pre-test level after teardown.
RSS remains high even after GC, so allocation churn and resident memory must remain separate measurements.
This does not prove a DOM leak. Jest/module caches, code, retained runtime state, and allocator behavior need separate retention analysis.

## Local resolver experiment

The normal configuration uses `moduleDirectories: ['public', 'node_modules']`.
The experiment uses `moduleDirectories: ['node_modules']` and an absolute `modulePaths` entry for the repository's `public` directory.
It does not change the production configuration.

All 83 sidebar tests passed in both experiment runs.

| Warm allocation-profile measure | Existing resolution | Absolute public path |
| --- | ---: | ---: |
| Process wall time | 10.05 s | 9.58 s |
| Startup/import allocations | 1,072 MiB | 966 MiB |
| Path-operation allocations | 461 MiB | 339 MiB |
| Heap after teardown | 268 MiB | 257 MiB |

This is approximately 10% less import allocation and 26% less path allocation in this sample.
The 4.6% elapsed-time difference is a single instrumented observation, not a validated benchmark speedup.
Module-resolution semantics and normal pnpm-layout behavior need full validation before adoption.

## Implemented follow-up optimizations

These changes extend the source commit. They do not change benchmark selection or existing source tests.
New regression suites remain in `scripts/test-harness/regressions/`, outside benchmark shards.

### Lazy custom matchers

`packages/grafana-test-utils/src/matchers/index.ts` now loads each matcher implementation on its first call.
All matcher names remain registered. The wrappers preserve canvas matcher context, arguments, synchronous results, errors, and observable promises.
Non-canvas suites no longer load the comparator's separate Jest 30 snapshot dependencies during setup.
Observable matcher registration no longer triggers an extra RxJS import before EventBus isolation.

| Measure | timeCompare before | timeCompare after | Sidebar before | Sidebar after |
| --- | ---: | ---: | ---: | ---: |
| Cold process wall time | 5.103 s | 4.259 s | 19.124 s | 18.370 s |
| Warm process wall time | 3.610 s | 3.202 s | 10.687 s | 10.055 s |
| Warm setup | 1.555 s | 1.164 s | 1.560 s | 1.151 s |
| Unique modules | 1,481 | 1,280 | 5,252 | 5,056 |
| Module executions | 1,844 | 1,287 | 5,620 | 5,339 |
| Warm observed peak RSS | 290 MiB | 273 MiB | 631 MiB | 618 MiB |

Both cold/warm pairs passed: 30 timeCompare tests and 83 Sidebar tests per run.
The Sidebar still imports RxJS independently. EventBus isolation remains unchanged.

### Remove runtime's UI dependency for debug utilities

`LocationService.tsx` imported the entire `@grafana/ui` entry point for `createLogger` and `attachDebugger`.
Their implementations now reside in `packages/grafana-data/src/utils/`. Runtime imports them from `@grafana/data`.
Existing UI paths and public exports reexport the same functions. The throttle state remains shared, and the implementation behavior remains unchanged.

The control suite is `packages/grafana-runtime/src/services/pluginSettings/entrypoints.test.ts`, an existing shard-1 suite.
Both before and after runs include the lazy matcher change. The suite does not independently import UI.

| Measure | Before | After |
| --- | ---: | ---: |
| Cold process wall time | 9.757 s | 6.667 s |
| Warm process wall time | 5.698 s | 4.012 s |
| Cold suite imports/collection | 5.837 s | 2.830 s |
| Warm suite imports/collection | 2.797 s | 1.190 s |
| Unique modules | 3,137 | 2,069 |
| Module executions | 3,420 | 2,304 |
| UI modules | 465 | 0 |
| Cold transformed files | 1,032 | 525 |
| Warm observed peak RSS | 402 MiB | 329 MiB |

All four runs passed six tests with six matcher calls each.
Suites with independent UI imports will retain that dependency graph.
These are single instrumented comparisons, not full-shard speedup estimates. RSS observations do not measure allocation churn or prove leak removal.

### Follow-up validation

- New matcher and debug utility regression suites: 13 tests passed.
- Existing observable matcher and three canvas suites: 73 tests and 49 snapshots passed.
- Existing LocationService suite: 31 tests passed.
- Harness discovery boundaries and installer tests: 12 tests passed.
- Focused TypeScript check: zero diagnostics for the matcher module, matcher regression suite, and relocated utility implementations.
- A complete repository typecheck and lint run remain unavailable with the selected dependencies.

The existing duplicate `fixtures` mock warning remains. No snapshots or existing assertions changed.
The full shard was not rerun after these optimizations. Its generated backend fixture blocker remains.

### Candidates not adopted

Extracting variable lookup helpers does not remove the Sidebar deserializer graph.
Independent paths through DashboardScene, test utilities, serializers, and code editing still reach those modules.
The first-parent inclusive import cost is not a removable saving.

Replacing the React Testing Library setup import with DOM-only configuration changes cleanup and act-related setup behavior.
The implementation retains that import rather than trading correctness for lower setup time.
The resolver experiment also remains unadopted pending normal-layout validation.

## Sidebar dependency-graph follow-up

The canvas comparator retains `jest-snapshot@30.4.1`. The attempted version alignment is reverted, including its dependency plan changes.
This follow-up uses the lazy matchers and relocated debug utilities as its control.

### Defer core extension configuration until registry initialization

The eager path was:

```text
DashboardSidebar → dashboard models → plugin importer → registry setup
  → core extension configuration → Explore actions and reducers
```

`public/app/features/plugins/extensions/registry/setup.ts` now imports core extension configuration inside its existing asynchronous initializer.
Registry access and empty registry construction no longer load that configuration.
Full initialization still registers all core links and exposed components before it resolves.
Panel activation, menu callbacks, and synchronous registry APIs remain unchanged.

The first initialization gains a chunk-load wait. Import failures now use the existing logged fallback and retry path instead of failing during eager module loading.
The change adds no separate import-promise cache.

| Measure | Control | Deferred configuration |
| --- | ---: | ---: |
| Unique modules | 5,058 | 4,440 |
| Module executions | 5,341 | 4,723 |
| Cold process wall time | 15.409 s | 14.904 s |
| Warm process wall time | 8.528 s | 8.085 s |
| Warm suite imports/collection | 5.373 s | 4.734 s |
| Cold observed peak RSS | 784 MiB | 678 MiB |
| Warm observed peak RSS | 628 MiB | 569 MiB |
| Passing tests per run | 83 | 83 |
| Matcher calls per run | 245 | 245 |

The change removes 618 modules (12.2%) with no new loaded modules in this profile.
The removed set contains 539 dependency modules, 22 shared-package modules, and 57 application modules.
These timings are single cold/warm comparisons. They do not establish a full-shard speedup or quantify allocation savings.

Validation passed:

- Six existing source suites: 165 tests. These cover Sidebar, registry setup, plugin imports, extension delivery, Explore extensions, and panel loading.
- New `coreExtensionInitialization.test.ts`: three tests with `CI=true`, without console failures or teardown warnings.
- Harness discovery boundaries: three tests.
- Retained dependency verification and whitespace checks.

The new harness verifies deferred loading, ready core links, concurrent/cached initialization, and failure/retry behavior.
Its explicit `uwrap` mock uses the existing source-suite manual mock, which harness-only roots cannot discover.
Its network stub prevents isolated module initialization from leaving background requests after teardown.
No source-suite tests, assertions, or selection rules changed. No full repository typecheck or browser bundle validation ran.

### Why the remaining graph needs larger changes

The remaining graph includes the direct `@grafana/scenes` and `@grafana/ui` entry points, dashboard models, and V1/V2 serialization.
Many large first-parent branches contain cycles or shared dependencies. Another import preserves those modules after an apparent boundary is removed.

| Candidate | First-parent subtree | Potentially deferred modules after alternate-path inspection | Assessment |
| --- | ---: | ---: | --- |
| Notebook panel scene | 527 | About 5 | Most of the branch returns through dashboard utilities to DashboardScene, which the test imports directly. |
| Dashboard empty-state UI | 306 | About 12 | Both layout managers import it. Other paths retain most layout and provisioning dependencies. |
| DashboardScene renderer | 58 | About 57 | Requires a new root-render loading stage and checks for scope effects, scroll restoration, overlays, and drag/drop. |
| Code pane renderer | 34 | About 33 | A model/renderer split can defer YAML and diff helpers, but shared editor infrastructure remains. |

These are screening estimates, not measured removals. None of these additional refactors is implemented.
The two renderer candidates suggest approximately 2% of the remaining graph, before wrapper costs or runtime loading.
The return does not currently justify changing root-render timing or adding another code-pane loading stage.

A substantially larger reduction needs narrower package entry points or separation of scene models from renderers and serializers.
Removing a module merely because no assertion names it is unsafe: its initialization and transitive behavior can still affect the tested actions.

## Recommended next steps

1. **Measure the combined changes on the bench machine.** Replay the baseline shard-1 selection with the normal dependency layout.
   Compare elapsed time, RSS, worker replacements, and GC completeness across repeated runs.
2. **Investigate model/package boundaries for larger Sidebar reductions.** Direct scenes/UI entry points and shared serialization retain most remaining modules.
   Preserve activation, cancellation, dispatch order, undo/redo, and synchronous conversion contracts.
3. **Reduce receiver-form query and render churn.** Scope role queries to stable containers with `within` where appropriate.
   Reuse element references within a test when React preserves them.
   Keep typing semantics for tests that exercise input behavior; payload-only tests already use paste.
   Inspect the full-store render wrapper and unnecessary reducer updates before introducing a narrower, contract-equivalent provider.
4. **Validate the resolver candidate.** Repeat uninstrumented timings on the bench machine with normal pnpm dependencies.
   Run the full shard and relevant resolver tests. Preserve alias, mock, export-condition, and workspace resolution behavior.
5. **Profile the remaining DOM costs before extending dependency patches.** Count selector-cache hits, invalidations, and media-query parses during the receiver suite.
   Any caching change needs mutation, scope, disconnected-node, stylesheet, and event-behavior regression coverage.

Do not raise the worker memory limit as the first response. It can postpone recycling while increasing peak RSS.
Do not disable accessibility checks, development assertions, source maps, or test isolation to obtain a faster number without a separate correctness review.

## Reproduction and artifacts

The exact dependency list and reinstall procedure are in [shard1-deps/README.md](shard1-deps/README.md).
The plan records 1,228 locked snapshot variants, 15 workspace links, and eight patched packages.
The dependency tree uses approximately 941 MB of allocated disk space. Profiling caches are removed after each run.

Commands from the repository root:

```sh
node scripts/test-harness/profiling/shard1-deps/installer.mjs install
node scripts/test-harness/profiling/run-shard1.cjs
node scripts/jest-profile.cjs --transformer=sucrase --suite=public/app/features/dashboard-scene/sidebar/DashboardSidebar.test.tsx --cpu --output=local/shard1-profile/results/cpu-sidebar
node scripts/test-harness/profiling/profile-allocation.cjs public/app/features/dashboard-scene/sidebar/DashboardSidebar.test.tsx
node scripts/test-harness/profiling/profile-allocation.cjs public/app/features/dashboard-scene/sidebar/DashboardSidebar.test.tsx --direct-public
python3 scripts/test-harness/profiling/summarize.py
```

The profiling tools are included in the shard-1 checkpoint and remain outside benchmark discovery.
Raw benchmark inputs, profiles, and installed dependencies are not included in the checkpoint.
The shard and allocation helpers require the supplied baseline metrics file at `scripts/test-harness/jsdom-shard-1.metrics.json`.
Their output directory, `local/shard1-profile/results/`, must exist before those helpers run.
The portable benchmark runner does not require these local profiling inputs.

Artifacts under `local/shard1-profile/results/`:

- `shard-vjkSFg/`: full one-worker diagnostic, Jest results, phase logs, and failure details.
- `smoke-IWfP5g/`: successful rerun of the two dependency-blocked suites.
- `cpu-sidebar/suite-nigw1i/`: sidebar cold/warm CPU attribution.
- `cpu-receiver/suite-gcYiU7/`: receiver cold/warm CPU attribution.
- `cpu-timecompare/suite-QCYlZw/`: data-only suite cold/warm CPU attribution.
- `alloc-ZP85Ol/`: sidebar allocation and GC-boundary observations.
- `alloc-GfdvDc/`: receiver allocation and GC-boundary observations.
- `alloc-resolver-nOQ4Xs/`: sidebar resolver experiment.
- `lazy-canvas-timecompare/suite-73LQS5/`: intermediate canvas-only laziness profile.
- `lazy-all-timecompare/suite-6p5rq7/`: all-lazy matcher profile for the data-only suite.
- `lazy-all-sidebar/suite-cNmutF/`: all-lazy matcher profile for Sidebar.
- `runtime-before/suite-1wenjU/`: runtime control with lazy matchers, before utility relocation.
- `runtime-after/suite-l1Vp9n/`: runtime profile after utility relocation.
- `sidebar-current/suite-0UFAJ4/`: Sidebar control with lazy matchers and relocated debug utilities.
- `sidebar-lazy-registry/suite-GdVlyA/`: Sidebar after deferred core extension configuration.
- `summary.json`: compact machine-readable summaries from `summarize.py`.

CPU sampling uses 4 ms intervals. Inspector allocation sampling uses 1 MiB intervals.
The receiver CPU runs report 192 versus 191 matcher calls despite identical passing cases.
Retry-based assertions can execute different numbers of times; these runs are not assertion-count-identical microbenchmarks.
