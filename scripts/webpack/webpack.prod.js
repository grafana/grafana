'use strict';

const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const common = require('./webpack.common.js');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = (env = {}) =>
  merge(common, {
    mode: 'production',
    //devtool: 'source-map',

    entry: {
      dark: './public/sass/grafana.dark.scss',
      light: './public/sass/grafana.light.scss',
    },

    module: {
      // Note: order is bottom-to-top and/or right-to-left
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                cacheDirectory: true,
                cacheCompression: false,
              },
            },
          ],
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
        new TerserPlugin({
          parallel: false,
        }),
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
        filename: 'grafana.[name].[fullhash].css',
      }),
      new HtmlWebpackPlugin({
        filename: path.resolve(__dirname, '../../public/views/error.html'),
        template: path.resolve(__dirname, '../../public/views/error-template.html'),
        inject: false,
        excludeChunks: ['dark', 'light'],
        chunksSortMode: 'none',
      }),
      new HtmlWebpackPlugin({
        filename: path.resolve(__dirname, '../../public/views/index.html'),
        template: path.resolve(__dirname, '../../public/views/index-template.html'),
        inject: false,
        excludeChunks: ['manifest', 'dark', 'light'],
        chunksSortMode: 'none',
      }),
      function () {
        this.hooks.done.tap('Done', function (stats) {
          if (stats.compilation.errors && stats.compilation.errors.length) {
            console.log(stats.compilation.errors);
            process.exit(1);
          }
        });
      },
    ],
  });
