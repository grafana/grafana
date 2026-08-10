import rspack, { type Configuration } from '@rspack/core';
import path from 'node:path';
import { RspackManifestPlugin } from 'rspack-manifest-plugin';
import WebpackBar from 'webpackbar';

import CorsWorkerPlugin from './plugins/CorsWorkerPlugin.ts';
import FeatureFlaggedSRIPlugin from './plugins/FeatureFlaggedSriPlugin.ts';
import { assetsManifestOptions } from './plugins/assetsManifest.ts';
import { swcRule, sassRule, type Env } from './rspack.common.ts';

// Port of scripts/webpack/webpack.swagger.ts. Like that config this stands alone rather than
// extending rspack.common.ts — the swagger page is a separate entry with its own resolve
// roots and no plugin/theme machinery.
//
// Output goes to public/build-swagger-rspack while publicPath stays public/build-swagger/,
// the same split rspack.prod.ts uses for the app: a separate directory on disk, one shared
// URL space. pkg/api/swagger.go hardcodes "build-swagger" and does not take part in the
// feature-flagged directory selection, so writing to it directly would mean the rspack build
// silently overwrites what the backend is still serving. Holding the public path is what
// keeps public/swagger/index.tsx correct without editing it — its derivation of
// __grafana_public_path__ only breaks if the URL segment changes, and it does not.
// Teaching the backend to pick the swagger directory the way it picks the app one is a
// follow-up on #129729; until that lands nothing serves this directory, the intended safe
// state.
export default (env: Env = {}): Configuration => {
  const config: Configuration = {
    name: 'swagger',
    mode: env.develop ? 'development' : 'production',

    // NOTE: no `cache: { type: 'filesystem' }` counterpart to webpack.swagger.ts, matching
    // the call made in rspack.dev.ts and rspack.prod.ts.
    devtool: env.develop ? 'eval-source-map' : 'source-map',

    // Mirrors rspack.common.ts: rspack leaves the runtime `define.amd` check in UMD wrappers
    // in place unless this is set, where webpack resolves the branch at build time.
    amd: {},

    entry: {
      app: './public/swagger/index.tsx',
    },
    ignoreWarnings: [
      // The webpack config matches this with the `{ module, message }` object form. Rspack's
      // warning message carries extra formatting, so an anchored message regex never
      // matches — hence the function form, as in rspack.common.ts.
      (warning) =>
        warning.message.includes('Critical dependency: the request of a dependency is an expression') &&
        warning.module != null &&
        /@kusto[\\/]language-service[\\/]bridge\.min\.js/.test(warning.module.readableIdentifier()),
    ],
    module: {
      parser: {
        javascript: {
          // Same downgrade as rspack.common.ts: rspack raises missing ESM exports as hard
          // errors where webpack reports warnings.
          exportsPresence: 'warn',
        },
      },
      rules: [
        swcRule,
        sassRule,
        {
          test: /\.(svg)(\?.*)?$/,
          type: 'asset/resource',
          generator: { filename: 'static/img/[name].[hash:8][ext]' },
        },
      ],
    },
    optimization: {
      nodeEnv: env.develop ? 'development' : 'production',
      minimize: !Boolean(env.develop),
      // `targets: []` means "minify, do not transpile" — see the note in rspack.prod.ts.
      minimizer: [
        new rspack.SwcJsMinimizerRspackPlugin(),
        new rspack.LightningCssMinimizerRspackPlugin({ minimizerOptions: { targets: [] } }),
      ],
      chunkIds: env.develop ? 'named' : 'deterministic',
    },
    output: {
      clean: true,
      path: path.resolve(import.meta.dirname, '../../public/build-swagger-rspack'),
      publicPath: 'public/build-swagger/',
      crossOriginLoading: 'anonymous',
      filename: env.develop ? '[name].js' : '[name].[contenthash].js',
    },
    plugins: [
      new CorsWorkerPlugin(),
      new rspack.CssExtractRspackPlugin({
        filename: env.develop ? '[name].css' : '[name].[contenthash].css',
      }),
      new rspack.SubresourceIntegrityPlugin(),
      new FeatureFlaggedSRIPlugin(),
      new RspackManifestPlugin(assetsManifestOptions),
    ],
    resolve: {
      conditionNames: ['@grafana-app/source', '...'],
      extensions: ['.ts', '.tsx', '.es6', '.js', '.json', '.svg'],
      fallback: {
        fs: false,
      },
      modules: [
        // default value
        'node_modules',
        // required for 'bare' imports (like 'app/core/utils' etc)
        path.resolve('public'),
      ],
    },
    watchOptions: {
      ignored: '**/node_modules',
    },
  };

  if (env.develop) {
    config.stats = 'minimal';
    config.plugins?.push(
      new WebpackBar({
        color: '#43ac33',
        name: 'Swagger',
      })
    );
  }

  return config;
};
