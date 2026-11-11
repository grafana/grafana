import rspack, { type Chunk, type Compiler, type Configuration } from '@rspack/core';
import { RspackManifestPlugin } from 'rspack-manifest-plugin';
import { merge } from 'webpack-merge';

import FeatureFlaggedSRIPlugin from './plugins/FeatureFlaggedSriPlugin.ts';
import { createAssetsManifestOptions } from './plugins/assetsManifest.ts';
import bootConfig from './rspack.boot.ts';
import common, { type Env, PUBLIC_PATH } from './rspack.common.ts';
import swaggerConfig from './rspack.swagger.ts';

// Workers run as ES modules, but lazy chunks use the array-push format, so a worker cannot load a
// split chunk and silently never starts. Only split chunks in the app's runtime, which
// `runtimeChunk: 'single'` names 'runtime', and leave each worker in one file.
const APP_RUNTIME = 'runtime';
const isAppChunk = (chunk: Chunk) => chunk.runtime.has(APP_RUNTIME);
const isInitialAppChunk = (chunk: Chunk) => chunk.canBeInitial() && isAppChunk(chunk);

export default (env: Env = {}) => {
  const prodConfig: Configuration = {
    name: 'grafana',
    mode: 'production',
    devtool: process.env.NO_SOURCEMAP === '1' ? false : 'source-map',

    output: {
      crossOriginLoading: 'anonymous',
      // Lazy chunks load through <script> tags rather than import(), which can't carry an
      // integrity attribute and would leave them unchecked when SRI checks are enabled. Kept out
      // of the dev config because HMR there fetches its ES module update manifest as JSON.
      chunkFormat: 'array-push',
      chunkLoading: 'jsonp',
    },

    optimization: {
      nodeEnv: 'production',
      minimize: Number(env.noMinify) !== 1,
      minimizer: [
        new rspack.SwcJsMinimizerRspackPlugin(),
        // `targets: []` means "minify, do not transpile".
        new rspack.LightningCssMinimizerRspackPlugin({ minimizerOptions: { targets: [] } }),
      ],
      runtimeChunk: 'single',
      splitChunks: {
        chunks: isAppChunk,
        minChunks: 1,
        cacheGroups: {
          moment: {
            test: /[\\/]node_modules[\\/]moment[\\/].*[jt]sx?$/,
            chunks: isInitialAppChunk,
            priority: 20,
            enforce: true,
          },
          defaultVendors: {
            test: /[\\/]node_modules[\\/].*[jt]sx?$/,
            chunks: isInitialAppChunk,
            priority: -10,
            reuseExistingChunk: true,
            enforce: true,
          },
          default: {
            priority: -20,
            chunks: isAppChunk,
            test: /.*[jt]sx?$/,
            reuseExistingChunk: true,
          },
        },
      },
    },

    plugins: [
      new rspack.SubresourceIntegrityPlugin(),
      new FeatureFlaggedSRIPlugin(),
      new RspackManifestPlugin(createAssetsManifestOptions(PUBLIC_PATH)),
      function (this: Compiler) {
        this.hooks.done.tap('Done', function (stats) {
          if (stats.compilation.errors && stats.compilation.errors.length) {
            console.log(stats.compilation.errors);
            process.exit(1);
          }
        });
      },
    ],
  };

  const mergedProdConfig = merge(common(env), prodConfig);
  return Object.assign([mergedProdConfig, swaggerConfig(env), bootConfig(env)], { parallelism: 2 });
};
