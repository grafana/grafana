import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

interface ReleaseGroup {
  projects?: string[];
  projectsRelationship?: 'fixed' | 'independent';
}

export interface Deps {
  nxJson: { release: { groups: Record<string, ReleaseGroup> } };
  listManifests(): string[];
  readManifest(path: string): { name?: string };
}

export interface IndependentPackage {
  group: string;
  name: string;
  root: string;
  manifestPath: string;
}

function isPattern(project: string): boolean {
  return project.includes('*') || project.startsWith('!') || project.startsWith('tag:');
}

export function getIndependentPackages(deps: Deps): IndependentPackage[] {
  const manifestPathByPackageName = new Map<string, string>();
  for (const path of deps.listManifests()) {
    const name = deps.readManifest(path).name;
    if (name) {
      manifestPathByPackageName.set(name, path);
    }
  }

  const packages: IndependentPackage[] = [];
  for (const [group, config] of Object.entries(deps.nxJson.release.groups)) {
    if (config.projectsRelationship !== 'independent') {
      continue;
    }

    for (const name of config.projects ?? []) {
      if (isPattern(name)) {
        throw new Error(`Release group ${group} lists "${name}", but independent groups must list project names.`);
      }

      const manifestPath = manifestPathByPackageName.get(name);
      if (!manifestPath) {
        throw new Error(`Could not find the package.json of ${name} under packages/.`);
      }

      packages.push({ group, name, root: dirname(manifestPath), manifestPath });
    }
  }

  return packages;
}

export function tagFor(name: string, version: string): string {
  return `${name}@${version}`;
}

export function createDeps(): Deps {
  return {
    nxJson: JSON.parse(readFileSync('nx.json', 'utf8')),
    listManifests: () =>
      execFileSync('git', ['ls-files', '-z', '--', 'packages/*/package.json'], { encoding: 'utf8' })
        .split('\0')
        .filter(Boolean),
    readManifest: (path) => JSON.parse(readFileSync(path, 'utf8')),
  };
}
