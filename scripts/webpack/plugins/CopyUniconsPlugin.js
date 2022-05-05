const fs = require('fs-extra');
const path = require('path');

class CopyUniconsPlugin {
  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply(compiler) {
    compiler.hooks.afterEnvironment.tap(
      'CopyUniconsPlugin',
      /**
       * @param {import('webpack').Compilation} compilation
       */
      () => {
        let destDir = path.resolve(__dirname, '../../../public/img/icons/unicons');

        if (!fs.pathExistsSync(destDir)) {
          let srcDir = path.join(
            path.dirname(require.resolve('iconscout-unicons-tarball/package.json')),
            'unicons/svg/line'
          );
          fs.copySync(srcDir, destDir);
        }

        let solidDestDir = path.resolve(__dirname, '../../../public/img/icons/solid');

        if (!fs.pathExistsSync(solidDestDir)) {
          let srcDir = path.join(
            path.dirname(require.resolve('iconscout-unicons-tarball/package.json')),
            'unicons/svg/solid'
          );
          fs.copySync(srcDir, solidDestDir);
        }
      }
    );
  }
}

module.exports = CopyUniconsPlugin;
