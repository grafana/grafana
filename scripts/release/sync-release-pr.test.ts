import { describe, expect, it } from 'vitest';

import type { PackageRelease } from './lib/releases.mjs';
import {
  decideAction,
  openVersionPr,
  parseCommand,
  readOptions,
  readPrOptions,
  renderPrBody,
  resetReleaseBranch,
  type BranchDeps,
  type Deps,
  type PrDeps,
} from './sync-release-pr.mjs';

const MANIFEST = 'packages/grafana-plugin-compat/package.json';
const CHANGELOG = 'packages/grafana-plugin-compat/CHANGELOG.md';

interface Setup {
  working?: Record<string, string>;
  branch?: Record<string, string> | null;
}

function createFakeDeps({
  working = { [MANIFEST]: '{"version":"0.11.1"}', [CHANGELOG]: '## 0.11.1' },
  branch = { [MANIFEST]: '{"version":"0.11.1"}', [CHANGELOG]: '## 0.11.1' },
}: Setup = {}) {
  const calls: string[] = [];
  const deps: Deps = {
    fetchBranch: () => {
      calls.push('fetchBranch');
      return branch !== null;
    },
    changedPaths: () => Object.keys(working),
    branchPaths: () => Object.keys(branch ?? {}),
    readWorking: (path) => working[path],
    readBranch: (path) => branch?.[path] ?? null,
  };
  return { deps, calls };
}

describe('decideAction', () => {
  it('updates when there is no version PR branch yet', () => {
    const { deps } = createFakeDeps({ branch: null });

    expect(decideAction(deps)).toBe('update');
  });

  it('leaves the PR alone when the branch already has exactly the same files with the same content', () => {
    const { deps } = createFakeDeps();

    expect(decideAction(deps)).toBe('leave');
  });

  it('does not depend on the order the paths are listed in', () => {
    const { deps } = createFakeDeps();
    deps.branchPaths = () => [CHANGELOG, MANIFEST];

    expect(decideAction(deps)).toBe('leave');
  });

  it('updates when a file has different content on the branch', () => {
    const { deps } = createFakeDeps({
      branch: { [MANIFEST]: '{"version":"0.11.0"}', [CHANGELOG]: '## 0.11.1' },
    });

    expect(decideAction(deps)).toBe('update');
  });

  it('updates when the branch changes a file that the version step no longer changes', () => {
    const { deps } = createFakeDeps({
      branch: { [MANIFEST]: '{"version":"0.11.1"}', [CHANGELOG]: '## 0.11.1', 'packages/other/package.json': '{}' },
    });

    expect(decideAction(deps)).toBe('update');
  });

  it('updates when the version step changes a file that the branch does not have', () => {
    const { deps } = createFakeDeps({ branch: { [MANIFEST]: '{"version":"0.11.1"}' } });

    expect(decideAction(deps)).toBe('update');
  });

  it('updates when a file the branch lists is missing on the branch, for example because it was deleted', () => {
    const { deps } = createFakeDeps();
    deps.readBranch = () => null;

    expect(decideAction(deps)).toBe('update');
  });

  it('leaves everything alone, without even fetching the branch, when the version step changed nothing', () => {
    const { deps, calls } = createFakeDeps({ working: {} });

    expect(decideAction(deps)).toBe('leave');
    expect(calls).toEqual([]);
  });
});

describe('renderPrBody', () => {
  const pluginCompat: PackageRelease = {
    name: '@grafana/plugin-compat',
    currentVersion: '0.11.0',
    newVersion: '0.11.1',
    changelog: '## 0.11.1 (2026-11-13)\n\n- a change',
  };
  const other: PackageRelease = { name: '@grafana/other', currentVersion: '1.0.0', newVersion: '1.1.0', changelog: '' };

  it('lists every package with its old and new version and ends with the do-not-edit notice', () => {
    const body = renderPrBody([pluginCompat, other]);

    expect(body).toContain('| Package | Version |\n| --- | --- |');
    expect(body).toContain('| `@grafana/plugin-compat` | 0.11.0 -> 0.11.1 |');
    expect(body).toContain('| `@grafana/other` | 1.0.0 -> 1.1.0 |');
    expect(body.trimEnd().endsWith('Do not edit it.')).toBe(true);
  });

  it('includes the changelog entry of each package that has one, folded away', () => {
    const body = renderPrBody([pluginCompat, other]);

    expect(body).toContain(
      '<details>\n<summary>@grafana/plugin-compat 0.11.1</summary>\n\n## 0.11.1 (2026-11-13)\n\n- a change\n\n</details>'
    );
    expect(body).not.toContain('<summary>@grafana/other');
  });

  it('says what merging the PR does', () => {
    expect(renderPrBody([pluginCompat])).toContain('Merging it publishes them to npm.');
  });
});

describe('readOptions', () => {
  it('reads the branch, whether the version step changed anything, and where its summary is', () => {
    expect(
      readOptions({ RELEASE_BRANCH: 'nx-release-branch--main', CHANGED: 'true', SUMMARY_PATH: '/tmp/summary.json' })
    ).toEqual({ branch: 'nx-release-branch--main', changed: true, summaryPath: '/tmp/summary.json' });
  });

  it('treats anything but the text true as nothing changed, and the summary path as optional then', () => {
    expect(readOptions({ RELEASE_BRANCH: 'b', CHANGED: 'false' })).toEqual({
      branch: 'b',
      changed: false,
      summaryPath: undefined,
    });
    expect(readOptions({ RELEASE_BRANCH: 'b' }).changed).toBe(false);
  });

  it('requires the branch, and the summary path when something changed', () => {
    expect(() => readOptions({ CHANGED: 'false' })).toThrow('RELEASE_BRANCH is not set.');
    expect(() => readOptions({ RELEASE_BRANCH: 'b', CHANGED: 'true' })).toThrow('SUMMARY_PATH is not set.');
  });
});

describe('parseCommand', () => {
  it('runs the decision when no subcommand is given', () => {
    expect(parseCommand([])).toBe('decide');
  });

  it('knows the two steps that change GitHub', () => {
    expect(parseCommand(['reset-branch'])).toBe('reset-branch');
    expect(parseCommand(['open-pr'])).toBe('open-pr');
  });

  it('rejects anything else', () => {
    expect(() => parseCommand(['merge'])).toThrow('Usage: sync-release-pr.mts [decide|reset-branch|open-pr]');
  });
});

describe('resetReleaseBranch', () => {
  function createFakeBranchDeps(exists: boolean) {
    const calls: string[] = [];
    const deps: BranchDeps = {
      headSha: () => 'abc123',
      branchExists: () => exists,
      createBranch: (sha) => calls.push(`create ${sha}`),
      moveBranch: (sha) => calls.push(`move ${sha}`),
    };
    return { deps, calls };
  }

  it('creates the branch at the current commit when it does not exist yet', () => {
    const { deps, calls } = createFakeBranchDeps(false);

    expect(resetReleaseBranch(deps)).toBe('created');
    expect(calls).toEqual(['create abc123']);
  });

  it('moves an existing branch to the current commit, so the new commit lands on main and not on an old attempt', () => {
    const { deps, calls } = createFakeBranchDeps(true);

    expect(resetReleaseBranch(deps)).toBe('moved');
    expect(calls).toEqual(['move abc123']);
  });
});

describe('openVersionPr', () => {
  function createFakePrDeps(openPr: number | null) {
    const calls: string[] = [];
    const deps: PrDeps = {
      findOpenPr: () => openPr,
      createPr: (title, bodyPath) => calls.push(`create "${title}" ${bodyPath}`),
      editPr: (number, title, bodyPath) => calls.push(`edit #${number} "${title}" ${bodyPath}`),
    };
    return { deps, calls };
  }

  const options = { title: 'Release: Frontend packages', bodyPath: '/tmp/pr-body.md' };

  it('creates the pull request when none is open', () => {
    const { deps, calls } = createFakePrDeps(null);

    expect(openVersionPr(deps, options)).toBe('created');
    expect(calls).toEqual(['create "Release: Frontend packages" /tmp/pr-body.md']);
  });

  it('edits the open pull request instead of creating a second one', () => {
    const { deps, calls } = createFakePrDeps(12);

    expect(openVersionPr(deps, options)).toBe('updated');
    expect(calls).toEqual(['edit #12 "Release: Frontend packages" /tmp/pr-body.md']);
  });
});

describe('readPrOptions', () => {
  it('reads the branch, the title and the file with the body', () => {
    expect(
      readPrOptions({ RELEASE_BRANCH: 'nx-release-branch--main', PR_TITLE: 'Release: x', BODY_PATH: '/tmp/b.md' })
    ).toEqual({ branch: 'nx-release-branch--main', title: 'Release: x', bodyPath: '/tmp/b.md' });
  });

  it('requires all three', () => {
    expect(() => readPrOptions({ PR_TITLE: 't', BODY_PATH: 'p' })).toThrow('RELEASE_BRANCH is not set.');
    expect(() => readPrOptions({ RELEASE_BRANCH: 'b', BODY_PATH: 'p' })).toThrow('PR_TITLE is not set.');
    expect(() => readPrOptions({ RELEASE_BRANCH: 'b', PR_TITLE: 't' })).toThrow('BODY_PATH is not set.');
  });
});
