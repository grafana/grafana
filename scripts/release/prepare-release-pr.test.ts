import { describe, expect, it } from 'vitest';

import type { IndependentPackage } from './lib/packages.mjs';
import { prepareReleasePr, toVersionChanges, type Deps, type VersionChange } from './prepare-release-pr.mjs';

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

const bumpedToV12: VersionChange = { newVersion: '0.12.0' };
const notBumped: VersionChange = { newVersion: null };

interface Setup {
  packages?: IndependentPackage[];
  versionOnDisk?: Record<string, string>;
  tags?: string[];
  versions?: Record<string, VersionChange>;
}

function createFakeDeps({
  packages = [pluginCompat],
  versionOnDisk = {},
  tags,
  versions = { [pluginCompat.name]: bumpedToV12 },
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
    },
    notice: (message) => messages.push(`notice: ${message}`),
    warning: (message) => messages.push(`warning: ${message}`),
  };
  return { deps, calls, messages };
}

describe('prepareReleasePr', () => {
  it('warns and does nothing when the tag of the last release does not exist', async () => {
    const { deps, calls, messages } = createFakeDeps({ tags: [] });

    await prepareReleasePr(deps);

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

    await prepareReleasePr(deps);

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

    await prepareReleasePr(deps);

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

  it('writes the changelog when at least one package got a new version', async () => {
    const { deps, calls } = createFakeDeps({
      packages: [pluginCompat, other],
      versions: { [pluginCompat.name]: bumpedToV12, [other.name]: notBumped },
    });

    await prepareReleasePr(deps);

    expect(calls).toEqual(['releaseVersion plugin-compat', 'releaseChangelog plugin-compat']);
  });

  it('ignores projects that Nx returns but that are not independent packages', async () => {
    const { deps, calls, messages } = createFakeDeps({
      versions: { [pluginCompat.name]: notBumped, '@grafana/data': bumpedToV12 },
    });

    await prepareReleasePr(deps);

    expect(calls).toEqual(['releaseVersion plugin-compat']);
    expect(messages).toEqual(['notice: No package has releasable commits since its last release.']);
  });

  it('skips the changelog when no package got a new version', async () => {
    const { deps, calls, messages } = createFakeDeps({ versions: { [pluginCompat.name]: notBumped } });

    await prepareReleasePr(deps);

    expect(calls).toEqual(['releaseVersion plugin-compat']);
    expect(messages).toEqual(['notice: No package has releasable commits since its last release.']);
  });
});

describe('toVersionChanges', () => {
  it('keeps only the new version of each project from what Nx returns', () => {
    const fromNx = {
      '@grafana/plugin-compat': {
        currentVersion: '0.11.0',
        newVersion: '0.11.1',
        dependentProjects: [{ source: '@grafana/o11y-ds-frontend', target: '@grafana/plugin-compat' }],
      },
      '@grafana/other': { currentVersion: '1.0.0', newVersion: null },
    };

    expect(toVersionChanges(fromNx)).toEqual({
      '@grafana/plugin-compat': { newVersion: '0.11.1' },
      '@grafana/other': { newVersion: null },
    });
  });
});
