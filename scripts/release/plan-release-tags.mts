// Plans the tags of the last release: finds the oldest merged version PR that is still labelled
// nx-release:pending and works out which independent packages it released. The workflow creates the tags with
// create-release-tag.yml and then swaps the label, so this script only reads.
//
// Usage: node scripts/release/plan-release-tags.mts >> "$GITHUB_OUTPUT"
// Reads its input from the environment: GITHUB_REPOSITORY, GITHUB_SHA, a GH_TOKEN that may read pull requests,
// and optionally TAGS=<name@version>[,<name@version>...]. With TAGS it only checks that the given tags exist and
// reports them, which is how a manual run publishes. Prints pr (the PR to finish, empty when there is none),
// tagged (a JSON list of {name, version, tag, path, commit}), matrix (the same list in the form a job matrix
// reads), release_created and sha to stdout.

import { execFileSync } from 'node:child_process';

import { getIndependentPackages, type IndependentPackage } from './lib/independent-packages.mts';
import { isMainModule } from './lib/main.mts';
import { tagFor } from './lib/tags.mts';

export interface PendingPr {
  number: number;
  mergeCommit: string;
}

// The version of each package, by the path of its package.json, or null when the file did not exist.
export type Versions = Record<string, string | null>;

export interface VersionedPr extends PendingPr {
  before: Versions;
  after: Versions;
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

export function readTags(env: Record<string, string | undefined>): string[] | undefined {
  const tags = (env.TAGS ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : undefined;
}

function changedPackages(packages: IndependentPackage[], pr: VersionedPr): PlannedTag[] {
  return packages.flatMap((pkg) => {
    const version = pr.after[pkg.manifestPath] ?? null;
    if (version === null || version === (pr.before[pkg.manifestPath] ?? null)) {
      return [];
    }
    return [{ name: pkg.name, version, tag: tagFor(pkg.name, version), path: pkg.root, commit: pr.mergeCommit }];
  });
}

// Plans one release, so that everything reported belongs to a single commit that the publish job can check out.
// The PRs are given oldest first. Any other pending PR waits for the next run.
export function planReleaseTags(
  packages: IndependentPackage[],
  sha: string,
  prs: VersionedPr[]
): { plan: Plan; warnings: string[] } {
  const warnings: string[] = [];
  let release: { pr: VersionedPr; changed: PlannedTag[] } | undefined;

  for (const pr of prs) {
    if (release) {
      warnings.push(`PR #${pr.number} is also labelled nx-release:pending. A later run will finish it.`);
      continue;
    }

    const changed = changedPackages(packages, pr);
    if (changed.length === 0) {
      warnings.push(
        `PR #${pr.number} is labelled nx-release:pending but changes no independent package version. Leaving it alone.`
      );
    } else {
      release = { pr, changed };
    }
  }

  if (!release) {
    return { plan: { pr: null, sha, tagged: [] }, warnings };
  }

  return { plan: { pr: release.pr.number, sha: release.pr.mergeCommit, tagged: release.changed }, warnings };
}

// The commit of each tag is null when the tag does not exist.
export function resolveDispatchTags(
  tags: string[],
  packages: IndependentPackage[],
  commits: Record<string, string | null>
): Plan {
  if (tags.length === 0) {
    throw new Error('Pass at least one tag to publish.');
  }

  const tagged: PlannedTag[] = [];
  const found = new Set<string>();

  for (const tag of tags) {
    const separator = tag.lastIndexOf('@');
    if (separator <= 0 || separator === tag.length - 1) {
      throw new Error(`Invalid tag ${tag}: expected name@version.`);
    }

    const name = tag.slice(0, separator);
    const pkg = packages.find((candidate) => candidate.name === name);
    if (!pkg) {
      throw new Error(`Tag ${tag} is not an independent package.`);
    }

    const commit = commits[tag] ?? null;
    if (commit === null) {
      throw new Error(`Tag ${tag} does not exist.`);
    }

    found.add(commit);
    tagged.push({ name, version: tag.slice(separator + 1), tag, path: pkg.root, commit });
  }

  if (found.size > 1) {
    throw new Error(`Tags point at different commits: ${[...found].join(', ')}.`);
  }

  return { pr: null, sha: [...found][0], tagged };
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

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function stderrOf(error: unknown): string {
  return error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
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

function versionsAt(commit: string, packages: IndependentPackage[]): Versions {
  return Object.fromEntries(
    packages.map(({ manifestPath }) => {
      try {
        return [manifestPath, JSON.parse(run('git', ['show', `${commit}:${manifestPath}`])).version];
      } catch (error) {
        if (/does not exist in|exists on disk, but not in/.test(stderrOf(error))) {
          return [manifestPath, null];
        }
        throw error;
      }
    })
  );
}

function tagCommit(tag: string): string | null {
  try {
    return run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`]).trim();
  } catch (error) {
    // rev-parse --verify answers 1 when the tag does not exist; any other failure is a real problem.
    if (error instanceof Error && 'status' in error && error.status === 1) {
      return null;
    }
    throw error;
  }
}

if (isMainModule(import.meta.url)) {
  try {
    const packages = await getIndependentPackages();
    const tags = readTags(process.env);

    let plan: Plan;
    if (tags) {
      plan = resolveDispatchTags(tags, packages, Object.fromEntries(tags.map((tag) => [tag, tagCommit(tag)])));
    } else {
      const prs = listMergedPendingPrs(requireEnv('GITHUB_REPOSITORY')).map((pr) => ({
        ...pr,
        before: versionsAt(run('git', ['rev-parse', `${pr.mergeCommit}^1`]).trim(), packages),
        after: versionsAt(pr.mergeCommit, packages),
      }));

      const planned = planReleaseTags(packages, requireEnv('GITHUB_SHA'), prs);
      planned.warnings.forEach((warning) => console.error(`::warning::${warning}`));
      plan = planned.plan;
    }

    for (const [key, value] of Object.entries(formatOutputs(plan))) {
      console.log(`${key}=${value}`);
    }
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
