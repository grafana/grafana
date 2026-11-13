// Finishes the previous release: tags the merge commit of every merged version PR that is still labelled
// nx-release:pending, then swaps its label to nx-release:tagged. Safe to run again after a failure, and it
// reports every tag that belongs to the pushed commit so the publish job can run on a re-run.
//
// Usage: node scripts/release/tag-merged-version-prs.mts
// Reads its input from the environment: INDEPENDENT_PACKAGES (the packages output of independent-packages.mts),
// GITHUB_REPOSITORY, GITHUB_SHA, a GH_TOKEN that may create tag refs, and optionally DRY_RUN=true or
// TAGS=<name@version>[,<name@version>...]. With TAGS it only checks that the given tags exist and reports
// them, which is how a manual run publishes. Writes release_created, tagged and sha to GITHUB_OUTPUT.

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { writeOutputs } from './lib/github-output.mts';
import { parsePackages, type IndependentPackage } from './lib/packages.mts';
import { tagFor } from './lib/tags.mts';

export interface PendingPr {
  number: number;
  mergeCommit: string;
}

export interface ExistingTag {
  annotated: boolean;
  commit: string;
}

export interface TaggedPackage {
  name: string;
  version: string;
  tag: string;
  path: string;
}

export interface Result {
  sha: string;
  tagged: TaggedPackage[];
}

export interface Deps {
  packages: IndependentPackage[];
  sha: string;
  listPendingPrs(): PendingPr[];
  parentOf(commit: string): string;
  readVersionAt(commit: string, manifestPath: string): string | null;
  existingTag(tag: string): ExistingTag | null;
  createTag(tag: string, commit: string): void;
  swapLabel(pr: number): void;
  notice(message: string): void;
  warning(message: string): void;
}

export function readOptions(env: Record<string, string | undefined>): { dryRun: boolean; tags: string[] | undefined } {
  const tags = (env.TAGS ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return { dryRun: env.DRY_RUN === 'true', tags: tags.length > 0 ? tags : undefined };
}

function changedPackages(deps: Deps, mergeCommit: string): TaggedPackage[] {
  const parent = deps.parentOf(mergeCommit);
  const changed: TaggedPackage[] = [];

  for (const pkg of deps.packages) {
    const version = deps.readVersionAt(mergeCommit, pkg.manifestPath);
    if (version !== null && version !== deps.readVersionAt(parent, pkg.manifestPath)) {
      changed.push({ name: pkg.name, version, tag: tagFor(pkg.name, version), path: pkg.root });
    }
  }

  return changed;
}

function ensureTag(deps: Deps, tag: string, commit: string, dryRun: boolean): void {
  const existing = deps.existingTag(tag);

  if (!existing) {
    if (dryRun) {
      deps.notice(`Dry run: would tag ${tag} at ${commit}.`);
    } else {
      deps.createTag(tag, commit);
    }
    return;
  }

  if (!existing.annotated) {
    throw new Error(`Tag ${tag} already exists as a lightweight tag; expected an annotated tag.`);
  }
  if (existing.commit !== commit) {
    throw new Error(`Tag ${tag} already exists but points at ${existing.commit}, not ${commit}.`);
  }
}

function tagsAtPushedCommit(deps: Deps): Result {
  const tagged: TaggedPackage[] = [];

  for (const pkg of deps.packages) {
    const version = deps.readVersionAt(deps.sha, pkg.manifestPath);
    if (version === null) {
      continue;
    }

    const tag = tagFor(pkg.name, version);
    if (deps.existingTag(tag)?.commit === deps.sha) {
      tagged.push({ name: pkg.name, version, tag, path: pkg.root });
    }
  }

  return { sha: deps.sha, tagged };
}

// Finishes one release per run, so that everything reported belongs to a single commit that the publish job
// can check out. Any other pending PR waits for the next run.
export function tagMergedVersionPrs(deps: Deps, { dryRun = false } = {}): Result {
  let release: { pr: PendingPr; changed: TaggedPackage[] } | undefined;
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

  // A re-run finds nothing pending because the first run already swapped the label, so the tags that belong
  // to the pushed commit are reported from their state and not only from what a run created.
  if (!release) {
    return tagsAtPushedCommit(deps);
  }

  for (const pkg of release.changed) {
    ensureTag(deps, pkg.tag, release.pr.mergeCommit, dryRun);
  }

  for (const pr of waiting) {
    deps.warning(`PR #${pr.number} is also labelled nx-release:pending. A later run will finish it.`);
  }

  if (dryRun) {
    deps.notice(`Dry run: would swap the label of PR #${release.pr.number} to nx-release:tagged.`);
    return { sha: deps.sha, tagged: [] };
  }

  deps.swapLabel(release.pr.number);
  return { sha: release.pr.mergeCommit, tagged: release.changed };
}

export function resolveDispatchTags(tags: string[], deps: Deps): Result {
  if (tags.length === 0) {
    throw new Error('Pass at least one tag to publish.');
  }

  const tagged: TaggedPackage[] = [];
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

    const existing = deps.existingTag(tag);
    if (!existing) {
      throw new Error(`Tag ${tag} does not exist.`);
    }

    commits.add(existing.commit);
    tagged.push({ name, version: tag.slice(separator + 1), tag, path: pkg.root });
  }

  if (commits.size > 1) {
    throw new Error(`Tags point at different commits: ${[...commits].join(', ')}.`);
  }

  return { sha: [...commits][0], tagged };
}

export function formatOutputs(result: Result): Record<string, string> {
  return {
    release_created: String(result.tagged.length > 0),
    tagged: JSON.stringify(result.tagged),
    sha: result.sha,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function stderrOf(error: unknown): string {
  return error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
}

function listMergedPendingPrs(repo: string): PendingPr[] {
  const prs: Array<{ number: number; mergeCommit: { oid: string }; mergedAt: string }> = JSON.parse(
    run('gh', [
      'pr',
      'list',
      '--repo',
      repo,
      '--state',
      'merged',
      '--base',
      'main',
      '--label',
      'nx-release:pending',
      '--limit',
      '100',
      '--json',
      'number,mergeCommit,mergedAt',
    ])
  );

  return prs
    .sort((a, b) => Date.parse(a.mergedAt) - Date.parse(b.mergedAt))
    .map((pr) => ({ number: pr.number, mergeCommit: pr.mergeCommit.oid }));
}

function apiGet(path: string): { object: { type: string; sha: string } } | null {
  try {
    return JSON.parse(run('gh', ['api', path]));
  } catch (error) {
    // Only a 404 means the tag is absent; any other failure must stop the run instead of creating a tag.
    if (stderrOf(error).includes('HTTP 404')) {
      return null;
    }
    throw error;
  }
}

export function createTaggingDeps(): Deps {
  const repo = requireEnv('GITHUB_REPOSITORY');

  return {
    packages: parsePackages(process.env.INDEPENDENT_PACKAGES),
    sha: requireEnv('GITHUB_SHA'),
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
    existingTag: (tag) => {
      const ref = apiGet(`repos/${repo}/git/ref/tags/${tag}`);
      if (!ref) {
        return null;
      }
      if (ref.object.type !== 'tag') {
        return { annotated: false, commit: ref.object.sha };
      }
      const tagObject = apiGet(`repos/${repo}/git/tags/${ref.object.sha}`);
      if (!tagObject) {
        throw new Error(`Tag ${tag} points at a tag object that does not exist.`);
      }
      return { annotated: true, commit: tagObject.object.sha };
    },
    createTag: (tag, commit) => {
      const tagObjectSha = run('gh', [
        'api',
        `repos/${repo}/git/tags`,
        '--method',
        'POST',
        '-f',
        `tag=${tag}`,
        '-f',
        `message=${tag}`,
        '-f',
        `object=${commit}`,
        '-f',
        'type=commit',
        '--jq',
        '.sha',
      ]).trim();
      run('gh', [
        'api',
        `repos/${repo}/git/refs`,
        '--method',
        'POST',
        '-f',
        `ref=refs/tags/${tag}`,
        '-f',
        `sha=${tagObjectSha}`,
      ]);
    },
    swapLabel: (pr) => {
      run('gh', [
        'pr',
        'edit',
        String(pr),
        '--repo',
        repo,
        '--remove-label',
        'nx-release:pending',
        '--add-label',
        'nx-release:tagged',
      ]);
    },
    notice: (message) => console.log(`::notice::${message}`),
    warning: (message) => console.log(`::warning::${message}`),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    const { dryRun, tags } = readOptions(process.env);
    const deps = createTaggingDeps();
    writeOutputs(formatOutputs(tags ? resolveDispatchTags(tags, deps) : tagMergedVersionPrs(deps, { dryRun })));
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
