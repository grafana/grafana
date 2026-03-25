import { type Chunk, type Compilation, type Compiler, RuntimeGlobals, RuntimeModule } from 'webpack';

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
export default class CorsWorkerPlugin {
  apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap('CorsWorkerPlugin', (compilation: Compilation) => {
      const getChunkLoading = (chunk: Chunk) => {
        const entryOptions = chunk.getEntryOptions();
        return entryOptions && entryOptions.chunkLoading !== undefined
          ? entryOptions.chunkLoading
          : compilation.outputOptions.chunkLoading;
      };
      const getChunkPublicPath = (chunk: Chunk) => {
        const entryOptions = chunk.getEntryOptions();
        return entryOptions && entryOptions.publicPath !== undefined
          ? entryOptions.publicPath
          : compilation.outputOptions.publicPath;
      };

      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.publicPath)
        .tap('CorsWorkerPlugin', (chunk: Chunk) => {
          if (getChunkLoading(chunk) === 'import-scripts') {
            const publicPath = getChunkPublicPath(chunk);

            if (publicPath !== 'auto') {
              const module = new CorsWorkerPublicPathRuntimeModule(String(publicPath));
              compilation.addRuntimeModule(chunk, module);
              return true;
            }
          }
          return undefined;
        });
    });
  }
}
