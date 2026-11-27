import { describe, expect, it } from 'vitest';

import { selectIndependentPackages, tagFor } from './independent-packages.mjs';

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
        manifestPath: 'packages/grafana-plugin-compat/package.json',
      },
    ]);
  });

  it('returns nothing when no project has the tag, and does not fail for projects without tags', () => {
    expect(selectIndependentPackages({ 'e2e-playwright': nodes['e2e-playwright'] })).toEqual([]);
  });
});

describe('tagFor', () => {
  it('joins the package name and version the way nx names tags of independent projects', () => {
    expect(tagFor('@grafana/plugin-compat', '0.11.0')).toBe('@grafana/plugin-compat@0.11.0');
  });
});
