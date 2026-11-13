import { describe, expect, it } from 'vitest';

import type { IndependentPackage } from './lib/packages.mjs';
import {
  prepareReleasePr,
  toChangelogEntries,
  toVersionChanges,
  type Deps,
  type VersionChange,
} from './prepare-release-pr.mjs';

const pluginCompat: IndependentPackage = {
  group: 'plugin-compat',
  name: '@grafana/plugin-compat',
  root: 'packages/grafana-plugin-compat',
  manifestPath: 'packages/grafana-plugin-compat/package.json',
};
const other: IndependentPackage = {
  group: 'plugin-compat',
  name: '@grafana/other',
  root: 'packages/grafana-other',
  manifestPath: 'packages/grafana-other/package.json',
};
const ui: IndependentPackage = {
  group: 'ui',
  name: '@grafana/ui',
  root: 'packages/grafana-ui',
  manifestPath: 'packages/grafana-ui/package.json',
};

const bumpedToV12: VersionChange = { currentVersion: '0.11.0', newVersion: '0.12.0' };

interface Setup {
  packages?: IndependentPackage[];
  versionOnDisk?: Record<string, string>;
  tags?: string[];
  versions?: Record<string, VersionChange>;
  changelogs?: Record<string, string>;
}

function createFakeDeps({
  packages = [pluginCompat],
  versionOnDisk = {},
  tags,
  versions = { [pluginCompat.name]: bumpedToV12 },
  changelogs = { [pluginCompat.name]: '## 0.12.0\n\n- a change' },
}: Setup = {}) {
  const onDisk = (pkg: IndependentPackage) => versionOnDisk[pkg.manifestPath] ?? '0.11.0';
  const existingTags = tags ?? packages.map((pkg) => `${pkg.name}@${onDisk(pkg)}`);
  const calls: string[] = [];
  const messages: string[] = [];

  const deps: Deps = {
    packages,
    readVersion: (manifestPath) => versionOnDisk[manifestPath] ?? '0.11.0',
    tagExists: (tag) => existingTags.includes(tag),
    releaseVersion: async (groups) => {
      calls.push(`releaseVersion ${groups.join(',')}`);
      return versions;
    },
    releaseChangelog: async (groups) => {
      calls.push(`releaseChangelog ${groups.join(',')}`);
      return changelogs;
    },
    notice: (message) => messages.push(`notice: ${message}`),
    warning: (message) => messages.push(`warning: ${message}`),
  };
  return { deps, calls, messages };
}

describe('prepareReleasePr', () => {
  it('warns and does nothing when the tag of the last release does not exist', async () => {
    const { deps, calls, messages } = createFakeDeps({ tags: [] });

    expect(await prepareReleasePr(deps)).toEqual({ changed: false, releases: [] });
    expect(calls).toEqual([]);
    expect(messages).toEqual([
      'warning: The tag @grafana/plugin-compat@0.11.0 does not exist, so Nx cannot tell which commits are new. Create it on the commit that published @grafana/plugin-compat 0.11.0, then run the workflow again.',
    ]);
  });

  it('does nothing for any package when the tag of just one of them is missing', async () => {
    const { deps, calls, messages } = createFakeDeps({
      packages: [pluginCompat, other],
      tags: ['@grafana/plugin-compat@0.11.0'],
    });

    expect(await prepareReleasePr(deps)).toEqual({ changed: false, releases: [] });
    expect(calls).toEqual([]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('@grafana/other@0.11.0');
  });

  it('checks the tag of the version that is on disk, not a fixed one', async () => {
    const { deps, calls } = createFakeDeps({
      versionOnDisk: { [pluginCompat.manifestPath]: '0.13.2' },
      tags: ['@grafana/plugin-compat@0.13.2'],
    });

    await prepareReleasePr(deps);

    expect(calls).toEqual(['releaseVersion plugin-compat', 'releaseChangelog plugin-compat']);
  });

  it('does nothing instead of asking Nx to version every group when there are no independent packages', async () => {
    const { deps, calls, messages } = createFakeDeps({ packages: [] });

    expect(await prepareReleasePr(deps)).toEqual({ changed: false, releases: [] });
    expect(calls).toEqual([]);
    expect(messages).toEqual(['notice: There are no independent packages to release.']);
  });

  it('versions each release group once and then writes the changelog for the same groups', async () => {
    const { deps, calls } = createFakeDeps({
      packages: [pluginCompat, other, ui],
      versions: {
        [pluginCompat.name]: bumpedToV12,
        [other.name]: bumpedToV12,
        [ui.name]: bumpedToV12,
      },
    });

    await prepareReleasePr(deps);

    expect(calls).toEqual(['releaseVersion plugin-compat,ui', 'releaseChangelog plugin-compat,ui']);
  });

  it('reports each bumped package with its new version and its changelog entry', async () => {
    const { deps } = createFakeDeps();

    expect(await prepareReleasePr(deps)).toEqual({
      changed: true,
      releases: [
        {
          name: '@grafana/plugin-compat',
          currentVersion: '0.11.0',
          newVersion: '0.12.0',
          changelog: '## 0.12.0\n\n- a change',
        },
      ],
    });
  });

  it('leaves out packages that got no new version', async () => {
    const { deps } = createFakeDeps({
      packages: [pluginCompat, other],
      versions: {
        [pluginCompat.name]: bumpedToV12,
        [other.name]: { currentVersion: '0.11.0', newVersion: null },
      },
    });

    const { releases } = await prepareReleasePr(deps);

    expect(releases.map((release) => release.name)).toEqual(['@grafana/plugin-compat']);
  });

  it('ignores projects that Nx returns but that are not independent packages', async () => {
    const { deps } = createFakeDeps({
      versions: { [pluginCompat.name]: bumpedToV12, '@grafana/data': bumpedToV12 },
    });

    const { releases } = await prepareReleasePr(deps);

    expect(releases.map((release) => release.name)).toEqual(['@grafana/plugin-compat']);
  });

  it('skips the changelog and reports no change when no package got a new version', async () => {
    const { deps, calls, messages } = createFakeDeps({
      versions: { [pluginCompat.name]: { currentVersion: '0.11.0', newVersion: null } },
    });

    expect(await prepareReleasePr(deps)).toEqual({ changed: false, releases: [] });
    expect(calls).toEqual(['releaseVersion plugin-compat']);
    expect(messages).toEqual(['notice: No package has releasable commits since its last release.']);
  });

  it('warns and uses an empty entry when a bumped package has no changelog entry', async () => {
    const { deps, messages } = createFakeDeps({ changelogs: {} });

    const { releases } = await prepareReleasePr(deps);

    expect(releases[0].changelog).toBe('');
    expect(messages).toEqual(['warning: No changelog entry was generated for @grafana/plugin-compat 0.12.0.']);
  });
});

describe('toVersionChanges', () => {
  it('keeps only the current and the new version of each project from what Nx returns', () => {
    const fromNx = {
      '@grafana/plugin-compat': {
        currentVersion: '0.11.0',
        newVersion: '0.11.1',
        dependentProjects: [{ source: '@grafana/o11y-ds-frontend', target: '@grafana/plugin-compat' }],
      },
      '@grafana/other': { currentVersion: '1.0.0', newVersion: null },
    };

    expect(toVersionChanges(fromNx)).toEqual({
      '@grafana/plugin-compat': { currentVersion: '0.11.0', newVersion: '0.11.1' },
      '@grafana/other': { currentVersion: '1.0.0', newVersion: null },
    });
  });
});

describe('toChangelogEntries', () => {
  it('keeps only the markdown of each project from what Nx returns', () => {
    const fromNx = {
      '@grafana/plugin-compat': {
        releaseVersion: { rawVersion: '0.11.1', gitTag: '@grafana/plugin-compat@0.11.1' },
        contents: '## 0.11.1 (2026-11-13)\n\n- a change',
        postGitTask: null,
      },
    };

    expect(toChangelogEntries(fromNx)).toEqual({ '@grafana/plugin-compat': '## 0.11.1 (2026-11-13)\n\n- a change' });
  });

  it('returns nothing when Nx generated no changelog at all', () => {
    expect(toChangelogEntries(undefined)).toEqual({});
  });
});
