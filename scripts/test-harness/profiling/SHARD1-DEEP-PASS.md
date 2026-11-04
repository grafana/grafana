# Shard 1: shared setup and environment retention

Date: 2026-11-03. Control commit: `74762ad8` (`a bit more`).

## Summary

This pass investigates costs shared across many suites, rather than individual assertions or fixtures.
The strongest finding is a native performance observer that retains completed Jest runtimes.
A separate Happy DOM frame registry also retains root windows after the existing teardown.

The adapter now releases both resources. A fixed-order diagnostic shows substantially less surviving heap after repeated suite execution.
The ordinary 20-suite comparison does not show a time or sampled-RSS improvement. Full-shard worker behavior still needs bench-machine validation.

The pass also removes unnecessary imports from feature-flag helpers, DOM matcher registration, and one shared data hook.
No dependencies, worker limits, GC flags, shard selection rules, or source test cases changed.

## 1. Root-window cleanup

The installed Happy DOM environment calls `window.close()` during teardown.
Happy DOM permits that call to close windows opened by other windows, but not the ordinary root window.
Consequently, the root frame remains in the static `WindowBrowserContext` map.

The adapter now captures the public detached-window API before upstream teardown clears `global`.
After upstream timer disposal and task cancellation, it awaits `happyDOM.close()`.
Prototype restoration remains in a final cleanup block.

A ten-cycle lifecycle diagnostic used a 100,000-number array in each window:

| Measure | Original teardown | Explicit detached close |
| --- | ---: | ---: |
| Closed root windows | 0 | 10 |
| Additional registered frames | 10 | 0 |
| Post-GC heap increase | 11.45 MiB | Approximately 0 MiB |

This synthetic fixture establishes the retaining path. Its allocation size does not predict real-suite savings.
New regression cases also cover child-frame closure, pending timers, and active modern and legacy fake timers.
All three closure regressions failed against the old adapter and passed after the change.

## 2. Native performance observers retain complete runtimes

Frame cleanup alone did not stop growth in repeated import-heavy suites.
A compressed heap snapshot identified this strong-reference path:

```text
Node performance observer registry
  → PerformanceObserver
  → web-vitals callback
  → web-vitals.attribution.umd.cjs module
  → bound Jest require function
  → Jest Runtime
  → test environment and window
```

The analysis excluded weak edges and conditional WeakMap edges when searching for this strong path.
Happy DOM exposes Node's native PerformanceObserver. Closing its window does not disconnect that native observer.

The adapter now gives each root window a subclass of the real native observer:

- Constructor validation, supported entry types, records, and callback delivery retain native behavior.
- Successful `observe()` calls register the observer with its environment.
- `disconnect()` unregisters it. Subsequent `observe()` calls register it again.
- Teardown disconnects active observers through the captured native method and clears the registry.
- Host observers, including benchmark GC observers, remain outside this registry.

The regression uses actual performance marks and callbacks, not a mock implementation.
Before the change, the observer received marks after environment teardown. After the change, it stops, while a host observer continues.
The test also covers manual disconnection and reconnection.

This ownership boundary covers root-window observers. Direct `node:perf_hooks` consumers and observers created through iframe constructors remain outside it.
No broader interception is justified by the current retaining-path evidence.

## 3. Controlled retained-heap comparison

The diagnostic invokes Jest's actual `runTest` four times for each of three existing suites, in one process.
Both versions use the same fixed order: timeCompare, pluginSettings entrypoints, then DashboardSidebar.
Both versions include the new import changes. Only the environment adapter differs.

After each complete suite invocation, the diagnostic yields to the host event loop and requests collection through Inspector.
It records heap size and weak-reference liveness without retaining test environments directly.
Recycling is disabled only in this diagnostic. The ordinary Jest configuration remains unchanged.

| Checkpoint | Original adapter | Both cleanup fixes |
| --- | ---: | ---: |
| After four timeCompare runs | 101.9 MiB | 60.6 MiB |
| After four additional runtime runs | 204.7 MiB | 104.6 MiB |
| After four additional Sidebar runs | 609.4 MiB | 231.0 MiB |
| Live windows at the final checkpoint | 12 | 2 |

During the final four Sidebar runs, control heap increased from 353.7 to 609.4 MiB.
With cleanup, it remained between 230.8 and 231.1 MiB.
Final surviving heap was 62% lower in this diagnostic. This is not a 62% reduction in benchmark RSS or total allocation.

The remaining windows are not proof of zero retention. A separate process rejection listener retains the latest runtime in the inspected snapshot.
The fixed diagnostic reaches a plateau instead of retaining every completed environment.

Earlier checkpoints with ordinary exposed-GC calls produced different results from Inspector collection and heap snapshots.
Those exploratory numbers are not the basis for the final comparison.
An earlier comparison also changed suite order. The fixed-order measurements in this table supersede it.

## 4. Remove repeated import costs

### Feature flags

`@grafana/test-utils/feature-flags` now exports the existing feature-flag implementation directly.
The old `unstable` exports remain unchanged, with the same functions and provider singleton.
Two shared test wrappers and 18 flag-only shard-1 callers now use the narrow entry point.
They no longer import the package's handlers and fixtures solely to configure flags.

Mixed imports and suites that intentionally use the server or handlers remain unchanged.
Regression tests cover both import orders, shared provider state, helper identity, and the absence of unrelated modules.

### DOM matchers

Global setup registers lazy wrappers for all 29 jest-dom matchers.
The wrappers load the public `@testing-library/jest-dom/matchers` implementation only when a matcher runs.
They preserve context, arguments, results, errors, deprecated names, and TypeScript augmentation.
RTL's cleanup hooks and timeout configuration remain unchanged.

Regression tests cover export-name parity, lazy loading, negation, asymmetric matching, promise assertions, and failure messages.

### Shared data hook

`useObservable` imports `useIsomorphicLayoutEffect` through the hook library's supported subpath export.
It no longer imports all hooks from `@react-hookz/web`.
The existing hook test targets the same subpath and retains its assertions.

### Measured graph reductions

| Isolated suite | Modules before | Modules after | Cold observed peak RSS before → after |
| --- | ---: | ---: | ---: |
| timeCompare | 1,280 | 1,023 | 277 → 268 MiB |
| pluginSettings entrypoints | 2,069 | 1,752 | 340 → 325 MiB |
| DashboardSidebar | 4,440 | 4,086 | 683 → 653 MiB |

Matcher call counts remain unchanged: 49, 6, and 245 respectively.
These are measured graph reductions, not estimates from overlapping inclusive import costs.

Cold process times were 3.915 → 4.087 seconds, 5.934 → 6.488 seconds, and 16.895 → 16.781 seconds respectively.
These single runs do not establish an isolated speed improvement.
The edited Sidebar profile completed its cold run but stopped before the warm run at the profiler's disk-space safeguard.

## 5. Ordinary 20-suite comparison

These runs use one worker, fresh Jest caches, normal GC behavior, and the unchanged 1 GB recycling limit.
All three include the import changes, so they compare environment cleanup only.

| Adapter | Wall time | Sampled phase-boundary peak RSS | Worker processes |
| --- | ---: | ---: | ---: |
| Original | 68.53 s | 1,307 MiB | 1 |
| Frame cleanup only | 69.59 s | 1,325 MiB | 1 |
| Frame and observer cleanup | 70.80 s | 1,309 MiB | 1 |

All runs passed the same 20 suites and 381 tests.
There is no demonstrated time, sampled-RSS, or recycling improvement in this cohort.
The post-collection diagnostic and ordinary RSS measurements answer different questions.
The next benchmark must retain the normal four-worker configuration to measure practical effects across 352 suites.

## Validation

- All 19 changed source suites passed: 382 tests.
- The 20-suite diagnostic passed all 381 tests with each adapter variant.
- Both new harness suites passed: 10 tests.
- Environment and discovery-boundary Node tests passed: 68 tests.
- The lazy DOM matcher helper passed a targeted TypeScript check with strict mode.
- `git diff --check` passed.

Source assertions and test-case counts remain unchanged. New regression cases remain outside the benchmark shards.
The expected bench counts remain 352 suites, 4,222 passed tests, 17 skipped tests, one todo, and 113 snapshots.

No full-shard run, repository-wide typecheck, or lint run occurred locally.
The known duplicate `fixtures` manual-mock warning remains.
No additional dependency installation was necessary.

## Candidates deferred

- EventBus isolation still duplicates RxJS work. Removing it needs stronger evidence about mock ordering and module-reset behavior.
- The global layout-worker mock still imports D3 eagerly. Deferral must preserve fake-timer initialization and worker cancellation.
- Absolute public-module resolution reduced allocations in an earlier experiment. Normal pnpm resolution semantics still need validation.
- A shared compiled-script cache can retain old runtime closures through dynamic-import callbacks. It is not a safe shortcut without additional design.
- Forced GC or a larger worker limit can change recycling, but neither replaces correct resource cleanup. Neither is part of this patch.

## Local evidence

Artifacts remain under `local/shard1-profile/results/`:

- `deep-teardown-lifecycle.json`: synthetic frame-retention comparison.
- `deep-retention-ordered-control.jsonl` and `deep-retention-ordered-fixed.jsonl`: authoritative fixed-order retained-heap comparison.
- `deep-retention-sidebar.heapsnapshot.gz`: compressed snapshot with the native observer retaining path.
- `deep-retention-sidebar-strong-paths.txt`: strong-reference path through web-vitals.
- `deep-before-{data,runtime,sidebar}/` and `deep-after-{data,runtime,sidebar}/`: isolated profiles.
- `smoke-45x3o7/`, `smoke-VJFofS/`, and `smoke-zGWrDS/`: ordinary 20-suite runs.
- `deep-source-validation.log`, `deep-harness-validation.log`, and `deep-environment-validation.log`: validation results.

The exploratory scripts and snapshots remain local, outside source-test discovery.
Generated transform caches were removed after validation. Large traces and snapshots remain compressed.
