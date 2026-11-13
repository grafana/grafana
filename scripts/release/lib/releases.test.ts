import { describe, expect, it } from 'vitest';

import { parseReleases, type PackageRelease } from './releases.mjs';

const release: PackageRelease = {
  name: '@grafana/plugin-compat',
  currentVersion: '0.11.0',
  newVersion: '0.11.1',
  changelog: '## 0.11.1 (2026-11-13)\n\n- a change',
};

describe('parseReleases', () => {
  it('reads the summary that prepare-release-pr.mts wrote', () => {
    expect(parseReleases(JSON.stringify([release]))).toEqual([release]);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseReleases('not json')).toThrow('The release summary is not valid JSON.');
  });

  it('rejects an entry that does not have the expected fields', () => {
    expect(() => parseReleases('[{"name":"n","currentVersion":"1.0.0","newVersion":"1.0.1"}]')).toThrow(
      'The release summary must be a JSON list of {name, currentVersion, newVersion, changelog}.'
    );
  });
});
