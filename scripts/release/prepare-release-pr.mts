// Prepares the next release: checks that the last release of every independent package is tagged, then asks
// Nx to bump the versions from the conventional commits since those tags and to write the changelog entries.
// Both steps change files in the working tree, and the next step commits them to the version PR branch.
//
// Usage: node scripts/release/prepare-release-pr.mts
// Reads INDEPENDENT_PACKAGES (the packages output of independent-packages.mts) from the environment and needs
// the git tags fetched. Run from the repo root.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { isMainModule } from './lib/main.mts';
import { parsePackages, type IndependentPackage } from './lib/packages.mts';
import { tagFor } from './lib/tags.mts';

export interface VersionChange {
  newVersion: string | null;
}

export interface Deps {
  packages: IndependentPackage[];
  readVersion(manifestPath: string): string;
  tagExists(tag: string): boolean;
  releaseVersion(groups: string[]): Promise<Record<string, VersionChange>>;
  releaseChangelog(groups: string[]): Promise<void>;
  notice(message: string): void;
  warning(message: string): void;
}

export async function prepareReleasePr(deps: Deps): Promise<void> {
  // Without packages the group list would be empty, which Nx may read as "every group".
  if (deps.packages.length === 0) {
    deps.notice('There are no independent packages to release.');
    return;
  }

  // Nx counts commits from the tag of the last release. Without it, it would version from commits that were
  // already released.
  for (const pkg of deps.packages) {
    const version = deps.readVersion(pkg.manifestPath);
    const tag = tagFor(pkg.name, version);
    if (!deps.tagExists(tag)) {
      deps.warning(
        `The tag ${tag} does not exist, so Nx cannot tell which commits are new. Create it on the commit that published ${pkg.name} ${version}, then run the workflow again.`
      );
      return;
    }
  }

  const groups = [...new Set(deps.packages.map((pkg) => pkg.group))];
  const versions = await deps.releaseVersion(groups);

  if (!deps.packages.some((pkg) => versions[pkg.name]?.newVersion)) {
    deps.notice('No package has releasable commits since its last release.');
    return;
  }

  await deps.releaseChangelog(groups);
}

// Nx returns far more than the core needs (dependent projects, the release graph, tag names), so its answer is
// cut down to the one field the core reads.
export function toVersionChanges(
  projectsVersionData: Record<string, { newVersion: string | null }>
): Record<string, VersionChange> {
  return Object.fromEntries(
    Object.entries(projectsVersionData).map(([project, { newVersion }]) => [project, { newVersion }])
  );
}

export async function createVersioningDeps(packages: IndependentPackage[]): Promise<Deps> {
  const { releaseChangelog, releaseVersion } = await import('nx/release');
  const options = (groups: string[]) => ({ groups, gitCommit: false, gitTag: false, stageChanges: false });

  // releaseChangelog needs everything releaseVersion returned, so it is kept here between the two calls.
  let versionResult: Awaited<ReturnType<typeof releaseVersion>> | undefined;

  return {
    packages,
    readVersion: (manifestPath) => JSON.parse(readFileSync(manifestPath, 'utf8')).version,
    tagExists: (tag) => {
      try {
        execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    releaseVersion: async (groups) => {
      versionResult = await releaseVersion(options(groups));
      return toVersionChanges(versionResult.projectsVersionData);
    },
    releaseChangelog: async (groups) => {
      if (!versionResult) {
        throw new Error('The changelog can only be written after the versions were bumped.');
      }

      await releaseChangelog({
        ...options(groups),
        versionData: versionResult.projectsVersionData,
        releaseGraph: versionResult.releaseGraph,
      });
    },
    notice: (message) => console.error(`::notice::${message}`),
    warning: (message) => console.error(`::warning::${message}`),
  };
}

if (isMainModule(import.meta.url)) {
  try {
    await prepareReleasePr(await createVersioningDeps(parsePackages(process.env.INDEPENDENT_PACKAGES)));
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
