# Shard 1: remove imports instead of deferring them

## Scope

The base revision is `3b6162328392881950f63564cb0cb860e9a6934c`.
This follow-up restores eager application-renderer imports and removes unnecessary dependencies from five existing suites.
Source test bodies, assertions, and suite paths remain unchanged.

The earlier renderer split moved imports into the first test without reducing the final module graph substantially.
This pass does not add deferred imports to application or source-test code.

## Renderer rollback

`public/test/test-utils.tsx` again contains the original renderer and static imports from `cea19590`.
The separate `test-utils-renderer.tsx` module and its lazy-import tests are removed.
A replacement harness test records dependency initialization before test bodies run.

The five-suite diagnostic shows the attribution change:

| Measure                                | Lazy renderer | Eager renderer, original callers |
| -------------------------------------- | ------------: | -------------------------------: |
| Accumulated body import/transform time |       4.064 s |                          0.176 s |
| Sum of per-suite unique module counts  |        22,098 |                           22,098 |
| Profile execution wall time            |      19.413 s |                         19.306 s |

These single runs establish the phase shift, not an isolated speed improvement.
The eager control also loads the feature-toggle helper during suite initialization.

Other conditional boundaries remain where they avoid unused work:

- Non-canvas suites do not load the canvas comparator or its separate snapshot dependencies.
- Pure suites do not load React Testing Library solely for global cleanup.
- Suites without DOM assertions do not load the jest-dom implementation.
- Suites without extension-registry initialization do not load core extension configurations.
- Imports without theme-registry use skip extra-theme validation and name-collator construction.

The final banner and retry captures load the theme registry without loading runtime configuration.
Their components use the default theme context, not a registry lookup.
The existing theme harness verifies that importing the registry does not validate extras until first use.
The theme change does not remove schema construction or theme JSON imports.

## Actual dependency cuts

### Plain Testing Library

`ManagedReadOnlyBanner.test.tsx` now uses Testing Library directly.
The component needs no application store, router, or Grafana context.

`FinishedJobStatus.test.tsx` also uses Testing Library directly.
Its existing query and child-component mocks already isolate retry behavior.
The query mock no longer loads the actual API module before replacing its only required runtime export.

### Focused providers

`OptionsPaneCategory.test.tsx` retains real legacy and compatibility routers without the application store or context defaults.

`NotebookExportMenu.test.tsx` retains the production notification reducer, visible toast UI, real routers, and a real chrome service.
Its store contains only notification state.
The test retains clipboard behavior and all existing API, PDF, download, and analytics mocks.

`abilityTestUtils.tsx` retains the real Alertmanager, feature-flag, and location providers.
Each wrapper still creates and registers fresh history.
The shared wrapper uses a real store containing only the browse-dashboard, folder, and IAM APIs.
Silence-ability consumers need those APIs even when their folder queries are skipped.
`useNotificationPolicyAbility.test.tsx` imports Testing Library directly.

### Remove a constant-only reducer dependency

`OptionsPaneCategory.tsx` previously imported its storage-key constant from the legacy panel reducer.
That import also loaded `PanelModel` and its dependencies.

The constant now lives in the existing `PanelEditor/types.ts` module, whose other imports are type-only.
The reducer re-exports the same constant for compatibility.
The component imports the lightweight module directly.

This source change removes another **562 modules** after the focused-router change.
The final category capture contains neither the legacy panel reducer nor `PanelModel`.

## Module footprint

The control uses the eager renderer with the original five callers.
The final version includes all caller changes and the constant relocation.

| Suite                          | Control modules | Final modules |         Reduction |
| ------------------------------ | --------------: | ------------: | ----------------: |
| `useNotificationPolicyAbility` |           4,540 |         3,763 |               777 |
| `OptionsPaneCategory`          |           4,431 |         3,102 |             1,329 |
| `NotebookExportMenu`           |           4,436 |         3,328 |             1,108 |
| `FinishedJobStatus`            |           4,262 |         2,802 |             1,460 |
| `ManagedReadOnlyBanner`        |           4,429 |         2,983 |             1,446 |
| Total suite/module pairs       |          22,098 |        15,978 | **6,120 (27.7%)** |

These are observed module lists, not estimates from source imports or inclusive timing trees.
None of the five final captures loads `app/store/configureStore.ts`.
The ability suite still loads the real backend service through another dependency path.
The other four final captures do not load that service.

## Measurements

All diagnostic runs use Happy DOM/Sucrase, Node 26.13.0, one worker, and fresh Jest caches.
Controlled comparisons use fixed lexical suite order.
The retained local preload selects that order without changing the checked-in Jest configuration.
The existing worker memory limit remains unchanged.

### Final sampled comparison

Both runs enable CPU sampling at 1,000 microseconds and heap sampling at 1 MiB.
They pass the same five suites and 49 tests.

| Measure                                | Eager control | Final version |   Change |
| -------------------------------------- | ------------: | ------------: | -------: |
| Profile execution wall time            |      33.130 s |      25.948 s |   -21.7% |
| Process CPU within suite boundaries    |      38.156 s |      29.346 s |   -23.1% |
| Estimated allocation volume            |   3,308.1 MiB |   2,464.9 MiB |   -25.5% |
| Observed GC duration                   |       4.133 s |       3.079 s |   -25.5% |
| Accumulated body import/transform time |       0.263 s |       0.295 s | +0.031 s |

The reduction does not come from moving more imports into bodies.
Remaining body imports include the retained conditional matcher implementations.

This is one sampled pair, not a full-shard benchmark result.
Sampling affects CPU, allocations, GC, and elapsed time.
Allocation estimates are not retained heap or RSS.

### Repeated comparisons without CPU or heap sampling

The first caller-only pass used two cold runs per version, before the additional constant relocation.
Run order was control, optimized, optimized, control.

| Measure                             | Control runs     | Caller-only runs |
| ----------------------------------- | ---------------- | ---------------- |
| Profile execution wall time         | 19.306, 20.730 s | 10.985, 17.837 s |
| Process CPU within suite boundaries | 20.629, 23.279 s | 11.870, 19.036 s |
| Suite/module pairs                  | 22,098 in both   | 16,540 in both   |

Timing varies substantially on this machine.
The stable module reductions provide stronger evidence than the fastest timing result.
These runs still include phase and module instrumentation.
They do not predict savings for the ordinary four-worker shard.

## Correctness

Validation passed:

- Five targeted source suites: 49 tests, with unchanged test declarations and bodies.
- Ten alerting helper consumers: 128 tests and one snapshot.
- Six Happy DOM harness suites: 29 tests.
- Three jsdom/Sucrase harness suites: 16 tests.
- Both new regression guards fail against reverted behavior and pass with the changes.
- Three native tests retain the source/harness discovery boundary.
- Syntax and isolated transpilation checks pass for all changed TypeScript files.

The new panel-entry regression renders the real category using the existing storage key.
It also rejects loading the legacy reducer and panel model.

Harness-only roots do not discover the source suites' `uwrap` mock.
The renderer harness tests now select that same mock explicitly.
The provider harness also unmounts flag subscribers before its nested flag-reset hook runs.
Neither correction suppresses console enforcement.

No source cases or assertions were removed.
New regression cases remain outside source-shard discovery.
No full-shard run, repository-wide typecheck, or lint run forms part of this validation.
The existing duplicate `fixtures` manual-mock warning remains.

## Dependencies and disk use

No dependencies were installed.
The runs reuse `local/shard1-profile/deps`, linked through the existing root `node_modules` symlink.
The exact dependency record remains in `shard1-deps/plan.json`.

The profiler enforces a 220 MiB free-space floor.
Completed runs retain `summary.json` and a compact module-list summary.
Raw captures, generated configurations, logs, detailed Jest output, and transform caches are removed after analysis.
Old raw CPU, heap, and retention captures released approximately 64 MiB.
Their existing attribution reports and summaries remain.

Evidence remains under `local/import-cost-audit`:

- `before/` and `before-sampled/`: original lazy renderer and callers.
- `control-1/` and `control-2/`: eager renderer with original callers.
- `optimized-1/` and `optimized-2/`: focused callers before the constant relocation.
- `control-sampled/` and `optimized-sampled/`: final sampled comparison.
- `ability-validation/`: all ten shared-helper consumers.
- Correctness and mutation summaries for the harness checks.

The local control script preserves and restores optimized files around each comparison.
No commits, dependency-manifest changes, worker-limit changes, or shard-selection changes are part of this pass.
