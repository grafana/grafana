# Shard 1: third smaller-suite pass

Date: 2026-11-03. Control commit: `cba0191c` (`fixes and optimizations`).

## Scope

This pass covers seven existing shard-1 suites. It reduces unnecessary imports, repeated mounts, real debounce waits, and fixed response delays.
It does not change shard selection, snapshots, dependency versions, worker limits, environment behavior, or production matching algorithms.
No additional dependencies were installed.

## Changes

### Notebook list

`public/app/features/notebook/list/useNotebooksList.test.ts` now uses RTL directly, without the application wrapper.
The tested hook uses React state, translations, contextSrv, and API hooks that the suite already mocks.
Its exercised paths do not need the wrapper's Redux store, router, modal context, or feature-flag provider.

Six cases now use fake timers for the real 300 ms debounce.
Each case advances time in a separate `act`, after the setter's effect schedules the debounce.
The whitespace case also advances the debounce before its negative assertions.
Cleanup unmounts the hook before restoring real timers, including failure paths.
Other polling, all 45 cases, and all 64 assertion expressions remain unchanged.

### Notebook navigation races

`NotebookPageStateManager.test.ts` replaces four executions of a fixed 50 ms delay with response gates.
Each case waits for the newer load or blank-notebook creation, then releases and awaits the older response in `finally`.
This establishes response order explicitly and avoids leaving a request pending after an assertion failure.

Real MSW handlers, RTK requests, scene construction, stale-error responses, and all 33 cases remain intact.
The panel-metadata readiness wait remains because it observes real asynchronous work.

### Repeated modal and rule-list fixtures

- `MoveModal.test.tsx` combines identical initial-display cases and warnings within each API flag variant. Cases decrease from 11 to 6.
- `DataSourceGroupLoader.test.tsx` combines identical read-only fixtures, separately for vanilla Prometheus and Mimir. Cases decrease from 6 to 2.

Both suites retain fresh stores for each remaining case, real providers, MSW requests, and asynchronous readiness checks.
Distinct flag variants and user interactions remain separate.
The loader removes one duplicate length assertion at the same loaded-fixture checkpoint. Every distinct assertion remains.

### Alerting setup

`Details.test.tsx` installs the same real backend service directly instead of importing the entire alerting mockApi module for that assignment.
Its datasource setup, receiver scenario, real contact-point query, and awaited link assertion remain unchanged.

`Policy.test.tsx` uses the renderer's user-event session in four cases instead of creating another session.
Only its three prop-driven `TimingOptionsMeta` cases use direct RTL rendering.
The full policy-tree cases retain the application and Alertmanager providers.

### Narrow notification-policy entry point

`@grafana/alerting/notification-policies` exposes the existing pure route utilities without the root barrel's UI and API-hook exports.
The new facade reexports the same implementations. Existing root exports remain unchanged.
The package manifest includes source, declaration, ESM, and CommonJS targets. Rollup has a matching entry point.

The application utility in `public/app/features/alerting/unified/utils/notification-policies.ts` uses this supported subpath.
No matching, normalization, inheritance, escaping, or route-traversal implementation changed.
The existing 15-case suite remains unchanged.

## Measurements

Measurements use local Happy DOM, Sucrase, fresh processes, and one worker.
Cold means a fresh Jest transform cache, not a cleared operating-system cache.

### Isolated notebook-list suite

| Measure | Control | Edited |
| --- | ---: | ---: |
| Unique modules | 4,229 | 3,012 |
| Cold process wall time | 17.094 s | 10.192 s |
| Warm process wall time | 10.091 s | 5.984 s |
| Cold observed peak RSS | 610 MiB | 440 MiB |
| Warm observed peak RSS | 525 MiB | 388 MiB |
| Warm test-body time | 1.961 s | 0.164 s |
| Passing cases | 45 | 45 |

The wrapper change removes 1,217 modules, or 28.8%.
Observed matcher calls decrease from 97 to 64 because the debounce assertions no longer repeat inside polling loops.
The source still contains the same 64 assertion expressions.

### Isolated notification-policy utility suite

| Measure | Root package barrel | Narrow entry point |
| --- | ---: | ---: |
| Unique modules | 2,934 | 1,496 |
| Cold process wall time | 10.109 s | 5.809 s |
| Warm process wall time | 5.774 s | 3.713 s |
| Cold observed peak RSS | 423 MiB | 317 MiB |
| Warm observed peak RSS | 369 MiB | 283 MiB |
| Passing cases | 15 | 15 |
| Matcher calls | 62 | 62 |

The entry point removes 1,438 modules, or 49.0%. Both versions execute the same matching implementation and assertions.

### Seven-suite batch

| Measure | Control | Edited |
| --- | ---: | ---: |
| Process wall time | 40.750 s | 37.537 s |
| Passing suites | 7 | 7 |
| Passing cases | 137 | 128 |
| Skipped cases | 1 | 1 |

The single pair shows a 7.9% reduction. It is not a prediction for the full four-worker shard.
Some import work moves to later suites once the first suite stops loading unnecessary dependencies.
For example, notebook state-manager imports took longer in the edited batch. Isolated savings therefore must not be added together.

## Validation

- The original seven-suite batch passed 137 cases, with one existing skip.
- The edited batch passed 128 cases, with the same skip.
- Randomized validation with seed 1301 passed all eight selected suites, including the existing package route-utility tests.
- That run passed 181 cases and three snapshots, with one existing skip.
- The new harness entry-point suite passed both cases.
- Redirecting the new entry point to the broad root barrel made the graph regression fail. The narrow export was then restored.
- All three discovery-boundary Node tests passed.
- `git diff --check` passed.

An AST comparison covered all six edited source test files.
It found 230 original assertion occurrences and 229 edited occurrences, with every distinct expression retained.
The only removed occurrence is the duplicate loader length assertion.
Static assertion preservation does not, by itself, establish identical production coverage.

The new regression suite remains under `scripts/test-harness/`, outside ordinary shard discovery.
Expected shard-1 counts are 352 suites, 4,213 passed tests, 17 skipped tests, one todo, and 113 snapshots.
The nine fewer passing cases come from the two fixture consolidations.

The package build did not run: Rollup and its plugins are absent from the surgical dependency installation.
The source export and runtime identity checks passed, but emitted package artifacts still need normal build validation.
No repository-wide typecheck, lint run, or full-shard benchmark ran locally.
The existing duplicate `fixtures` manual-mock warning remains.

## Reviewed but unchanged

- `Browse.test.tsx` uses Redux, routing, page context, and real feature-flag consumers. Its current provider tree remains necessary.
- `PluginDetailsBody.test.tsx` needs real dispatch and datasource reducers. A narrower store requires more dependency validation.
  Its 47 version rows remain because the existing assertions cover each button.
- Plugin fixture helpers install a permission mock as a side effect. Replacing them with raw fixture imports changes behavior.
- Rule-group move/delete suites retain completion waits and invalidation requests. Their request capture is not a timed collection window.
- JourneyTracker and page-history deadlines already use fake time. Their large timeout values do not represent wall-clock sleeps.
- Rich-history storage retains the real datasource, persistence, and retention-policy paths.
- Extracting Details display helpers from policy-management modules remains a separate import-boundary candidate.

## Artifacts

Local evidence remains under `local/shard1-profile/results/`:

- `smoke-MgUDPi/`: original seven-suite batch.
- `smoke-ukV9mT/`: edited seven-suite batch.
- `pass3-notebooks-before/` and `pass3-notebooks-after/`: isolated notebook-list profiles.
- `pass3-policies-before/` and `pass3-policies-after/`: isolated notification-policy profiles.
- `pass3-randomized.log`: randomized source and package utility validation.
- `pass3-entrypoint-negative-control.log`: broad-barrel mutation failure.

Large traces remain compressed. The generated validation cache was removed after use.
