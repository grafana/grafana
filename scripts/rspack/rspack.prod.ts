import rspack, { type Compiler, type Configuration } from '@rspack/core';
import { merge } from 'webpack-merge';

import AssetsManifestPlugin from './plugins/AssetsManifestPlugin.ts';
import FeatureFlaggedSRIPlugin from './plugins/FeatureFlaggedSriPlugin.ts';
import common, { type Env } from './rspack.common.ts';
import swaggerConfig from './rspack.swagger.ts';

// Port of scripts/webpack/webpack.prod.ts. Differences from the webpack config:
//
// - EsbuildPlugin → SwcJsMinimizerRspackPlugin. swc has no `target` option here — the
//   browserslist targets are applied by builtin:swc-loader in rspack.common.ts, and the
//   minifier only has to avoid emitting newer syntax. Shipped JS shrinks ~9% relative to
//   esbuild; that is swc being a better minifier, not a tree-shaking difference.
// - CssMinimizerPlugin (cssnano) → LightningCssMinimizerRspackPlugin, with `targets: []`.
//   The empty targets list is load-bearing: it means "minify, do not transpile", which is
//   what cssnano did. Left to itself the plugin derives its targets from `target: 'web'`
//   in rspack.common.ts, reads that as "every browser ever", and rewrites modern CSS for
//   ancient ones — logical properties become :lang() fallback chains repeated for
//   :-webkit-any/:-moz-any/:is, oklch() becomes lab(), clamp() becomes max(min()),
//   media range syntax becomes min-width/max-width. That grew shipped CSS 12% for browsers
//   the production browserslist does not target. Transpiling is not the minifier's job
//   here anyway: autoprefixer already runs in the shared postcss pipeline ahead of it.
//   Passing real browserslist targets instead is not an option — a query string is parsed
//   by lightningcss's own bundled browser data, which is too old to know our Chrome
//   version, and the precomputed Targets object the types advertise is rejected by the
//   plugin's option normalisation.
// - webpack-subresource-integrity → rspack's native SubresourceIntegrityPlugin, a top-level
//   export in rspack 2 rather than an `experiments` entry. Its default
//   hashFuncNames: ['sha384'] matches webpack-subresource-integrity's, so the script tags
//   the backend renders carry the same algorithm.
// - webpack-assets-manifest → AssetsManifestPlugin.
// - No persistent `cache: { type: 'filesystem' }`. rspack's native cache covers it, and the
//   webpack-style cache costs ~2.6GB per checkout. Same call as rspack.dev.ts.
// - WebpackManifestPlugin is deliberately not ported. It wrote a second manifest to
//   manifest.json at the repo root; that file is gitignored and has no reader in this repo.
//
// `module.parser.javascript.exportsPresence` and lint behaviour are not set here: the first
// is already 'warn' globally in rspack.common.ts, and prod never linted (webpack.prod.ts
// registers no ESLint plugin), so there is nothing to keep in step with rspack.dev.ts.
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
      // Rewrites the load_script runtime module to gate the SRI attributes behind
      // window.__grafanaAssetSriChecksEnabled. It taps compilation.hooks.runtimeModule,
      // which runs during code generation, so it is ordered against neither the SRI plugin
      // nor AssetsManifestPlugin — both of those work on finished assets.
      new FeatureFlaggedSRIPlugin(),
      new AssetsManifestPlugin(),
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
