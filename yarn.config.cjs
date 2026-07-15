/** @type {import('@yarnpkg/types')} */

const { defineConfig } = require('@yarnpkg/types');

module.exports = defineConfig({
  async constraints({ Yarn }) {
    const root = Yarn.workspace({ cwd: '.' });
    for (const workspace of Yarn.workspaces()) {
      if (workspace.manifest.packageManager) {
        workspace.set('packageManager', root.manifest.packageManager);
      }
    }
  },
});
