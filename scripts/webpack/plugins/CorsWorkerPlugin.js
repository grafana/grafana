const { RuntimeGlobals, RuntimeModule } = require('webpack');

class CorsWorkerPublicPathRuntimeModule extends RuntimeModule {
  constructor(publicPath) {
    super('publicPath', RuntimeModule.STAGE_BASIC);
    this.publicPath = publicPath;
  }

  /**
   * @returns {string} runtime code
   */
  generate() {
    const { compilation, publicPath } = this;

    const publicPathValue = compilation.getPath(publicPath || '', {
      hash: compilation.hash || 'XXXX',
    });
    return `${RuntimeGlobals.publicPath} = __webpack_worker_public_path__ || '${publicPathValue}';`;
  }
}

// https://github.com/webpack/webpack/discussions/14648#discussioncomment-1604202
// by @ https://github.com/piotr-oles
class CorsWorkerPlugin {
  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply(compiler) {
    compiler.hooks.compilation.tap(
      'CorsWorkerPlugin',
      /**
       * @param {import('webpack').Compilation} compilation
       */
      (compilation) => {
        const getChunkLoading = (chunk) => {
          const entryOptions = chunk.getEntryOptions();
          return entryOptions && entryOptions.chunkLoading !== undefined
            ? entryOptions.chunkLoading
            : compilation.outputOptions.chunkLoading;
        };
        const getChunkPublicPath = (chunk) => {
          const entryOptions = chunk.getEntryOptions();
          return entryOptions && entryOptions.publicPath !== undefined
            ? entryOptions.publicPath
            : compilation.outputOptions.publicPath;
        };

        compilation.hooks.runtimeRequirementInTree.for(RuntimeGlobals.publicPath).tap('CorsWorkerPlugin', (chunk) => {
          if (getChunkLoading(chunk) === 'import-scripts') {
            const publicPath = getChunkPublicPath(chunk);

            if (publicPath !== 'auto') {
              const module = new CorsWorkerPublicPathRuntimeModule(publicPath);
              compilation.addRuntimeModule(chunk, module);
              return true;
            }
          }
        });
      }
    );
  }
}

module.exports = CorsWorkerPlugin;
