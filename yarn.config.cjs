// @ts-check

/** @type {import('@yarnpkg/types')} */
const { defineConfig } = require('@yarnpkg/types');
const semver = require('semver');

// These packages are in a different version across the workspaces and are currently excluded from the check.
// These should be cleaned up over time.
const excludedPackages = [
  '@faker-js/faker',
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
  '@openfeature/ofrep-web-provider',
  '@storybook/addon-webpack5-compiler-swc',
  '@swc/helpers',
  '@testing-library/jest-dom',
  '@testing-library/react',
  '@testing-library/user-event',
  '@types/jest',
  '@types/lodash',
  '@types/node',
  '@types/react-table',
  '@types/tinycolor2',
  '@typescript-eslint/utils',
  'fishery',
  'fs-extra',
  'immutable',
  'jest',
  'lodash',
  'lru-cache',
  'msw',
  'react-dropzone',
  'react-redux',
  'react-router-dom',
  'react-select-event',
  'rimraf',
  'rxjs',
  'semver',
  'tinycolor2',
  'type-fest',
  'webpack-merge',
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

      let highestRange = resolvedRanges.get(dep.ident);
      if (highestRange === undefined) {
        const siblings = Yarn.dependencies({ ident: dep.ident }).filter((d) => d.type !== 'peerDependencies');
        highestRange = pickHighestRange(siblings.map((d) => d.range));
        resolvedRanges.set(dep.ident, highestRange);
      }

      if (highestRange !== null) {
        dep.update(highestRange);
      }
    }
  },
});

// Returns the range whose minimum version is the highest among the inputs.
// Returns null if any range can't be parsed as semver (e.g. workspace:*, git URLs),
// since in that case "highest" isn't well-defined and we leave the deps alone.
function pickHighestRange(ranges) {
  let bestRange = null;
  let bestVersion = null;

  for (const range of ranges) {
    let min;
    try {
      min = semver.minVersion(range);
    } catch {
      min = null;
    }
    if (!min) {
      return null;
    }
    if (!bestVersion || semver.gt(min, bestVersion)) {
      bestVersion = min;
      bestRange = range;
    }
  }

  return bestRange;
}
