# Shard 1: third import-cost audit

## Scope

This batch follows revision `995899329af0495d51331a6eb7710057435dc039`.
The baseline includes the previous two import-cost batches.
The updated external profile is `local/summary2/summary.json`.

The audit selected seven existing suites for before/after measurements.
All runs used Happy DOM/Sucrase, one worker, fresh Jest caches, and fixed lexical suite order.
The runs used three separate groups to limit memory use.
No source suite paths, test cases, snapshots, or benchmark selections changed.
The only expected-output update is the generated import path.
No imports moved into test bodies.

## Changes

### A narrow base-query entry point

`@grafana/api-clients/rtkq/createBaseQuery` now exposes the existing helper without the aggregate RTKQ barrel.
The package export includes source, declaration, ESM, and CommonJS paths.
The old barrel retains its export.

Helper-only consumers now use the narrow entry point:

- The alerting conversion client.
- The scopes API.
- The dashboard browsing API.
- The public dashboard API.
- The legacy client type import.

The generator uses the same entry point for future clients.
Its existing expectation changed to match the new import path.
No generated endpoint behavior changed.

This prevents helper imports from initializing unrelated generated API clients.
The regression guard exercises real query responses, metadata, and backend errors.
It also rejects generated API initialization and checks compatibility with the old export.

### Narrow alerting imports

`DEFAULT_GROUP_EVALUATION_INTERVAL` moved unchanged from `formDefaults.ts` into `defaultEvaluationInterval.ts`.
Its four constant-only consumers now import the smaller module.
`formDefaults.ts` retains a compatibility re-export.
The interval still captures the runtime configuration at module initialization.

`RuleInspectorTabs` moved unchanged into its own module.
The inspector and export drawer now import that module directly.
The inspector retains a compatibility re-export.
The export drawer no longer loads the inspector, editor, and rule-conversion graph through the tab component.

The contact-point and datasource-loader tests retain their existing renderers.
Their measured graph reductions come from production imports, not new component mocks.

### Translate only the requested time-range label

`rangeutil.ts` now stores untranslated preset definitions and label callbacks.
A preset lookup translates only the matching label, not all 53 labels.
A custom match needs no preset translations.
An unmatched range that ends at `now` avoids two complete preset translations.

The implementation does not cache translated strings.
Locale changes still affect later calls.
Each text-range lookup returns an independent option object.
The existing keys, labels, plural forms, custom-range precedence, and fallback formatting remain unchanged.
No public export was added.

### Focus two existing suites

`useNavModel.test.ts` now uses React Testing Library and a focused Redux store.
It retains the real folder API reducer, middleware, backend service, MSW handlers, permissions, and feature flags.
It no longer imports the application-wide renderer and store.

`getVizSuggestionForQuery.test.ts` no longer constructs a complete dashboard and grid layout.
The test already replaced both dashboard operations with spies.
It now supplies a typed object for those same operations.
Real `VizPanel` and `SceneQueryRunner` instances remain.
`applyQueryToPanel` accepts a `Pick` of the two required dashboard operations.
Existing dashboard callers remain compatible.

## Sampled measurements

The seven suites passed 97 tests and seven snapshots before and after the changes.
Each row represents one before/after pair within its group.
The CPU sampling interval was 1,000 microseconds.
The allocation sampling interval was 1 MiB.

CPU means process user plus system time within suite boundaries.
It excludes command startup and work outside those boundaries.
Allocation estimates measure allocation volume, not retained heap or peak RSS.
Sampling adds overhead, so these results do not predict the four-worker shard duration.

| Suite                         | Modules before | Modules after |   CPU before |    CPU after | Allocations before | Allocations after |
| ----------------------------- | -------------: | ------------: | -----------: | -----------: | -----------------: | ----------------: |
| `ContactPointHeader`          |          5,362 |         4,745 |     22.070 s |     21.037 s |        2,569.4 MiB |       1,996.5 MiB |
| `useDeleteRuleFromGroup`      |          4,653 |         3,853 |      6.467 s |      5.704 s |          429.7 MiB |         386.0 MiB |
| `useMoveRuleFromRuleGroup`    |          4,654 |         3,854 |      5.368 s |      5.145 s |          396.1 MiB |         374.7 MiB |
| `DataSourceGroupLoader`       |          5,378 |         4,805 |      7.669 s |      8.068 s |          582.9 MiB |         562.3 MiB |
| `useNavModel`                 |          4,400 |         3,275 |     16.234 s |     12.021 s |        1,855.6 MiB |       1,132.1 MiB |
| `getVizSuggestionForQuery`    |          3,866 |         2,781 |      8.642 s |      3.332 s |          774.0 MiB |         209.2 MiB |
| `AddPanelToNotebookModalBody` |          4,453 |         4,453 |     25.152 s |     26.297 s |        2,749.3 MiB |       2,680.7 MiB |
| **Total**                     |     **32,766** |    **27,766** | **91.603 s** | **81.603 s** |    **9,357.0 MiB** |   **7,341.5 MiB** |

A module loaded by two suites contributes once to each suite.
The total reduction is **5,000 suite/module pairs (15.3%)**.
Measured CPU decreased **10.9%**, and estimated allocations decreased **21.5%** across these groups.
Combined profile execution time decreased from 89.257 to 81.116 seconds.

The focused suites show the clearest timing and allocation reductions.
`DataSourceGroupLoader` shows a smaller graph but no measured CPU improvement in this pair.
The sampled notebook pair also shows no whole-suite CPU improvement.
These rows do not establish a timing improvement for every suite.

Accumulated body import/transform time changed from 0.580 to 0.728 seconds.
The focused pair has zero recorded body import/transform time before and after.
No new lazy imports explain the gains.
The small increase elsewhere does not establish a reduction in body import time.

## Notebook comparison without CPU or heap sampling

The sampled notebook profile estimates test-phase i18next allocations at 189 MiB before and 38 MiB after.
Four further runs isolate the range-description change from the other optimizations.
Control runs restore only the old `rangeutil.ts`.
The run order is control, optimized, optimized, control.
Module and phase instrumentation remains active.

| Run                  | Profile execution | Test bodies |    Suite CPU |
| -------------------- | ----------------: | ----------: | -----------: |
| Control 1            |          22.784 s |     7.574 s |     24.147 s |
| Optimized 1          |          21.415 s |     7.017 s |     22.806 s |
| Optimized 2          |          22.145 s |     7.298 s |     23.682 s |
| Control 2            |          22.393 s |     7.613 s |     24.053 s |
| **Control median**   |      **22.589 s** | **7.594 s** | **24.100 s** |
| **Optimized median** |      **21.780 s** | **7.158 s** | **23.244 s** |

Both optimized runs are faster than both controls on all three measures.
The median body reduction is 5.7%, and the median CPU reduction is 3.6%.
Two runs per version do not establish statistical confidence for a full-shard improvement.
The deterministic reduction in translation calls provides separate evidence that the implementation removes work.

## Correctness validation

Final validation passed:

- Seven measured source suites: 97 tests and seven snapshots.
- Six API and range consumers: 152 tests.
- Three interval and inspector consumers: 49 tests on the final retry.
- Four export and group consumers: 35 tests and four snapshots.
- Three new harness suites: 98 tests in Happy DOM/Sucrase and again in jsdom/Sucrase.
- Three native discovery-boundary tests.
- Syntax parsing and isolated transpilation for 23 changed or new TypeScript files.
- AST comparisons of the two focused source suites: all titles and 29 assertion expressions remain unchanged.
- Source resolution for the new package entry under the root, API-client, and alerting TypeScript configurations.
- Prettier and `git diff --check`.

The new guards remain under `scripts/test-harness/regressions`, outside source-shard discovery.
Three temporary reversions made the relevant guards fail:

- Redirect the narrow API entry to the aggregate barrel.
- Restore the export drawer import through the inspector.
- Restore the old range descriptions, which translate 53 labels instead of one.

All temporary reversions were restored.
The API build configuration includes the helper, and its output paths match the new package export.
No package build, full-shard run, repository-wide typecheck, or lint run forms part of this validation.

### Existing intermittent inspector assertion

`RuleInspector` initially failed its assertion for `expr: up == 0` in the editor DOM.
The unchanged HEAD code reproduced the same failure in the same three-suite group.
A baseline run of that suite alone passed.
The optimized three-suite retry passed all 49 tests.
This audit leaves the existing assertion unchanged.
The evidence establishes an intermittent baseline problem, not its underlying cause.

The existing duplicate `fixtures` manual-mock warning also remains unchanged.

## Artifacts and next steps

`local/import-cost-audit-3/comparison-summary.json` contains the comparison in columnar form.
Each successful profile directory retains its metric summary and module summary.
Failed runs retain compact failure evidence.
Raw captures, generated caches, logs, and full Jest result files were removed.
No dependencies were installed for this batch.

The next benchmark is the unchanged shard selection on the external machine with four workers.
Useful remaining targets include the broad renderers in `ContactPointHeader` and `DataSourceGroupLoader`.
Both still load more than 4,700 modules.
Receiver-form subscription work remains deferred to a separate batch.
