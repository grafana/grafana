# AGENTS.md

Guidance for agents working in `prs-queue/`. This is a standalone Node CLI, not part of
the Grafana build: no TypeScript, no bundler, no Jest, CommonJS only.

## What it does

Builds the open PR queue for a GitHub team: every open PR in a repo that is authored by a team
member, or has a review requested from the team or one of its members. Writes a markdown table for
humans, or compact JSON for agents.

```bash
node pr-reports.js                          # markdown, grafana/grafana + dashboards-squad
node pr-reports.js --format json            # compact JSON on stdout, no markdown file
node pr-reports.js --refresh-cache          # delete selected caches, then fetch and cache fresh data
node pr-reports.js --no-cache               # bypass cache reads/writes, preserve existing files
node pr-reports.js --repo grafana/scenes --team grafana/grafana-dashboards-core
node pr-reports.js --pr https://github.com/grafana/grafana/pull/12   # one PR, one JSON object
node pr-reports.js --help
LOG=1 node pr-reports.js                    # with progress logging on stderr
```

Requires the `gh` CLI, authenticated. Every network call goes through it.
The CLI accepts only repositories and teams owned by the `grafana` organization, including
single-PR URLs. Keep this restriction in CLI validation; shared services remain generic.
`--repo` accepts a bare name such as `scenes`, which the CLI expands to `grafana/scenes`.

## Layout

Keep `pr-reports.js` and `pr-reports.test.js` as the only JavaScript files at the root. Supporting
implementations and their tests live in the corresponding subfolders.

| Path                                              | Responsibility                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pr-reports.js`                                   | CLI entry point: parse arguments, construct services inline, invoke the pipeline, log timing, and handle CLI errors                              |
| `pipeline/PrReportsPipeline.js`                   | Owns configuration, the four-stage workflow, team scope, single-PR fetching, contributor sorting, cache freshness rules, and output coordination |
| `pipeline/io/ReportOutput.js`                     | Constructs renderers and writes reports through injected file, stdout, and logging dependencies                                                  |
| `pipeline/helpers.js`                             | `parseRepo`, `parseTeam`, `numbersIn`, and `newestUpdatedAt`                                                                                     |
| `api/GithubApiClient.js`                          | GitHub requests through `gh`, team-member caching, search queries, and batched PR detail fetching                                                |
| `api/helpers.js`                                  | `mapWithLimit` for bounded concurrency                                                                                                           |
| `pipeline/normalizer/PullRequestNormalizer.js`    | GraphQL nodes plus cached fallbacks into normalized records; static `normalizeLogins`                                                            |
| `pipeline/presenter/PullRequestPresenter.js`      | Normalized records into display values, durations, and contributor descriptions                                                                  |
| `pipeline/presenter/contributor-ranking.js`       | Shared `rankOf` and `contributorCounts`; queue sorting belongs to the pipeline                                                                   |
| `pipeline/renderers/PrReport.js`                  | PR Markdown layout, columns, escaping, links, and issue cells                                                                                    |
| `pipeline/renderers/markdown/MarkdownReport.js`   | Generic Markdown document and table assembly                                                                                                     |
| `pipeline/renderers/compact/CompactJsonReport.js` | Compact queue or single-PR JSON, with empty fields omitted                                                                                       |
| `pipeline/renderers/summary/SummaryReport.js`     | Scope, contribution counts, cache activity, and output paths for a Markdown run                                                                  |
| `cli/cli.js`                                      | `parseArgs`, `helpText`, and `CliError`; does not build configuration                                                                            |
| `cache/FileCacheClient.js`                        | Key/value JSON cache over a directory                                                                                                            |
| `logger/logger.js`                                | `Logger` class and shared `logger` instance                                                                                                      |
| `output/`                                         | Generated reports under `output/reports/`; PR caches under `output/cache/prs/`; team caches under `output/cache/teams/`                          |

## Pipeline and data contracts

`PrReportsPipeline` receives `{ api, cache, normalizer, presenter, output }` in its constructor. Keep
intermediate results local to `run()`, not on the instance. Its workflow should remain visible at
a glance:

```js
const fetched = await this.fetch(config, options);
const normalized = this.normalize(fetched);
const presented = this.present(normalized);
await this.render(config, options.format, presented);
```

- `PrReportsPipeline.configFor(repo, team)` builds repository/team configuration, cache keys, and
  output paths. The CLI entry point uses it before constructing the services.
- `fetch` gathers team scope and cached rows, prunes irrelevant PRs, and fetches stale details.
  `collectScope()` and `fetchSinglePrNode(config, number)` are pipeline methods using the injected API.
- `normalize` builds records through `PullRequestNormalizer.fromGraphQL`, retaining cached rows
  when no new node is returned. This stage performs no I/O.
- `present` sorts a copy through static `PrReportsPipeline.sortByContributorRank`, formats records,
  and prepares contribution counts. One supplied `now` drives both row durations and `generatedAt`.
  The returned `run.prs` retains normalized values; `prs` contains presented values.
- `render` writes normalized queue records to the cache, then delegates to the injected output
  service through `writePr`, `writeJson`, or `writeMarkdown`. The pipeline does not construct
  renderers or write files or stdout directly.
- `ReportOutput` constructs the renderers and handles file and stdout writes. Its constructor
  accepts `{ files, stdout, diagnostics }`, defaulting to Node's filesystem, process stdout, and
  the shared logger. It creates the report folder before writing Markdown and prints the summary
  only after the file is written successfully. `SummaryReport` receives normalized run records
  so it can rank contribution counts by raw association.

Cache `changedFiles` from the PR detail query immediately above `churn`. Cache raw line counts as
`churn: { additions, deletions, total }`, followed by `sizeFromChurn` and then `sizeFromLabels`. Compute `churn.total` once from additions plus deletions and use it for `sizeFromChurn`: `size/small` for 0–49, `size/medium` for 50–599, and `size/large` for 600 or more.
Use named constants for the medium and large thresholds. Omit `sizeFromChurn` when either count is missing.
The presenter uses `churn.total` as its numeric `churn` value. Missing counts leave churn unknown; zero is valid. Refetch cached PRs missing
either count, `churn.total`, `changedFiles`, or `sizeFromChurn`, or still carrying the old top-level `size` or nested `churn.size`, so older
cache entries are upgraded.

Keep all fetched labels in normalized records, including `size/` labels.
`sizeFromLabels` comes from the PR's size label. Omitted labels preserve the cached size; an explicitly
fetched list without a size clears it. A new size label replaces the cached value. Escape size
values with `PrReport.esc`, just like other Markdown text cells, and keep missing sizes blank.

Keep stdout for report data or CLI help. Progress logs go to stderr when `LOG` is present;
error logs go to stderr regardless of `LOG`.

CI is a scalar `ciStatus`, never a nested `ci` object. Normalized records use GitHub states such
as `SUCCESS`, `FAILURE`, `ERROR`, `PENDING`, or `EXPECTED`, with an empty string for missing state.
Presented records use `Pass`, `Fail`, or `Pending`; unrecognized states are omitted from JSON and
shown as blank Markdown cells. The overall state comes from the latest commit's rollup in the PR
detail query. Do not fetch or display individual CI failure names or check contexts.

## Fetching and caching

Queue searches exclude drafts and authors in the API client's `AUTHOR_BLACKLIST` array (initially
`dependabot[bot]`, the REST search login). Apply exclusions outside the OR group to every search; add future authors to
the array. Explicit single-PR lookups remain available for these authors.
Queue searches combine team review requests, member-authored PRs, and individual
member review requests. Deduplicate PR numbers and retain the newest search timestamp when a PR
appears in several searches. PR details are fetched in batches of 20, with at most four requests
in flight.

Metadata freshness uses `updatedAt` and the diff-metadata checks in `PrReportsPipeline.js`.
New or stale records receive full detail queries. Reused records receive lightweight queries for
CI, mergeability, review decision, and linked-issue context on every run, regardless of their cached states.
Use `PullRequestNormalizer.fromReadiness` to merge these fields into cached records without clearing
other metadata. Both full-detail and readiness queries fetch at most six linked issues per PR,
including their types, labels, and comment counts. Preserve the total linked-issue count so reports
can indicate truncation. Use cached PR labels as the issue-type fallback for readiness responses;
a fetched linked-issue total of zero clears cached issues.
Missing readiness nodes or failed requests fail the run before writing the PR cache or report.
Full-detail and readiness requests share batches of 20 with at most four requests in flight;
each PR alias selects the fields it needs. Summary `refetched` counts full-detail records; `reused` counts records whose metadata was
reused and readiness refreshed. Cache raw normalized values, not display labels.

Use separate `FileCacheClient` instances for PR records and team members. Configuration supplies
`prsCacheDir` and `membersCacheDir`; the latter points to `output/cache/teams/`. Team membership is
currently cached without a TTL.

`--refresh-cache` deletes only the selected repo/team PR cache and the selected team's shared
membership cache before fetching. `--no-cache` disables reads and writes for both caches without
deleting files; reports are still produced, with a null cache path in the Markdown run summary.
The flags are mutually exclusive and have no cache effect in single-PR mode.

Encode each repository and team component with `encodeURIComponent` before joining cache keys
with `@`. Team cache keys use `members@<encoded-team>`; PR cache keys use
`<encoded-repo>@<encoded-team>`. Markdown filenames are
`output/reports/open-prs@<encoded-repo>@<encoded-team>.md`.

Cache writes use a unique temporary file opened with `wx`, then rename it to publish the complete
entry. Clean up that writer's temporary file after success or failure; never share a temporary
filename between writers.

`PullRequestNormalizer.normalizeLogins` trims, lowercases, deduplicates, and sorts team logins.
The API client calls it on fresh team-member results before caching because those logins are
needed for subsequent PR searches. Cached member lists are returned directly without normalizing
again.

A single-PR run always fetches fresh details, can include a draft, and emits one compact JSON
object. It performs no team searches, cache reads/writes, or report-file writes. Its URL supplies
the repository, and only JSON output is supported.

## Tests

Never assert calls to the logger, including their messages, counts, order, or absence. Stub logging
when needed and assert behavior instead. Tests of the Logger class itself may verify its stream output.

Keep tests beside the implementation they exercise. `pr-reports.test.js` covers CLI wiring and
entry-point errors; pipeline tests cover configuration, sorting, freshness, scope, both run modes,
and delegation to the output service. `pipeline/io/ReportOutput.test.js` covers stream output,
file writes, and output failures using injected dependencies. Helper and normalization tests
belong in their own subfolders.

Use injected API/command stubs rather than live GitHub requests. Prefer injected output streams and file stubs for unit tests. Use temporary directories for
filesystem integration tests, restore mocked streams and methods, and supply a fixed time when asserting
ages or generated timestamps. Leave generated files under `output/` alone.

## Commands

```bash
node --test                  # all tests (run from this directory)
node --check <file>          # syntax check
# Run from the repo root. Source only: `output/` is generated, leave it alone.
npx prettier --write "prs-queue/**/*.js" "prs-queue/*.md"
```

The repo's Jest `roots` do not include this directory, so `yarn jest` never sees these files. Tests
use the Node built-in runner (`node:test` + `node:assert/strict`).
