import { describe, expect, it } from 'vitest';

import type { IndependentPackage } from './lib/independent-packages.mjs';
import {
  formatOutputs,
  planReleaseTags,
  readTags,
  resolveDispatchTags,
  selectPendingPrs,
  type ClosedPr,
  type VersionedPr,
} from './plan-release-tags.mjs';

const MANIFEST = 'packages/grafana-plugin-compat/package.json';
const OTHER_MANIFEST = 'packages/grafana-other/package.json';
const PLUGIN_COMPAT_TAG = '@grafana/plugin-compat@0.12.0';

const pluginCompat: IndependentPackage = {
  name: '@grafana/plugin-compat',
  root: 'packages/grafana-plugin-compat',
  manifestPath: MANIFEST,
};
const other: IndependentPackage = {
  name: '@grafana/other',
  root: 'packages/grafana-other',
  manifestPath: OTHER_MANIFEST,
};

const pluginCompatTag = {
  name: '@grafana/plugin-compat',
  version: '0.12.0',
  tag: PLUGIN_COMPAT_TAG,
  path: 'packages/grafana-plugin-compat',
  commit: 'm1',
};

function versionPr(
  number: number,
  mergeCommit: string,
  before: VersionedPr['before'],
  after: VersionedPr['after']
): VersionedPr {
  return { number, mergeCommit, before, after };
}

const bumpedToV12 = versionPr(7, 'm1', { [MANIFEST]: '0.11.0' }, { [MANIFEST]: '0.12.0' });

describe('planReleaseTags', () => {
  it('plans nothing when no version PR is pending', () => {
    expect(planReleaseTags([pluginCompat], 'head', [])).toEqual({
      plan: { pr: null, sha: 'head', tagged: [] },
      warnings: [],
    });
  });

  it('plans the tags of a pending version PR at its merge commit', () => {
    expect(planReleaseTags([pluginCompat], 'head', [bumpedToV12])).toEqual({
      plan: { pr: 7, sha: 'm1', tagged: [pluginCompatTag] },
      warnings: [],
    });
  });

  it('does not plan a package whose version the PR left unchanged', () => {
    const pr = versionPr(
      7,
      'm1',
      { [MANIFEST]: '0.11.0', [OTHER_MANIFEST]: '1.0.0' },
      { [MANIFEST]: '0.12.0', [OTHER_MANIFEST]: '1.0.0' }
    );

    const { plan } = planReleaseTags([pluginCompat, other], 'head', [pr]);

    expect(plan.tagged.map(({ tag }) => tag)).toEqual([PLUGIN_COMPAT_TAG]);
  });

  it('plans every package whose version changed in the same PR', () => {
    const pr = versionPr(
      7,
      'm1',
      { [MANIFEST]: '0.11.0', [OTHER_MANIFEST]: '1.0.0' },
      { [MANIFEST]: '0.12.0', [OTHER_MANIFEST]: '1.1.0' }
    );

    const { plan } = planReleaseTags([pluginCompat, other], 'head', [pr]);

    expect(plan.tagged.map(({ tag }) => tag)).toEqual([PLUGIN_COMPAT_TAG, '@grafana/other@1.1.0']);
  });

  it('treats a package that did not exist before the PR as changed', () => {
    const pr = versionPr(7, 'm1', { [MANIFEST]: null }, { [MANIFEST]: '0.1.0' });

    const { plan } = planReleaseTags([pluginCompat], 'head', [pr]);

    expect(plan.tagged.map(({ tag }) => tag)).toEqual(['@grafana/plugin-compat@0.1.0']);
  });

  it('plans only the oldest pending PR and warns that the others wait for a later run', () => {
    const second = versionPr(9, 'm2', { [MANIFEST]: '0.12.0' }, { [MANIFEST]: '0.13.0' });

    const { plan, warnings } = planReleaseTags([pluginCompat], 'head', [bumpedToV12, second]);

    expect(plan.pr).toBe(7);
    expect(plan.sha).toBe('m1');
    expect(warnings).toEqual(['PR #9 is also labelled nx-release:pending. A later run will finish it.']);
  });

  it('skips a pending PR that changes no version and plans the next one', () => {
    const noChange = versionPr(7, 'm1', { [MANIFEST]: '0.11.0' }, { [MANIFEST]: '0.11.0' });
    const next = versionPr(9, 'm2', { [MANIFEST]: '0.11.0' }, { [MANIFEST]: '0.12.0' });

    const { plan, warnings } = planReleaseTags([pluginCompat], 'head', [noChange, next]);

    expect(plan.pr).toBe(9);
    expect(plan.sha).toBe('m2');
    expect(warnings).toEqual([
      'PR #7 is labelled nx-release:pending but changes no independent package version. Leaving it alone.',
    ]);
  });

  it('warns and plans nothing when the only pending PR changes no independent package version', () => {
    const noChange = versionPr(7, 'm1', { [MANIFEST]: '0.11.0' }, { [MANIFEST]: '0.11.0' });

    expect(planReleaseTags([pluginCompat], 'head', [noChange])).toEqual({
      plan: { pr: null, sha: 'head', tagged: [] },
      warnings: ['PR #7 is labelled nx-release:pending but changes no independent package version. Leaving it alone.'],
    });
  });

  it('reports the merge commit of the PR, not the pushed commit, when they differ', () => {
    expect(planReleaseTags([pluginCompat], 'later', [bumpedToV12]).plan.sha).toBe('m1');
  });
});

describe('resolveDispatchTags', () => {
  const packages = [pluginCompat, other];

  it('resolves the given tags to the commit they point at, reading the version after the last @', () => {
    const commits = { [PLUGIN_COMPAT_TAG]: 'm1', '@grafana/other@1.1.0': 'm1' };

    expect(resolveDispatchTags([PLUGIN_COMPAT_TAG, '@grafana/other@1.1.0'], packages, commits)).toEqual({
      pr: null,
      sha: 'm1',
      tagged: [
        pluginCompatTag,
        {
          name: '@grafana/other',
          version: '1.1.0',
          tag: '@grafana/other@1.1.0',
          path: 'packages/grafana-other',
          commit: 'm1',
        },
      ],
    });
  });

  it('rejects an empty list', () => {
    expect(() => resolveDispatchTags([], packages, {})).toThrow('Pass at least one tag to publish.');
  });

  it.each(['plugin-compat', '@grafana', '@grafana/plugin-compat@'])(
    'rejects %s because it is not name@version',
    (tag) => {
      expect(() => resolveDispatchTags([tag], packages, {})).toThrow(`Invalid tag ${tag}: expected name@version.`);
    }
  );

  it('rejects a package that is not independent', () => {
    expect(() => resolveDispatchTags(['@grafana/data@1.0.0'], packages, {})).toThrow(
      'Tag @grafana/data@1.0.0 is not an independent package.'
    );
  });

  it('rejects a tag that does not exist', () => {
    expect(() => resolveDispatchTags([PLUGIN_COMPAT_TAG], packages, { [PLUGIN_COMPAT_TAG]: null })).toThrow(
      `Tag ${PLUGIN_COMPAT_TAG} does not exist.`
    );
  });

  it('rejects tags that point at different commits', () => {
    const commits = { [PLUGIN_COMPAT_TAG]: 'm1', '@grafana/other@1.1.0': 'm2' };

    expect(() => resolveDispatchTags([PLUGIN_COMPAT_TAG, '@grafana/other@1.1.0'], packages, commits)).toThrow(
      'Tags point at different commits: m1, m2.'
    );
  });
});

describe('selectPendingPrs', () => {
  const pending = [{ name: 'nx-release:pending' }];

  function closedPr(overrides: Partial<ClosedPr> & { number: number }): ClosedPr {
    return {
      merged_at: '2026-11-10T10:00:00Z',
      merge_commit_sha: `merge-${overrides.number}`,
      labels: pending,
      ...overrides,
    };
  }

  it('keeps merged pull requests that carry the pending label', () => {
    expect(selectPendingPrs([closedPr({ number: 1 })])).toEqual([{ number: 1, mergeCommit: 'merge-1' }]);
  });

  it('drops pull requests that were closed without merging', () => {
    expect(selectPendingPrs([closedPr({ number: 1, merged_at: null, merge_commit_sha: null })])).toEqual([]);
  });

  it('drops pull requests without the pending label, including the tagged ones', () => {
    const tagged = [{ name: 'nx-release:tagged' }];

    expect(selectPendingPrs([closedPr({ number: 1, labels: [] }), closedPr({ number: 2, labels: tagged })])).toEqual(
      []
    );
  });

  it('orders the result by merge time, oldest first, whatever order GitHub returned', () => {
    const prs = [
      closedPr({ number: 3, merged_at: '2026-11-12T10:00:00Z' }),
      closedPr({ number: 1, merged_at: '2026-11-10T10:00:00Z' }),
      closedPr({ number: 2, merged_at: '2026-11-11T10:00:00Z' }),
    ];

    expect(selectPendingPrs(prs).map(({ number }) => number)).toEqual([1, 2, 3]);
  });
});

describe('formatOutputs', () => {
  it('reports no release, no PR and an empty list when nothing is planned', () => {
    expect(formatOutputs({ pr: null, sha: 'head', tagged: [] })).toEqual({
      pr: '',
      release_created: 'false',
      tagged: '[]',
      matrix: '{"include":[]}',
      sha: 'head',
    });
  });

  it('reports the PR, the planned tags as one line of JSON, and the same list as a job matrix', () => {
    const outputs = formatOutputs({ pr: 7, sha: 'm1', tagged: [pluginCompatTag] });

    expect(outputs).toEqual({
      pr: '7',
      release_created: 'true',
      tagged: JSON.stringify([pluginCompatTag]),
      matrix: JSON.stringify({ include: [pluginCompatTag] }),
      sha: 'm1',
    });
    expect(Object.values(outputs).every((value) => !value.includes('\n'))).toBe(true);
  });
});

describe('readTags', () => {
  it('is empty when no tags were given', () => {
    expect(readTags({})).toBeUndefined();
  });

  it('treats an unset workflow input, which GitHub passes as an empty string, as not given', () => {
    expect(readTags({ TAGS: '' })).toBeUndefined();
    expect(readTags({ TAGS: '  ' })).toBeUndefined();
  });

  it('reads a comma separated list', () => {
    expect(readTags({ TAGS: 'a@1, b@2' })).toEqual(['a@1', 'b@2']);
  });
});
