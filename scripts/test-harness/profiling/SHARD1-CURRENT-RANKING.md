# Shard 1: current one-worker ranking

Date: 2026-11-04. Revision: `3a736c66c2958a9f995717d1dd664223b0c290b6`.

## Scope

This diagnostic used one worker, Happy DOM, Sucrase, and a cold Jest transform cache.
The worker-recycling limit remained 1 GB. No source code, test cases, or shard-selection rules changed.
The 352 selected paths match the original jsdom shard-1 roster and the latest committed benchmark roster.

The command was:

```sh
node scripts/test-harness/profiling/run-shard1.cjs
```

One worker reduces concurrent load. This run did not measure temperature or control CPU frequency.
Local timings are not directly comparable to the four-worker bench-machine results.
The surgical dependency layout also differs from a normal pnpm installation.

## Outcome

| Measure | Result |
| --- | ---: |
| Process wall time | 672.14 s |
| Passing suites | 351 |
| Failing suites | 1 |
| Passing tests | 4,157 |
| Failing tests | 56 |
| Skipped tests | 17 |
| Todo tests | 1 |
| Passing snapshots | 113 |
| Suites with phase instrumentation | 351 |
| Observed worker PIDs in phase logs | 13 |
| Largest phase-sampled worker RSS | 1,437.9 MiB |

`DashboardMigratorToBackend.test.ts` failed because generated backend migration outputs are absent locally.
Its 56 failures account for the difference from the bench-machine result of 4,213 passing tests.
The diagnostic retained this suite. This result is not a passing full-shard benchmark.

`QueryAndCondition.test.tsx` selects jsdom explicitly, so it bypasses the phase environment.
Its Jest result supplies elapsed time, but not the setup/body split.

The RSS figure describes one worker at phase boundaries. It is not a continuous peak or summed process RSS.
Heap changes between phases do not measure allocation volume or prove retention.

## Where the time goes

| Attributed interval | Aggregate time |
| --- | ---: |
| Environment construction, setup, imports, and collection before tests | 449.01 s |
| Tests and hooks | 194.56 s |
| Teardown and remaining attributed work | 4.51 s |
| Total across instrumented suites | 648.08 s |

Pre-test work accounts for **69.3% of attributed time**, or 66.8% of process wall time.
It is not exclusively import execution.

Within the test-and-hook interval, test bodies account for 185.51 seconds and hooks account for 6.74 seconds.
These values subdivide the interval. They are not additional costs.
Imports inside test bodies also count as body time.

Of the 351 instrumented suites, 106 took at least two seconds.
The slowest 20 instrumented suites account for 165.42 seconds, or 25.5% of attributed time.
Most attributed time remains outside that group. Shared setup and import costs therefore remain important targets.

## Slowest suites

Times are seconds. Total includes the full instrumented environment interval, except the explicit jsdom suite.
The jsdom row uses Jest elapsed time and has no phase breakdown.

| Suite | Total | Before tests | Tests and hooks |
| --- | ---: | ---: | ---: |
| `GrafanaReceiverForm.test.tsx` | 17.22 | 3.10 | 14.11 |
| `PolicyTreeSelector.integration.test.tsx` | 15.50 | 2.55 | 12.94 |
| `SharedPreferences.test.tsx` | 12.26 | 1.62 | 10.63 |
| `AddPanelToNotebookModalBody.test.tsx` | 12.09 | 4.88 | 7.19 |
| `DashboardSidebar.test.tsx` | 11.10 | 10.44 | 0.61 |
| `explore/spec/query.test.tsx` | 9.96 | 8.18 | 1.77 |
| `QueryAndCondition.test.tsx` (jsdom) | 9.89 | — | — |
| `StagedConfiguration.test.tsx` | 8.78 | 6.06 | 2.71 |
| `RecordingRuleListEntry.test.tsx` | 7.12 | 6.31 | 0.80 |
| `integrationSchemasApi.test.ts` | 6.83 | 6.05 | 0.77 |
| `ProviderConfigForm.test.tsx` | 6.77 | 1.21 | 5.55 |
| `RangeFilter.test.tsx` | 6.65 | 0.63 | 6.01 |
| `DashboardControls.test.tsx` | 6.48 | 4.25 | 2.22 |
| `provisioning/Config/ConfigForm.test.tsx` | 6.29 | 1.88 | 4.40 |
| `explore/state/query.test.ts` | 5.59 | 3.16 | 2.42 |
| `PanelDataTransformationsTab.test.tsx` | 5.58 | 1.89 | 3.68 |
| `CommandPalette.test.tsx` | 5.56 | 1.93 | 3.62 |
| `ContactPointHeader.test.tsx` | 5.56 | 4.33 | 1.22 |
| `sandboxConsent.test.ts` | 5.55 | 0.48 | 5.06 |
| `areQueriesTransformableToSimpleCondition.test.ts` | 5.39 | 5.34 | 0.03 |

### Worker startup affects the ranking

Several expensive import rows were the first instrumented suite in a new worker:

- `DashboardSidebar.test.tsx`
- `AddPanelToNotebookModalBody.test.tsx`
- `StagedConfiguration.test.tsx`
- `RecordingRuleListEntry.test.tsx`
- `integrationSchemasApi.test.ts`
- `areQueriesTransformableToSimpleCondition.test.ts`

Those rows include costs that later suites can reuse within the worker.
A large elapsed time does not establish that the suite itself causes all that cost.
A controlled repeat in a reused worker is necessary before estimating savings from those imports.

The CSV marks the first instrumented suite for each worker PID.
It does not include a complete process-start trace.

## Next audit priorities

### 1. Repeated module isolation in sandbox consent

`public/app/features/dashboard-scene/scene/sandbox-consent/sandboxConsent.test.ts` calls its isolated loader 24 times across 15 cases.
Each call requires the production consent module in a new module registry.
The consent module imports the `@grafana/data` barrel.

Single-loader cases commonly took 185–233 ms. Two-loader cases took approximately 388–439 ms.
The session-storage and expiry cases each load three times and took 606 ms and 670 ms.
This pattern supports repeated module initialization as a concrete target.

A smaller isolation boundary or an instantiable store core can preserve real storage behavior without rebuilding the full dependency graph.
Fresh instances must still read persisted state and preserve user/org isolation, expiry, blocked-storage fallback, and hook snapshots.
Subscriptions and timers need explicit lifecycle ownership before dependencies can safely be shared.

The 30-day advances use fake time. They are not 30-day wall waits.
The measured five-second body budget is not a guaranteed five-second saving.

### 2. Date-filter interactions

`packages/grafana-ui/src/components/Table/TableNG/Filter/RangeFilter.test.tsx` spends 6.01 seconds in tests and hooks.
The calendar-selection, reversed-range, and timezone-conversion cases took approximately 656 ms, 619 ms, and 565 ms.

The suite types full timestamp strings. Each character causes state updates and date-processing work.
Bulk paste is a candidate only where the assertion concerns the completed value rather than incremental keyboard behavior.
The real calendar, bounds, precision, timezone, focus, and Apply-only behavior must remain covered.

The focus helper defers focus through `requestAnimationFrame` for correct menu-close ordering.
Some focus assertions use real polling. This is a smaller candidate, not a reason to make production focus synchronous.

### 3. Provider form rendering and custom Select input

`public/app/features/auth-config/ProviderConfigForm.test.tsx` spends 5.55 seconds in tests and hooks.
The save-and-enable case takes 2.53 seconds. Ordinary text fields already use paste.
Custom Select values still use character-by-character input.

Paste followed by a real Enter key is a candidate for payload-only custom-option setup.
Option creation, mapping order, full payloads, and telemetry assertions must remain intact.

`FieldRenderer` constructs the full translated `fieldMap(provider)` during rendering.
Its runtime share is not yet measured. A profile can determine whether form-scoped reuse removes significant repeated work.
Any reuse must preserve locale and permission changes.

The form also imports `Page` only for `Page.Contents`, which aliases the separately exported `PageContents` component.
That dependency is a narrow import candidate.

Successful saves schedule a 300 ms redirect, but the tests do not await it.
The redirect is pending-timer cleanup work, not established blocking time.

### 4. Existing large interaction suites

The receiver form, policy-tree selector, SharedPreferences, and notebook modal remain the largest test-body contributors.
Their combined test-and-hook interval is 44.87 seconds.
This is a measured budget, not an estimate of removable work.

`SharedPreferences.test.tsx` still mounts the same initial form separately for several read-only preference assertions.
Consolidation is a candidate after fixture equivalence is verified.
Interactive saves and distinct states must remain separate.

The notebook modal includes keyboard navigation and focus tests.
Its repeated Tab interactions exercise real behavior and cannot be replaced wholesale with direct focus calls.

### 5. First-use extension registration

`public/app/features/plugins/extensions/registry/setup.test.ts` spends 1.013 seconds in its first test.
The other bodies each take approximately 3–13 ms.

Registry initialization dynamically imports core extension configuration.
The Explore configuration still imports dispatch, actions, and query execution for a correlation click callback.
Separating registration from action execution is a candidate for a wider import improvement.
Concurrent initialization, retry, logging, feature flags, dispatch order, and error behavior must remain intact.

The profile records 519 ms of GC across this suite, without locating it inside the first test.
The first-test duration is therefore not an import-savings estimate.

## Artifacts and resource use

Local artifacts are in `local/shard1-profile/results/shard-uqM9tK/`:

- `suite-ranking.csv`: all 352 suites, phase durations, worker PID, and phase-sampled RSS.
- `ranking-summary.json`: revision and leading rows.
- `jest-results.json`: suite and case results.
- `phases.jsonl`: phase, hook, and test-body measurements.
- `jest.log`: complete test output.
- `run.json`: command selection and run metadata.

The profiling script removed its transform cache after the run.
No dependencies were installed.
Twenty-six old raw attribution/trace files were losslessly compressed and verified, recovering 124.1 MiB.
The compressed files retain the original names with a `.gz` suffix. Existing compressed heap snapshots remain unchanged.
Approximately 393 MiB of disk space remained after the run, above the 220 MB reserve.

This pass produced rankings and audit proposals only. It did not implement further optimizations.
