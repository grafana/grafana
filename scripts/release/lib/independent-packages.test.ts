import { describe, expect, it } from 'vitest';

import { selectIndependentPackages } from './independent-packages.mjs';

describe('selectIndependentPackages', () => {
  const nodes = {
    '@grafana/plugin-compat': {
      name: '@grafana/plugin-compat',
      data: { root: 'packages/grafana-plugin-compat', tags: ['scope:package', 'release:independent'] },
    },
    '@grafana/data': {
      name: '@grafana/data',
      data: { root: 'packages/grafana-data', tags: ['scope:package', 'release:grafana'] },
    },
    'e2e-playwright': { name: 'e2e-playwright', data: { root: 'e2e-playwright' } },
  };

  it('keeps only the projects with the release:independent tag', () => {
    expect(selectIndependentPackages(nodes)).toEqual([
      {
        name: '@grafana/plugin-compat',
        root: 'packages/grafana-plugin-compat',
        manifestPath: 'packages/grafana-plugin-compat/package.json',
      },
    ]);
  });

  it('returns nothing when no project has the tag, and does not fail for projects without tags', () => {
    expect(selectIndependentPackages({ 'e2e-playwright': nodes['e2e-playwright'] })).toEqual([]);
  });

  it('orders the packages by name, whatever order Nx lists them in', () => {
    const second = { name: '@grafana/other', data: { root: 'packages/grafana-other', tags: ['release:independent'] } };

    const names = selectIndependentPackages({ ...nodes, '@grafana/other': second }).map(({ name }) => name);

    expect(names).toEqual(['@grafana/other', '@grafana/plugin-compat']);
  });
});
