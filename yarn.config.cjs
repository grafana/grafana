// @ts-check

/** @type {import('@yarnpkg/types')} */
const { defineConfig } = require('@yarnpkg/types');
const semver = require('semver');

// These packages are in a different version across the workspaces and are currently excluded from the check.
// These should be cleaned up over time.
const excludedPackages = [
  '@grafana/api-clients',
  '@grafana/assistant',
  '@grafana/data',
  '@grafana/e2e-selectors',
  '@grafana/google-sdk',
  '@grafana/i18n',
  '@grafana/llm',
  '@grafana/plugin-configs',
  '@grafana/plugin-ui',
  '@grafana/runtime',
  '@grafana/schema',
  '@grafana/sql',
  '@grafana/ui',
  '@grafana/alerting',
  '@grafana/flamegraph',
  '@grafana/o11y-ds-frontend',
  '@grafana/eslint-plugin',
  '@grafana/test-utils',
  '@openfeature/ofrep-web-provider',
  'immutable',
  'lodash',
  'lru-cache',
  'react-dropzone',
  'react-redux',
  'react-router-dom',
  'rxjs',
  'semver',
  'tinycolor2',
];

module.exports = defineConfig({
  async constraints({ Yarn }) {
    const resolvedRanges = new Map();

    for (const dep of Yarn.dependencies()) {
      if (excludedPackages.includes(dep.ident)) {
        continue;
      }

      if (dep.type === 'peerDependencies') {
        continue;
      }

      // Internal workspace dependencies (e.g. @grafana/ui) should depend on the exact version,
      // not something from npm or `workspace:*`
      const workspacePackage = Yarn.workspace({ ident: dep.ident });
      if (workspacePackage) {
        dep.update(workspacePackage.manifest.version);
        continue;
      }

      // A package should not have multiple versions depended on
      if (!resolvedRanges.get(dep.ident)) {
        const siblings = Yarn.dependencies({ ident: dep.ident }).filter((d) => d.type !== 'peerDependencies');
        const resolved = pickHighestRange(siblings.map((d) => d.range));
        resolvedRanges.set(dep.ident, resolved);
      }

      let resolved = resolvedRanges.get(dep.ident);
      if (resolved.error) {
        // Reporting an error (instead of calling .update) means the conflict is not
        // auto-fixable — there's no safe range we can confidently rewrite to.
        dep.error(resolved.error);
      } else {
        dep.update(resolved.range);
      }
    }
  },
});

/**
 * @param {Array<string>} ranges
 *
 * Determines the range that all workspaces should share for a given ident.
 * Returns { range } with the one that has the min version.
 * If any of the versions aren't semver parsable, returns { error }.
 */
function pickHighestRange(ranges) {
  // If every workspace already agrees there's nothing to resolve, return early
  const uniqueRanges = [...new Set(ranges)];
  if (uniqueRanges.length === 1) {
    return { range: uniqueRanges[0] };
  }

  let bestRange = null;
  let bestVersion = null;

  for (const range of uniqueRanges) {
    const min = trySemverMin(range);

    if (!min) {
      return {
        error: `Cannot determine highest version: range "${range}" is not semver-parseable, but other workspaces use different ranges (${uniqueRanges.map((r) => `"${r}"`).join(', ')}). Fix this manually.`,
      };
    }

    if (!bestVersion || semver.gt(min, bestVersion)) {
      bestVersion = min;
      bestRange = range;
    }
  }

  return { range: bestRange };
}

/**
 * @param {string} range
 * @returns {semver.SemVer | null}
 */
function trySemverMin(range) {
  try {
    return semver.minVersion(range);
  } catch {
    return null;
  }
}
