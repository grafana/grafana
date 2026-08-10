import rspack, { type Configuration } from '@rspack/core';
import path from 'node:path';
import WebpackBar from 'webpackbar';

import AssetsManifestPlugin from './plugins/AssetsManifestPlugin.ts';
import CorsWorkerPlugin from './plugins/CorsWorkerPlugin.ts';
import FeatureFlaggedSRIPlugin from './plugins/FeatureFlaggedSriPlugin.ts';
import { swcRule, sassRule, type Env } from './rspack.common.ts';

// Port of scripts/webpack/webpack.swagger.ts. Like that config this stands alone rather than
// extending rspack.common.ts — the swagger page is a separate entry with its own resolve
// roots and no plugin/theme machinery.
//
// Output goes to public/build-swagger-rspack, NOT public/build-swagger. pkg/api/swagger.go
// hardcodes "build-swagger" and does not take part in the feature-flagged build directory
// selection, so it reads webpack's output under both flag states. Writing here would mean
// the rspack build silently overwrites the directory the backend is still serving — exactly
// the collision public/build-rspack exists to avoid. Teaching the backend to pick the
// swagger directory the same way it picks the app one is a follow-up on #129729; until that
// lands nothing serves this directory, which is the intended safe state.
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
      publicPath: 'public/build-swagger-rspack/',
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
      new AssetsManifestPlugin(),
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
