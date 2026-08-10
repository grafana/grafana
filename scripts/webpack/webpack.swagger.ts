import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { EsbuildPlugin } from 'esbuild-loader';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { createRequire } from 'module';
import path from 'node:path';
import { type Configuration } from 'webpack';
import { WebpackAssetsManifest } from 'webpack-assets-manifest';
import WebpackBar from 'webpackbar';

import CorsWorkerPlugin from './plugins/CorsWorkerPlugin.ts';
import FeatureFlaggedSRIPlugin from './plugins/FeatureFlaggedSriPlugin.ts';
import { manifestPluginOptions } from './plugins/assetsManifest.ts';
import { sassRule, esbuildRule, esbuildOptions } from './rules.ts';
import { type Env } from './webpack.common.ts';

// SRI plugin has broken esm builds so we use require.
// https://github.com/waysact/webpack-subresource-integrity/issues/236
const require = createRequire(import.meta.url);
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

export default (env: Env = {}): Configuration => {
  const config: Configuration = {
    name: 'swagger',
    mode: env.develop ? 'development' : 'production',
    cache: {
      type: 'filesystem',
      name: env.develop ? 'grafana-swagger-dev' : 'grafana-swagger-prod',
      buildDependencies: {
        config: [import.meta.filename],
      },
    },
    devtool: env.develop ? 'eval-source-map' : 'source-map',
    entry: {
      app: './public/swagger/index.tsx',
    },
    ignoreWarnings: [
      {
        module: /@kusto\/language-service\/bridge\.min\.js$/,
        message: /^Critical dependency: the request of a dependency is an expression$/,
      },
    ],
    module: {
      rules: [
        esbuildRule,
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
      minimizer: [new EsbuildPlugin(esbuildOptions), new CssMinimizerPlugin()],
      chunkIds: env.develop ? 'named' : 'deterministic',
    },
    output: {
      clean: true,
      path: path.resolve(import.meta.dirname, '../../public/build-swagger'),
      publicPath: 'public/build-swagger/',
      crossOriginLoading: 'anonymous',
      filename: env.develop ? '[name].js' : '[name].[contenthash].js',
    },
    plugins: [
      new CorsWorkerPlugin(),
      new MiniCssExtractPlugin({
        filename: env.develop ? '[name].css' : '[name].[contenthash].css',
      }),
      new SubresourceIntegrityPlugin(),
      new FeatureFlaggedSRIPlugin(),
      new WebpackAssetsManifest(manifestPluginOptions),
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
