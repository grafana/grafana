import { SubresourceIntegrityPlugin, type Configuration, type RspackPluginInstance } from '@rspack/core';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WebpackAssetsManifest } from 'webpack-assets-manifest';

import AssetsManifestPlugin from './AssetsManifestPlugin.ts';
import { compile, readAssets } from './testUtils.ts';

const OUTPUT_PATH = '/dist';
const PUBLIC_PATH = 'public/build/';
const MANIFEST_NAME = 'assets-manifest.json';
const HASHES = ['sha384', 'sha512'];

interface ManifestEntry {
  src: string;
  integrity: string;
}

function createConfig(plugins: RspackPluginInstance[]): Configuration {
  return {
    context: path.join(import.meta.dirname, '__fixtures__', 'assets-manifest'),
    entry: './index.js',
    mode: 'production',
    devtool: false,
    // Explicit target so the compilation doesn't depend on the repo's .browserslistrc,
    // which rspack's bundled browserslist database cannot parse.
    target: ['web', 'es2022'],
    optimization: { minimize: false },
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
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
      cssFilename: '[name].css',
      assetModuleFilename: '[name][ext]',
    },
    plugins,
  };
}

function expectedIntegrity(content: Buffer | string): string {
  return HASHES.map((algo) => `${algo}-${createHash(algo).update(content).digest('base64')}`).join(' ');
}

function readManifest(assets: Record<string, string>): Record<string, ManifestEntry> {
  const { entrypoints, ...rest } = JSON.parse(assets[MANIFEST_NAME]);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return rest as Record<string, ManifestEntry>;
}

function readEntrypoints(assets: Record<string, string>): Record<string, { assets: Record<string, string[]> }> {
  return JSON.parse(assets[MANIFEST_NAME]).entrypoints;
}

describe('AssetsManifestPlugin', () => {
  it('emits the entrypoints shape the backend decodes', async () => {
    const { outputFs } = await compile(createConfig([new AssetsManifestPlugin()]));
    const entrypoints = readEntrypoints(readAssets(outputFs, OUTPUT_PATH));

    expect(entrypoints).toEqual({
      main: { assets: { js: ['public/build/main.js'], css: ['public/build/main.css'] } },
    });
  });

  it('gives every entry a { src, integrity } value matching the emitted bytes', async () => {
    const { outputFs } = await compile(createConfig([new AssetsManifestPlugin()]));
    const assets = readAssets(outputFs, OUTPUT_PATH);
    const manifest = readManifest(assets);

    expect(Object.keys(manifest).length).toBeGreaterThan(0);

    for (const [, entry] of Object.entries(manifest)) {
      expect(entry).toEqual({ src: expect.any(String), integrity: expect.any(String) });
      const filename = entry.src.replace(PUBLIC_PATH, '');
      expect(entry.integrity).toBe(expectedIntegrity(assets[filename]));
    }
  });

  // SubresourceIntegrityPlugin injects an sriHashes map into the entry chunk, changing the
  // very bytes this plugin hashes. It is a native plugin, so that injection lands before
  // any JS processAssets tap and registration order does not affect the result — both
  // orders are asserted so a future move to a JS-side SRI implementation fails here rather
  // than shipping a manifest whose digests no longer match the served files.
  describe.each([
    ['SRI registered first', () => [new SubresourceIntegrityPlugin(), new AssetsManifestPlugin()]],
    ['SRI registered last', () => [new AssetsManifestPlugin(), new SubresourceIntegrityPlugin()]],
  ])('with SubresourceIntegrityPlugin (%s)', (_label, buildPlugins) => {
    it('hashes the bytes that are actually emitted', async () => {
      const config = createConfig(buildPlugins());
      const { outputFs } = await compile({
        ...config,
        output: { ...config.output, crossOriginLoading: 'anonymous' },
      });
      const assets = readAssets(outputFs, OUTPUT_PATH);
      const manifest = readManifest(assets);

      // Guards the guard: without the injection there is no rewrite to be wrong about.
      expect(assets['main.js']).toContain('sriHashes');
      expect(Object.keys(manifest).length).toBeGreaterThan(0);

      for (const [, entry] of Object.entries(manifest)) {
        const filename = entry.src.replace(PUBLIC_PATH, '');
        expect(entry.integrity).toBe(expectedIntegrity(assets[filename]));
      }
    });
  });

  it('keys chunk assets by chunk name rather than output filename', async () => {
    const { outputFs } = await compile(createConfig([new AssetsManifestPlugin()]));
    const manifest = readManifest(readAssets(outputFs, OUTPUT_PATH));

    expect(Object.keys(manifest).sort()).toEqual(['main.css', 'main.js']);
  });

  it('limits entries to entrypoint-reachable files', async () => {
    const { outputFs } = await compile(createConfig([new AssetsManifestPlugin()]));
    const assets = readAssets(outputFs, OUTPUT_PATH);
    const manifest = readManifest(assets);

    // Both are emitted, neither is reachable from an entrypoint.
    expect(assets['image.png']).toBeDefined();
    expect(assets['lazy.chunk.js']).toBeDefined();
    expect(Object.keys(manifest)).not.toContain('image.png');
    expect(Object.keys(manifest)).not.toContain('lazy.chunk.js');
  });

  it('excludes sourcemaps from the entrypoint file lists', async () => {
    const config = createConfig([new AssetsManifestPlugin()]);
    const { outputFs } = await compile({ ...config, devtool: 'source-map' });
    const assets = readAssets(outputFs, OUTPUT_PATH);
    const entrypoints = readEntrypoints(assets);

    expect(assets['main.js.map']).toBeDefined();
    expect(entrypoints.main.assets.js).toEqual(['public/build/main.js']);
  });

  it('records why webpack-assets-manifest is not used: it throws under rspack either way', async () => {
    const manifestPlugin = (integrity: boolean): RspackPluginInstance => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return new WebpackAssetsManifest({
        entrypoints: true,
        integrity,
        integrityHashes: HASHES,
        publicPath: true,
        output: MANIFEST_NAME,
      }) as unknown as RspackPluginInstance;
    };

    // With integrity on, recordSubresourceIntegrity writes through compilation.assetsInfo,
    // which rspack doesn't expose.
    await expect(compile(createConfig([manifestPlugin(true)]))).rejects.toThrow(
      "Cannot read properties of undefined (reading 'set')"
    );

    // Turning integrity off only moves the failure: handleProcessAssetsAnalyse is tapped
    // unconditionally and calls codeGenerationResults.get(module, chunk.runtime), which
    // rspack's binding rejects because chunk.runtime is a Set. Any asset/resource module
    // reaches it, so there is no configuration under which this library works.
    await expect(compile(createConfig([manifestPlugin(false)]))).rejects.toThrow(
      'Value is none of these types `String`, `Array<T>`'
    );
  });
});
