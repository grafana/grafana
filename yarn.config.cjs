/** @type {import('@yarnpkg/types')} */

const { defineConfig } = require('@yarnpkg/types');

module.exports = defineConfig({
  async constraints({ Yarn }) {
    const root = Yarn.workspace({ cwd: '.' });
    for (const workspace of Yarn.workspaces()) {
      // Ensure all workspaces are using the same package manager version otherwise builds can fail.
      if (workspace.manifest.packageManager) {
        workspace.set('packageManager', root.manifest.packageManager);
      }
    }
  },
});
