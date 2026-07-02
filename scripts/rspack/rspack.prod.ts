import rspack, { type Compiler, type Configuration } from '@rspack/core';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { merge } from 'webpack-merge';

import AssetsManifestRspackPlugin from './plugins/AssetsManifestRspackPlugin.ts';
import FeatureFlaggedSriRspackPlugin from './plugins/FeatureFlaggedSriRspackPlugin.ts';
import common, { type Env } from './rspack.common.ts';

// Rspack port of scripts/webpack/webpack.prod.ts. Differences from the webpack config:
// - EsbuildPlugin → SwcJsMinimizerRspackPlugin (defaults; swc's env targets already come
//   from browserslist in the loader — the minimizer has no targets option).
// - webpack-subresource-integrity → rspack's native SubresourceIntegrityPlugin
//   (top-level export in rspack 2; same default hashFuncNames: ['sha384']).
// - webpack-assets-manifest → AssetsManifestRspackPlugin (prod mode = entrypoint-filtered).
// - WebpackManifestPlugin (repo-root manifest.json) intentionally NOT ported — nothing
//   reads that file.
// - No persistent cache for the spike (webpack uses a filesystem cache here).
export default (env: Env = {}) => {
  const prodConfig: Configuration = {
    mode: 'production',
    devtool: process.env.NO_SOURCEMAP === '1' ? false : 'source-map',

    output: {
      crossOriginLoading: 'anonymous',
    },

    optimization: {
      nodeEnv: 'production',
      minimize: Number(env.noMinify) !== 1,
      // css-minimizer-webpack-plugin is typed against webpack but is rspack-compatible
      // (uses the processAssets/compiler.webpack compat surface).
      minimizer: [new rspack.SwcJsMinimizerRspackPlugin(), new CssMinimizerPlugin()],
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
      // Must be registered BEFORE AssetsManifestRspackPlugin: both tap processAssets at
      // PROCESS_ASSETS_STAGE_REPORT and same-stage taps run in registration order, so the
      // manifest hashes the feature-flag-patched runtime bytes.
      new FeatureFlaggedSriRspackPlugin(),
      new AssetsManifestRspackPlugin({
        mode: 'prod',
        react19: Boolean(env.react19),
      }),
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

  return merge(common(env), prodConfig);
};
