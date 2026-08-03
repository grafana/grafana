import rspack, { type Chunk, type Compilation, type Compiler } from '@rspack/core';

const { RuntimeGlobals, RuntimeModule } = rspack;

class CorsWorkerPublicPathRuntimeModule extends RuntimeModule {
  publicPath: string;

  constructor(publicPath: string) {
    super('publicPath', RuntimeModule.STAGE_BASIC);
    this.publicPath = publicPath;
  }

  generate(): string {
    const { compilation, publicPath } = this;

    const publicPathValue = compilation!.getPath(publicPath || '', {
      hash: compilation!.hash || 'XXXX',
    });
    return `${RuntimeGlobals.publicPath} = __webpack_worker_public_path__ || '${publicPathValue}';`;
  }
}

// https://github.com/webpack/webpack/discussions/14648#discussioncomment-1604202
// by @ https://github.com/piotr-oles
export default class CorsWorkerRspackPlugin {
  apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap('CorsWorkerRspackPlugin', (compilation: Compilation) => {
      const getChunkLoading = (chunk: Chunk) => {
        const entryOptions = chunk.getEntryOptions();
        return entryOptions && entryOptions.chunkLoading !== undefined
          ? entryOptions.chunkLoading
          : compilation.outputOptions.chunkLoading;
      };

      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.publicPath)
        .tap('CorsWorkerRspackPlugin', (chunk: Chunk) => {
          if (getChunkLoading(chunk) === 'import-scripts') {
            const publicPath = compilation.outputOptions.publicPath;
            if (publicPath !== 'auto') {
              const module = new CorsWorkerPublicPathRuntimeModule(String(publicPath));
              compilation.addRuntimeModule(chunk, module);
            }
          }
          return undefined;
        });
    });
  }
}
