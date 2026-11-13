// Decides what to do with the version PR after prepare-release-pr.mts changed files in the working tree:
// leave it alone when its branch already has exactly this result, or update it. When it must be updated,
// this also writes the PR body.
//
// Usage: node scripts/release/sync-release-pr.mts
// Reads from the environment: RELEASE_BRANCH (the version PR branch), CHANGED and SUMMARY_PATH (the changed and
// summary_path outputs of prepare-release-pr.mts). Run from the repo root with the full history fetched.
// Writes action (leave or update) to GITHUB_OUTPUT, and for update also body_path: the PR body, in RUNNER_TEMP.

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireEnv } from './lib/env.mts';
import { writeOutputs } from './lib/github-output.mts';
import { parseReleases, type PackageRelease } from './lib/releases.mts';
import { run, stderrOf } from './lib/shell.mts';

export type Action = 'leave' | 'update';

export interface Deps {
  fetchBranch(): boolean;
  changedPaths(): string[];
  branchPaths(): string[];
  readWorking(path: string): string;
  readBranch(path: string): string | null;
}

type Options = { branch: string; changed: false } | { branch: string; changed: true; summaryPath: string };

export function readOptions(env: Record<string, string | undefined>): Options {
  const branch = requireEnv(env, 'RELEASE_BRANCH');
  if (env.CHANGED !== 'true') {
    return { branch, changed: false };
  }
  return { branch, changed: true, summaryPath: requireEnv(env, 'SUMMARY_PATH') };
}

export function decideAction(deps: Deps): Action {
  const changed = [...new Set(deps.changedPaths())].sort();
  if (changed.length === 0) {
    return 'leave';
  }

  if (!deps.fetchBranch()) {
    return 'update';
  }

  const onBranch = [...new Set(deps.branchPaths())].sort();
  const samePaths = changed.length === onBranch.length && changed.every((path, i) => path === onBranch[i]);
  if (!samePaths) {
    return 'update';
  }

  return changed.every((path) => deps.readWorking(path) === deps.readBranch(path)) ? 'leave' : 'update';
}

const BODY_INTRO =
  'This pull request releases the independently versioned packages below, with versions and changelog entries derived from the conventional commit titles merged since their last release. Merging it publishes them to npm.';
const BODY_FOOTER =
  'This pull request is generated and is rebuilt from main whenever a change to these packages lands. Do not edit it.';

export function renderPrBody(releases: PackageRelease[]): string {
  const rows = releases.map(
    ({ name, currentVersion, newVersion }) => `| \`${name}\` | ${currentVersion} -> ${newVersion} |`
  );
  const table = ['| Package | Version |', '| --- | --- |', ...rows].join('\n');

  const changelogs = releases
    .filter(({ changelog }) => changelog.trim() !== '')
    .map(
      ({ name, newVersion, changelog }) =>
        `<details>\n<summary>${name} ${newVersion}</summary>\n\n${changelog.trim()}\n\n</details>`
    );

  return [BODY_INTRO, table, ...changelogs, BODY_FOOTER].join('\n\n');
}

export function createSyncingDeps(branch: string): Deps {
  const remoteBranch = `origin/${branch}`;

  return {
    fetchBranch: () => {
      try {
        run('git', ['ls-remote', '--exit-code', '--heads', 'origin', branch]);
      } catch (error) {
        // ls-remote --exit-code answers 2 when the branch does not exist; any other failure is a real problem.
        if (error instanceof Error && 'status' in error && error.status === 2) {
          return false;
        }
        throw error;
      }

      run('git', ['fetch', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/${remoteBranch}`]);
      return true;
    },
    changedPaths: () =>
      run('git', ['ls-files', '--modified', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean),
    branchPaths: () => {
      const base = run('git', ['merge-base', 'HEAD', remoteBranch]).trim();
      return run('git', ['diff', '--name-only', '-z', base, remoteBranch]).split('\0').filter(Boolean);
    },
    readWorking: (path) => readFileSync(path, 'utf8'),
    readBranch: (path) => {
      try {
        return run('git', ['show', `${remoteBranch}:${path}`]);
      } catch (error) {
        if (/does not exist in|exists on disk, but not in/.test(stderrOf(error))) {
          return null;
        }
        throw error;
      }
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    const options = readOptions(process.env);
    if (!options.changed) {
      writeOutputs({ action: 'leave' });
    } else {
      const releases = parseReleases(readFileSync(options.summaryPath, 'utf8'));
      const action = decideAction(createSyncingDeps(options.branch));

      if (action === 'update') {
        const bodyPath = join(process.env.RUNNER_TEMP ?? tmpdir(), 'pr-body.md');
        writeFileSync(bodyPath, renderPrBody(releases));
        writeOutputs({ action, body_path: bodyPath });
      } else {
        writeOutputs({ action });
      }
    }
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
