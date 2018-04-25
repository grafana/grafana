'use strict';

const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackHarddiskPlugin = require('html-webpack-harddisk-plugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CleanWebpackPlugin = require('clean-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const TARGET = process.env.npm_lifecycle_event;
const HOT = TARGET === 'start';

const extractSass = new ExtractTextPlugin({
  filename: "grafana.[name].css",
  disable: HOT
});

const entries = HOT ? {
  app: [
    'webpack-dev-server/client?http://localhost:3333',
    './public/app/dev.ts',
  ],
  vendor: require('./dependencies'),
} : {
    app: './public/app/index.ts',
    dark: './public/sass/grafana.dark.scss',
    light: './public/sass/grafana.light.scss',
    vendor: require('./dependencies'),
  };

module.exports = merge(common, {
  devtool: "cheap-module-source-map",

  entry: entries,

  resolve: {
    extensions: ['.scss', '.ts', '.tsx', '.es6', '.js', '.json', '.svg', '.woff2', '.png'],
  },

  devServer: {
    publicPath: '/public/build/',
    hot: HOT,
    port: 3333,
    proxy: {
      '!/public/build': 'http://localhost:3000'
    }
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        enforce: 'pre',
        exclude: /node_modules/,
        use: {
          loader: 'tslint-loader',
          options: {
            emitErrors: true,
            typeCheck: false,
          }
        }
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              plugins: [
                'react-hot-loader/babel',
              ],
            },
          },
          {
            loader: 'awesome-typescript-loader',
            options: {
              useCache: true,
            },
          }
        ]
      },
      require('./sass.rule.js')({
        sourceMap: true, minimize: false, preserveUrl: true
      }, extractSass),
      {
        test: /\.(ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
        loader: 'file-loader'
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          {
            loader: 'file-loader',
            options: {}
          }
        ]
      },
    ]
  },

  plugins: [
    new CleanWebpackPlugin('../public/build', { allowExternal: true }),
    extractSass,
    new HtmlWebpackPlugin({
      filename: path.resolve(__dirname, '../../public/views/index.html'),
      template: path.resolve(__dirname, '../../public/views/index.template.html'),
      inject: 'body',
      chunks: ['manifest', 'vendor', 'app'],
      alwaysWriteToDisk: HOT
    }),
    new HtmlWebpackHarddiskPlugin(),
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      'GRAFANA_THEME': JSON.stringify(process.env.GRAFANA_THEME || 'dark'),
      'process.env': {
        'NODE_ENV': JSON.stringify('development')
      }
    }),
    new webpack.optimize.CommonsChunkPlugin({
      names: ['vendor', 'manifest'],
    }),
    // new BundleAnalyzerPlugin({
    //   analyzerPort: 8889
    // })
  ]
});
