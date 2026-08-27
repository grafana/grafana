import { type Configuration } from '@rspack/core';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { compile } from './testUtils.ts';
import { widenStatsForAnalyzer } from './webpackStatsCompat.ts';

const OUTPUT_PATH = '/dist';

// Reuses the assets-manifest fixture because it emits into a subdirectory
// (`static/img/`), which is what rspack's asset grouping keys on. A fixture emitting a
// single root-level bundle would pass whether or not grouping is disabled.
function createConfig(widen: boolean): Configuration {
  return {
    context: path.join(import.meta.dirname, '__fixtures__', 'assets-manifest'),
    entry: { app: './index.js' },
    mode: 'production',
    devtool: false,
    // Explicit target so the compilation doesn't depend on the repo's .browserslistrc, which
    // has no section matching NODE_ENV=test and no defaults — rspack would resolve an empty
    // browserslist and throw.
    target: ['web', 'es2022'],
    optimization: { minimize: false },
    experiments: { css: true },
    module: {
      rules: [
        { test: /\.css$/, type: 'css' },
        { test: /\.png$/, type: 'asset/resource' },
      ],
    },
    output: {
      path: OUTPUT_PATH,
      filename: '[name].js',
      chunkFilename: '[name].js',
      assetModuleFilename: 'static/img/[name][ext]',
    },
    plugins: widen ? [widenStatsForAnalyzer] : [],
  };
}

describe('widenStatsForAnalyzer', () => {
  it('leaves rspack reporting a bare summary without it', async () => {
    const { stats } = await compile(createConfig(false));

    // Documents the behaviour the plugin exists to correct: webpack-bundle-analyzer calls
    // `toJson()` with no arguments and would report an empty bundle. If rspack ever adopts
    // webpack's defaults this fails, and the plugin can go.
    const json = stats.toJson();
    expect(json.assets).toBeUndefined();
    expect(json.chunks).toBeUndefined();
    expect(json.modules).toBeUndefined();
  });

  it('makes toJson() report the whole graph', async () => {
    const { stats } = await compile(createConfig(true));

    const json = stats.toJson();
    expect(json.assets?.length).toBeGreaterThan(0);
    expect(json.chunks?.length).toBeGreaterThan(0);
    expect(json.modules?.length).toBeGreaterThan(0);
  });

  it('reports assets flat, not grouped into synthetic tree nodes', async () => {
    const { stats } = await compile(createConfig(true));

    // Grouping replaces real assets with `assets by path` parents holding `children`.
    // webpack-bundle-analyzer drops anything whose type isn't `asset`, so a grouped report
    // silently comes out near-empty rather than failing.
    const assets = stats.toJson().assets ?? [];
    expect(assets.filter((asset) => asset.type !== 'asset')).toEqual([]);
    expect(assets.map((asset) => asset.name)).toContain('static/img/image.png');
  });

  it('leaves console output alone', async () => {
    const [widened, plain] = await Promise.all([compile(createConfig(true)), compile(createConfig(false))]);

    // `toString` goes through `toJson` too. Widening it would replace the build summary
    // with every module in the graph. The summary quotes its own build time, so drop that.
    const withoutDuration = (summary: string) => summary.replace(/in \d+ ms/, 'in <n> ms');
    expect(withoutDuration(widened.stats.toString())).toBe(withoutDuration(plain.stats.toString()));
  });

  it('does not override explicitly requested stats options', async () => {
    const { stats } = await compile(createConfig(true));

    expect(stats.toJson({ all: false, hash: true }).assets).toBeUndefined();
  });
});
