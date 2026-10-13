import { SubresourceIntegrityPlugin, type Compiler, type Configuration, type RspackPluginInstance } from '@rspack/core';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import FeatureFlaggedSriPlugin from './FeatureFlaggedSriPlugin.ts';
import { compile, readAssets } from './testUtils.ts';

const OUTPUT_PATH = '/dist';
const FEATURE_FLAG_GATE_REGEX =
  /if \(window\.__grafanaAssetSriChecksEnabled\) \{\s*script\.integrity = [^;]+;\s*script\.crossOrigin = [^;]+;\s*\}/;

function createConfig(plugins: RspackPluginInstance[]): Configuration {
  return {
    context: path.join(import.meta.dirname, '__fixtures__', 'sri'),
    entry: './index.js',
    mode: 'production',
    devtool: false,
    // The repo's .browserslistrc has no section for NODE_ENV=test, so rspack would resolve an
    // empty browserslist and throw.
    target: ['web', 'es2022'],
    optimization: { minimize: false },
    output: {
      path: OUTPUT_PATH,
      publicPath: '/public/build/',
      crossOriginLoading: 'anonymous',
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
    },
    plugins,
  };
}

// Mirrors the ES module output options in rspack.common.ts.
function createEsmConfig(plugins: RspackPluginInstance[]): Configuration {
  const config = createConfig(plugins);
  return {
    ...config,
    output: {
      ...config.output,
      publicPath: 'auto',
      module: true,
      chunkFormat: 'module',
      chunkLoading: 'import',
    },
  };
}

const RAW_ESM_CHUNK_IMPORT = 'import("./" + __webpack_require__.u(chunkId))';

// Simulates a future rspack runtime template that the plugin no longer recognises.
class RewriteEsmChunkImportPlugin {
  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap('RewriteEsmChunkImportPlugin', (compilation) => {
      compilation.hooks.runtimeModule.tap('RewriteEsmChunkImportPlugin', (module) => {
        if (module.name !== 'module_chunk_loading' || !module.source) {
          return;
        }
        const source = module.source.source.toString();
        module.source.source = Buffer.from(
          source.replace(RAW_ESM_CHUNK_IMPORT, 'import(__webpack_require__.p + __webpack_require__.u(chunkId))'),
          'utf-8'
        );
      });
    });
  }
}

function findLazyChunk(assets: Record<string, string>): string {
  const lazyChunk = Object.entries(assets).find(([filename]) => filename.endsWith('.chunk.js'));
  expect(lazyChunk).toBeDefined();
  return lazyChunk![1];
}

describe('FeatureFlaggedSriPlugin', () => {
  it('wraps the SRI runtime attributes in the feature flag gate', async () => {
    const { outputFs } = await compile(createConfig([new SubresourceIntegrityPlugin(), new FeatureFlaggedSriPlugin()]));
    const assets = readAssets(outputFs, OUTPUT_PATH);
    expect(assets['main.js']).toMatch(FEATURE_FLAG_GATE_REGEX);
  });

  it('preserves real sha384 hashes matching the emitted assets', async () => {
    const { outputFs } = await compile(createConfig([new SubresourceIntegrityPlugin(), new FeatureFlaggedSriPlugin()]));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    const lazyChunkContent = findLazyChunk(assets);
    const expectedDigest = createHash('sha384').update(lazyChunkContent).digest('base64');
    expect(assets['main.js']).toContain(`sha384-${expectedDigest}`);
  });

  it('leaves SRI attributes ungated when the plugin is not registered', async () => {
    const { outputFs } = await compile(createConfig([new SubresourceIntegrityPlugin()]));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    expect(assets['main.js']).toContain('script.integrity =');
    expect(assets['main.js']).not.toContain('__grafanaAssetSriChecksEnabled');
  });

  it('is a silent no-op when the SubresourceIntegrityPlugin is not registered', async () => {
    const { outputFs } = await compile(createConfig([new FeatureFlaggedSriPlugin()]));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    expect(assets['main.js']).not.toContain('script.integrity =');
    expect(assets['main.js']).not.toContain('__grafanaAssetSriChecksEnabled');
  });

  describe('ESM output', () => {
    it('loads lazy chunks through the import map helper behind the feature flag gate', async () => {
      const { outputFs } = await compile(
        createEsmConfig([new SubresourceIntegrityPlugin(), new FeatureFlaggedSriPlugin()])
      );
      const runtime = readAssets(outputFs, OUTPUT_PATH)['main.js'];

      expect(runtime).not.toContain(RAW_ESM_CHUNK_IMPORT);
      expect(runtime).toContain('__grafanaSriImport("./" + __webpack_require__.u(chunkId))');
      expect(runtime).toContain('window.__grafanaAssetSriChecksEnabled');
      expect(runtime).toContain("type = 'importmap'");
    });

    it('keeps real sha384 hashes matching the emitted lazy chunk', async () => {
      const { outputFs } = await compile(
        createEsmConfig([new SubresourceIntegrityPlugin(), new FeatureFlaggedSriPlugin()])
      );
      const assets = readAssets(outputFs, OUTPUT_PATH);

      const expectedDigest = createHash('sha384').update(findLazyChunk(assets)).digest('base64');
      expect(assets['main.js']).toContain(`sha384-${expectedDigest}`);
    });

    it('leaves chunk loading untouched when the SubresourceIntegrityPlugin is not registered', async () => {
      const { outputFs } = await compile(createEsmConfig([new FeatureFlaggedSriPlugin()]));
      const runtime = readAssets(outputFs, OUTPUT_PATH)['main.js'];

      expect(runtime).toContain(RAW_ESM_CHUNK_IMPORT);
      expect(runtime).not.toContain('__grafanaAssetSriChecksEnabled');
    });

    it('fails the build when the chunk import no longer matches the expected runtime template', async () => {
      const config = createEsmConfig([
        new SubresourceIntegrityPlugin(),
        new RewriteEsmChunkImportPlugin(),
        new FeatureFlaggedSriPlugin(),
      ]);

      await expect(compile(config)).rejects.toThrow(/module_chunk_loading/);
    });
  });
});
