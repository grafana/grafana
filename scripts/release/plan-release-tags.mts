// Plans the tags of the last release: finds the oldest merged version PR that is still labelled
// nx-release:pending and works out which independent packages it released. The workflow creates the tags with
// create-release-tag.yml and then swaps the label, so this script only reads.
//
// Usage: node scripts/release/plan-release-tags.mts <output-file>
// Reads its input from the environment: GITHUB_REPOSITORY, GITHUB_SHA and a GH_TOKEN that may read pull requests.
// Writes pr (the PR to finish, empty when there is none), tagged (a JSON list of {name, tag, commit}), matrix
// (the same list in the form a job matrix reads), release_created and sha to the output file.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { getIndependentPackages, tagFor, type IndependentPackage } from './lib/independent-packages.mts';

interface PendingPr {
  number: number;
  mergeCommit: string;
}

// The version of each package, by the path of its package.json, or null when the file did not exist.
type Versions = Record<string, string | null>;

export interface VersionedPr extends PendingPr {
  before: Versions;
  after: Versions;
}

interface PlannedTag {
  name: string;
  tag: string;
  commit: string;
}

interface Plan {
  pr: number | null;
  sha: string;
  tagged: PlannedTag[];
}

function changedPackages(packages: IndependentPackage[], pr: VersionedPr): PlannedTag[] {
  return packages.flatMap((pkg) => {
    const version = pr.after[pkg.manifestPath] ?? null;
    if (version === null || version === (pr.before[pkg.manifestPath] ?? null)) {
      return [];
    }
    return [{ name: pkg.name, tag: tagFor(pkg.name, version), commit: pr.mergeCommit }];
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

interface PlanOutputs {
  pr: string;
  release_created: boolean;
  tagged: PlannedTag[];
  matrix: { include: PlannedTag[] };
  sha: string;
}

export function formatOutputs(plan: Plan): PlanOutputs {
  return {
    pr: plan.pr === null ? '' : String(plan.pr),
    release_created: plan.tagged.length > 0,
    tagged: plan.tagged,
    matrix: { include: plan.tagged },
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
// The 300 most recently updated closed pull requests reach back about two to three working days. A version pull
// request older than that is no longer found, so a failed tag job must be fixed within that time (see the workflow).
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
        // A package added after this commit has no package.json here, so it has no version yet.
        if (/does not exist in|exists on disk, but not in/.test(stderrOf(error))) {
          return [manifestPath, null];
        }
        throw error;
      }
    })
  );
}

if (import.meta.main) {
  try {
    const outputPath = process.argv[2];
    if (!outputPath) {
      throw new Error('Pass the path of the file to write the step outputs to.');
    }

    const packages = await getIndependentPackages();
    const prs = listMergedPendingPrs(requireEnv('GITHUB_REPOSITORY')).map((pr) => ({
      ...pr,
      before: versionsAt(run('git', ['rev-parse', `${pr.mergeCommit}^1`]).trim(), packages),
      after: versionsAt(pr.mergeCommit, packages),
    }));

    const { plan, warnings } = planReleaseTags(packages, requireEnv('GITHUB_SHA'), prs);
    warnings.forEach((warning) => console.error(`::warning::${warning}`));

    writeFileSync(outputPath, JSON.stringify(formatOutputs(plan), null, 2));
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
