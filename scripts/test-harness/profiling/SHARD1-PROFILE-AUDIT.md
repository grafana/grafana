# Shard 1 profile audit

This document records the original audit and implementation.
The [import-cost follow-up](SHARD1-IMPORT-COST-AUDIT.md) reverses the lazy renderer split and measures actual dependency reductions.

## Source and scope

The report is `summary.json`, supplied from the benchmark machine.
The recorded revision is `debd440aece8de671f9b58950431974e035e3af3`.
The recorded start is `2026-11-06T04:58:29.660Z`.
The machine uses an AMD Ryzen 7 PRO 5850U and Node.js 26.13.0.

The run uses Happy DOM, Sucrase, four workers, and a cold Jest cache.
CPU sampling uses a 1,000-microsecond interval.
Heap sampling uses a 1,048,576-byte interval.

The implementation base is `cea19590c1ae56c15b227fbaebc4f58ccf665126`.
That commit adds the profiler to the recorded application revision.
The upstream files matched the previous local profiler files before synchronization.
A scoped Git stash retains the previous local profiler work.

No new performance measurements accompany this implementation.
The benchmark machine will measure the changes.

## Completeness and interpretation

| Item                          |          Result |
| ----------------------------- | --------------: |
| Selected suites               |             361 |
| Complete suite captures       |             361 |
| Passed suites                 |             361 |
| Passed tests                  |           4,348 |
| Skipped tests                 |              17 |
| Todo tests                    |               1 |
| Missing activity measurements |               0 |
| Summary size before transfer  | 2,127,235 bytes |
| Size-based truncation         |            None |
| Jest execution wall time      | 344.597 seconds |

Earlier benchmark runs contained 352 suites.
Those runs do not provide an identical selection for this report.
A comparison needs the same selection, revision assumptions, worker count, and profiling mode.

The supplied copy contains literal newlines inside JSON strings.
A standard JSON parser rejects that copy.
The analysis used a tolerant parser and left the file unchanged.
The numerical tables remain readable, but some transferred names contain inserted whitespace.

Activity totals accumulate elapsed time across suites and workers.
They are not shard wall time or process CPU time.
Sampled main-thread time includes idle intervals and GC.
Allocation estimates are not peak memory or retained heap.

Module edges identify evaluation parents, not every cached import edge.
The summary retains at most eight hotspot functions per suite.
Aggregates of those hotspots are lower bounds for their full cost.

## Time distribution

All table values are accumulated suite-seconds.
Each row partitions its elapsed time into exclusive activities.

| Phase                    | Transform pipeline | Module evaluation |   Other |   Total |
| ------------------------ | -----------------: | ----------------: | ------: | ------: |
| Before tests             |             95.794 |           437.227 |   5.671 | 538.691 |
| Test bodies              |              2.644 |            13.317 | 142.209 | 158.169 |
| Hooks                    |                  0 |                 0 |   6.160 |   6.160 |
| Framework between tests  |                  0 |                 0 |   2.910 |   2.910 |
| Teardown                 |                  0 |                 0 |   2.982 |   2.982 |
| Explicit profiler phases |                  0 |                 0 | 605.520 | 605.520 |
| Unassigned               |                  0 |                 0 |       0 |       0 |

The recorded total is 1,314.433 suite-seconds.
The total outside explicit profiler phases is 708.913 suite-seconds.
Before-test work accounts for 76% of that second total.
These intervals still contain sampling and instrumentation overhead.

The transform pipeline accounts for 98.437 seconds across all phases.
Sucrase itself accounts for 14.274 sampled seconds.
The pipeline also contains cache, source-map, and other transform infrastructure work.
The two measurements do not represent the same activity or measurement method.

## Module loading

| Metric                                      |    Result |
| ------------------------------------------- | --------: |
| Distinct suite/module pairs                 | 1,030,106 |
| Module evaluations, including repeats       | 1,147,149 |
| Median distinct modules per suite           |     3,054 |
| Minimum distinct modules per suite          |       675 |
| Summed module source size                   |  5.20 GiB |
| Suites with at least 4,000 distinct modules |        83 |
| Suites with at least 5,000 distinct modules |        23 |

These counts do not represent globally distinct files.
Each isolated suite can load the same dependency again.

There are 171 suites with less than 100 milliseconds in test bodies.
Together, those suites spend 161.892 seconds before tests and 4.173 seconds in test bodies.
The 20 largest setup costs account for only 18.6% of total before-test time.
The shared setup and import graph therefore remain important beyond the slowest suites.

Aggregated appearances in the retained hotspot lists include:

| Function                     | Sampled seconds | Suites with a retained entry |
| ---------------------------- | --------------: | ---------------------------: |
| `node:vm` `Script`           |          72.328 |                          324 |
| Jest `_execModule`           |          55.139 |                          343 |
| Jest `_prepareForResolution` |          18.960 |                          321 |
| Jest `getModuleID`           |           3.555 |                          106 |
| Jest `_createJestObjectFor`  |           2.940 |                           82 |
| INI `decode`                 |           2.854 |                          124 |

These are lower bounds, not complete function totals.

## Allocation and library costs

The estimated allocation volume is 105.714 GiB.
Before-test work accounts for 83.661 GiB, or about 79%.
Test phases account for 21.711 GiB.
Teardown accounts for 0.341 GiB.

| Category           | Sampled seconds | Estimated allocations |
| ------------------ | --------------: | --------------------: |
| Node and Jest      |         345.595 |            56.172 GiB |
| Other dependencies |         197.366 |            29.010 GiB |
| Happy DOM          |          41.245 |             7.212 GiB |
| Sucrase            |          14.274 |             3.194 GiB |
| Application source |           9.022 |             0.823 GiB |
| Workspace source   |          30.957 |             4.308 GiB |
| Profiler           |         335.916 |             4.886 GiB |

Individual before-test candidates include:

| Owner                | Sampled seconds | Estimated allocations |
| -------------------- | --------------: | --------------------: |
| `source-map`         |          14.580 |             1.672 GiB |
| `zod`                |          14.157 |             3.129 GiB |
| `ini`                |           8.590 |             0.606 GiB |
| `@reduxjs/toolkit`   |           4.570 |             0.751 GiB |
| `ua-parser-js`       |           4.098 |             0.124 GiB |
| `source-map-support` |           3.993 |             2.523 GiB |

The report contains no retained-heap estimates.
It cannot establish a memory leak.
For 145 suites, an absent or empty heap sample list caused a node-`selfSize` fallback.
The summarizer counts either samples or that fallback, not both.

## Profiler overhead

Explicit profiler phases account for 46.1% of recorded suite time.
The separate `instrumentationUs` counter totals 639.090 seconds and overlaps existing phases.
Adding that counter to phase totals would count work twice.

Of 269.192 sampled GC seconds, 242.980 occur inside profiler phases.
Thus about 90% of sampled GC occurs during explicit profiler work.
This report does not demonstrate a comparable GC regression in the ordinary benchmark.

Repeated comparisons can use `--noCpu --noHeap` to retain phase timings and module counts.
Full sampling remains useful for selected suites and allocation questions.
Neither mode replaces an ordinary benchmark for final wall-time comparisons.

## Recommendations and implementation decisions

### 1. Defer theme-registry validation

The public data barrel loads theme construction, registry, and context modules.
`createTheme.ts` constructs Zod schemas.
The registry previously validated all 18 extra themes during module evaluation.
Zod appears in before-test samples for 321 suites.

The implementation moves extra-theme validation into the existing one-time registry initializer.
It also creates the name collator on first listing.
The registry retains validation, invalid-definition logging, filtering, sorting, and fresh theme construction.
Invalid definitions now produce their error on first registry use, not import.

This change does not remove eager Zod imports, schema construction, bundled JSON imports, or the default context theme.
The first registry use still validates all extra themes, including a lookup for `dark`.

A complete schema split needs additional design.
`@grafana/data/internal`, schema generation, and deep imports expose the real schema object.
The published package supports synchronous APIs, CommonJS, and ESM.
A local `require()` workaround would not preserve the current ESM build contract.
This batch does not replace schemas with proxies or weaken validation.

### 2. Separate lightweight test exports from the application renderer

**Superseded:** The follow-up restores eager renderer imports because this split mainly moved work into test bodies.
The following paragraphs describe the original experiment, not the current implementation.

`public/test/test-utils.tsx` previously loaded the renderer, runtime, and store graph for every consumer.
The store imports application reducers and RTK Query clients.
Supplying a custom store did not avoid that module evaluation.

The implementation keeps real Testing Library exports in the existing entry point.
The entry point loads the application renderer only when `render()` or `getWrapper()` is called.
The renderer loads `configureStore` when its existing fallback or preloaded-state path needs it.
Feature-toggle and license helpers load their dependencies when called.

Real Testing Library initialization remains eager because it registers lifecycle hooks and async wrappers.
Default renders still use the full application store and providers.
The change does not replace application dependencies with global mocks.
Some renderer dependencies can still load the store transitively.
The new boundary does not promise a store-free custom render.

### 3. Read developer configuration outside suite isolation

INI parsing appears in all 361 suites and totals 8.590 sampled setup seconds.
Shared setup previously read and parsed defaults and custom configuration for each suite.

The implementation shares the existing parser through `scripts/cli/env-util.cjs`.
The TypeScript entry point retains its export for build-tool consumers.
A CommonJS declaration file preserves strict NodeNext type resolution.
Jest computes the console-enforcement flag while it loads configuration.
The serialized global carries that result into each suite.
Shared setup still honors a truthy `CI` value, including launchers that set it after configuration generation.

Custom configuration retains precedence over defaults.
A false custom value can override a true default outside CI.
CI still enables console enforcement regardless of the developer value.
Normal suite setup no longer parses INI files.
A derived configuration that replaces Jest globals retains a lazy fallback to the existing reader.
That fallback preserves the developer preference rather than silently disabling console checks.

### 4. Reduce unasserted UI work

| Suite                                     | Before tests | Test bodies | Estimated suite allocations |
| ----------------------------------------- | -----------: | ----------: | --------------------------: |
| `GrafanaReceiverForm.test.tsx`            |      7.354 s |    10.813 s |                    3.67 GiB |
| `PolicyTreeSelector.integration.test.tsx` |      2.878 s |    10.666 s |                    2.28 GiB |
| `SharedPreferences.test.tsx`              |      2.802 s |     7.022 s |                    1.45 GiB |
| `AddPanelToNotebookModalBody.test.tsx`    |      2.677 s |     6.610 s |                    1.53 GiB |

The policy suite keeps all 11 cases in the original file.
Two selector-only cases use a real `FormProvider` and selector instead of the complete rule editor.
The other nine cases retain full-editor coverage.
Queries use the relevant form section where possible.
Portaled options remain document-wide.

The preferences suite combines three duplicate save workflows with their analytics assertions.
All payload and analytics assertions remain.
The unchanged-dashboard case changes Week start instead of the more expensive timezone control.
The timezone payload cases remain.

The receiver suite uses the default email form for backend 400/500 error cases.
It retains real POST, toast, and log assertions and adds explicit payload checks.
The MQTT secure-field case remains unchanged.

The notebook suite uses click and paste for four completed-value cases.
The exact whitespace, validation, payload, and no-write assertions remain.
These cases do not assert intermediate keystrokes.

### 5. Further candidates

The following suites contain much more setup work than test-body work:

| Suite                                    | Before tests |       Test bodies |
| ---------------------------------------- | -----------: | ----------------: |
| `ExploreToNotebookPanel.test.tsx`        |      5.797 s |           0.075 s |
| `routeLayer.test.ts`                     |      4.677 s |           0.029 s |
| `DashboardSidebar.test.tsx`              |      7.164 s |           0.671 s |
| `PanelModelCompatibilityWrapper.test.ts` |      3.575 s | Less than 0.100 s |
| `sceneVariablesSetToVariables.test.ts`   |      3.117 s | Less than 0.100 s |

Raw module edges can identify the incidental imports in these suites.
This batch does not remove modules without source-level evidence that their behavior is outside the assertions.

The runtime logging export loads Faro before telemetry enablement checks.
Faro depends on `ua-parser-js`.
A narrower supported logging entry point needs package-level verification before a production change.
The test-utils boundary can defer that graph, but does not alter telemetry behavior.

The source-map costs need raw call-stack analysis.
This batch does not disable source maps or reduce failure diagnostics.

Shared setup still initializes i18next for direct `react-i18next` consumers.
Existing regression coverage requires that initialized instance.
Removing this bootstrap needs a separate compatibility design.

## Coverage and selection

No source test files are added or removed.
The policy cases stay in their original suite to preserve baseline selection.
The three preferences consolidations reduce test declarations by three without removing their assertions.

New regression tests stay under `scripts/test-harness/`.
The source Jest configurations exclude that directory.
The manual harness configuration selects the regression tests.
The benchmark roster configuration remains unchanged.

## Correctness validation

The local checkout initially had no installed application dependencies and about 307 MiB of free space.
A full application dependency installation does not fit the retained disk budget.
No benchmark or profiler run is part of local validation.

The validation-only installation uses versions from the lockfile and retained installation plan:

| Dependency   | Version | Purpose                                         |
| ------------ | ------- | ----------------------------------------------- |
| `ini`        | 5.0.0   | Real configuration-parser regression tests      |
| `typescript` | 6.0.2   | TS/TSX syntax and isolated transpilation checks |
| `zod`        | 4.6.7   | Real theme schema validation                    |
| `lodash`     | 4.18.1  | Theme construction                              |
| `tinycolor2` | 1.6.0   | Theme color construction                        |
| `prettier`   | 3.6.2   | Repository formatting                           |

The installation occupies about 46 MiB under `local/profile-audit-validation`.
The dependency record is [`shard1-profile-audit-dependencies.json`](shard1-profile-audit-dependencies.json).
It contains exact versions, archive URLs, and integrity hashes.
Every downloaded archive passed its integrity check.
The installation does not change the project dependency manifest or lockfile.

Runtime UI checks still require the benchmark machine or another checkout with application dependencies.
Syntax checks and native boundary tests do not substitute for those checks.

Local checks passed:

- 67 native tests for configuration, console enforcement, lazy imports, source discovery, and profiler configuration compatibility.
- Direct execution of real theme construction and Zod schemas, including once-only validation, filtering, fresh instances, and system preference changes.
- Strict NodeNext type resolution for the configuration-reader export, with the Rspack compiler options.
- TS/TSX syntax and isolated transpilation checks for all changed TypeScript implementation and test files.
- Independent correctness review of provider behavior, test assertions, and source-suite membership.

The source discovery comparison retained the same 2,882 suite paths.
The native tests use dependency substitutes only for integration boundaries.
They do not prove that the full React/Jest runtime works.

### External application checks

Run the changed source suites with the optimized environment:

```sh
node node_modules/jest/bin/jest.js --config jest.happy-dom.config.js --no-watch --runInBand --runTestsByPath \
  public/app/features/alerting/unified/components/receivers/form/GrafanaReceiverForm.test.tsx \
  public/app/features/alerting/unified/components/rule-editor/notificaton-preview/PolicyTreeSelector.integration.test.tsx \
  public/app/core/components/SharedPreferences/SharedPreferences.test.tsx \
  public/app/features/notebook/addPanel/AddPanelToNotebookModalBody.test.tsx
```

Run the manual regression suites:

```sh
node node_modules/jest/bin/jest.js --config jest.harness.config.js --no-watch --runInBand --runTestsByPath \
  scripts/test-harness/theme-registry.test.ts \
  scripts/test-harness/test-utils.test.tsx \
  scripts/test-harness/test-utils-initialization.test.tsx \
  scripts/test-harness/regressions/lazySetup.test.ts \
  scripts/test-harness/regressions/reactSetup.test.tsx
```

The manual harness command uses the baseline jsdom/ts-jest configuration.
The external optimized run remains necessary to validate the full shard with Happy DOM and Sucrase.
