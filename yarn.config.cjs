// @ts-check

const { defineConfig } = require('@yarnpkg/types');
const { coerce } = require('semver');

const permittedPinnedProductionDependencies = new Set([
  '@grafana/api-clients',     // Monorepo package
  '@grafana/i18n',            // Monorepo package
  '@grafana/schema',          // Monorepo package
  '@grafana/data',            // Monorepo package
  '@grafana/ui',              // Monorepo package
  '@grafana/runtime',         // Monorepo package
  '@grafana/e2e-selectors',   // Monorepo package
  '@grafana/react-data-grid', // Forked package with beta releases
]);

module.exports = defineConfig({
  async constraints({ Yarn }) {
    const root = Yarn.workspace({ cwd: '.' });
    if (!root) {
      throw new Error('Root workspace not found');
    }

    // Ensure all workspaces are using the same package manager version otherwise builds can fail.
    for (const workspace of Yarn.workspaces()) {
      if (workspace.manifest.packageManager) {
        workspace.set('packageManager', root.manifest.packageManager);
      }
    }

    // Ensure all production dependencies in public packages are not pinned to a specific version.
    for (const dependency of Yarn.dependencies({ type: 'dependencies' })) {
      if (dependency.workspace.manifest.publishConfig?.access !== 'public') {
        continue;
      }

      if (permittedPinnedProductionDependencies.has(dependency.ident)) {
        continue;
      }

      const version = coerce(dependency.range, { includePrerelease: true });
      if (version !== null) {
        dependency.update(`^${version.version}`);
        continue;
      }

      dependency.error(
        `Pinned production dependency ${dependency.ident}@${dependency.range} is not allowed in public packages; use a ^ range or add an explicit exception to yarn.config.cjs.`
      );
    }
  },
});
