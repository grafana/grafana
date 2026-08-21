import webpack, { type Chunk, type Compilation, type Compiler } from 'webpack';

const { RuntimeGlobals, RuntimeModule } = webpack;

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

/**
 * Used when publicPath is 'auto', which has no literal value to fall back on. Webpack's own
 * derivation reads the worker's location, which for a CorsWorker is the blob URL rather than
 * the chunk URL — so this runs after it (STAGE_ATTACH) and prefers the value the blob sets.
 * The typeof guard matters: a natively constructed worker never sets the global, and there
 * webpack's derivation is already correct because its location _is_ the chunk URL.
 */
class CorsWorkerPublicPathOverrideRuntimeModule extends RuntimeModule {
  constructor() {
    super('publicPath override', RuntimeModule.STAGE_ATTACH);
  }

  generate(): string {
    return `if (typeof __webpack_worker_public_path__ !== 'undefined') ${RuntimeGlobals.publicPath} = __webpack_worker_public_path__;`;
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

            // Returning undefined leaves the requirement unsatisfied so webpack's own
            // RuntimePlugin still installs AutoPublicPathRuntimeModule, which the override
            // module then corrects for blob-loaded workers.
            if (publicPath === 'auto') {
              compilation.addRuntimeModule(chunk, new CorsWorkerPublicPathOverrideRuntimeModule());
              return undefined;
            }

            compilation.addRuntimeModule(chunk, new CorsWorkerPublicPathRuntimeModule(String(publicPath)));
            return true;
          }
          return undefined;
        });
    });
  }
}
