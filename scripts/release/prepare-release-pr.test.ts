import { describe, expect, it } from 'vitest';

import type { IndependentPackage } from './lib/independent-packages.mjs';
import { findMissingTag, hasNewVersion } from './prepare-release-pr.mjs';

const pluginCompat: IndependentPackage = {
  name: '@grafana/plugin-compat',
  root: 'packages/grafana-plugin-compat',
  manifestPath: 'packages/grafana-plugin-compat/package.json',
};
const other: IndependentPackage = {
  name: '@grafana/other',
  root: 'packages/grafana-other',
  manifestPath: 'packages/grafana-other/package.json',
};

const versions = { [pluginCompat.manifestPath]: '0.11.0', [other.manifestPath]: '1.0.0' };

describe('findMissingTag', () => {
  it('finds nothing when the tag of the version on disk exists for every package', () => {
    const existing = ['@grafana/plugin-compat@0.11.0', '@grafana/other@1.0.0'];

    expect(findMissingTag([pluginCompat, other], versions, existing)).toBeUndefined();
  });

  it('reports the tag of the version that is on disk when it does not exist', () => {
    expect(findMissingTag([pluginCompat], versions, [])).toEqual({
      name: '@grafana/plugin-compat',
      version: '0.11.0',
      tag: '@grafana/plugin-compat@0.11.0',
    });
  });

  it('does not accept the tag of another version', () => {
    expect(findMissingTag([pluginCompat], versions, ['@grafana/plugin-compat@0.10.0'])?.tag).toBe(
      '@grafana/plugin-compat@0.11.0'
    );
  });

  it('reports a package whose tag is missing even when the others have theirs', () => {
    const existing = ['@grafana/plugin-compat@0.11.0'];

    expect(findMissingTag([pluginCompat, other], versions, existing)?.tag).toBe('@grafana/other@1.0.0');
  });
});

describe('hasNewVersion', () => {
  it('is true when at least one package got a new version', () => {
    const fromNx = { [pluginCompat.name]: { newVersion: '0.12.0' }, [other.name]: { newVersion: null } };

    expect(hasNewVersion([pluginCompat, other], fromNx)).toBe(true);
  });

  it('is false when no package got a new version', () => {
    expect(hasNewVersion([pluginCompat], { [pluginCompat.name]: { newVersion: null } })).toBe(false);
  });

  it('ignores projects that Nx returns but that are not independent packages', () => {
    const fromNx = { [pluginCompat.name]: { newVersion: null }, '@grafana/data': { newVersion: '13.5.0' } };

    expect(hasNewVersion([pluginCompat], fromNx)).toBe(false);
  });

  it('is false when Nx returned nothing for the package', () => {
    expect(hasNewVersion([pluginCompat], {})).toBe(false);
  });
});
