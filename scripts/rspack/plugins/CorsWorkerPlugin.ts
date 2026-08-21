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

/**
 * Used when publicPath is 'auto', which has no literal value to fall back on. Rspack's own
 * derivation reads the worker's location, which for a CorsWorker is the blob URL rather than
 * the chunk URL — so this runs after it and prefers the value the blob sets. The typeof guard
 * matters: a natively constructed worker never sets the global, and there rspack's derivation
 * is already correct because its location _is_ the chunk URL.
 *
 * STAGE_TRIGGER rather than webpack's STAGE_ATTACH: rspack renders its auto publicPath module
 * after every earlier stage, so anything below STAGE_TRIGGER gets clobbered by it. Runtime
 * modules still all render before the chunk's startup section, so the entry sees the override.
 */
class CorsWorkerPublicPathOverrideRuntimeModule extends RuntimeModule {
  constructor() {
    super('publicPath override', RuntimeModule.STAGE_TRIGGER);
  }

  generate(): string {
    return `if (typeof __webpack_worker_public_path__ !== 'undefined') ${RuntimeGlobals.publicPath} = __webpack_worker_public_path__;`;
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

            // Returning undefined leaves the requirement unsatisfied so rspack's own
            // RuntimePlugin still installs its auto publicPath runtime module, which the
            // override module then corrects for blob-loaded workers.
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
