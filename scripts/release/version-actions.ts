import { join } from 'node:path';
import { VersionActions } from 'nx/release';

type Tree = Parameters<VersionActions['updateProjectVersion']>[0];
type ProjectGraph = Parameters<VersionActions['updateProjectDependencies']>[1];

// peerDependencies are left out on purpose: their ranges are maintained by hand, as they were with lerna.
const UPDATABLE_COLLECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
type DependencyCollection = (typeof UPDATABLE_COLLECTIONS)[number];

// Local dependency protocols are left unchanged by versioning rather than pinned to a sibling version.
const LOCAL_PROTOCOLS = ['workspace:', 'link:', 'file:', 'portal:'];

type PackageJson = {
  version?: string;
} & Partial<Record<DependencyCollection, Record<string, string>>>;

function readPackageJson(tree: Tree, manifestPath: string): PackageJson {
  const content = tree.read(manifestPath, 'utf-8');
  if (content === null) {
    throw new Error(`Unable to read ${manifestPath}`);
  }
  return JSON.parse(content);
}

function writePackageJson(tree: Tree, manifestPath: string, packageJson: PackageJson) {
  tree.write(manifestPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function packageNameOf(projectGraph: ProjectGraph, projectName: string): string {
  return projectGraph.nodes[projectName]?.data.metadata?.js?.packageName ?? projectName;
}

/**
 * Matches `lerna version --exact`: sibling dependencies are pinned to the new version, local protocols such as
 * `workspace:*` are kept, and peerDependencies are never touched. The @nx/js defaults instead rewrite peer ranges
 * and throw on any prerelease version that falls outside one.
 */
export default class GrafanaVersionActions extends VersionActions {
  validManifestFilenames = ['package.json'];

  async readCurrentVersionFromSourceManifest(tree: Tree) {
    const manifestPath = join(this.projectGraphNode.data.root, 'package.json');
    const { version } = readPackageJson(tree, manifestPath);
    if (!version) {
      throw new Error(
        `Unable to determine the current version of ${this.projectGraphNode.name}: ${manifestPath} has no version field`
      );
    }
    return { currentVersion: version, manifestPath };
  }

  async readCurrentVersionFromRegistry() {
    return null;
  }

  async readCurrentVersionOfDependency(tree: Tree, projectGraph: ProjectGraph, dependencyProjectName: string) {
    const packageJson = readPackageJson(tree, join(this.projectGraphNode.data.root, 'package.json'));
    const dependencyPackageName = packageNameOf(projectGraph, dependencyProjectName);

    for (const collection of UPDATABLE_COLLECTIONS) {
      const currentVersion = packageJson[collection]?.[dependencyPackageName];
      if (currentVersion) {
        return { currentVersion, dependencyCollection: collection };
      }
    }
    return { currentVersion: null, dependencyCollection: null };
  }

  async updateProjectVersion(tree: Tree, newVersion: string) {
    const logMessages: string[] = [];
    for (const { manifestPath } of this.manifestsToUpdate) {
      const packageJson = readPackageJson(tree, manifestPath);
      writePackageJson(tree, manifestPath, { ...packageJson, version: newVersion });
      logMessages.push(`✍️  New version ${newVersion} written to manifest: ${manifestPath}`);
    }
    return logMessages;
  }

  async updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ) {
    const logMessages: string[] = [];
    for (const { manifestPath } of this.manifestsToUpdate) {
      const packageJson = readPackageJson(tree, manifestPath);
      let updatedCount = 0;

      for (const collection of UPDATABLE_COLLECTIONS) {
        const dependencies = packageJson[collection];
        if (!dependencies) {
          continue;
        }
        for (const [projectName, newVersion] of Object.entries(dependenciesToUpdate)) {
          const packageName = packageNameOf(projectGraph, projectName);
          const currentSpec = dependencies[packageName];
          if (!currentSpec || LOCAL_PROTOCOLS.some((protocol) => currentSpec.startsWith(protocol))) {
            continue;
          }
          dependencies[packageName] = newVersion;
          updatedCount++;
        }
      }

      if (updatedCount === 0) {
        continue;
      }
      writePackageJson(tree, manifestPath, packageJson);
      logMessages.push(`✍️  Updated ${updatedCount} dependencies in manifest: ${manifestPath}`);
    }
    return logMessages;
  }
}
