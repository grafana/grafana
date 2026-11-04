# Shard 1: second smaller-suite pass

Date: 2026-11-03. Control commit: `cb8c73f926bfb165858f2d9b51c5df3819854018`.

## Scope

This pass changes six existing shard-1 test files. Production code, suite selection, snapshots, dependency versions, and worker limits remain unchanged.
No new dependencies are necessary. The existing dependency plan remains sufficient.

## Changes

| Suite | Change | Cases before → after |
| --- | --- | ---: |
| `ThresholdsEditor.test.tsx` | Replace the application renderer with RTL and the real OpenFeature test client. | 22 → 22 |
| `HelpWizard.test.tsx` | Construct the oversized markdown fixture once, without converting a million-element typed array on each call. | 7 → 7 |
| `SidebarCard.test.tsx` | Combine five identical default-card fixtures. Keep all state, action, and accessibility assertions. | 26 → 22 |
| `DashboardControls.test.tsx` | Combine identical library-panel fixtures for action visibility, labels, and the Save tooltip. | 53 → 52 |
| `LogListControls.test.tsx` | Combine identical plugin-control fixtures and timestamp interaction prefixes. Remove duplicate assertions at identical checkpoints. | 31 → 29 |
| `PolicyTreeSelector.integration.test.tsx` | Paste two rule names used only as submission setup. Keep policy interactions, requests, and payload assertions. | 10 → 10 |

### Provider boundary

`ThresholdsEditor` needs the OpenFeature provider but not the application store, router, Grafana context, or modal providers.
The narrower wrapper uses `getTestFeatureFlagClient()`, as the application renderer does.
RTL retains this wrapper during rerenders. Existing theme mocks, flag lifecycle, typing, focus checks, and expression tests remain unchanged.
A bare RTL render without this provider does not preserve the flag behavior.

### Fixture equivalence

The HelpWizard fixture remains exactly 2,097,151 characters long. An independent equality check compared it with the original typed-array conversion.
The clipboard size-limit behavior remains under test.

The merged SidebarCard fixtures use identical helper defaults, including callback availability.
The merged DashboardControls cases use the same library-panel scene and retain the real hover and awaited tooltip.
The merged LogListControls fixtures use `CoreApp.Unknown` and the same context properties.
No mounted state is shared between test cases.

## Measurements

All measurements use local Happy DOM, Sucrase, and one worker at a time.
Cold runs use fresh Jest caches, not cleared operating-system caches.
The measurements do not predict four-worker bench-machine results.

### Isolated ThresholdsEditor

| Measure | Application renderer | Narrow provider wrapper |
| --- | ---: | ---: |
| Unique modules | 4,576 | 3,330 |
| Cold process wall time | 16.628 s | 11.338 s |
| Warm process wall time | 10.186 s | 7.463 s |
| Cold observed peak RSS | 652 MiB | 486 MiB |
| Warm observed peak RSS | 549 MiB | 455 MiB |
| Tests | 22 | 22 |
| Matcher calls | 127 | 127 |

The wrapper removes 1,246 modules, or 27.2%. Both cold and warm runs passed before and after the change.
These RSS values describe observed process peaks, not total allocation volume.

### Six-suite batch

| Measure | Control | Edited |
| --- | ---: | ---: |
| Process wall time | 52.724 s | 51.537 s |
| Passing suites | 6 | 6 |
| Passing tests | 149 | 142 |
| Worker processes observed | 2 | 1 |

The single pair shows a 2.2% time reduction. It does not establish a repeatable full-shard improvement.
The control recycled its worker once. The edited run retained one worker, which also affected later import times.
Suite order differed slightly between runs. Per-suite timing differences therefore do not isolate each change.

The policy suite's aggregate test-and-hook time remained approximately 13.4 seconds in both runs.
The two paste changes remove per-character work, but this pair does not demonstrate a measurable policy-suite speedup.
HelpWizard's aggregate test-and-hook time also remained approximately 1.9 seconds.
Its fixture change removes repeated construction work without a demonstrated aggregate timing gain in this pair.

## Validation

- The original six-suite batch passed all 149 cases.
- The edited six-suite batch passed all 142 cases.
- Isolated ThresholdsEditor cold and warm profiles passed all 22 cases before and after the change.
- An AST comparison found all original distinct assertion expressions in every edited file.
- Assertion occurrences remained identical in five files. LogListControls removed 14 duplicate occurrences at identical checkpoints.
- The six files contain 428 assertion expressions, compared with 442 originally. Static assertion counts do not establish identical production coverage.
- All three discovery-boundary Node tests passed.
- `git diff --check` passed.

### Pre-existing randomized-order failures

The six-suite randomized run used seed 1301. Five suites passed, but ThresholdsEditor failed five of its 22 cases.
A second run with the unchanged HEAD version of ThresholdsEditor reproduced the same five failures.
The edited file was restored after that control run.

The outer block sets the disabled feature flag in `beforeAll`.
The enabled nested block resets flags in `afterAll`, so later outer tests can receive the default flag value.
This lifecycle already depends on test order. The provider change does not correct or introduce that problem.
The lifecycle remains unchanged in this optimization batch.

The existing duplicate `fixtures` manual-mock warning remains.
No full-shard benchmark, repository typecheck, or lint run occurred locally. Prettier is not installed in the surgical dependency set.

## Reviewed but unchanged

- `DataSourcePicker`: direct RTL imports already exist. Real modal consumers and keyboard/search behavior require the remaining setup.
- `LogLineDetailsFields`: large fixtures exercise pagination limits and balanced pages. Production code slices before rendering.
- `PanelDataTransformationsTab`: empty/existing transforms and single/all deletions exercise different behavior. A microtask flush is not a fixed sleep.
- `annotationCommands`: mutation clients, lazy commands, permissions, and validation remain necessary.
- `sandboxConsent`: module isolation repeatedly loads the data-package graph for storage. No supported narrow storage export currently avoids that graph.
  Storage mocks or weaker isolation are not substitutes. A separate public boundary needs deliberate design.
- `TableCellTooltip`: five dismissal paths use a real 100 ms timer. Narrow fake timers can remove that wait, but focus and pointer behavior need careful validation.
  This batch leaves those tests unchanged.

The next focused candidates are a supported storage boundary for sandbox consent and narrowly controlled tooltip timers.
Neither candidate justifies a broad mock or weaker behavioral assertions.

## Artifacts

Local artifacts remain outside the source commit under `local/shard1-profile/results/`:

- `smoke-yRWfpo/`: six-suite control.
- `smoke-EazxxM/`: edited six-suite batch.
- `pass2-thresholds-before/suite-IZy1kR/`: isolated control profiles.
- `pass2-thresholds-after/suite-SQZFl8/`: isolated edited profiles.
- `pass2-thresholds-original-randomized.log`: randomized reproduction with the original suite.

Large trace and attribution files are compressed. The generated validation cache was removed.
