# Shard 1: query imports and remaining form setup

Date: 2026-11-04. Base revision: `a9951b3c`.

## Summary

The upstream sync retained all accepted pass-4 changes.
This pass removes an unnecessary dashboard dependency from query classification.
It also reduces duplicate receiver setup and notebook payload entry.

The query suite loads 848 fewer modules after the import change.
Its pre-test RSS samples decrease in both comparisons.
Wall-time results vary substantially, so this pass does not establish a stable speedup or a full-shard memory reduction.

All measurements use one worker, Happy DOM, and Sucrase.
Cold and warm refer to the Jest transform cache, not the operating-system cache.
Each run starts a new process. The runner retains the existing 1 GB worker-recycling limit.

## 1. Query classification without dashboard form conversion

`formProcessing.ts` imported `getInstantFromDataQuery` from `utils/rule-form.ts`.
That module also imports dashboard-scene conversion utilities.
The classification helper does not use those utilities.

The helper now lives in the existing `utils/query.ts` module.
`formProcessing.ts` imports it directly. `rule-form.ts` retains a compatibility export.
An AST comparison confirms that the helper implementation is unchanged.

The change preserves datasource lookup, UID fallback, Prometheus-flavor handling, Loki handling, and unsupported-source results.
It does not substitute a newer datasource API with different lookup behavior.

### Runtime module evidence

A separate diagnostic recorded `require.cache` after the unchanged transformability suite.
Both versions used the same diagnostic setup and passed all ten cases.

| Measure | Before | After |
| --- | ---: | ---: |
| Loaded modules | 3,963 | 3,115 |
| Dashboard-scene modules | 382 | 15 |

The change removes 848 modules overall, including 367 dashboard-scene modules.
The new query utility is the only added module in this comparison.
Broad datasource and alerting utilities remain loaded. This is not a complete removal of their dependency graph.

### Timing and RSS

The suite is `components/rule-editor/query-and-alert-condition/__snapshots__/areQueriesTransformableToSimpleCondition.test.ts` under unified alerting.
The table uses process wall time and RSS at the start of tests.

| Comparison | Cache | Before wall | After wall | Before RSS | After RSS |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Cold | 7.778 s | 9.412 s | 526.0 MiB | 418.5 MiB |
| 1 | Warm | 4.120 s | 5.008 s | 431.9 MiB | 357.4 MiB |
| 2 | Cold | 13.674 s | 9.878 s | 529.4 MiB | 418.0 MiB |
| 2 | Warm | 6.262 s | 5.444 s | 431.4 MiB | 355.4 MiB |

The first comparison is slower after the change. The second is faster.
The large variation in baseline time prevents a reliable speedup estimate.
No temperature or CPU-frequency measurements establish the cause.

RSS decreases by approximately 75–111 MiB at this phase boundary.
These samples do not measure allocation volume, retained heap after GC, continuous peak RSS, or summed full-shard RSS.

## 2. Smaller test-only changes

### Receiver form

Two provisioned-email cases used identical fixtures and form props.
One case now asserts that Save, Duplicate, and Delete controls are absent.
It first waits for the populated Addresses textbox, instead of waiting for an absent loading indicator.

All three control assertions remain. The secure-field and name-readonly cases remain separate.
The source suite has one fewer case.

### Notebook modal

Seven payload-only name entries now use focused paste instead of character-by-character typing.
All 107 assertion expressions remain unchanged.
Validation, trimming, keyboard navigation, focus, providers, notifications, and telemetry remain covered.

The earlier three-suite experiment does not establish a reliable timing gain for these test-only changes.
They remain small reductions in repeated setup and input events, not a claimed full-shard speedup.

## 3. Experiments excluded from the batch

An OnCall hook split removed redundant subscriptions from contact-point writers.
A separate query-header refactor preserved component identity across parent renders.
Neither change showed a convincing batch speedup. The header refactor also changed draft-state lifetime.

The final experiment comparison measured 59.820 versus 60.265 seconds cold, and 50.538 versus 50.048 seconds warm.
RSS results were mixed. Those runs included both production experiments and the smaller test changes.

Both production experiments and their regression files remain in the local `pass5-deferred` archive.
They are absent from this batch. The query-header behavior needs a separate correctness-focused change if pursued later.

## Validation

Seven source suites passed in both Happy DOM and jsdom:

- `GrafanaReceiverForm.test.tsx`
- `AddPanelToNotebookModalBody.test.tsx`
- `utils/rule-form.test.ts`
- `utils/query.test.ts`
- `rule-editor/formDefaults.test.ts`
- `query-and-alert-condition/reducer.test.tsx`
- `areQueriesTransformableToSimpleCondition.test.ts`

Each environment passed 190 tests and 21 snapshots.
Runs used one worker, no transform cache, and randomized test order with seeds 1301 and 2417.
Both environments retained Sucrase.
Jest reported the existing duplicate `fixtures` manual-mock warning.

The new `alertQueryEntryPoint.test.ts` harness passed three cases in each environment.
It covers Prometheus, Amazon Prometheus, and Azure Prometheus classification through real datasource setup.
It also asserts that classification does not load `rule-form.ts` or core `DashboardScene.tsx`.
Restoring the original import made all three cases fail at that dependency assertion.

The harness remains outside source-shard discovery. All three discovery-boundary tests passed.
The notebook assertion audit retained every original assertion occurrence.
The receiver audit replaced two loading-absence assertions with one positive readiness assertion and retained every other occurrence.

No full-shard run, lint run, or TypeScript typecheck forms part of this validation.
The expected bench totals are 352 suites, 4,208 passed tests, 17 skipped tests, one todo, and 113 snapshots.
The total test count becomes 4,226 because of the consolidated receiver case. These are expected totals, not a new bench result.

## Artifacts and resource use

Local artifacts are under `local/shard1-profile/results/`:

- `pass5-import-before-1/`, `pass5-import-after-1/`, `pass5-import-before-2/`, and `pass5-import-after-2/`: timing, phases, and Jest results.
- `pass5-modules-before.json` and `pass5-modules-after.json`: runtime module lists.
- `pass5-source-validation.log` and `pass5-source-jsdom.log`: source validation.
- `pass5-query-harness.log`, `pass5-query-harness-jsdom.log`, and `pass5-query-negative.log`: harness validation and negative control.
- `pass5-deferred/`: excluded production experiments and their harness tests.

No dependencies were installed. The dependency installation records require no changes.
Approximately 279 MiB of disk space remained before the final harness run, above the 220 MB reserve.
The profiling runner removed its generated transform caches.

## Next audit boundary

`utils/datasource.ts` still imports alertmanager APIs, ability hooks, context, and rule utilities.
The transformability suite imports that module independently for `DataSourceType`.
A predicate-only extraction cannot remove this graph while that enum import remains.
A separate experiment can measure a coordinated source-type boundary before adding further production changes.
