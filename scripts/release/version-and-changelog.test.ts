import { describe, expect, it } from 'vitest';

import { parseGroups, versionAndChangelog } from './version-and-changelog';

type Manifest = { name: string; version: string };

interface Setup {
  groups?: Record<string, { projects: string[] }>;
  manifests?: Record<string, Manifest>;
  headVersions?: Record<string, string>;
  tags?: string[];
  versionBumps?: Record<string, string>;
}

function createDeps({
  groups = { 'plugin-compat': { projects: ['@grafana/plugin-compat'] } },
  manifests = { 'packages/grafana-plugin-compat/package.json': { name: '@grafana/plugin-compat', version: '0.7.0' } },
  headVersions,
  tags = ['@grafana/plugin-compat@0.7.0'],
  versionBumps = { 'packages/grafana-plugin-compat/package.json': '0.7.1' },
}: Setup = {}) {
  const disk = new Map(Object.entries(manifests).map(([path, manifest]) => [path, { ...manifest }]));
  const head = new Map(
    Object.entries(headVersions ?? Object.fromEntries(Object.entries(manifests).map(([p, m]) => [p, m.version])))
  );
  const nxCalls: string[][] = [];
  const notices: string[] = [];

  const deps = {
    nxJson: { release: { groups } },
    listManifests: () => [...disk.keys()],
    readManifest: (path: string) => disk.get(path)!,
    readHeadManifest: (path: string) => ({ version: head.get(path)! }),
    tagExists: (tag: string) => tags.includes(tag),
    runNx: (args: string[]) => {
      nxCalls.push(args);
      if (args[0] === 'release' && args[1] === 'version') {
        for (const [path, version] of Object.entries(versionBumps)) {
          disk.get(path)!.version = version;
        }
      }
    },
    notice: (message: string) => notices.push(message),
  };
  return { deps, nxCalls, notices };
}

describe('parseGroups', () => {
  it('splits a comma separated list and trims each name', () => {
    expect(parseGroups('plugin-compat')).toEqual(['plugin-compat']);
    expect(parseGroups('plugin-compat, ui')).toEqual(['plugin-compat', 'ui']);
  });

  it('rejects a missing or empty argument', () => {
    expect(() => parseGroups(undefined)).toThrow('Usage: version-and-changelog.ts <group>[,<group>...]');
    expect(() => parseGroups('')).toThrow('Usage: version-and-changelog.ts <group>[,<group>...]');
    expect(() => parseGroups(' , ')).toThrow('Usage: version-and-changelog.ts <group>[,<group>...]');
  });
});

describe('versionAndChangelog', () => {
  it('versions the group and writes the changelog for the new version', () => {
    const { deps, nxCalls } = createDeps();

    versionAndChangelog(['plugin-compat'], deps);

    expect(nxCalls).toEqual([
      ['release', 'version', '--groups=plugin-compat'],
      ['release', 'changelog', '0.7.1', '--groups=plugin-compat'],
    ]);
  });

  it('exits without running nx while the tag for the released version does not exist', () => {
    const { deps, nxCalls, notices } = createDeps({ tags: [] });

    versionAndChangelog(['plugin-compat'], deps);

    expect(nxCalls).toEqual([]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('@grafana/plugin-compat@0.7.0');
  });

  it('looks for the tag of the version in HEAD, not the version on disk', () => {
    const { deps, nxCalls } = createDeps({
      manifests: {
        'packages/grafana-plugin-compat/package.json': { name: '@grafana/plugin-compat', version: '0.8.0' },
      },
      headVersions: { 'packages/grafana-plugin-compat/package.json': '0.7.0' },
      tags: ['@grafana/plugin-compat@0.7.0'],
      versionBumps: {},
    });

    versionAndChangelog(['plugin-compat'], deps);

    expect(nxCalls[0]).toEqual(['release', 'version', '--groups=plugin-compat']);
  });

  it('skips the changelog when nx leaves the version unchanged', () => {
    const { deps, nxCalls, notices } = createDeps({ versionBumps: {} });

    versionAndChangelog(['plugin-compat'], deps);

    expect(nxCalls).toEqual([['release', 'version', '--groups=plugin-compat']]);
    expect(notices).toEqual([
      '@grafana/plugin-compat has no releasable commits since its last release, skipping its changelog.',
    ]);
  });

  it('versions several groups in one call and writes a changelog for each one that changed', () => {
    const { deps, nxCalls, notices } = createDeps({
      groups: {
        'plugin-compat': { projects: ['@grafana/plugin-compat'] },
        ui: { projects: ['@grafana/ui'] },
      },
      manifests: {
        'packages/grafana-plugin-compat/package.json': { name: '@grafana/plugin-compat', version: '0.7.0' },
        'packages/grafana-ui/package.json': { name: '@grafana/ui', version: '13.4.0' },
      },
      tags: ['@grafana/plugin-compat@0.7.0', '@grafana/ui@13.4.0'],
      versionBumps: { 'packages/grafana-plugin-compat/package.json': '0.7.1' },
    });

    versionAndChangelog(['plugin-compat', 'ui'], deps);

    expect(nxCalls).toEqual([
      ['release', 'version', '--groups=plugin-compat,ui'],
      ['release', 'changelog', '0.7.1', '--groups=plugin-compat'],
    ]);
    expect(notices).toEqual(['@grafana/ui has no releasable commits since its last release, skipping its changelog.']);
  });

  it('runs nothing when any of the groups is missing its tag', () => {
    const { deps, nxCalls, notices } = createDeps({
      groups: {
        'plugin-compat': { projects: ['@grafana/plugin-compat'] },
        ui: { projects: ['@grafana/ui'] },
      },
      manifests: {
        'packages/grafana-plugin-compat/package.json': { name: '@grafana/plugin-compat', version: '0.7.0' },
        'packages/grafana-ui/package.json': { name: '@grafana/ui', version: '13.4.0' },
      },
      tags: ['@grafana/plugin-compat@0.7.0'],
    });

    versionAndChangelog(['plugin-compat', 'ui'], deps);

    expect(nxCalls).toEqual([]);
    expect(notices[0]).toContain('@grafana/ui@13.4.0');
  });

  it('only uses the first project of a group and ignores manifests of other packages', () => {
    const { deps, nxCalls } = createDeps({
      groups: { 'plugin-compat': { projects: ['@grafana/plugin-compat', '!@grafana/other'] } },
      manifests: {
        'packages/grafana-other/package.json': { name: '@grafana/other', version: '1.0.0' },
        'packages/grafana-plugin-compat/package.json': { name: '@grafana/plugin-compat', version: '0.7.0' },
      },
    });

    versionAndChangelog(['plugin-compat'], deps);

    expect(nxCalls[1]).toEqual(['release', 'changelog', '0.7.1', '--groups=plugin-compat']);
  });

  it('fails for a group that does not exist or has no projects', () => {
    const { deps, nxCalls } = createDeps({ groups: { empty: { projects: [] } } });

    expect(() => versionAndChangelog(['nope'], deps)).toThrow('Release group nope does not exist or has no projects.');
    expect(() => versionAndChangelog(['empty'], deps)).toThrow(
      'Release group empty does not exist or has no projects.'
    );
    expect(nxCalls).toEqual([]);
  });

  it('fails when the package of the group is not under packages/', () => {
    const { deps, nxCalls } = createDeps({ manifests: {} });

    expect(() => versionAndChangelog(['plugin-compat'], deps)).toThrow(
      'Could not find the package.json of @grafana/plugin-compat under packages/.'
    );
    expect(nxCalls).toEqual([]);
  });
});
