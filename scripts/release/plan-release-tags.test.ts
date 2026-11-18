import { describe, expect, it } from 'vitest';

import type { IndependentPackage } from './lib/independent-packages.mjs';
import {
  formatOutputs,
  planReleaseTags,
  readTags,
  resolveDispatchTags,
  selectPendingPrs,
  type ClosedPr,
  type Deps,
  type PendingPr,
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

interface Setup {
  packages?: IndependentPackage[];
  sha?: string;
  pendingPrs?: PendingPr[];
  versions?: Record<string, string>;
  parents?: Record<string, string>;
  tags?: Record<string, string>;
}

function createFakeDeps({
  packages = [pluginCompat],
  sha = 'head',
  pendingPrs = [],
  versions = {},
  parents = {},
  tags = {},
}: Setup = {}) {
  const messages: string[] = [];

  const deps: Deps = {
    packages,
    sha,
    listPendingPrs: () => pendingPrs,
    parentOf: (commit) => parents[commit],
    readVersionAt: (commit, manifestPath) => versions[`${commit}:${manifestPath}`] ?? null,
    tagCommit: (tag) => tags[tag] ?? null,
    warning: (message) => messages.push(`warning: ${message}`),
  };
  return { deps, messages };
}

const versionPr = { pendingPrs: [{ number: 7, mergeCommit: 'm1' }], parents: { m1: 'p1' } };
const bumpedToV12 = { [`m1:${MANIFEST}`]: '0.12.0', [`p1:${MANIFEST}`]: '0.11.0' };
const pluginCompatTag = {
  name: '@grafana/plugin-compat',
  version: '0.12.0',
  tag: PLUGIN_COMPAT_TAG,
  path: 'packages/grafana-plugin-compat',
  commit: 'm1',
};

describe('planReleaseTags', () => {
  it('plans nothing when no version PR is pending', () => {
    const { deps } = createFakeDeps();

    expect(planReleaseTags(deps)).toEqual({ pr: null, sha: 'head', tagged: [] });
  });

  it('plans the tags of a pending version PR at its merge commit', () => {
    const { deps } = createFakeDeps({ ...versionPr, versions: bumpedToV12 });

    expect(planReleaseTags(deps)).toEqual({ pr: 7, sha: 'm1', tagged: [pluginCompatTag] });
  });

  it('does not plan a package whose version the PR left unchanged', () => {
    const { deps } = createFakeDeps({
      ...versionPr,
      packages: [pluginCompat, other],
      versions: { ...bumpedToV12, [`m1:${OTHER_MANIFEST}`]: '1.0.0', [`p1:${OTHER_MANIFEST}`]: '1.0.0' },
    });

    expect(planReleaseTags(deps).tagged.map((planned) => planned.tag)).toEqual([PLUGIN_COMPAT_TAG]);
  });

  it('plans every package whose version changed in the same PR', () => {
    const { deps } = createFakeDeps({
      ...versionPr,
      packages: [pluginCompat, other],
      versions: { ...bumpedToV12, [`m1:${OTHER_MANIFEST}`]: '1.1.0', [`p1:${OTHER_MANIFEST}`]: '1.0.0' },
    });

    expect(planReleaseTags(deps).tagged.map((planned) => planned.tag)).toEqual([
      PLUGIN_COMPAT_TAG,
      '@grafana/other@1.1.0',
    ]);
  });

  it('treats a package that did not exist before the PR as changed', () => {
    const { deps } = createFakeDeps({ ...versionPr, versions: { [`m1:${MANIFEST}`]: '0.1.0' } });

    expect(planReleaseTags(deps).tagged.map((planned) => planned.tag)).toEqual(['@grafana/plugin-compat@0.1.0']);
  });

  it('plans only the oldest pending PR and warns that the others wait for a later run', () => {
    const { deps, messages } = createFakeDeps({
      pendingPrs: [
        { number: 7, mergeCommit: 'm1' },
        { number: 9, mergeCommit: 'm2' },
      ],
      parents: { m1: 'p1', m2: 'm1' },
      versions: {
        [`p1:${MANIFEST}`]: '0.11.0',
        [`m1:${MANIFEST}`]: '0.12.0',
        [`m2:${MANIFEST}`]: '0.13.0',
      },
    });

    const plan = planReleaseTags(deps);

    expect(plan.pr).toBe(7);
    expect(plan.sha).toBe('m1');
    expect(messages).toEqual(['warning: PR #9 is also labelled nx-release:pending. A later run will finish it.']);
  });

  it('skips a pending PR that changes no version and plans the next one', () => {
    const { deps, messages } = createFakeDeps({
      pendingPrs: [
        { number: 7, mergeCommit: 'm1' },
        { number: 9, mergeCommit: 'm2' },
      ],
      parents: { m1: 'p1', m2: 'm1' },
      versions: {
        [`p1:${MANIFEST}`]: '0.11.0',
        [`m1:${MANIFEST}`]: '0.11.0',
        [`m2:${MANIFEST}`]: '0.12.0',
      },
    });

    const plan = planReleaseTags(deps);

    expect(plan.pr).toBe(9);
    expect(plan.sha).toBe('m2');
    expect(messages).toEqual([
      'warning: PR #7 is labelled nx-release:pending but changes no independent package version. Leaving it alone.',
    ]);
  });

  it('warns and plans nothing when the only pending PR changes no independent package version', () => {
    const { deps, messages } = createFakeDeps({
      ...versionPr,
      versions: { [`m1:${MANIFEST}`]: '0.11.0', [`p1:${MANIFEST}`]: '0.11.0' },
    });

    expect(planReleaseTags(deps)).toEqual({ pr: null, sha: 'head', tagged: [] });
    expect(messages).toEqual([
      'warning: PR #7 is labelled nx-release:pending but changes no independent package version. Leaving it alone.',
    ]);
  });

  it('reports the merge commit of the PR, not the pushed commit, when they differ', () => {
    const { deps } = createFakeDeps({ ...versionPr, sha: 'later', versions: bumpedToV12 });

    expect(planReleaseTags(deps).sha).toBe('m1');
  });
});

describe('resolveDispatchTags', () => {
  const distinctTags = { '@grafana/plugin-compat@0.12.0': 'm1', '@grafana/other@1.1.0': 'm1' };

  it('resolves the given tags to the commit they point at, reading the version after the last @', () => {
    const { deps } = createFakeDeps({ packages: [pluginCompat, other], tags: distinctTags });

    expect(resolveDispatchTags([PLUGIN_COMPAT_TAG, '@grafana/other@1.1.0'], deps)).toEqual({
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
    expect(() => resolveDispatchTags([], createFakeDeps().deps)).toThrow('Pass at least one tag to publish.');
  });

  it.each(['plugin-compat', '@grafana', '@grafana/plugin-compat@'])(
    'rejects %s because it is not name@version',
    (tag) => {
      expect(() => resolveDispatchTags([tag], createFakeDeps().deps)).toThrow(
        `Invalid tag ${tag}: expected name@version.`
      );
    }
  );

  it('rejects a package that is not independent', () => {
    expect(() => resolveDispatchTags(['@grafana/data@1.0.0'], createFakeDeps().deps)).toThrow(
      'Tag @grafana/data@1.0.0 is not an independent package.'
    );
  });

  it('rejects a tag that does not exist', () => {
    expect(() => resolveDispatchTags([PLUGIN_COMPAT_TAG], createFakeDeps().deps)).toThrow(
      `Tag ${PLUGIN_COMPAT_TAG} does not exist.`
    );
  });

  it('rejects tags that point at different commits', () => {
    const { deps } = createFakeDeps({
      packages: [pluginCompat, other],
      tags: { '@grafana/plugin-compat@0.12.0': 'm1', '@grafana/other@1.1.0': 'm2' },
    });

    expect(() => resolveDispatchTags([PLUGIN_COMPAT_TAG, '@grafana/other@1.1.0'], deps)).toThrow(
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
