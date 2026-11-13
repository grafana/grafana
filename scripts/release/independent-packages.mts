// Lists the packages of every independent release group in nx.json, with the folder and package.json of
// each. The workflow runs this as its own step and hands the list to the scripts that need it.
//
// Usage: node scripts/release/independent-packages.mts
// Writes packages=<JSON list of {group, name, root, manifestPath}> to GITHUB_OUTPUT, or to stdout.

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeOutputs } from './lib/github-output.mts';

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

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    writeOutputs({ packages: JSON.stringify(getIndependentPackages(createDeps())) });
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
