// Plans the tags of the last release: finds the oldest merged version PR that is still labelled
// nx-release:pending and works out which independent packages it released. The workflow creates the tags with
// create-release-tag.yml and then swaps the label, so this script only reads.
//
// Usage: node scripts/release/plan-release-tags.mts >> "$GITHUB_OUTPUT"
// Reads its input from the environment: INDEPENDENT_PACKAGES (the packages output of independent-packages.mts),
// GITHUB_REPOSITORY, GITHUB_SHA, a GH_TOKEN that may read pull requests, and optionally
// TAGS=<name@version>[,<name@version>...]. With TAGS it only checks that the given tags exist and reports them,
// which is how a manual run publishes. Prints pr (the PR to finish, empty when there is none), tagged (a JSON
// list of {name, version, tag, path, commit}), matrix (the same list in the form a job matrix reads),
// release_created and sha to stdout.

import { requireEnv } from './lib/env.mts';
import { isMainModule } from './lib/main.mts';
import { parsePackages, type IndependentPackage } from './lib/packages.mts';
import { run, stderrOf } from './lib/shell.mts';
import { tagFor } from './lib/tags.mts';

export interface PendingPr {
  number: number;
  mergeCommit: string;
}

export interface PlannedTag {
  name: string;
  version: string;
  tag: string;
  path: string;
  commit: string;
}

export interface Plan {
  pr: number | null;
  sha: string;
  tagged: PlannedTag[];
}

export interface Deps {
  packages: IndependentPackage[];
  sha: string;
  listPendingPrs(): PendingPr[];
  parentOf(commit: string): string;
  readVersionAt(commit: string, manifestPath: string): string | null;
  tagCommit(tag: string): string | null;
  warning(message: string): void;
}

export function readTags(env: Record<string, string | undefined>): string[] | undefined {
  const tags = (env.TAGS ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : undefined;
}

function changedPackages(deps: Deps, mergeCommit: string): PlannedTag[] {
  const parent = deps.parentOf(mergeCommit);
  const changed: PlannedTag[] = [];

  for (const pkg of deps.packages) {
    const version = deps.readVersionAt(mergeCommit, pkg.manifestPath);
    if (version !== null && version !== deps.readVersionAt(parent, pkg.manifestPath)) {
      changed.push({ name: pkg.name, version, tag: tagFor(pkg.name, version), path: pkg.root, commit: mergeCommit });
    }
  }

  return changed;
}

// Plans one release per run, so that everything reported belongs to a single commit that the publish job can
// check out. Any other pending PR waits for the next run.
export function planReleaseTags(deps: Deps): Plan {
  let release: { pr: PendingPr; changed: PlannedTag[] } | undefined;
  const waiting: PendingPr[] = [];

  for (const pr of deps.listPendingPrs()) {
    if (release) {
      waiting.push(pr);
      continue;
    }

    const changed = changedPackages(deps, pr.mergeCommit);
    if (changed.length === 0) {
      deps.warning(
        `PR #${pr.number} is labelled nx-release:pending but changes no independent package version. Leaving it alone.`
      );
    } else {
      release = { pr, changed };
    }
  }

  if (!release) {
    return { pr: null, sha: deps.sha, tagged: [] };
  }

  for (const pr of waiting) {
    deps.warning(`PR #${pr.number} is also labelled nx-release:pending. A later run will finish it.`);
  }

  return { pr: release.pr.number, sha: release.pr.mergeCommit, tagged: release.changed };
}

export function resolveDispatchTags(tags: string[], deps: Deps): Plan {
  if (tags.length === 0) {
    throw new Error('Pass at least one tag to publish.');
  }

  const tagged: PlannedTag[] = [];
  const commits = new Set<string>();

  for (const tag of tags) {
    const separator = tag.lastIndexOf('@');
    if (separator <= 0 || separator === tag.length - 1) {
      throw new Error(`Invalid tag ${tag}: expected name@version.`);
    }

    const name = tag.slice(0, separator);
    const pkg = deps.packages.find((candidate) => candidate.name === name);
    if (!pkg) {
      throw new Error(`Tag ${tag} is not an independent package.`);
    }

    const commit = deps.tagCommit(tag);
    if (commit === null) {
      throw new Error(`Tag ${tag} does not exist.`);
    }

    commits.add(commit);
    tagged.push({ name, version: tag.slice(separator + 1), tag, path: pkg.root, commit });
  }

  if (commits.size > 1) {
    throw new Error(`Tags point at different commits: ${[...commits].join(', ')}.`);
  }

  return { pr: null, sha: [...commits][0], tagged };
}

export function formatOutputs(plan: Plan): Record<string, string> {
  return {
    pr: plan.pr === null ? '' : String(plan.pr),
    release_created: String(plan.tagged.length > 0),
    tagged: JSON.stringify(plan.tagged),
    matrix: JSON.stringify({ include: plan.tagged }),
    sha: plan.sha,
  };
}

export interface ClosedPr {
  number: number;
  merged_at: string | null;
  merge_commit_sha: string | null;
  labels: Array<{ name: string }>;
}

const PENDING_LABEL = 'nx-release:pending';
const PAGE_SIZE = 100;
// Three pages of closed pull requests reach back several days, long enough to re-run a failed release job.
const MAX_PAGES = 3;

export function selectPendingPrs(prs: ClosedPr[]): PendingPr[] {
  return prs
    .flatMap((pr) =>
      pr.merged_at !== null && pr.merge_commit_sha !== null && pr.labels.some(({ name }) => name === PENDING_LABEL)
        ? [{ number: pr.number, mergeCommit: pr.merge_commit_sha, mergedAt: Date.parse(pr.merged_at) }]
        : []
    )
    .sort((a, b) => a.mergedAt - b.mergedAt)
    .map(({ number, mergeCommit }) => ({ number, mergeCommit }));
}

// gh pr list --label goes through GitHub's search index, which can lag right after a merge, so the plain list
// endpoint is paged instead. Sorted by last update, a version PR that has just merged is on the first page.
// The jq filter keeps only the fields used here: a full page of pull requests is larger than run() can buffer.
const CLOSED_PR_FIELDS = '[.[] | {number, merged_at, merge_commit_sha, labels: [.labels[] | {name}]}]';

function listMergedPendingPrs(repo: string): PendingPr[] {
  const closed: ClosedPr[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch: ClosedPr[] = JSON.parse(
      run('gh', [
        'api',
        `repos/${repo}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
        '--jq',
        CLOSED_PR_FIELDS,
      ])
    );
    closed.push(...batch);
    if (batch.length < PAGE_SIZE) {
      break;
    }
  }

  return selectPendingPrs(closed);
}

export function createPlanningDeps(): Deps {
  const repo = requireEnv(process.env, 'GITHUB_REPOSITORY');

  return {
    packages: parsePackages(process.env.INDEPENDENT_PACKAGES),
    sha: requireEnv(process.env, 'GITHUB_SHA'),
    listPendingPrs: () => listMergedPendingPrs(repo),
    parentOf: (commit) => run('git', ['rev-parse', `${commit}^1`]).trim(),
    readVersionAt: (commit, manifestPath) => {
      try {
        return JSON.parse(run('git', ['show', `${commit}:${manifestPath}`])).version;
      } catch (error) {
        if (/does not exist in|exists on disk, but not in/.test(stderrOf(error))) {
          return null;
        }
        throw error;
      }
    },
    tagCommit: (tag) => {
      try {
        return run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`]).trim();
      } catch (error) {
        // rev-parse --verify answers 1 when the tag does not exist; any other failure is a real problem.
        if (error instanceof Error && 'status' in error && error.status === 1) {
          return null;
        }
        throw error;
      }
    },
    warning: (message) => console.error(`::warning::${message}`),
  };
}

if (isMainModule(import.meta.url)) {
  try {
    const tags = readTags(process.env);
    const deps = createPlanningDeps();
    const outputs = formatOutputs(tags ? resolveDispatchTags(tags, deps) : planReleaseTags(deps));
    for (const [key, value] of Object.entries(outputs)) {
      console.log(`${key}=${value}`);
    }
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
