// Prepares the next release: checks that the last release of every independent package is tagged, then asks
// Nx to bump the versions from the conventional commits since those tags and to write the changelog entries.
// Both steps change files in the working tree, and the next step commits them to the version PR branch.
//
// Usage: node scripts/release/prepare-release-pr.mts
// Needs the git tags fetched. Run from the repo root.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { releaseChangelog, releaseVersion } from 'nx/release';

import { getIndependentPackages, type IndependentPackage } from './lib/independent-packages.mts';
import { tagFor } from './lib/tags.mts';

// Nx counts commits from the tag of the last release. Without it, it would version from commits that were
// already released, so the first package whose tag is missing is reported.
export function findMissingTag(
  packages: IndependentPackage[],
  versions: Record<string, string>,
  existingTags: string[]
): { name: string; version: string; tag: string } | undefined {
  for (const pkg of packages) {
    const version = versions[pkg.manifestPath];
    const tag = tagFor(pkg.name, version);
    if (!existingTags.includes(tag)) {
      return { name: pkg.name, version, tag };
    }
  }
  return undefined;
}

// Nx also returns projects that depend on the packages, which are not released here, so only the packages count.
export function hasNewVersion(
  packages: IndependentPackage[],
  projectsVersionData: Record<string, { newVersion: string | null }>
): boolean {
  return packages.some((pkg) => projectsVersionData[pkg.name]?.newVersion);
}

function tagExists(tag: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  try {
    const packages = await getIndependentPackages();

    // Without packages the project list would be empty, which Nx may read as "every project".
    if (packages.length === 0) {
      console.error('::notice::There are no independent packages to release.');
      process.exit(0);
    }

    const versions = Object.fromEntries(
      packages.map(({ manifestPath }) => [manifestPath, JSON.parse(readFileSync(manifestPath, 'utf8')).version])
    );
    const existingTags = packages
      .map((pkg) => tagFor(pkg.name, versions[pkg.manifestPath]))
      .filter((tag) => tagExists(tag));

    const missing = findMissingTag(packages, versions, existingTags);
    if (missing) {
      console.error(
        `::warning::The tag ${missing.tag} does not exist, so Nx cannot tell which commits are new. Create it on the commit that published ${missing.name} ${missing.version}, then run the workflow again.`
      );
      process.exit(0);
    }

    const options = {
      projects: packages.map((pkg) => pkg.name),
      gitCommit: false,
      gitTag: false,
      stageChanges: false,
    };

    const versionResult = await releaseVersion(options);
    if (!hasNewVersion(packages, versionResult.projectsVersionData)) {
      console.error('::notice::No package has releasable commits since its last release.');
      process.exit(0);
    }

    await releaseChangelog({
      ...options,
      versionData: versionResult.projectsVersionData,
      releaseGraph: versionResult.releaseGraph,
    });
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
