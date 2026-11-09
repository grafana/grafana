// Bumps the versions of the given nx release groups from the conventional commits since their last
// release tag, then writes the changelog entries.
//
// nx release changelog needs the new version, and the top-level "nx release" command cannot be used
// because it rejects the per-subcommand git settings that "nx release version" requires. Each group is
// expected to contain a single package that lives in packages/.
//
// Usage: node scripts/release/version-and-changelog.mts <group>[,<group>...]

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: version-and-changelog.mts <group>[,<group>...]';

export interface Deps {
  nxJson: { release: { groups: Record<string, { projects?: string[] }> } };
  listManifests(): string[];
  readManifest(path: string): { name?: string; version: string };
  readHeadManifest(path: string): { version: string };
  tagExists(tag: string): boolean;
  runNx(args: string[]): void;
  notice(message: string): void;
}

export function parseGroups(arg: string | undefined): string[] {
  const groups = (arg ?? '')
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
  if (groups.length === 0) {
    throw new Error(USAGE);
  }
  return groups;
}

function resolveGroup(group: string, deps: Deps) {
  const project = deps.nxJson.release.groups[group]?.projects?.[0];
  if (!project) {
    throw new Error(`Release group ${group} does not exist or has no projects.`);
  }

  const manifest = deps.listManifests().find((path) => deps.readManifest(path).name === project);
  if (!manifest) {
    throw new Error(`Could not find the package.json of ${project} under packages/.`);
  }

  return { group, project, manifest };
}

export function versionAndChangelog(groups: string[], deps: Deps): void {
  const resolved = groups.map((group) => resolveGroup(group, deps));

  // nx release reads the last release from a git tag, which the publish workflow creates after the
  // release pull request is merged. Until that tag exists, nx would version and write the changelog
  // from commits that were already released.
  for (const { project, manifest } of resolved) {
    const tag = `${project}@${deps.readHeadManifest(manifest).version}`;
    if (!deps.tagExists(tag)) {
      deps.notice(`The tag ${tag} does not exist yet, so the last release of ${project} is not published. Skipping.`);
      return;
    }
  }

  deps.runNx(['release', 'version', `--groups=${groups.join(',')}`]);

  for (const { group, project, manifest } of resolved) {
    const oldVersion = deps.readHeadManifest(manifest).version;
    const newVersion = deps.readManifest(manifest).version;
    if (oldVersion === newVersion) {
      deps.notice(`${project} has no releasable commits since its last release, skipping its changelog.`);
      continue;
    }

    deps.runNx(['release', 'changelog', newVersion, `--groups=${group}`]);
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function createDeps(): Deps {
  return {
    nxJson: JSON.parse(readFileSync('nx.json', 'utf8')),
    listManifests: () => git(['ls-files', '-z', '--', 'packages/*/package.json']).split('\0').filter(Boolean),
    readManifest: (path) => JSON.parse(readFileSync(path, 'utf8')),
    readHeadManifest: (path) => JSON.parse(git(['show', `HEAD:${path}`])),
    tagExists: (tag) => {
      try {
        execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    runNx: (args) => {
      execFileSync('pnpm', ['exec', 'nx', ...args], { stdio: 'inherit' });
    },
    notice: (message) => console.log(`::notice::${message}`),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    versionAndChangelog(parseGroups(process.argv[2]), createDeps());
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
