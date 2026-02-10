'use strict';

const browserslist = require('browserslist');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { EsbuildPlugin } = require('esbuild-loader');
const { resolveToEsbuildTarget } = require('esbuild-plugin-browserslist');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const { EnvironmentPlugin, NormalModuleReplacementPlugin } = require('webpack');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const { merge } = require('webpack-merge');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

const getEnvConfig = require('./env-util.js');
const FeatureFlaggedSRIPlugin = require('./plugins/FeatureFlaggedSriPlugin');
const common = require('./webpack.common.js');
const esbuildTargets = resolveToEsbuildTarget(browserslist(), { printUnknownTargets: false });

// esbuild-loader 3.0.0+ requires format to be set to prevent it
// from defaulting to 'iife' which breaks monaco/loader once minified.
const esbuildOptions = {
  target: esbuildTargets,
  format: undefined,
  jsx: 'automatic',
};

const envConfig = getEnvConfig();

module.exports = (env = {}) =>
  merge(common(env), {
    mode: 'production',
    devtool: 'source-map',

    entry: {
      dark: './public/sass/grafana.dark.scss',
      light: './public/sass/grafana.light.scss',
    },

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
        require('./sass.rule.js')({
          sourceMap: false,
          preserveUrl: true,
        }),
      ],
    },
    output: {
      crossOriginLoading: 'anonymous',
    },
    optimization: {
      nodeEnv: 'production',
      minimize: parseInt(env.noMinify, 10) !== 1,
      minimizer: [new EsbuildPlugin(esbuildOptions), new CssMinimizerPlugin()],
    },

    // enable persistent cache for faster builds
    cache:
      parseInt(env.noMinify, 10) === 1
        ? false
        : {
            type: 'filesystem',
            name: 'grafana-default-production',
            buildDependencies: {
              config: [__filename],
            },
          },

    plugins: [
      // Replace any imports of test libraries with empty modules to prevent them from being bundled
      // TODO figure out where these are being included, stop that from happening and remove this
      new NormalModuleReplacementPlugin(/@testing-library/, (resource) => {
        resource.request = require.resolve('./empty.js');
      }),
      new MiniCssExtractPlugin({
        filename: env.react19 ? 'grafana.[name].[contenthash].css' : 'grafana.[name]-react18.[contenthash].css',
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
        output: env.react19 ? 'assets-manifest.json' : 'assets-manifest-react18.json',
      }),
      new WebpackManifestPlugin({
        fileName: path.join(process.cwd(), env.react19 ? 'manifest.json' : 'manifest-react18.json'),
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
