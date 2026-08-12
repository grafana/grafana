import { SubresourceIntegrityPlugin, type Configuration, type RspackPluginInstance } from '@rspack/core';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { RspackManifestPlugin } from 'rspack-manifest-plugin';
import { describe, expect, it } from 'vitest';
import { WebpackAssetsManifest } from 'webpack-assets-manifest';

import FeatureFlaggedSRIPlugin from './FeatureFlaggedSriPlugin.ts';
import { INTEGRITY_HASHES, assetsManifestOptions } from './assetsManifest.ts';
import { compile, readAssets } from './testUtils.ts';

const OUTPUT_PATH = '/dist';
const PUBLIC_PATH = 'public/build/';
const MANIFEST_NAME = 'assets-manifest.json';

interface ManifestEntry {
  src: string;
  integrity: string;
}

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
    // Explicit target so the compilation doesn't depend on the repo's .browserslistrc,
    // which rspack's bundled browserslist database cannot parse.
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
  return new SubresourceIntegrityPlugin({ hashFuncNames: ['sha384', 'sha512'] });
}

function manifestPlugin(): RspackPluginInstance {
  return new RspackManifestPlugin(assetsManifestOptions);
}

function expectedIntegrity(content: Buffer | string): string {
  return INTEGRITY_HASHES.map((algo) => `${algo}-${createHash(algo).update(content).digest('base64')}`).join(' ');
}

async function build(plugins: RspackPluginInstance[]) {
  const { outputFs } = await compile(createConfig(plugins));
  const assets = readAssets(outputFs, OUTPUT_PATH);
  const { entrypoints, ...entries } = JSON.parse(assets[MANIFEST_NAME]);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { assets, entrypoints, entries: entries as Record<string, ManifestEntry> };
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

    for (const [, entry] of Object.entries(entries)) {
      expect(entry).toEqual({ src: expect.any(String), integrity: expect.any(String) });
      expect(entry.integrity).toBe(expectedIntegrity(assets[entry.src.replace(PUBLIC_PATH, '')]));
    }
  });

  it('resolves integrity for every file the backend looks up', async () => {
    const { entrypoints, entries } = await build([sriPlugin(), manifestPlugin()]);

    // Mirrors readWebAssets: build src -> integrity from the top-level entries, then resolve
    // the entrypoint lists against it.
    const integrity = new Map(Object.values(entries).map((entry) => [entry.src, entry.integrity]));
    const looked = [
      ...entrypoints.app.assets.js,
      ...entrypoints.app.assets.css,
      entrypoints.dark.assets.css[0],
      entrypoints.light.assets.css[0],
    ];

    expect(looked.filter((src: string) => !integrity.get(src))).toEqual([]);
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

  // rspack.dev.ts registers this plugin with no SubresourceIntegrityPlugin and
  // mode: 'development', where SRI disables itself anyway. Digests are computed here rather
  // than read from FileDescriptor.integrity precisely so that build still produces a usable
  // manifest — reading the SRI field would leave every digest blank.
  it('produces full digests with no SubresourceIntegrityPlugin registered', async () => {
    const { assets, entrypoints, entries } = await build([manifestPlugin()]);

    expect(Object.keys(entries).length).toBeGreaterThan(0);
    expect(entrypoints.app.assets.js.length).toBeGreaterThan(0);
    for (const [key, entry] of Object.entries(entries)) {
      expect(entry.integrity, `missing digest for ${key}`).toBe(
        expectedIntegrity(assets[entry.src.replace(PUBLIC_PATH, '')])
      );
    }
  });

  // SubresourceIntegrityPlugin defaults to ['sha384'] alone. Computing locally keeps the
  // manifest's digest set independent of that option, matching webpack-assets-manifest today.
  it('keeps its digest set independent of the SRI plugin hashFuncNames', async () => {
    const { assets, entries } = await build([new SubresourceIntegrityPlugin(), manifestPlugin()]);

    for (const [key, entry] of Object.entries(entries)) {
      expect(entry.integrity, `narrowed digest for ${key}`).toBe(
        expectedIntegrity(assets[entry.src.replace(PUBLIC_PATH, '')])
      );
      expect(entry.integrity).toContain('sha512-');
    }
  });

  it('records why webpack-assets-manifest is not used: it throws under rspack either way', async () => {
    const legacyPlugin = (integrity: boolean): RspackPluginInstance => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return new WebpackAssetsManifest({
        entrypoints: true,
        integrity,
        integrityHashes: [...INTEGRITY_HASHES],
        publicPath: true,
        output: MANIFEST_NAME,
      }) as unknown as RspackPluginInstance;
    };

    // With integrity on, recordSubresourceIntegrity writes through compilation.assetsInfo,
    // which rspack doesn't expose.
    await expect(compile(createConfig([legacyPlugin(true)]))).rejects.toThrow(
      "Cannot read properties of undefined (reading 'set')"
    );

    // Turning integrity off only moves the failure: handleProcessAssetsAnalyse is tapped
    // unconditionally and calls codeGenerationResults.get(module, chunk.runtime), which
    // rspack's binding rejects because chunk.runtime is a Set. Any asset/resource module
    // reaches it, so there is no configuration under which this library works.
    await expect(compile(createConfig([legacyPlugin(false)]))).rejects.toThrow(
      'Value is none of these types `String`, `Array<T>`'
    );
  });
});
