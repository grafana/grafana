# Shard 1: measured audit of five targets

Date: 2026-11-04. Control revision: `3a736c66c2958a9f995717d1dd664223b0c290b6`.

## Result

All five targets have changes and local measurements.
The targeted batch improved, but the complete local diagnostic did not improve.
A bench-machine comparison is necessary before claiming a full-shard speedup.

This pass keeps the original 352-suite selection, transformer, environment, and worker-recycling limit.
No dependencies were installed.
Four fewer test cases come from equivalent-fixture consolidation in SharedPreferences.
All original assertion occurrences in the three edited test files remain.

## Changes

### Consent-store imports

`@grafana/data/store` is a new supported entry point for the existing store singleton.
Its package exports include source, types, ESM, and CommonJS targets. Rollup has a matching entry.
`sandboxConsent.ts` uses this entry point instead of the main data barrel.

The consent test file is unchanged.
It still performs all 24 isolated loads and retains storage-event, expiry, blocked-storage, user/org, and hook checks.
No store factory, lifecycle change, or new storage mock was necessary.

The harness checks real storage operations, subscriptions, and singleton identity with the main barrel.
It also rejects loading the main barrel through the narrow entry point.

### RangeFilter input setup

Eight full-timestamp entries now use real clipboard paste instead of character-by-character typing.
These cases assert completed bounds, timezone conversion, or precision.
Numeric entry, malformed input, keyboard behavior, calendar selection, and Apply-only assertions remain.

Two cases await real initial focus before populating both date bounds.
This preserves the deferred autofocus behavior without timer or animation-frame mocks.
All 28 cases remain. Two focus assertions were added.

### Provider form

The form imports `PageContents` directly, which is the same component as `Page.Contents`.
Custom Select payload setup uses paste followed by a real Enter key.
Option creation, mapping order, full request payloads, and telemetry assertions remain.

An additional timing probe found 416 full field-map constructions, costing 1,345 ms across eight cases.
`FieldRenderer` now requests one field through `getField(provider, name)`.
Per-call factories avoid constructing unrelated field definitions.

`fieldMap(provider)` remains eager and enumerable for DTO conversion.
The 50 field definitions remain AST-equivalent after removal of their factory wrappers.
Neither path caches translated text, permissions, filesystem availability, or mutable field values.
Eight shared labels still evaluate on each lookup.

The edited timing probe recorded 38 eager-map calls and 378 selective lookups.
Their combined measured time was 308 ms: 174 ms for maps and 134 ms for selective lookups.
These pass-through probes measure function time, not the entire rendering cost.

### SharedPreferences fixtures

Five read-only cases now share one initial loaded form.
The case still asserts the theme, home dashboard, timezone, week start, and default language.
Interactive cases and distinct state variants remain separate.

The suite changes from 20 cases to 16 cases.
All 29 original assertion expressions remain.

### Explore extension registration

The correlation action now loads its dispatch, action, and query dependencies after a click.
`startCorrelation.ts` retains the original dispatch order: enable editing, then dispatch the query thunk for the selected pane.

The click callback now returns a Promise.
The existing extension wrapper handles rejected Promises, including chunk-load errors.
The harness verifies deferred loading, the selected pane, dispatch order, and rejection propagation.
The existing extension and registry suites remain unchanged.

## Measurement method

The targeted runner uses one worker and a fixed suite order:

1. `sandboxConsent.test.ts`
2. `RangeFilter.test.tsx`
3. `ProviderConfigForm.test.tsx`
4. `SharedPreferences.test.tsx`
5. Extension registry `setup.test.ts`

Each measurement pair uses a fresh process for each run.
The cold run starts with an empty Jest transform cache. The warm run reuses that cache.
Cold does not mean an empty operating-system cache.
The runner removes the transform cache after each pair.

Two baseline pairs and two final pairs passed.
The baseline batch passed 77 cases. The edited batch passed 73 cases.
An intermediate edited pair preceded the selective field-construction change and is not part of the final results.

### Five-suite process wall time

| Configuration | Cold runs | Warm runs |
| --- | --- | --- |
| Baseline | 41.19 s, 48.26 s | 32.57 s, 40.09 s |
| Final | 38.73 s, 38.61 s | 30.02 s, 30.55 s |

The final means are 38.67 seconds cold and 30.28 seconds warm.
Even against the faster baseline pair, these means are approximately 6.1% and 7.0% lower.
The baseline spread limits precision. These numbers do not predict four-worker shard savings.

### Warm test-and-hook intervals

| Suite | Baseline range | Final range |
| --- | ---: | ---: |
| Consent | 3.35–3.76 s | 0.10–0.11 s |
| RangeFilter | 5.84–6.67 s | 4.61–4.74 s |
| Provider form | 4.69–5.96 s | 3.66–3.75 s |
| SharedPreferences | 8.60–11.34 s | 9.95–10.20 s |
| Extension registry | 0.427–0.429 s | 0.045–0.050 s |

The batch does not isolate a consistent SharedPreferences reduction.
A separate comparison held the other edited production files constant and changed only the SharedPreferences test file.
That comparison is listed next.

Removing the initial consent barrel import moves some first-load work into later suites.
For example, RangeFilter pre-test time increased while its test-and-hook interval decreased.
Isolated gains therefore cannot be added to estimate the batch result.

The largest phase-sampled worker RSS in warm batches decreased from 1,029–1,063 MiB to 893–897 MiB.
These samples are not continuous peaks, summed process RSS, or allocation measurements.

### Isolated comparisons

| Target | Measure | Before | After |
| --- | --- | ---: | ---: |
| SharedPreferences consolidation | Cold wall | 24.59 s | 23.29 s |
| SharedPreferences consolidation | Warm wall | 17.87 s | 17.33 s |
| SharedPreferences consolidation | Warm tests and hooks | 10.35 s | 9.50 s |
| Extension action loading | Cold wall | 14.70 s | 10.81 s |
| Extension action loading | Warm wall | 7.83 s | 5.91 s |
| Extension action loading | Warm tests and hooks | 1.55 s | 0.052 s |
| Extension action loading | Warm phase-sampled worker RSS | 448 MiB | 366 MiB |

Each isolated comparison is one cold/warm pair per variant.
For the extension comparison, only `getExploreExtensionConfigs.tsx` changed between variants.
Other edited production files remained constant.
The isolated results are supporting evidence, not established full-shard savings.

## Complete local diagnostic

Both runs used one worker, a cold transform cache, and the default Jest suite order.
The targeted batch used a fixed order. The full runs did not freeze the order or worker boundaries.

| Measure | Before | After |
| --- | ---: | ---: |
| Process wall time | 672.14 s | 696.62 s |
| Passing suites | 351 | 351 |
| Failing suites | 1 | 1 |
| Passing tests | 4,157 | 4,153 |
| Failing tests | 56 | 56 |
| Skipped tests | 17 | 17 |
| Todo tests | 1 | 1 |
| Passing snapshots | 113 | 113 |
| Aggregate pre-test interval | 449.01 s | 469.33 s |
| Aggregate test-and-hook interval | 194.56 s | 201.18 s |
| Observed worker PIDs in phase logs | 13 | 12 |
| Largest phase-sampled worker RSS | 1,438 MiB | 1,456 MiB |

The edited full run was **3.6% slower**.
Several unchanged expensive suites also took longer, and the worker boundaries changed.
These observations do not establish the cause of the slowdown or rule out an aggregate regression.
No full-shard speed or memory improvement is established locally.

Both runs failed only `DashboardMigratorToBackend.test.ts` because generated backend migration outputs are absent.
Its 56 failed comparisons account for the difference from expected bench-machine passing counts.
Neither full diagnostic is a passing benchmark.

Expected bench-machine counts after this batch:

```text
Test Suites: 352 passed
Tests:       17 skipped, 1 todo, 4209 passed, 4227 total
Snapshots:   113 passed
```

## Validation

- Randomized source validation, seed 1301: nine suites and 162 cases passed.
- New harness checks plus existing core-extension initialization: four suites and 15 cases passed under Happy DOM.
- The same four harness suites and 15 cases passed under jsdom, with seed 1301.
- Three negative controls failed as expected: broad store export, eager field lookup, and eager correlation-action import.
- All production files were restored after the negative controls. Final harness runs passed.
- An AST comparison retained all 128 original assertion occurrences across the three edited source test files.
- The edited files contain 130 occurrences because RangeFilter adds two focus assertions.
- All 50 provider field definitions remain AST-equivalent after removal of their factory wrappers.
- All three discovery-boundary checks passed.
- An independent read-only review found no correctness blockers.
- `git diff --check` passed.

The surgical installation lacks Rollup and its plugins, so emitted package artifacts remain unvalidated.
No repository-wide lint or typecheck ran.
Source-resolution singleton checks do not replace a package build.

## Artifacts

Artifacts remain under `local/shard1-profile/results/`:

- `audit-targets-before-1/` and `audit-targets-before-2/`
- `audit-targets-after-1/`: intermediate result before selective field construction
- `audit-targets-final-1/` and `audit-targets-final-2/`
- `audit-preferences-original-test/` and `audit-preferences-consolidated/`
- `audit-registry-eager/` and `audit-registry-deferred/`
- `audit-targets-summary.json`
- `audit-field-map.log` and `audit-field-map-after.log`
- `audit-randomized.log`, `audit-harness-final.log`, and `audit-harness-jsdom.log`
- `audit-negative-store.log`, `audit-negative-fields.log`, and `audit-negative-correlation.log`
- `shard-uqM9tK/`: baseline full diagnostic
- `shard-hWugxn/`: edited full diagnostic

Local helper scripts preserve the fixed-order measurements, field timing probe, and AST comparisons.
No generated transform cache remains from these measurements.
