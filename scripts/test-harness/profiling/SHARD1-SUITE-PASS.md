# Shard 1: smaller-suite optimization pass

Date: 2026-11-03. Control commit: `86a4edae` (`faster things`).

## Scope

This pass uses the existing shard-1 roster and earlier per-suite phase logs. It changes 15 existing test files only.
It does not change production code, test discovery, snapshots, worker limits, dependency versions, or environment configuration.
No new dependencies are necessary.

The review separates import costs from test-body costs. A multi-second suite does not necessarily contain slow assertions.
The earlier diagnostic attributed most of the time in small display suites to imports before their tests began.

## Changes

### Remove unused application providers and imports

`test/test-utils` imports the application store, routing, context providers, and fixture helpers.
Its custom renderer creates a fresh store, history, providers, and user-event session for each render.
It also reexports plain RTL helpers. Importing only those helpers still loads the application dependencies.

These suites now use direct `@testing-library/react` imports:

| Existing suite | Reason |
| --- | --- |
| `public/app/features/alerting/unified/gma-rule-list/rule-row/RuleInterval.test.tsx` | The component renders translated text and UI components without application providers. |
| `public/app/features/scopes/selector/ScopesInput.test.tsx` | The tests render the prop-driven ScopesTooltip, not the parent scope-fetching component. |
| `public/app/features/provisioning/Job/JobContent.test.tsx` | Both existing fixtures exercise warning/error paths without the repository-query branch. |
| `public/app/features/notebook/scene/layout-notebook/cells/MarkdownFormatToolbar.test.tsx` | The existing no-view/no-selection cases need no application providers. |
| `public/app/features/notebook/scene/layout-notebook/edit/NotebookCellAddButton.test.tsx` | Local menu state and callback props need no application providers. |
| `public/app/features/alerting/unified/components/settings/AutoSyncStatusBadge.test.tsx` | Status badges depend on supplied props. |
| `public/app/features/alerting/unified/gma-rule-list/rule-search/RuleSearchInput.test.tsx` | Query state and callbacks are local or supplied through props. |
| `public/app/features/alerting/unified/plugin-proxy/pluginAvailability.test.ts` | The suite only imports RTL's act helper, not a renderer. |
| `public/app/features/notebook/addPanel/useNotebookPicker.test.ts` | RTL's act/renderHook already run without the custom application wrapper. |
| `public/app/features/notebook/incidents/useNotebookIncidents.test.tsx` | RTL's renderHook already runs without the custom application wrapper. |

Interactive tests create a fresh user-event session before rendering, as the original renderer did.
All keyboard sequences, clicks, fixtures, existing mocks, and assertions remain unchanged. No additional behavior mocks replace application providers.

The JobContent decision applies only to its existing fixtures. Its success path without a pull request still needs a Redux-backed repository query.

### Reduce repeated setup and input work

- `ProviderConfigForm.test.tsx` pastes complete submission values for client ID, secret, and role attribute path.
  Custom-option typing, Enter-key interactions, and required-field validation remain unchanged.
- `CallToAction.test.tsx` pastes complete migration tokens in its success and server-error cases.
  Each case uses one user-event session for its interactions. Empty-token behavior remains unchanged.
- `SharedPreferences.test.tsx` reuses its per-test user-event session and already-found elements.
  Readiness, request, analytics, and dashboard-resolution waits remain.
- `StagedConfiguration.test.tsx` combines identical-fixture assertions and removes four redundant mounts.
  Its MSW setup retains common handlers, explicit receiver/dry-run handlers, the real backend service, flag cleanup, and unhandled-request errors.
  It no longer installs unrelated alerting handlers or resets their unused entities.
- `NotificationDetailPage.test.tsx` checks the initial collapsed state and subsequent expanded UUID in one test, removing one redundant mount.

There is no shared mounted state across test cases. Different fixtures, permissions, error states, and interaction sequences remain separate.

## Coverage and validation

The 15 files originally contained 101 passing test cases. They now contain 96.
The difference is five merged identical-fixture cases, not removed assertions or suite exclusions.
An AST comparison against the control commit found the same 183 assertion expressions, including duplicates, across all 15 files.
This static comparison does not establish identical production coverage by itself.

Validation results:

- Original 15-suite control: 101 tests passed.
- Edited 15-suite run: 96 tests passed with `CI=true` through the phase runner.
- Randomized edited run, seed 1301: all 15 suites and 96 tests passed.
- RuleInterval profiles: all three tests and three matcher calls passed before and after.
- The eight additional import-focused suites retained all 32 tests.

The existing duplicate `fixtures` manual-mock warning remains.
No complete repository typecheck, lint run, or full-shard benchmark ran in this pass.

## Measurements

All measurements use the local installation, Happy DOM, Sucrase, and one worker.
Cold runs use fresh Jest caches, not cleared operating-system caches. These are not four-worker bench-machine results.

### RuleInterval import comparison

Both versions contain the same three tests and matcher calls.

| Measure | Application renderer | Direct RTL renderer |
| --- | ---: | ---: |
| Unique modules | 4,576 | 3,024 |
| Module executions | 4,859 | 3,307 |
| Cold process wall time | 14.075 s | 9.096 s |
| Warm process wall time | 8.079 s | 5.244 s |
| Cold observed peak RSS | 618 MiB | 419 MiB |
| Warm observed peak RSS | 518 MiB | 364 MiB |

The direct import removes 1,552 modules (33.9%). This is a measured graph reduction, not a predicted saving from inclusive import times.

### Batch comparisons

| Batch | Control | Edited | Interpretation |
| --- | ---: | ---: | --- |
| Initial seven suites | 24.987 s | 43.611 s | Inconclusive: setup and test-body times increased broadly, including unrelated work. |
| Eight additional import-focused suites | 26.259 s | 19.039 s | Promising 27.5% reduction in this single pair. |
| All 15 suites, back-to-back | 48.469 s | 49.462 s | Essentially flat; this pair does not demonstrate an aggregate speedup. |

The complete pair retained one worker process in both runs.
Import-focused suites generally improved, but the first four larger suites took longer in the edited run.
The cause of that timing variation is not established. It must not be attributed to host load without further evidence.

The narrower import graphs and fewer mounts are concrete reductions in work.
The local timings do not establish that all changes together reduce full-shard wall time.
A repeated bench-machine comparison is necessary before claiming an additional shard-wide gain.

## Reviewed but unchanged

- `PolicyTreeSelector.integration.test.tsx`: its 90-second timeout is a ceiling, not an explicit wait.
  Moving a constant import alone does not remove dependencies that its production components also import.
- `RuleEditorCloudOnlyAllowed.test.tsx`: its mode-switch flow exercises distinct behavior.
- `QueryAndCondition.test.tsx`: the two evaluation runners exercise different paths.
- `CommandPalette.test.tsx`: 600 ms advances use fake time. They test debounce behavior and are not wall-clock sleeps.
- `ConfigForm.test.tsx`: its URL input already uses paste. Save-enabled waits and released response promises test real loading boundaries.
- `OwnersFilter.test.tsx`: its two-team fixture does not justify an algorithm change without stronger evidence.
- `DeclareIncidentModal.test.tsx`: its URL construction uses the location service. Removing the wrapper also removes per-test location isolation.
- `RangeFilter.test.tsx`: typed dates, malformed inputs, slider keyboard behavior, and calendar interactions are explicit test subjects.
- `sandboxConsent.test.ts`: repeated isolated imports reload the data-package dependency graph. Its expiry tests already use fake timers.
  A narrower storage entry point or store-construction boundary needs separate design work. No isolation or storage assertions were removed.
- `AddPanelToNotebookModalBody.test.tsx`: keyboard focus, radio selection, and modal input behavior remain intact.

No fixed sleep or inefficient production algorithm with a demonstrated low-risk fix emerged from this pass.

## Artifacts

Artifacts remain under `local/shard1-profile/results/`, outside the source commit:

- `smoke-ZEZiMe/`: initial seven-suite control.
- `smoke-JGsZ0P/`: initial seven-suite edited run.
- `smoke-xgrtKA/`: eight-suite import-focused control.
- `smoke-rVtkxl/`: eight-suite import-focused edited run.
- `smoke-zhDtav/`: complete 15-suite control.
- `smoke-pPsVmp/`: complete 15-suite edited run.
- `batch-ruleinterval-before/suite-x9jcuZ/`: isolated cold/warm RuleInterval control.
- `batch-ruleinterval-after/suite-xsnMWI/`: isolated cold/warm RuleInterval after the direct import.

The trace and attribution JSON files are compressed. The profiler's `run.json` and text reports remain directly readable.
