import { describe, expect, it } from 'vitest';

import GrafanaVersionActions from './version-actions';

type Actions = GrafanaVersionActions;
type Tree = Parameters<Actions['updateProjectVersion']>[0];
type ProjectGraph = Parameters<Actions['updateProjectDependencies']>[1];
type ConstructorArgs = ConstructorParameters<typeof GrafanaVersionActions>;

function createTree(files: Record<string, object>) {
  const contents = new Map(Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]));
  const tree = {
    root: '/workspace',
    exists: (path: string) => contents.has(path),
    read: (path: string) => (contents.has(path) ? Buffer.from(contents.get(path)!) : null),
    write: (path: string, content: string) => contents.set(path, content),
  };
  return {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    tree: tree as unknown as Tree,
    readJson: (path: string) => JSON.parse(contents.get(path)!),
  };
}

function createProjectGraph(projectToPackageName: Record<string, string>) {
  const nodes = Object.fromEntries(
    Object.entries(projectToPackageName).map(([project, packageName]) => [
      project,
      { name: project, type: 'lib', data: { root: '', metadata: { js: { packageName } } } },
    ])
  );
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { nodes, dependencies: {} } as unknown as ProjectGraph;
}

async function createActions(tree: Tree, root = 'packages/grafana-ui') {
  const actions = new GrafanaVersionActions(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    { name: 'grafana' } as unknown as ConstructorArgs[0],
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    { name: '@grafana/ui', type: 'lib', data: { root } } as unknown as ConstructorArgs[1],
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    { manifestRootsToUpdate: [], preserveLocalDependencyProtocols: true } as unknown as ConstructorArgs[2]
  );
  await actions.init(tree);
  return actions;
}

const manifestPath = 'packages/grafana-ui/package.json';
const projectGraph = createProjectGraph({
  'grafana-data': '@grafana/data',
  'grafana-schema': '@grafana/schema',
  'grafana-runtime': '@grafana/runtime',
  'grafana-i18n': '@grafana/i18n',
});

describe('GrafanaVersionActions', () => {
  it('reads the current version from the project package.json', async () => {
    const { tree } = createTree({ [manifestPath]: { name: '@grafana/ui', version: '13.3.0-pre' } });
    const actions = await createActions(tree);

    expect(await actions.readCurrentVersionFromSourceManifest(tree)).toEqual({
      currentVersion: '13.3.0-pre',
      manifestPath,
    });
  });

  it('throws when the project package.json has no version', async () => {
    const { tree } = createTree({ [manifestPath]: { name: '@grafana/ui' } });
    const actions = await createActions(tree);

    await expect(actions.readCurrentVersionFromSourceManifest(tree)).rejects.toThrow(/version/);
  });

  it('writes the new version to the project package.json', async () => {
    const { tree, readJson } = createTree({ [manifestPath]: { name: '@grafana/ui', version: '13.3.0-pre' } });
    const actions = await createActions(tree);

    await actions.updateProjectVersion(tree, '13.4.0-123456');

    expect(readJson(manifestPath).version).toBe('13.4.0-123456');
  });

  it('pins sibling dependencies to the new version and leaves everything else alone', async () => {
    const { tree, readJson } = createTree({
      [manifestPath]: {
        name: '@grafana/ui',
        version: '13.3.0-pre',
        dependencies: { '@grafana/data': '13.3.0-pre', '@grafana/i18n': 'workspace:*', lodash: '4.17.21' },
        devDependencies: { '@grafana/schema': '13.3.0-pre' },
        optionalDependencies: { '@grafana/runtime': 'link:../grafana-runtime' },
        peerDependencies: { '@grafana/runtime': '>=11.6' },
      },
    });
    const actions = await createActions(tree);

    await actions.updateProjectDependencies(tree, projectGraph, {
      'grafana-data': '13.4.0-pre',
      'grafana-schema': '13.4.0-pre',
      'grafana-runtime': '13.4.0-pre',
      'grafana-i18n': '13.4.0-pre',
    });

    const packageJson = readJson(manifestPath);
    expect(packageJson.dependencies).toEqual({
      '@grafana/data': '13.4.0-pre',
      '@grafana/i18n': 'workspace:*',
      lodash: '4.17.21',
    });
    expect(packageJson.devDependencies).toEqual({ '@grafana/schema': '13.4.0-pre' });
    expect(packageJson.optionalDependencies).toEqual({ '@grafana/runtime': 'link:../grafana-runtime' });
    expect(packageJson.peerDependencies).toEqual({ '@grafana/runtime': '>=11.6' });
  });

  it('reads the current spec of a sibling dependency, ignoring peerDependencies', async () => {
    const { tree } = createTree({
      [manifestPath]: {
        name: '@grafana/ui',
        version: '13.3.0-pre',
        devDependencies: { '@grafana/schema': '13.3.0-pre' },
        peerDependencies: { '@grafana/runtime': '>=11.6' },
      },
    });
    const actions = await createActions(tree);

    expect(await actions.readCurrentVersionOfDependency(tree, projectGraph, 'grafana-schema')).toEqual({
      currentVersion: '13.3.0-pre',
      dependencyCollection: 'devDependencies',
    });
    expect(await actions.readCurrentVersionOfDependency(tree, projectGraph, 'grafana-runtime')).toEqual({
      currentVersion: null,
      dependencyCollection: null,
    });
  });
});
