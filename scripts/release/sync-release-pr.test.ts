import { describe, expect, it } from 'vitest';

import type { PackageRelease } from './lib/releases.mjs';
import { decideAction, readOptions, renderPrBody, type Deps } from './sync-release-pr.mjs';

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
