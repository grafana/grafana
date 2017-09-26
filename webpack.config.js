
const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: {
    'app': './public/app/app2.ts'
  },
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, './public_gen'),
    filename: 'app/[name].bundle.js'
  },
  resolve: {
    extensions: ['.ts', 'tsx', '.es6', '.js', '.json'],
    alias: {
      ace: 'node_modules/ace-builds/src',
    },
    modules: [
      path.resolve('./public'),
      path.resolve('./node_modules')
    ],
  },
  node: {
    fs: 'empty',
  },
  module: {
    rules: [
      { enforce: 'pre', test: /\.(ts|tsx)$/, exclude: /node_modules/, loader: 'tslint-loader' },
      { test: /\.(ts|tsx)$/, exclude: /node_modules/, loader: 'ts-loader' },
      { test: /\.json$/, loader: 'json-loader' },
      { test: /\.css$/, loader: 'style-loader!css-loader' },
      { test: /\.(gif|png|jpe?g)$/i, loader: 'file-loader?name=dist/images/[name].[ext]' },
      { test: /\.woff2?$/, loader: 'url-loader?name=dist/fonts/[name].[ext]&limit=10000&mimetype=application/font-woff' },
      { test: /\.(ttf|eot|svg)$/, loader: 'file-loader?name=dist/fonts/[name].[ext]' }
    ]
  },
  plugins: []
};
