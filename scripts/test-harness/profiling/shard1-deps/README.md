# Shard 1 profiling dependencies

This installer provides the selected dependencies for shard 1 profiling within a fixed disk budget. It is not a full Grafana installation.

The retained plan selects **1,230 lock snapshot variants, 15 workspace links, and eight patched packages**. The plan contains 198 root links. Snapshot variants preserve the exact peer and patch identities from the lockfile.

The installer does not resolve semver ranges or run lifecycle scripts. A full workspace installation is outside its scope.

## Quick reinstall

Run these commands from the Grafana repository root.

1. Install or resume from the retained plan:

   ```sh
   node scripts/test-harness/profiling/shard1-deps/installer.mjs install
   ```

2. Rehash the installed package trees:

   ```sh
   node scripts/test-harness/profiling/shard1-deps/installer.mjs verify
   ```

3. Show allocated bytes and available filesystem space:

   ```sh
   node scripts/test-harness/profiling/shard1-deps/installer.mjs status
   ```

These commands need Node.js, not Bun. Installation also needs the `patch` command and network access to `registry.npmjs.org` for missing packages.

`install` uses `plan.json` directly. It validates input hashes and existing receipts, then downloads missing packages. It verifies archive integrity and applies the recorded patches.

`verify` also uses the installation path. It rehashes existing package trees against their receipts, can install missing packages, and restores the planned links. It stops on a changed tree rather than silently replacing it.

`status` reports `dependencies`, `task`, and `free` in bytes. It does not verify package contents or prove installation completeness.

## Exact dependency selection

- [`selection.json`](selection.json) defines the selection and disk limits.
- [`plan.json`](plan.json) retains the complete, exact list of snapshots, archive URLs, integrity hashes, dependency links, workspace links, and patches.
- [`installer.mjs`](installer.mjs) installs that plan without dependency rediscovery.
- [`installer.test.mjs`](installer.test.mjs) contains the installer tests.

To print every exact snapshot identity without the other plan data, run:

```sh
python3 -c 'import json; p=json.load(open("scripts/test-harness/profiling/shard1-deps/plan.json")); print("\n".join(x["snapshot"] for x in p["packages"]))'
```

### Root dependencies and omissions

The selection includes all root `dependencies` from the lock importer, except these nine names:

```text
@grafana/assistant
@locker/near-membrane-dom
react-inlinesvg
@bsull/augurs
@kusto/monaco-kusto
@msagl/core
@msagl/parser
mermaid
swagger-ui-react
```

The omission rules also apply to dependency traversal. The plan records 11 omission occurrences because some names occur in multiple importers.

The selection includes exactly these 42 root `devDependencies`:

```text
@codemirror/autocomplete
@codemirror/lang-json
@codemirror/lang-sql
@grafana/test-utils
@happy-dom/jest-environment
@jest/environment
@jest/fake-timers
@jest/types
@react-types/shared
@sucrase/jest-plugin
@swc/helpers
@testing-library/dom
@testing-library/jest-dom
@testing-library/react
@testing-library/user-event
blob-polyfill
chance
core-js
fake-indexeddb
fishery
happy-dom
ini
jest
jest-canvas-mock
jest-date-mock
jest-environment-jsdom
jest-fail-on-console
jest-mock
jest-util
jest-watch-typeahead
msw
mutationobserver-shim
papaparse
react-i18next
react-select-event
redux-mock-store
sucrase
supports-color
testing-library-selector
ts-jest
whatwg-fetch
zod
```

Two additional selections come from `packages/grafana-test-utils`, under `devDependencies`:

- `jest-canvas-mock-compare`
- `jest-snapshot`

The focused TypeScript check adds three root `devDependencies` through `selection.additional`:

- `@types/jest@29.5.14`: one new snapshot.
- `@types/lodash@4.17.27`: a root link to an existing snapshot.
- `@types/node@26.6.5`: a root link to an existing snapshot.

These additions are part of the retained plan. Reinstallation does not need separate commands.

### Explicit root exposures

These manual selections in `selection.exposeSnapshots` provide root resolution for dependencies that the initial selection missed:

| Root name          | Exact snapshot           |
| ------------------ | ------------------------ |
| `expect`           | `expect@29.7.0`          |
| `framework-utils`  | `framework-utils@1.1.0`  |
| `codemirror-json5` | `codemirror-json5@1.0.3` |

The optional `codemirror-json5` dependency is explicitly selected. Its normal dependency traversal includes `lezer-json5@2.0.2`. No separate root exposure for `lezer-json5` is necessary.

The optional policy is `link-exact-targets-already-selected`. Optional edges do not expand the selection. The installer links an optional target only when that exact target is already selected.

### Workspace links

The installer links these 15 workspaces and their selected dependencies:

| Package                             | Repository path                             |
| ----------------------------------- | ------------------------------------------- |
| `get-document`                      | `packages/get-document`                     |
| `@grafana/alerting`                 | `packages/grafana-alerting`                 |
| `@grafana/api-clients`              | `packages/grafana-api-clients`              |
| `@grafana/data`                     | `packages/grafana-data`                     |
| `@grafana/e2e-selectors`            | `packages/grafana-e2e-selectors`            |
| `@grafana/flamegraph`               | `packages/grafana-flamegraph`               |
| `@grafana/i18n`                     | `packages/grafana-i18n`                     |
| `@grafana/o11y-ds-frontend`         | `packages/grafana-o11y-ds-frontend`         |
| `@grafana/plugin-compat`            | `packages/grafana-plugin-compat`            |
| `@grafana/runtime`                  | `packages/grafana-runtime`                  |
| `@grafana/schema`                   | `packages/grafana-schema`                   |
| `@grafana/sql`                      | `packages/grafana-sql`                      |
| `@grafana/test-utils`               | `packages/grafana-test-utils`               |
| `@grafana/ui`                       | `packages/grafana-ui`                       |
| `@mapbox/jsonlint-lines-primitives` | `packages/mapbox-jsonlint-lines-primitives` |

### Patched packages

| Package                       | Patch file under `patches/`                        |
| ----------------------------- | -------------------------------------------------- |
| `@floating-ui/react@0.27.20`  | `floating-ui-react-npm-0.27.20.patch`              |
| `happy-dom@21.0.4`            | `happy-dom-21.0.4.patch`                           |
| `history@4.10.1`              | `history-npm-4.10.1-ee217563ae.patch`              |
| `react-calendar@6.0.1`        | `react-calendar-npm-6.0.1-22fe91a41c.patch`        |
| `react-grid-layout@1.4.4`     | `react-grid-layout-npm-1.4.4-4024c5395b.patch`     |
| `react-split-pane@0.1.92`     | `react-split-pane-npm-0.1.92-93dbf51dff.patch`     |
| `slate-dev-environment@0.2.5` | `slate-dev-environment-npm-0.2.5-9aeb7da7b5.patch` |
| `sucrase@3.35.1`              | `sucrase-3.35.1.patch`                             |

## Intentional plan changes

The plan stores SHA-256 hashes for 27 inputs:

- Root `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.
- `selection.json`.
- The 15 selected workspace manifests.
- The eight patch files.

`install` and `verify` reject changed inputs. Changes require explicit plan regeneration, not automatic dependency discovery.

If you intentionally change an input, regenerate the plan:

```sh
node scripts/test-harness/profiling/shard1-deps/installer.mjs plan
```

`plan` requires Bun with `Bun.YAML` support to read the lockfile and workspace configuration. It replaces `plan.json`. It does not install packages.

To select an existing lock importer dependency, use `amend`. For example, this command selects one of the retained additions:

```sh
node scripts/test-harness/profiling/shard1-deps/installer.mjs amend packages/grafana-test-utils devDependencies jest-snapshot
```

The arguments are `IMPORTER SECTION NAME`. Valid sections are `dependencies`, `devDependencies`, and `optionalDependencies`. The importer, section, and name must exist in the lockfile.

`amend` updates `selection.additional`, removes that name from `selection.omit`, and regenerates the plan. It therefore requires Bun. It does not install packages.

If a root exposure needs an exact snapshot instead, edit `selection.exposeSnapshots`. Use an existing lock snapshot identity, including any peer or patch suffix. Then run `plan` explicitly.

After a plan change, review the selection and disk limits. Then run `install` and `verify`.

## Disk limits and accounting

The hard limits come from `selection.json`, not this README. Units in this table are decimal.

| Selection key                   |         Bytes | Limit                                                |
| ------------------------------- | ------------: | ---------------------------------------------------- |
| `limits.dependenciesAndScratch` | 1,000,000,000 | 1 GB for dependencies and installation scratch space |
| `limits.task`                   | 1,400,000,000 | 1.4 GB for the total task                            |
| `limits.minimumFree`            |   220,000,000 | 220 MB minimum filesystem free space                 |

The completed installation used approximately **941 MB of allocated dependency space**. Its apparent size from `du` in byte-count mode was approximately **640 MB**. Filesystem block allocation and directory overhead explain the difference. Apparent bytes are not the budget measurement.

The installer measures allocated blocks with `st.blocks * 512`. Incremental subtree accounting replaced repeated full-store scans during installation. The installer reconciles the totals after it creates the links. The recorded installer test result is nine passing tests.

The `status` task counter includes dependencies and this installer directory. **It does not include profiling outputs elsewhere.** The filesystem free-space floor acts as a total-task stop for installer writes, including space consumed outside its counters.

Monitor total task usage and filesystem free space separately during profiling. Keep profiling outputs within the 1.4 GB task limit. Stop before available space reaches 220 MB. The installer cannot enforce these limits while another process writes profiling outputs.

With this partial installation, `pnpm run` can trigger a full dependency installation through `verifyDepsBeforeRun`.
That installation bypasses this installer's disk limits.
For local validation with the selected dependencies, run the test entry points directly with Node.js.

## Current plan revision

The pre-merge update targets main commit `1bc40fb45d4f7316856f278b6fefc14c60ebca30` without changes to `selection.json`.
It includes the upstream dependency manifests and lockfile changes, so the input hashes remain valid before and after that merge.
The plan retains Sucrase patch `b3142073ac922134681f720d8759e4dca943a513fee4bee0c64be350b2c86e96` and the branch's Happy DOM patches.
The merged lockfile removes the obsolete Floating UI 0.27.19 snapshot and uses the patched 0.27.20 snapshot for Prometheus.

The earlier compiler-sync refresh stopped at the dependency budget before it changed any links.
The remaining `vis-network` peer variant required a second package tree alongside the existing installation.
No dependency refresh accompanied this pre-merge update.
The existing dependency links remain unchanged and do not constitute an installation of the current plan.
The compiler-sync validation used the updated compiler through an explicit preload.

## Historical validation and remaining blocker

These results describe the earlier completed installation, not validation of the current plan:

- Installer tests: **9 passed** after the incremental accounting fix.
- Original shard run: **349 suites passed, 3 suites failed**.
- Two suites failed because dependencies were missing. The dependency gaps are fixed. Their targeted rerun passed **22 tests**.
- The remaining failure needs generated dashboard migration fixtures that are absent.

These results do not establish that the full shard passed. The remaining fixture failure is not a dependency installation gap.

## Storage and manual cleanup

The installer stores packages, receipts, workspace dependency directories, and root dependency links under `local/shard1-profile/deps/`.

`local/shard1-profile/deps/state.json` records external links that the installer owns. These include root `node_modules` and selected workspace `node_modules` links. The state can also record previous link targets.

The installer refuses to overwrite non-link paths or conflicting unowned links. It has no cleanup command.

If cleanup is necessary, inspect `state.json` before you remove anything. Verify each current link target against its recorded target. Remove only installer-owned links and directories. Preserve unrelated dependencies, profiling outputs, and user changes. Retain this directory and `plan.json` for reinstall.

Do not recursively remove root or workspace `node_modules` without ownership verification. A manual cleanup must not remove directories that belong to another installation.
