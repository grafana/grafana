// Keeps the version PR in step with what prepare-release-pr.mts changed in the working tree. Run from the repo
// root, with the full history fetched, in three steps:
//
//   node scripts/release/sync-release-pr.mts [decide]
//     Leaves the PR alone when its branch already has exactly this result, or says it must be updated and writes
//     its body. Reads RELEASE_BRANCH, CHANGED and SUMMARY_PATH (the changed and summary_path outputs of
//     prepare-release-pr.mts). Writes action (leave or update) to GITHUB_OUTPUT, and for update also body_path,
//     the PR body, in RUNNER_TEMP.
//   node scripts/release/sync-release-pr.mts reset-branch
//     Creates the version PR branch at the current commit, or moves it there if it exists. Reads RELEASE_BRANCH
//     and GITHUB_REPOSITORY, and needs a GH_TOKEN of the writer app.
//   node scripts/release/sync-release-pr.mts open-pr
//     Opens the version PR, or edits the one that is open. Reads RELEASE_BRANCH, PR_TITLE, BODY_PATH and
//     GITHUB_REPOSITORY, and needs a GH_TOKEN that may edit pull requests.

import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { requireEnv } from './lib/env.mts';
import { writeOutputs } from './lib/github-output.mts';
import { isMainModule } from './lib/main.mts';
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

export interface BranchDeps {
  headSha(): string;
  branchExists(): boolean;
  createBranch(sha: string): void;
  moveBranch(sha: string): void;
}

export interface PrDeps {
  findOpenPr(): number | null;
  createPr(title: string, bodyPath: string): void;
  editPr(number: number, title: string, bodyPath: string): void;
}

export type Command = 'decide' | 'reset-branch' | 'open-pr';

type Options = { branch: string; changed: false } | { branch: string; changed: true; summaryPath: string };

const COMMANDS: Command[] = ['decide', 'reset-branch', 'open-pr'];
const PR_LABELS = ['no-changelog', 'area/frontend', 'nx-release:pending'];

export function parseCommand(args: string[]): Command {
  const [command = 'decide'] = args;
  const known = COMMANDS.find((candidate) => candidate === command);
  if (!known || args.length > 1) {
    throw new Error(`Usage: sync-release-pr.mts [${COMMANDS.join('|')}]`);
  }
  return known;
}

export function readPrOptions(env: Record<string, string | undefined>) {
  return {
    branch: requireEnv(env, 'RELEASE_BRANCH'),
    title: requireEnv(env, 'PR_TITLE'),
    bodyPath: requireEnv(env, 'BODY_PATH'),
  };
}

// The branch has the same name for every release, so an existing one is moved to the current commit, which
// keeps the open PR attached to it. Committing on top of an old attempt would carry that attempt along.
export function resetReleaseBranch(deps: BranchDeps): 'created' | 'moved' {
  const sha = deps.headSha();
  if (deps.branchExists()) {
    deps.moveBranch(sha);
    return 'moved';
  }

  deps.createBranch(sha);
  return 'created';
}

export function openVersionPr(
  deps: PrDeps,
  { title, bodyPath }: { title: string; bodyPath: string }
): 'created' | 'updated' {
  const open = deps.findOpenPr();
  if (open === null) {
    deps.createPr(title, bodyPath);
    return 'created';
  }

  deps.editPr(open, title, bodyPath);
  return 'updated';
}

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

function remoteBranchExists(branch: string): boolean {
  try {
    run('git', ['ls-remote', '--exit-code', '--heads', 'origin', branch]);
    return true;
  } catch (error) {
    // ls-remote --exit-code answers 2 when the branch does not exist; any other failure is a real problem.
    if (error instanceof Error && 'status' in error && error.status === 2) {
      return false;
    }
    throw error;
  }
}

export function createBranchResetDeps(branch: string, repo: string): BranchDeps {
  return {
    headSha: () => run('git', ['rev-parse', 'HEAD']).trim(),
    branchExists: () => remoteBranchExists(branch),
    createBranch: (sha) => {
      run('gh', [
        'api',
        `repos/${repo}/git/refs`,
        '--method',
        'POST',
        '-f',
        `ref=refs/heads/${branch}`,
        '-f',
        `sha=${sha}`,
      ]);
    },
    moveBranch: (sha) => {
      run('gh', [
        'api',
        `repos/${repo}/git/refs/heads/${branch}`,
        '--method',
        'PATCH',
        '-f',
        `sha=${sha}`,
        '-F',
        'force=true',
      ]);
    },
  };
}

export function createPrOpeningDeps(branch: string, repo: string): PrDeps {
  return {
    // The branch name is reused after every merge, so only open pull requests are listed: gh pr view would also
    // find the merged and closed ones.
    findOpenPr: () => {
      const number = run('gh', [
        'pr',
        'list',
        '--repo',
        repo,
        '--head',
        branch,
        '--base',
        'main',
        '--state',
        'open',
        '--json',
        'number',
        '--jq',
        '.[0].number // empty',
      ]).trim();
      return number === '' ? null : Number(number);
    },
    createPr: (title, bodyPath) => {
      run('gh', [
        'pr',
        'create',
        '--repo',
        repo,
        '--base',
        'main',
        '--head',
        branch,
        '--title',
        title,
        '--body-file',
        bodyPath,
        ...PR_LABELS.flatMap((label) => ['--label', label]),
      ]);
    },
    editPr: (number, title, bodyPath) => {
      run('gh', [
        'pr',
        'edit',
        String(number),
        '--repo',
        repo,
        '--title',
        title,
        '--body-file',
        bodyPath,
        '--add-label',
        'nx-release:pending',
      ]);
    },
  };
}

export function createSyncingDeps(branch: string): Deps {
  const remoteBranch = `origin/${branch}`;

  return {
    fetchBranch: () => {
      if (!remoteBranchExists(branch)) {
        return false;
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

function decide(): void {
  const options = readOptions(process.env);
  if (!options.changed) {
    writeOutputs({ action: 'leave' });
    return;
  }

  const releases = parseReleases(readFileSync(options.summaryPath, 'utf8'));
  const action = decideAction(createSyncingDeps(options.branch));
  if (action === 'leave') {
    writeOutputs({ action });
    return;
  }

  const bodyPath = join(process.env.RUNNER_TEMP ?? tmpdir(), 'pr-body.md');
  writeFileSync(bodyPath, renderPrBody(releases));
  writeOutputs({ action, body_path: bodyPath });
}

function runCommand(command: Command): void {
  if (command === 'decide') {
    decide();
  } else if (command === 'reset-branch') {
    const branch = requireEnv(process.env, 'RELEASE_BRANCH');
    const result = resetReleaseBranch(createBranchResetDeps(branch, requireEnv(process.env, 'GITHUB_REPOSITORY')));
    console.log(`::notice::The branch ${branch} was ${result}.`);
  } else {
    const { branch, title, bodyPath } = readPrOptions(process.env);
    const result = openVersionPr(createPrOpeningDeps(branch, requireEnv(process.env, 'GITHUB_REPOSITORY')), {
      title,
      bodyPath,
    });
    console.log(`::notice::The version pull request was ${result}.`);
  }
}

if (isMainModule(import.meta.url)) {
  try {
    runCommand(parseCommand(process.argv.slice(2)));
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
