import { describe, expect, it } from 'vitest';

import type { IndependentPackage } from './lib/packages.mjs';
import {
  formatOutputs,
  readOptions,
  resolveDispatchTags,
  tagMergedVersionPrs,
  type Deps,
  type ExistingTag,
  type PendingPr,
} from './tag-merged-version-prs.mjs';

const MANIFEST = 'packages/grafana-plugin-compat/package.json';
const OTHER_MANIFEST = 'packages/grafana-other/package.json';
const PLUGIN_COMPAT_TAG = '@grafana/plugin-compat@0.12.0';

const pluginCompat: IndependentPackage = {
  group: 'plugin-compat',
  name: '@grafana/plugin-compat',
  root: 'packages/grafana-plugin-compat',
  manifestPath: MANIFEST,
};
const other: IndependentPackage = {
  group: 'plugin-compat',
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
  tags?: Record<string, ExistingTag>;
  createTagFails?: string[];
}

function createFakeDeps({
  packages = [pluginCompat],
  sha = 'head',
  pendingPrs = [],
  versions = {},
  parents = {},
  tags = {},
  createTagFails = [],
}: Setup = {}) {
  const existing = new Map(Object.entries(tags));
  const calls: string[] = [];
  const messages: string[] = [];

  const deps: Deps = {
    packages,
    sha,
    listPendingPrs: () => pendingPrs,
    parentOf: (commit) => parents[commit],
    readVersionAt: (commit, manifestPath) => versions[`${commit}:${manifestPath}`] ?? null,
    existingTag: (tag) => existing.get(tag) ?? null,
    createTag: (tag, commit) => {
      if (createTagFails.includes(tag)) {
        throw new Error(`cannot create ${tag}`);
      }
      calls.push(`createTag ${tag} ${commit}`);
      existing.set(tag, { annotated: true, commit });
    },
    swapLabel: (pr) => {
      calls.push(`swapLabel ${pr}`);
    },
    notice: (message) => messages.push(`notice: ${message}`),
    warning: (message) => messages.push(`warning: ${message}`),
  };
  return { deps, calls, messages };
}

const versionPr = { pendingPrs: [{ number: 7, mergeCommit: 'm1' }], parents: { m1: 'p1' } };
const bumpedToV12 = { [`m1:${MANIFEST}`]: '0.12.0', [`p1:${MANIFEST}`]: '0.11.0' };

describe('tagMergedVersionPrs', () => {
  it('does nothing when no version PR is pending and nothing is tagged at the pushed commit', () => {
    const { deps, calls } = createFakeDeps();

    expect(tagMergedVersionPrs(deps)).toEqual({ sha: 'head', tagged: [] });
    expect(calls).toEqual([]);
  });

  it('tags the merge commit of a pending version PR and only then swaps its label', () => {
    const { deps, calls } = createFakeDeps({ ...versionPr, sha: 'm1', versions: bumpedToV12 });

    const result = tagMergedVersionPrs(deps);

    expect(calls).toEqual([`createTag ${PLUGIN_COMPAT_TAG} m1`, 'swapLabel 7']);
    expect(result).toEqual({
      sha: 'm1',
      tagged: [
        {
          name: '@grafana/plugin-compat',
          version: '0.12.0',
          tag: PLUGIN_COMPAT_TAG,
          path: 'packages/grafana-plugin-compat',
        },
      ],
    });
  });

  it('does not tag a package whose version the PR left unchanged', () => {
    const { deps, calls } = createFakeDeps({
      ...versionPr,
      packages: [pluginCompat, other],
      versions: { ...bumpedToV12, [`m1:${OTHER_MANIFEST}`]: '1.0.0', [`p1:${OTHER_MANIFEST}`]: '1.0.0' },
    });

    tagMergedVersionPrs(deps);

    expect(calls).toEqual([`createTag ${PLUGIN_COMPAT_TAG} m1`, 'swapLabel 7']);
  });

  it('tags every package whose version changed in the same PR before swapping the label', () => {
    const { deps, calls } = createFakeDeps({
      ...versionPr,
      packages: [pluginCompat, other],
      versions: { ...bumpedToV12, [`m1:${OTHER_MANIFEST}`]: '1.1.0', [`p1:${OTHER_MANIFEST}`]: '1.0.0' },
    });

    tagMergedVersionPrs(deps);

    expect(calls).toEqual([`createTag ${PLUGIN_COMPAT_TAG} m1`, 'createTag @grafana/other@1.1.0 m1', 'swapLabel 7']);
  });

  it('treats a package that did not exist before the PR as changed', () => {
    const { deps, calls } = createFakeDeps({ ...versionPr, versions: { [`m1:${MANIFEST}`]: '0.1.0' } });

    tagMergedVersionPrs(deps);

    expect(calls).toEqual(['createTag @grafana/plugin-compat@0.1.0 m1', 'swapLabel 7']);
  });

  it('finishes only the oldest pending PR and warns that the others wait for a later run', () => {
    const { deps, calls, messages } = createFakeDeps({
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

    const result = tagMergedVersionPrs(deps);

    expect(calls).toEqual([`createTag ${PLUGIN_COMPAT_TAG} m1`, 'swapLabel 7']);
    expect(result.sha).toBe('m1');
    expect(messages).toEqual(['warning: PR #9 is also labelled nx-release:pending. A later run will finish it.']);
  });

  it('skips a pending PR that changes no version and finishes the next one', () => {
    const { deps, calls, messages } = createFakeDeps({
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

    const result = tagMergedVersionPrs(deps);

    expect(calls).toEqual([`createTag ${PLUGIN_COMPAT_TAG} m2`, 'swapLabel 9']);
    expect(result.sha).toBe('m2');
    expect(messages).toEqual([
      'warning: PR #7 is labelled nx-release:pending but changes no independent package version. Leaving it alone.',
    ]);
  });

  it('accepts an annotated tag that already exists at the merge commit and still swaps the label', () => {
    const { deps, calls } = createFakeDeps({
      ...versionPr,
      versions: bumpedToV12,
      tags: { [PLUGIN_COMPAT_TAG]: { annotated: true, commit: 'm1' } },
    });

    const result = tagMergedVersionPrs(deps);

    expect(calls).toEqual(['swapLabel 7']);
    expect(result.tagged.map((pkg) => pkg.tag)).toEqual([PLUGIN_COMPAT_TAG]);
  });

  it('fails and leaves the label alone when the tag already exists at another commit', () => {
    const { deps, calls } = createFakeDeps({
      ...versionPr,
      versions: bumpedToV12,
      tags: { [PLUGIN_COMPAT_TAG]: { annotated: true, commit: 'old' } },
    });

    expect(() => tagMergedVersionPrs(deps)).toThrow(
      `Tag ${PLUGIN_COMPAT_TAG} already exists but points at old, not m1.`
    );
    expect(calls).toEqual([]);
  });

  it('fails when the tag already exists as a lightweight tag', () => {
    const { deps, calls } = createFakeDeps({
      ...versionPr,
      versions: bumpedToV12,
      tags: { [PLUGIN_COMPAT_TAG]: { annotated: false, commit: 'm1' } },
    });

    expect(() => tagMergedVersionPrs(deps)).toThrow(
      `Tag ${PLUGIN_COMPAT_TAG} already exists as a lightweight tag; expected an annotated tag.`
    );
    expect(calls).toEqual([]);
  });

  it('leaves the label alone when creating one of the tags fails', () => {
    const { deps, calls } = createFakeDeps({
      ...versionPr,
      packages: [pluginCompat, other],
      versions: { ...bumpedToV12, [`m1:${OTHER_MANIFEST}`]: '1.1.0', [`p1:${OTHER_MANIFEST}`]: '1.0.0' },
      createTagFails: ['@grafana/other@1.1.0'],
    });

    expect(() => tagMergedVersionPrs(deps)).toThrow('cannot create @grafana/other@1.1.0');
    expect(calls).toEqual([`createTag ${PLUGIN_COMPAT_TAG} m1`]);
  });

  it('warns and leaves the label when a pending PR changes no independent package version', () => {
    const { deps, calls, messages } = createFakeDeps({
      ...versionPr,
      versions: { [`m1:${MANIFEST}`]: '0.11.0', [`p1:${MANIFEST}`]: '0.11.0' },
    });

    tagMergedVersionPrs(deps);

    expect(calls).toEqual([]);
    expect(messages).toEqual([
      'warning: PR #7 is labelled nx-release:pending but changes no independent package version. Leaving it alone.',
    ]);
  });

  it('reports the tags created now and the commit they point at, even when the pushed commit is a later one', () => {
    const { deps } = createFakeDeps({ ...versionPr, sha: 'later', versions: bumpedToV12 });

    const result = tagMergedVersionPrs(deps);

    expect(result.tagged.map((pkg) => pkg.tag)).toEqual([PLUGIN_COMPAT_TAG]);
    expect(result.sha).toBe('m1');
  });

  it('reports the tags that point at the pushed commit even when nothing is pending, so a re-run still publishes', () => {
    const { deps, calls } = createFakeDeps({
      sha: 'm1',
      versions: { [`m1:${MANIFEST}`]: '0.12.0' },
      tags: { [PLUGIN_COMPAT_TAG]: { annotated: true, commit: 'm1' } },
    });

    const result = tagMergedVersionPrs(deps);

    expect(calls).toEqual([]);
    expect(result.tagged.map((pkg) => pkg.tag)).toEqual([PLUGIN_COMPAT_TAG]);
  });

  it('does not report a tag that points at an older commit, as on a normal merge', () => {
    const { deps } = createFakeDeps({
      sha: 'x',
      versions: { [`x:${MANIFEST}`]: '0.11.0' },
      tags: { '@grafana/plugin-compat@0.11.0': { annotated: true, commit: 'bootstrap' } },
    });

    expect(tagMergedVersionPrs(deps).tagged).toEqual([]);
  });

  it('writes nothing in a dry run and says what it would do', () => {
    const { deps, calls, messages } = createFakeDeps({ ...versionPr, versions: bumpedToV12 });

    const result = tagMergedVersionPrs(deps, { dryRun: true });

    expect(calls).toEqual([]);
    expect(result.tagged).toEqual([]);
    expect(messages).toEqual([
      `notice: Dry run: would tag ${PLUGIN_COMPAT_TAG} at m1.`,
      'notice: Dry run: would swap the label of PR #7 to nx-release:tagged.',
    ]);
  });
});

describe('resolveDispatchTags', () => {
  const distinctTags = {
    '@grafana/plugin-compat@0.12.0': { annotated: true, commit: 'm1' },
    '@grafana/other@1.1.0': { annotated: true, commit: 'm1' },
  };

  it('resolves the given tags to the commit they point at, reading the version after the last @', () => {
    const { deps, calls } = createFakeDeps({ packages: [pluginCompat, other], tags: distinctTags });

    expect(resolveDispatchTags([PLUGIN_COMPAT_TAG, '@grafana/other@1.1.0'], deps)).toEqual({
      sha: 'm1',
      tagged: [
        {
          name: '@grafana/plugin-compat',
          version: '0.12.0',
          tag: PLUGIN_COMPAT_TAG,
          path: 'packages/grafana-plugin-compat',
        },
        { name: '@grafana/other', version: '1.1.0', tag: '@grafana/other@1.1.0', path: 'packages/grafana-other' },
      ],
    });
    expect(calls).toEqual([]);
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
      tags: {
        '@grafana/plugin-compat@0.12.0': { annotated: true, commit: 'm1' },
        '@grafana/other@1.1.0': { annotated: true, commit: 'm2' },
      },
    });

    expect(() => resolveDispatchTags([PLUGIN_COMPAT_TAG, '@grafana/other@1.1.0'], deps)).toThrow(
      'Tags point at different commits: m1, m2.'
    );
  });
});

describe('formatOutputs', () => {
  it('reports no release and an empty list when nothing was tagged', () => {
    expect(formatOutputs({ sha: 'head', tagged: [] })).toEqual({ release_created: 'false', tagged: '[]', sha: 'head' });
  });

  it('reports a release and the tagged packages as one line of JSON', () => {
    const tagged = [{ name: '@grafana/plugin-compat', version: '0.12.0', tag: PLUGIN_COMPAT_TAG, path: 'packages/x' }];

    expect(formatOutputs({ sha: 'm1', tagged })).toEqual({
      release_created: 'true',
      tagged: JSON.stringify(tagged),
      sha: 'm1',
    });
  });
});

describe('readOptions', () => {
  it('defaults to a real run that looks for pending version PRs', () => {
    expect(readOptions({})).toEqual({ dryRun: false, tags: undefined });
  });

  it('treats an unset workflow input, which GitHub passes as an empty string, as not given', () => {
    expect(readOptions({ DRY_RUN: 'false', TAGS: '' })).toEqual({ dryRun: false, tags: undefined });
    expect(readOptions({ TAGS: '  ' })).toEqual({ dryRun: false, tags: undefined });
  });

  it('reads DRY_RUN and a comma separated TAGS', () => {
    expect(readOptions({ DRY_RUN: 'true' })).toEqual({ dryRun: true, tags: undefined });
    expect(readOptions({ TAGS: 'a@1, b@2' })).toEqual({ dryRun: false, tags: ['a@1', 'b@2'] });
  });
});
