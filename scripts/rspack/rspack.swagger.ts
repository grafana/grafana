import rspack, { type Configuration } from '@rspack/core';
import path from 'node:path';
import { RspackManifestPlugin } from 'rspack-manifest-plugin';
import WebpackBar from 'webpackbar';

import CorsWorkerPlugin from './plugins/CorsWorkerPlugin.ts';
import FeatureFlaggedSRIPlugin from './plugins/FeatureFlaggedSriPlugin.ts';
import { assetsManifestOptions } from './plugins/assetsManifest.ts';
import { swcRule, sassRule, type Env } from './rspack.common.ts';

export default (env: Env = {}): Configuration => {
  const config: Configuration = {
    name: 'swagger',
    mode: env.develop ? 'development' : 'production',

    devtool: env.develop ? 'eval-source-map' : 'source-map',

    // See rspack.common.ts: without this, UMD wrappers register as AMD and export nothing.
    amd: {},

    entry: {
      app: './public/swagger/index.tsx',
    },
    ignoreWarnings: [
      // Function form because rspack's warning message carries extra formatting, which an
      // anchored message regex never matches.
      (warning) =>
        warning.message.includes('Critical dependency: the request of a dependency is an expression') &&
        warning.module != null &&
        /@kusto[\\/]language-service[\\/]bridge\.min\.js/.test(warning.module.readableIdentifier()),
    ],
    module: {
      parser: {
        javascript: {
          // Rspack raises missing ESM exports as hard errors. See rspack.common.ts.
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
