import { describe, expect, it } from 'vitest';

import { parseArgs, selectUnpublished } from './select-unpublished-npm-packages.mjs';

type Manifest = { name: string; version: string };

interface Setup {
  tarballs?: Record<string, Manifest>;
  npmView?: (spec: string) => { exitCode: number; output: string };
}

const PUBLISHED = { exitCode: 0, output: '0.7.0' };
const NOT_FOUND = { exitCode: 1, output: 'npm error code E404\nnpm error 404 Not Found' };

function createDeps({ tarballs = {}, npmView = () => NOT_FOUND }: Setup = {}) {
  const files = new Map(Object.entries(tarballs));
  const removed: string[] = [];
  const registries: string[] = [];
  const logs: string[] = [];

  const deps = {
    listTarballs: () => [...files.keys()],
    readTarballManifest: (file: string) => files.get(file)!,
    npmView: (name: string, version: string, registry: string) => {
      registries.push(registry);
      return npmView(`${name}@${version}`);
    },
    removeFile: (file: string) => {
      removed.push(file);
      files.delete(file);
    },
    log: (message: string) => logs.push(message),
  };
  return { deps, files, removed, registries, logs };
}

const compat = (version: string): Manifest => ({ name: '@grafana/plugin-compat', version });

describe('parseArgs', () => {
  it('defaults to the artifacts folder and the public npm registry', () => {
    expect(parseArgs([])).toEqual({ dir: './npm-artifacts', registry: 'https://registry.npmjs.org/' });
  });

  it('uses the folder and registry that are given', () => {
    expect(parseArgs(['./out', 'http://localhost:4873'])).toEqual({ dir: './out', registry: 'http://localhost:4873' });
    expect(parseArgs(['./out'])).toEqual({ dir: './out', registry: 'https://registry.npmjs.org/' });
  });
});

describe('selectUnpublished', () => {
  it('removes a tarball whose version is already on npm', () => {
    const { deps, removed, logs } = createDeps({
      tarballs: { 'a.tgz': compat('0.7.0') },
      npmView: () => PUBLISHED,
    });

    selectUnpublished('./npm-artifacts', 'https://registry.npmjs.org/', deps);

    expect(removed).toEqual(['a.tgz']);
    expect(logs).toEqual(['@grafana/plugin-compat@0.7.0 is already published, skipping.']);
  });

  it('keeps a tarball whose version is not on npm yet', () => {
    const { deps, removed, logs } = createDeps({ tarballs: { 'a.tgz': compat('0.7.1') } });

    selectUnpublished('./npm-artifacts', 'https://registry.npmjs.org/', deps);

    expect(removed).toEqual([]);
    expect(logs).toEqual(['@grafana/plugin-compat@0.7.1 is not published yet.']);
  });

  it('checks the name and version found inside each tarball, against the given registry', () => {
    const { deps, registries } = createDeps({
      tarballs: { 'a.tgz': compat('0.7.1') },
      npmView: (spec) => {
        expect(spec).toBe('@grafana/plugin-compat@0.7.1');
        return NOT_FOUND;
      },
    });

    selectUnpublished('./npm-artifacts', 'http://localhost:4873', deps);

    expect(registries).toEqual(['http://localhost:4873']);
  });

  it('fails on a prerelease before asking npm and keeps the tarball', () => {
    const asked: string[] = [];
    const { deps, removed } = createDeps({
      tarballs: { 'a.tgz': compat('0.8.0-beta.1') },
      npmView: (spec) => {
        asked.push(spec);
        return NOT_FOUND;
      },
    });

    expect(() => selectUnpublished('./npm-artifacts', 'https://registry.npmjs.org/', deps)).toThrow(
      '@grafana/plugin-compat@0.8.0-beta.1 is a prerelease, but this workflow publishes stable versions to the latest dist-tag only.'
    );
    expect(asked).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('does not treat build metadata as a prerelease', () => {
    const { deps, logs } = createDeps({ tarballs: { 'a.tgz': compat('0.7.1+build.5') } });

    selectUnpublished('./npm-artifacts', 'https://registry.npmjs.org/', deps);

    expect(logs).toEqual(['@grafana/plugin-compat@0.7.1+build.5 is not published yet.']);
  });

  it('fails and keeps the tarball when npm cannot be reached, showing the npm output', () => {
    const { deps, removed } = createDeps({
      tarballs: { 'a.tgz': compat('0.7.1') },
      npmView: () => ({ exitCode: 1, output: 'npm error code ECONNREFUSED' }),
    });

    expect(() => selectUnpublished('./npm-artifacts', 'http://127.0.0.1:9', deps)).toThrow(
      'Could not check whether @grafana/plugin-compat@0.7.1 is published:\nnpm error code ECONNREFUSED'
    );
    expect(removed).toEqual([]);
  });

  it('does nothing for an empty folder', () => {
    const { deps, removed, logs, registries } = createDeps();

    selectUnpublished('./npm-artifacts', 'https://registry.npmjs.org/', deps);

    expect(removed).toEqual([]);
    expect(logs).toEqual([]);
    expect(registries).toEqual([]);
  });

  it('removes only the published tarballs when there are several', () => {
    const { deps, files } = createDeps({
      tarballs: {
        'compat.tgz': compat('0.7.0'),
        'ui.tgz': { name: '@grafana/ui', version: '13.5.0' },
      },
      npmView: (spec) => (spec === '@grafana/plugin-compat@0.7.0' ? PUBLISHED : NOT_FOUND),
    });

    selectUnpublished('./npm-artifacts', 'https://registry.npmjs.org/', deps);

    expect([...files.keys()]).toEqual(['ui.tgz']);
  });

  it('stops at the first problem and leaves the removals made before it', () => {
    const { deps, removed } = createDeps({
      tarballs: {
        'a.tgz': compat('0.7.0'),
        'b.tgz': { name: '@grafana/ui', version: '13.5.0' },
        'c.tgz': { name: '@grafana/data', version: '13.5.0' },
      },
      npmView: (spec) =>
        spec === '@grafana/plugin-compat@0.7.0'
          ? PUBLISHED
          : spec === '@grafana/ui@13.5.0'
            ? { exitCode: 1, output: 'npm error code ETIMEDOUT' }
            : NOT_FOUND,
    });

    expect(() => selectUnpublished('./npm-artifacts', 'https://registry.npmjs.org/', deps)).toThrow(
      'Could not check whether @grafana/ui@13.5.0 is published'
    );
    expect(removed).toEqual(['a.tgz']);
  });
});
