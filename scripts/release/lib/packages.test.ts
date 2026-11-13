import { describe, expect, it } from 'vitest';

import { parsePackages, type IndependentPackage } from './packages.mjs';

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

describe('parsePackages', () => {
  it('reads the package list that independent-packages.mts wrote', () => {
    expect(parsePackages(JSON.stringify([pluginCompat, other]))).toEqual([pluginCompat, other]);
  });

  it('rejects a missing value', () => {
    expect(() => parsePackages(undefined)).toThrow('INDEPENDENT_PACKAGES is not set.');
    expect(() => parsePackages('')).toThrow('INDEPENDENT_PACKAGES is not set.');
  });

  it('rejects text that is not JSON', () => {
    expect(() => parsePackages('not json')).toThrow('INDEPENDENT_PACKAGES is not valid JSON.');
  });

  it.each([
    ['an object instead of a list', '{}'],
    ['an entry that is not an object', '["@grafana/plugin-compat"]'],
    ['an entry without a manifestPath', '[{"group":"g","name":"n","root":"r"}]'],
    ['an entry with a number as the name', '[{"group":"g","name":1,"root":"r","manifestPath":"m"}]'],
  ])('rejects %s', (_label, json) => {
    expect(() => parsePackages(json)).toThrow(
      'INDEPENDENT_PACKAGES must be a JSON list of {group, name, root, manifestPath}.'
    );
  });
});
