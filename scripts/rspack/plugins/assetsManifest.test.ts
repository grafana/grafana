import { SubresourceIntegrityPlugin, type Configuration, type RspackPluginInstance } from '@rspack/core';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { RspackManifestPlugin } from 'rspack-manifest-plugin';
import { describe, expect, it } from 'vitest';

import FeatureFlaggedSRIPlugin from './FeatureFlaggedSriPlugin.ts';
import { assetsManifestOptions, type ManifestAssets, type ManifestEntrypoints } from './assetsManifest.ts';
import { compile, readAssets } from './testUtils.ts';

const OUTPUT_PATH = '/dist';
const PUBLIC_PATH = 'public/build/';
const MANIFEST_NAME = 'assets-manifest.json';

// Mirrors webpack.common.ts: multiple entries including a CSS-only theme pair, boot opting
// out of the runtime chunk, content-hashed filenames and assets emitted to a subdirectory.
function createConfig(plugins: RspackPluginInstance[]): Configuration {
  return {
    context: path.join(import.meta.dirname, '__fixtures__', 'assets-manifest'),
    entry: {
      app: './index.js',
      boot: { import: './boot.js', runtime: false },
      dark: './dark.css',
      light: './light.css',
    },
    mode: 'production',
    devtool: false,
    // Explicit target so the compilation doesn't depend on the repo's .browserslistrc, which
    // has no section matching NODE_ENV=test and no defaults — rspack would resolve an empty
    // browserslist and throw.
    target: ['web', 'es2022'],
    optimization: { minimize: false, runtimeChunk: 'single' },
    experiments: { css: true },
    module: {
      rules: [
        { test: /\.css$/, type: 'css' },
        // The case that makes webpack-assets-manifest throw under rspack.
        { test: /\.png$/, type: 'asset/resource' },
      ],
    },
    output: {
      path: OUTPUT_PATH,
      publicPath: PUBLIC_PATH,
      crossOriginLoading: 'anonymous',
      filename: '[name].[contenthash].js',
      chunkFilename: '[name].[contenthash].js',
      cssFilename: 'grafana.[name].[contenthash].css',
      assetModuleFilename: 'static/img/[name].[hash:8][ext]',
    },
    plugins,
  };
}

function sriPlugin(): RspackPluginInstance {
  return new SubresourceIntegrityPlugin({ hashFuncNames: ['sha384'] });
}

function manifestPlugin(): RspackPluginInstance {
  return new RspackManifestPlugin(assetsManifestOptions);
}

function expectedIntegrity(content: Buffer | string): string {
  return ['sha384'].map((algo) => `${algo}-${createHash(algo).update(content).digest('base64')}`).join(' ');
}

interface BuildOutput {
  assets: Record<string, string>;
  entrypoints: ManifestEntrypoints;
  entries: ManifestAssets;
}

async function build(plugins: RspackPluginInstance[]): Promise<BuildOutput> {
  const { outputFs } = await compile(createConfig(plugins));
  const assets = readAssets(outputFs, OUTPUT_PATH);
  const { entrypoints, ...entries } = JSON.parse(assets[MANIFEST_NAME]);
  return { assets, entrypoints, entries };
}

describe('assets manifest', () => {
  it('emits the entrypoints shape the backend decodes', async () => {
    const { entrypoints } = await build([sriPlugin(), manifestPlugin()]);

    expect(Object.keys(entrypoints).sort()).toEqual(['app', 'boot', 'dark', 'light']);
    // Load order matters: the runtime chunk has to come before the entry chunk.
    expect(entrypoints.app.assets.js[0]).toMatch(/^public\/build\/runtime\./);
    expect(entrypoints.app.assets.js).toHaveLength(2);
    expect(entrypoints.app.assets.css).toHaveLength(1);
    // boot opts out of the runtime chunk and has no styles.
    expect(entrypoints.boot.assets).toEqual({ js: [expect.stringMatching(/^public\/build\/boot\./)] });
    // The backend reads dark/light from element [0] of the css list.
    expect(entrypoints.dark.assets.css[0]).toMatch(/^public\/build\/grafana\.dark\..*\.css$/);
    expect(entrypoints.light.assets.css[0]).toMatch(/^public\/build\/grafana\.light\..*\.css$/);
  });

  it('gives every entry a { src, integrity } value matching the emitted bytes', async () => {
    const { assets, entries } = await build([sriPlugin(), manifestPlugin()]);

    expect(Object.keys(entries).length).toBeGreaterThan(0);

    for (const entry of Object.values(entries)) {
      expect(entry).toEqual({ src: expect.any(String), integrity: expect.any(String) });
      expect(entry.integrity).toBe(expectedIntegrity(assets[entry.src.replace(PUBLIC_PATH, '')]));
    }
  });

  it('skips integrity hashes when SRI plugin is not present', async () => {
    const { assets, entries } = await build([manifestPlugin()]);

    expect(Object.keys(entries).length).toBeGreaterThan(0);

    for (const entry of Object.values(entries)) {
      expect(entry).toEqual({ src: expect.any(String), integrity: undefined });
    }
  });

  it('contains integrity hashes for every entrypoint asset', async () => {
    const { entrypoints, entries } = await build([sriPlugin(), manifestPlugin()]);

    const integrityMap = new Map(Object.values(entries).map((entry) => [entry.src, entry.integrity]));
    const entrypointFilePaths = Object.values(entrypoints).flatMap((v) => Object.values(v.assets).flat());

    for (const entrypoint of entrypointFilePaths) {
      expect(integrityMap.get(entrypoint), `${entrypoint} must have an integrity hash`).toBeDefined();
    }
  });

  // SubresourceIntegrityPlugin injects an sriHashes map into the entry chunk and
  // FeatureFlaggedSRIPlugin rewrites the load_script runtime module afterwards, both changing
  // the bytes these digests cover. Registration order is asserted in both directions so a
  // future move to a JS-side SRI implementation fails here rather than shipping a manifest
  // whose digests no longer match the served files.
  describe.each([
    ['SRI registered first', () => [sriPlugin(), new FeatureFlaggedSRIPlugin(), manifestPlugin()]],
    ['SRI registered last', () => [manifestPlugin(), new FeatureFlaggedSRIPlugin(), sriPlugin()]],
  ])('with SRI chunk rewrites (%s)', (_label, buildPlugins) => {
    it('hashes the bytes that are actually emitted', async () => {
      const { assets, entries } = await build(buildPlugins());

      // Guards the guard: without the injection and rewrite there is nothing to be wrong about.
      const runtime = Object.entries(entries).find(([key]) => key === 'runtime.js')?.[1];
      const runtimeSource = assets[runtime!.src.replace(PUBLIC_PATH, '')];
      expect(runtimeSource).toContain('__grafanaAssetSriChecksEnabled');
      expect(Object.values(assets).some((source) => source.includes('sriHashes'))).toBe(true);

      for (const [key, entry] of Object.entries(entries)) {
        const source = assets[entry.src.replace(PUBLIC_PATH, '')];
        expect(entry.integrity, `integrity mismatch for ${key}`).toBe(expectedIntegrity(source));
      }
    });
  });

  it('keys chunk assets by chunk name rather than output filename', async () => {
    const { entries } = await build([sriPlugin(), manifestPlugin()]);

    expect(Object.keys(entries).sort()).toEqual([
      'app.css',
      'app.js',
      'boot.js',
      'dark.css',
      'dark.js',
      'light.css',
      'light.js',
      'runtime.js',
    ]);
  });

  it('limits entries to entrypoint-reachable files', async () => {
    const { assets, entries } = await build([sriPlugin(), manifestPlugin()]);

    // Both are emitted, neither is reachable from an entrypoint.
    expect(assets[path.join('static', 'img', 'image.98d48194.png')]).toBeDefined();
    expect(Object.keys(assets).some((name) => name.startsWith('lazy.'))).toBe(true);
    expect(Object.keys(entries).some((key) => key.includes('image'))).toBe(false);
    expect(Object.keys(entries).some((key) => key.startsWith('lazy'))).toBe(false);
  });

  it('excludes sourcemaps from the entrypoint file lists', async () => {
    const config = createConfig([sriPlugin(), manifestPlugin()]);
    const { outputFs } = await compile({ ...config, devtool: 'source-map' });
    const assets = readAssets(outputFs, OUTPUT_PATH);
    const { entrypoints } = JSON.parse(assets[MANIFEST_NAME]);

    expect(Object.keys(assets).some((name) => name.endsWith('.js.map'))).toBe(true);
    expect(entrypoints.app.assets.js.every((file: string) => !file.endsWith('.map'))).toBe(true);
  });
});
