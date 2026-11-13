import { describe, expect, it } from 'vitest';

import { getIndependentPackages, type Deps } from './independent-packages.mjs';

type Groups = Deps['nxJson']['release']['groups'];

function createFakeDeps(groups: Groups, manifests: Record<string, { name: string }>): Deps {
  return {
    nxJson: { release: { groups } },
    listManifests: () => Object.keys(manifests),
    readManifest: (path) => manifests[path],
  };
}

const pluginCompatManifest = { 'packages/grafana-plugin-compat/package.json': { name: '@grafana/plugin-compat' } };

describe('getIndependentPackages', () => {
  it('returns the projects of independent groups with their root and manifest path', () => {
    const deps = createFakeDeps(
      { 'plugin-compat': { projects: ['@grafana/plugin-compat'], projectsRelationship: 'independent' } },
      pluginCompatManifest
    );

    expect(getIndependentPackages(deps)).toEqual([
      {
        group: 'plugin-compat',
        name: '@grafana/plugin-compat',
        root: 'packages/grafana-plugin-compat',
        manifestPath: 'packages/grafana-plugin-compat/package.json',
      },
    ]);
  });

  it('ignores groups that are not independent', () => {
    const deps = createFakeDeps(
      {
        grafana: { projects: ['@grafana/data', 'public/app/plugins/*/*'], projectsRelationship: 'fixed' },
        'plugin-compat': { projects: ['@grafana/plugin-compat'], projectsRelationship: 'independent' },
      },
      { ...pluginCompatManifest, 'packages/grafana-data/package.json': { name: '@grafana/data' } }
    );

    expect(getIndependentPackages(deps).map((pkg) => pkg.name)).toEqual(['@grafana/plugin-compat']);
  });

  it('returns every project of every independent group in nx.json order', () => {
    const deps = createFakeDeps(
      {
        ui: { projects: ['@grafana/ui'], projectsRelationship: 'independent' },
        'plugin-compat': {
          projects: ['@grafana/plugin-compat', '@grafana/other'],
          projectsRelationship: 'independent',
        },
      },
      {
        ...pluginCompatManifest,
        'packages/grafana-ui/package.json': { name: '@grafana/ui' },
        'packages/grafana-other/package.json': { name: '@grafana/other' },
      }
    );

    expect(getIndependentPackages(deps).map((pkg) => [pkg.group, pkg.name])).toEqual([
      ['ui', '@grafana/ui'],
      ['plugin-compat', '@grafana/plugin-compat'],
      ['plugin-compat', '@grafana/other'],
    ]);
  });

  it('returns nothing when no group is independent or an independent group has no projects', () => {
    expect(
      getIndependentPackages(createFakeDeps({ grafana: { projects: [], projectsRelationship: 'fixed' } }, {}))
    ).toEqual([]);
    expect(getIndependentPackages(createFakeDeps({ empty: { projectsRelationship: 'independent' } }, {}))).toEqual([]);
  });

  it('fails when a project of an independent group has no package.json under packages/', () => {
    const deps = createFakeDeps(
      { 'plugin-compat': { projects: ['@grafana/missing'], projectsRelationship: 'independent' } },
      pluginCompatManifest
    );

    expect(() => getIndependentPackages(deps)).toThrow(
      'Could not find the package.json of @grafana/missing under packages/.'
    );
  });

  it.each(['public/app/plugins/*/*', 'tag:release:independent', '!@grafana/data'])(
    'rejects the pattern %s in an independent group instead of guessing what it matches',
    (pattern) => {
      const deps = createFakeDeps(
        { 'plugin-compat': { projects: [pattern], projectsRelationship: 'independent' } },
        pluginCompatManifest
      );

      expect(() => getIndependentPackages(deps)).toThrow(
        `Release group plugin-compat lists "${pattern}", but independent groups must list project names.`
      );
    }
  );
});
