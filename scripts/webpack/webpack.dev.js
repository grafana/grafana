'use strict';

const ESLintPlugin = require('eslint-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const { DefinePlugin } = require('webpack');
const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (env = {}) =>
  merge(common, {
    devtool: 'inline-source-map',
    mode: 'development',

    entry: {
      app: './public/app/index.ts',
      dark: './public/sass/grafana.dark.scss',
      light: './public/sass/grafana.light.scss',
    },

    // If we enabled watch option via CLI
    watchOptions: {
      ignored: /node_modules/,
    },

    module: {
      // Note: order is bottom-to-top and/or right-to-left
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              cacheCompression: false,
            },
          },
          exclude: /node_modules/,
        },
        require('./sass.rule.js')({
          sourceMap: false,
          preserveUrl: false,
        }),
      ],
    },

    // https://webpack.js.org/guides/build-performance/#output-without-path-info
    output: {
      pathinfo: false,
      filename: '[name].js',
    },

    // https://webpack.js.org/guides/build-performance/#avoid-extra-optimization-steps
    optimization: {
      moduleIds: 'named',
      runtimeChunk: true,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false,
    },

    // enable persistent cache for faster cold starts
    cache: {
      type: 'filesystem',
      name: 'grafana-default-development',
      buildDependencies: {
        config: [__filename],
      },
    },

    plugins: [
      parseInt(env.noTsCheck, 10)
        ? new DefinePlugin({}) // bogus plugin to satisfy webpack API
        : new ForkTsCheckerWebpackPlugin({
            async: true, // don't block webpack emit
            typescript: {
              mode: 'write-references',
              memoryLimit: 4096,
              diagnosticOptions: {
                semantic: true,
                syntactic: true,
              },
            },
          }),
      // next major version of ForkTsChecker is dropping support for ESLint
      new ESLintPlugin({
        lintDirtyModulesOnly: true, // don't lint on start, only lint changed files
        extensions: ['.ts', '.tsx'],
      }),
      new MiniCssExtractPlugin({
        filename: 'grafana.[name].[contenthash].css',
      }),
      new HtmlWebpackPlugin({
        filename: path.resolve(__dirname, '../../public/views/error.html'),
        template: path.resolve(__dirname, '../../public/views/error-template.html'),
        inject: false,
        chunksSortMode: 'none',
        excludeChunks: ['dark', 'light'],
      }),
      new HtmlWebpackPlugin({
        filename: path.resolve(__dirname, '../../public/views/index.html'),
        template: path.resolve(__dirname, '../../public/views/index-template.html'),
        hash: true,
        inject: false,
        chunksSortMode: 'none',
        excludeChunks: ['dark', 'light'],
      }),
      new DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('development'),
        },
      }),
      // new BundleAnalyzerPlugin({
      //   analyzerPort: 8889
      // })
    ],
  });
