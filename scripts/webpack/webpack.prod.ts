import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { EsbuildPlugin } from 'esbuild-loader';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'node:path';
import { EnvironmentPlugin } from 'webpack';
import WebpackAssetsManifest from 'webpack-assets-manifest';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
import { merge } from 'webpack-merge';
import { SubresourceIntegrityPlugin } from 'webpack-subresource-integrity';

import getEnvConfig from './env-util.ts';
import esbuildOptions from './esbuild.ts';
import FeatureFlaggedSRIPlugin from './plugins/FeatureFlaggedSriPlugin.ts';
import sassRule from './sass.rule.ts';
import common, { type Env } from './webpack.common.ts';

const envConfig = getEnvConfig();

export default (env: Env = {}) =>
  merge(common(env), {
    mode: 'production',
    devtool: process.env.NO_SOURCEMAP === '1' ? false : 'source-map',

    module: {
      // Note: order is bottom-to-top and/or right-to-left
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'esbuild-loader',
            options: esbuildOptions,
          },
        },
        sassRule({ sourceMap: false, preserveUrl: true }),
      ],
    },
    output: {
      crossOriginLoading: 'anonymous',
    },
    optimization: {
      nodeEnv: 'production',
      minimize: Number(env.noMinify) !== 1,
      minimizer: [new EsbuildPlugin(esbuildOptions), new CssMinimizerPlugin()],
    },

    // enable persistent cache for faster builds
    cache:
      Number(env.noMinify) === 1
        ? false
        : {
            type: 'filesystem',
            name: 'grafana-default-production',
            buildDependencies: {
              config: [import.meta.filename],
            },
          },

    plugins: [
      new MiniCssExtractPlugin({
        filename: env.react19 ? 'grafana.[name]-react19.[contenthash].css' : 'grafana.[name].[contenthash].css',
      }),
      new SubresourceIntegrityPlugin(),
      new FeatureFlaggedSRIPlugin(),
      /**
       * I know we have two manifest plugins here.
       * WebpackManifestPlugin was only used in prod before and does not support integrity hashes
       */
      new WebpackAssetsManifest({
        entrypoints: true,
        integrity: true,
        integrityHashes: ['sha384', 'sha512'],
        publicPath: true,
        // This transform filters down the assets to only include the ones that are part of the entrypoints
        // this is all that the backend requires.
        transform(assets, manifest) {
          const entrypointAssets = Object.values(assets[manifest.options.entrypointsKey]).flatMap((entry) => [
            ...(entry.assets.js || []),
            ...(entry.assets.css || []),
          ]);
          const filteredAssets = Object.entries(assets).filter(([assetFileName]) =>
            entrypointAssets.includes(assets[assetFileName].src)
          );
          const result = Object.fromEntries(filteredAssets);
          result[manifest.options.entrypointsKey] = assets[manifest.options.entrypointsKey];

          return result;
        },
        output: env.react19 ? 'assets-manifest-react19.json' : 'assets-manifest.json',
      }),
      new WebpackManifestPlugin({
        fileName: path.join(process.cwd(), env.react19 ? 'manifest-react19.json' : 'manifest.json'),
        filter: (file) => !file.name.endsWith('.map'),
      }),
      function () {
        this.hooks.done.tap('Done', function (stats) {
          if (stats.compilation.errors && stats.compilation.errors.length) {
            console.log(stats.compilation.errors);
            process.exit(1);
          }
        });
      },
      new EnvironmentPlugin(envConfig),
    ],
  });
