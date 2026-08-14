import rspack, { type Compiler, type Configuration } from '@rspack/core';
import { RspackManifestPlugin } from 'rspack-manifest-plugin';
import { merge } from 'webpack-merge';

import FeatureFlaggedSRIPlugin from './plugins/FeatureFlaggedSriPlugin.ts';
import { assetsManifestOptions } from './plugins/assetsManifest.ts';
import common, { type Env } from './rspack.common.ts';
import swaggerConfig from './rspack.swagger.ts';

export default (env: Env = {}) => {
  const prodConfig: Configuration = {
    name: 'grafana',
    mode: 'production',
    devtool: process.env.NO_SOURCEMAP === '1' ? false : 'source-map',

    output: {
      crossOriginLoading: 'anonymous',
    },

    optimization: {
      nodeEnv: 'production',
      minimize: Number(env.noMinify) !== 1,
      minimizer: [
        new rspack.SwcJsMinimizerRspackPlugin(),
        // `targets: []` means "minify, do not transpile" — postcss already handles prefixes.
        new rspack.LightningCssMinimizerRspackPlugin({ minimizerOptions: { targets: [] } }),
      ],
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        minChunks: 1,
        cacheGroups: {
          moment: {
            test: /[\\/]node_modules[\\/]moment[\\/].*[jt]sx?$/,
            chunks: 'initial',
            priority: 20,
            enforce: true,
          },
          defaultVendors: {
            test: /[\\/]node_modules[\\/].*[jt]sx?$/,
            chunks: 'initial',
            priority: -10,
            reuseExistingChunk: true,
            enforce: true,
          },
          default: {
            priority: -20,
            chunks: 'all',
            test: /.*[jt]sx?$/,
            reuseExistingChunk: true,
          },
        },
      },
    },

    plugins: [
      new rspack.SubresourceIntegrityPlugin(),
      new FeatureFlaggedSRIPlugin(),
      new RspackManifestPlugin(assetsManifestOptions),
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
  return Object.assign([mergedProdConfig, swaggerConfig(env)], { parallelism: 2 });
};
