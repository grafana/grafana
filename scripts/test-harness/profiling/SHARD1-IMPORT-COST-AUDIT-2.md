# Shard 1: second import-cost audit

## Scope

This batch follows `SHARD1-IMPORT-COST-AUDIT.md` on revision `3b6162328392881950f63564cb0cb860e9a6934c`.
The baseline includes all uncommitted changes from that first batch.
The measurements here exclude the gains from that batch.

The audit selected nine existing suites from `local/summary.json`.
All comparisons use Happy DOM/Sucrase, one worker, fresh Jest caches, and fixed lexical suite order.
No source suite paths, test assertions, snapshot contents, or benchmark selections changed.
No imports moved into test bodies.

## Changes

### Focused providers instead of the application renderer

- `PageFallbackLoader.test.tsx` retains real navigation reducers, chrome, pod-readiness service, feature flags, and compatible routers.
  Its navigation index still uses `buildInitialState()`.
  Custom history, store, chrome, and pod state remain available to each case.
- `RuleRouting.test.tsx` retains real compatible routers without the application store or unrelated context providers.
- `useDeleteRuleFromGroup.test.tsx` and `useMoveRuleFromRuleGroup.test.tsx` retain the real alerting API reducer and middleware.
  Their MSW requests, permissions, error paths, and snapshots remain unchanged.
  Injected alerting endpoints share the same API middleware.
- `StateHistory.test.tsx` retains the real unified-alerting reducer, thunk middleware, backend service, and annotation handlers.
  Its MSW setup no longer imports unrelated alerting handlers.
  Navigation cases retain the same store across component remounts.
- `PanelAdHocChangesAction.test.tsx` retains the real feature-flag provider, dashboard scenes, and panel behavior.
- `ViewPanelQuickToggles.test.tsx` retains the real scenes and editors.
  Each setup creates fresh history shared by the router and runtime location service.
- `PluginDetailsBody.test.tsx` retains real plugin and datasource reducers, thunk middleware, feature flags, and tab components.

None of the final nine captures loads `app/store/configureStore.ts`.
The tests do not replace production reducers, components, or hooks with new mocks.

### Narrow production imports

`RuleRouting.tsx` now imports `GRAFANA_RULES_SOURCE_NAME` directly from `utils/constants.ts`.
It imports `isDefaultRoutingTreeName` from stable `@grafana/alerting`, not the broader unstable entry point.
Both exports refer to the same predicate implementation.

`createContactPointSearchLink` moved unchanged from `utils/misc.ts` to `utils/url.ts`.
The old module retains a compatibility re-export.
`RuleRouting.tsx` imports the helper directly from its new location.

A separate control retains the focused renderer but restores the original production imports.
That control loads 3,340 modules, compared with 3,134 after the production changes.
Thus, the production changes remove another **206 modules**, beyond the renderer change.

### Remove a redundant actual-module load

The existing scopes mock in `DashboardControls.test.tsx` replaces the only required export.
It no longer spreads `jest.requireActual('app/features/scopes/ScopesContextProvider')` first.
This removes 12 scope-service and API modules.
The rest of the suite still loads a large scene graph.

## Observed module counts

These counts measure evaluated modules, not a static import-graph estimate.
A module loaded by two suites contributes once to each suite.

| Suite                        |     Before |      After |           Removed |
| ---------------------------- | ---------: | ---------: | ----------------: |
| `PageFallbackLoader`         |      4,447 |      3,283 |             1,164 |
| `StateHistory`               |      4,722 |      3,563 |             1,159 |
| `RuleRouting`                |      4,514 |      3,134 |             1,380 |
| `useDeleteRuleFromGroup`     |      5,308 |      4,653 |               655 |
| `useMoveRuleFromRuleGroup`   |      5,309 |      4,654 |               655 |
| `DashboardControls`          |      5,756 |      5,744 |                12 |
| `PanelAdHocChangesAction`    |      5,121 |      4,348 |               773 |
| `ViewPanelQuickToggles`      |      5,007 |      4,349 |               658 |
| `PluginDetailsBody`          |      4,986 |      4,341 |               645 |
| **Total suite/module pairs** | **45,170** | **38,069** | **7,101 (15.7%)** |

The sampled and unsampled captures have identical module counts.
The final routing capture loads only `constants.ts` and `url.ts` from the alerting utilities directory.

## Targeted measurements

Each nine-suite run passed **125 tests and nine snapshots**.
These are local profiling results, not predictions for the four-worker shard benchmark.
Each table contains one before/after pair.

### Without CPU or heap sampling

Module and phase instrumentation remains active.

| Measure                                |   Before |    After |   Change |
| -------------------------------------- | -------: | -------: | -------: |
| Profile execution wall time            | 48.603 s | 39.525 s |   -18.7% |
| Process CPU within suite boundaries    | 56.105 s | 43.993 s |   -21.6% |
| Accumulated body import/transform time |  0.571 s |  0.531 s | -0.040 s |

### With CPU and heap sampling

The CPU interval is 1,000 microseconds.
The allocation interval is 1 MiB.

| Measure                                |      Before |       After |   Change |
| -------------------------------------- | ----------: | ----------: | -------: |
| Profile execution wall time            |    80.535 s |    70.700 s |   -12.2% |
| Process CPU within suite boundaries    |    93.344 s |    80.315 s |   -14.0% |
| Estimated allocation volume            | 7,125.2 MiB | 6,257.9 MiB |   -12.2% |
| Observed GC duration                   |    11.326 s |     9.082 s |   -19.8% |
| Accumulated body import/transform time |     0.738 s |     0.727 s | -0.012 s |

Allocation estimates do not measure retained heap or peak RSS.
The profiler reports occasional timestamp reordering and fallback allocation estimates for empty samples.
Timing and allocation sampling contain noise.
Stable module reductions provide stronger evidence than individual timing rows.

### Why individual allocation rows can increase

In the nine-suite pair, delete-rule allocations increased from 995.1 to 1,328.5 MiB.
Dashboard-controls allocations increased from 1,288.5 to 1,486.3 MiB.
Earlier suites no longer transform some dependencies that these later suites need.
This can move first-transform costs between suites, even with identical suite order.

A second sampled comparison starts with only those two suites and a fresh cache:

| Suite                    | Control modules | Final modules | Control allocations | Final allocations |
| ------------------------ | --------------: | ------------: | ------------------: | ----------------: |
| `useDeleteRuleFromGroup` |           5,308 |         4,653 |         2,536.3 MiB |       2,272.5 MiB |
| `DashboardControls`      |           5,756 |         5,744 |         1,309.8 MiB |       1,479.0 MiB |

The delete-rule allocation increase disappears when that suite runs first.
Its cold sampled CPU is effectively unchanged: 22.582 versus 22.776 seconds.
The two-suite execution times are 38.974 and 39.507 seconds.
This pair does **not** establish a timing improvement.

Dashboard controls still runs second in this comparison, so its transform-cache state can differ.
The dashboard change removes real work, but this audit does not establish a timing or allocation improvement for that suite alone.
It retains a one-line simplification, not a broad refactor.
The aggregate nine-suite reduction does not mean that every suite runs faster.

## Correctness validation

Validation passed:

- Nine changed source suites: 125 tests and nine snapshots in both profiling modes.
- Five URL-helper consumer suites: 85 passed tests and one existing skipped test.
- The new import-boundary guard in Happy DOM/Sucrase and jsdom/Sucrase.
- Three native discovery-boundary tests.
- Syntax and isolated transpilation for 13 changed TypeScript files.
- AST comparisons of all nine suites: assertion expressions and test titles remain unchanged.
- Prettier and `git diff --check`.

The URL-helper consumers include `AlertGroup`, `Policy`, `StagedConfiguration`, `misc`, and `url`.
The new `ruleRoutingEntryPoint.test.tsx` guard checks the exact rendered URL, including subpath and encoded contact-point text.
It also rejects the datasource, miscellaneous-utility, and unstable alerting entry points.
The guard fails with the original production imports and passes after restoration.

The guard remains under `scripts/test-harness/regressions`, outside source-shard discovery.
No full-shard run, repository-wide typecheck, or lint run forms part of this validation.
The existing duplicate `fixtures` manual-mock warning remains unchanged.

## Remaining opportunities

`DashboardControls` still loads 5,744 modules and remains a substantial target.
The one-line mock correction does not remove its real scene and editor dependencies.
Future reductions need production import boundaries rather than broader component mocks.

The two rule-group suites still import the full alerting MSW setup and large legacy helpers.
A future pass can separate the handlers and fixtures those hooks require.
It must retain request capture, permissions, and failure behavior.

A read-only audit examined `OptionFilter` and `renderSearchHits` in the legacy `OptionsPaneOptions.tsx` module.
Scene consumers import both exports through that component module.
Moving only the enum leaves the component reachable through the search helper.
Extracting both removes approximately five specific component/helper dependencies, but most underlying editor dependencies remain.
This batch leaves that larger refactor unchanged because the expected reduction is small.

## Artifacts and disk use

No dependencies were installed.
The existing surgical dependency tree and validation tools remain unchanged.
The dependency recipe remains `shard1-deps/plan.json`.

Local evidence resides in `local/import-cost-audit-2`:

- `before/` and `after/`: nine-suite runs without CPU or heap sampling.
- `before-sampled/` and `after-sampled/`: nine-suite sampled runs.
- `routing-source-control/`: focused renderer with original routing imports.
- `cold-two-control/` and `cold-two-optimized/`: the two-suite allocation check.
- `url-consumer-validation/`: existing URL-helper callers and utility tests.
- Harness, mutation, and static-validation summaries.

Completed profile directories retain only `summary.json` and `module-summary.json`.
Raw CPU captures, heap captures, detailed Jest results, logs, generated configurations, and transform caches were removed.
Local reproduction scripts and the first-batch patch backup remain.
All profiler runs enforce a 220 MiB free-space floor.
