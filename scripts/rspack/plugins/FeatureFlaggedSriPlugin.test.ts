import { SubresourceIntegrityPlugin, type Configuration, type RspackPluginInstance } from '@rspack/core';
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
    // Explicit target so the compilation doesn't depend on the repo's .browserslistrc,
    // which rspack's bundled browserslist database cannot parse.
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
});
