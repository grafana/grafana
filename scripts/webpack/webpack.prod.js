'use strict';

const browserslist = require('browserslist');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { EsbuildPlugin } = require('esbuild-loader');
const { resolveToEsbuildTarget } = require('esbuild-plugin-browserslist');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const { EnvironmentPlugin } = require('webpack');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const { merge } = require('webpack-merge');

const getEnvConfig = require('./env-util.js');
const common = require('./webpack.common.js');
const esbuildTargets = resolveToEsbuildTarget(browserslist(), { printUnknownTargets: false });

// esbuild-loader 3.0.0+ requires format to be set to prevent it
// from defaulting to 'iife' which breaks monaco/loader once minified.
const esbuildOptions = {
  target: esbuildTargets,
  format: undefined,
  jsx: 'automatic',
  keepNames: true,
  minifyIdentifiers: false,
};

const envConfig = getEnvConfig();

const DEPLOYMENT = process.env.DEPLOYMENT;
const isProfilingEnabled = ['dev', 'staging'].includes(DEPLOYMENT);

module.exports = (env = {}) => merge(common, {
  mode: 'production',
  devtool: 'source-map',

  entry: {
    app: './public/app/index.ts',
    dark: './public/sass/grafana.dark.scss',
    light: './public/sass/grafana.light.scss',
  },

  resolve: isProfilingEnabled ? {
    alias: {
      // Enable React DevTools profiling in production when profiling flag is set
      'react-dom$': 'react-dom/profiling',
      'scheduler/tracing': 'scheduler/tracing-profiling',
    },
  } : {},

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
        preserveUrl: false,
      }),
    ],
  },
  optimization: {
    nodeEnv: 'production',
    minimize: parseInt(env.noMinify, 10) !== 1,
    minimizer: [
      new EsbuildPlugin(esbuildOptions),
      new CssMinimizerPlugin(),
    ],
  },

  // enable persistent cache for faster builds
  cache: {
    type: 'filesystem',
    name: 'grafana-default-production',
    buildDependencies: {
      config: [__filename],
    },
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: 'grafana.[name].[contenthash].css',
    }),
    /**
     * I know we have two manifest plugins here.
     * WebpackManifestPlugin was only used in prod before and does not support integrity hashes
     */
    new WebpackAssetsManifest({
      entrypoints: true,
      integrity: true,
      publicPath: true,
    }),
    new WebpackManifestPlugin({
      fileName: path.join(process.cwd(), 'manifest.json'),
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
