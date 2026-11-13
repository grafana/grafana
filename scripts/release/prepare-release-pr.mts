// Prepares the next release: checks that the last release of every independent package is tagged, then asks
// Nx to bump the versions from the conventional commits since those tags and to write the changelog entries.
// Both steps change files in the working tree, which the next step compares with the open version PR.
//
// Usage: node scripts/release/prepare-release-pr.mts
// Reads INDEPENDENT_PACKAGES (the packages output of independent-packages.mts) from the environment and needs
// the git tags fetched. Run from the repo root, with NX_DAEMON=false in CI. Writes changed to GITHUB_OUTPUT,
// and when it is true also summary_path: a JSON list of {name, currentVersion, newVersion, changelog} written
// to RUNNER_TEMP.

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeOutputs } from './lib/github-output.mts';
import { parsePackages, type IndependentPackage } from './lib/packages.mts';
import type { PackageRelease } from './lib/releases.mts';
import { tagFor } from './lib/tags.mts';

export interface VersionChange {
  currentVersion: string;
  newVersion: string | null;
}

export interface Result {
  changed: boolean;
  releases: PackageRelease[];
}

export interface Deps {
  packages: IndependentPackage[];
  readVersion(manifestPath: string): string;
  tagExists(tag: string): boolean;
  releaseVersion(groups: string[]): Promise<Record<string, VersionChange>>;
  releaseChangelog(groups: string[]): Promise<Record<string, string>>;
  notice(message: string): void;
  warning(message: string): void;
}

const NOTHING_TO_RELEASE: Result = { changed: false, releases: [] };

export async function prepareReleasePr(deps: Deps): Promise<Result> {
  // Without packages the group list would be empty, which Nx may read as "every group".
  if (deps.packages.length === 0) {
    deps.notice('There are no independent packages to release.');
    return NOTHING_TO_RELEASE;
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
      return NOTHING_TO_RELEASE;
    }
  }

  const groups = [...new Set(deps.packages.map((pkg) => pkg.group))];
  const versions = await deps.releaseVersion(groups);

  const bumped = deps.packages.flatMap((pkg) => {
    const change = versions[pkg.name];
    return change?.newVersion
      ? [{ name: pkg.name, currentVersion: change.currentVersion, newVersion: change.newVersion }]
      : [];
  });
  if (bumped.length === 0) {
    deps.notice('No package has releasable commits since its last release.');
    return NOTHING_TO_RELEASE;
  }

  const changelogs = await deps.releaseChangelog(groups);

  return {
    changed: true,
    releases: bumped.map((release) => {
      const changelog = changelogs[release.name];
      if (changelog === undefined) {
        deps.warning(`No changelog entry was generated for ${release.name} ${release.newVersion}.`);
      }
      return { ...release, changelog: changelog ?? '' };
    }),
  };
}

// Nx returns far more than the core needs (dependent projects, the release graph, tag names). These two
// functions cut its answers down to the few fields the core reads.
export function toVersionChanges(
  projectsVersionData: Record<string, { currentVersion: string; newVersion: string | null }>
): Record<string, VersionChange> {
  return Object.fromEntries(
    Object.entries(projectsVersionData).map(([project, { currentVersion, newVersion }]) => [
      project,
      { currentVersion, newVersion },
    ])
  );
}

export function toChangelogEntries(
  projectChangelogs: Record<string, { contents: string }> | undefined
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(projectChangelogs ?? {}).map(([project, { contents }]) => [project, contents])
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

      const result = await releaseChangelog({
        ...options(groups),
        versionData: versionResult.projectsVersionData,
        releaseGraph: versionResult.releaseGraph,
      });
      return toChangelogEntries(result.projectChangelogs);
    },
    notice: (message) => console.log(`::notice::${message}`),
    warning: (message) => console.log(`::warning::${message}`),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    const packages = parsePackages(process.env.INDEPENDENT_PACKAGES);
    const result = await prepareReleasePr(await createVersioningDeps(packages));

    if (result.changed) {
      const summaryPath = join(process.env.RUNNER_TEMP ?? tmpdir(), 'release-summary.json');
      writeFileSync(summaryPath, JSON.stringify(result.releases, null, 2));
      writeOutputs({ changed: 'true', summary_path: summaryPath });
    } else {
      writeOutputs({ changed: 'false' });
    }
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
