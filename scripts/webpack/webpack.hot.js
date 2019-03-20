'use strict';

const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackHarddiskPlugin = require('html-webpack-harddisk-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const IgnoreNotFoundExportPlugin = require("./IgnoreNotFoundExportPlugin.js");

module.exports = merge(common, {
  entry: {
    app: ['webpack-dev-server/client?http://localhost:3333', './public/app/dev.ts'],
  },

  output: {
    path: path.resolve(__dirname, '../../public/build'),
    filename: '[name].[hash].js',
    publicPath: '/public/build/',
    pathinfo: false,
  },

  resolve: {
    extensions: ['.scss', '.ts', '.tsx', '.es6', '.js', '.json', '.svg', '.woff2', '.png', '.html'],
  },

  devtool: 'eval-source-map',

  devServer: {
    publicPath: '/public/build/',
    hot: true,
    port: 3333,
    proxy: {
      '!/public/build': 'http://localhost:3000',
    },
  },

  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              babelrc: false,
              plugins: [
                [require('@rtsao/plugin-proposal-class-properties'), { loose: true }],
                'angularjs-annotate',
                '@babel/plugin-syntax-dynamic-import', // needed for `() => import()` in routes.ts
                'react-hot-loader/babel',
              ],
              presets: [
                [
                  '@babel/preset-env',
                  {
                    targets: { browsers: 'last 3 versions' },
                    useBuiltIns: 'entry',
                  },
                ],
                '@babel/preset-typescript',
                '@babel/preset-react',
              ],
            },
          },
        ],
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader', // creates style nodes from JS strings
          'css-loader', // translates CSS into CommonJS
          {
            loader: 'postcss-loader',
            options: {
              config: { path: __dirname + '/postcss.config.js' },
            },
          },
          {
            loader: 'sass-loader'
          }
        ],
      },
      {
        test: /\.(png|jpg|gif|ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
        loader: 'file-loader',
      },
    ],
  },

  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      filename: path.resolve(__dirname, '../../public/views/index.html'),
      template: path.resolve(__dirname, '../../public/views/index-template.html'),
      inject: 'body',
      alwaysWriteToDisk: true,
    }),
    new HtmlWebpackHarddiskPlugin(),
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      GRAFANA_THEME: JSON.stringify(process.env.GRAFANA_THEME || 'dark'),
      'process.env': {
        NODE_ENV: JSON.stringify('development'),
      },
    }),
    new IgnoreNotFoundExportPlugin(),
  ],
});
