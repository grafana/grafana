'use strict';

const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CleanWebpackPlugin = require('clean-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const extractSass = new ExtractTextPlugin({
  filename: "grafana.[name].css"
});

module.exports = merge(common, {
  devtool: "cheap-module-source-map",

  entry: {
    app: './public/app/index.ts',
    dark: './public/sass/grafana.dark.scss',
    light: './public/sass/grafana.light.scss',
    vendor: require('./dependencies'),
  },

  output: {
    path: path.resolve(__dirname, '../../public/build'),
    filename: '[name].[hash].js',
    // Keep publicPath relative for host.com/grafana/ deployments
    publicPath: "public/build/",
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
        use: {
          loader: 'awesome-typescript-loader',
          options: {
            useCache: true,
          },
        }
      },
      require('./sass.rule.js')({
        sourceMap: true, minimize: false, preserveUrl: false
      }, extractSass),
      {
        test: /\.(png|jpg|gif|ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
        loader: 'file-loader'
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
    }),
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
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
