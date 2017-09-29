
const webpack = require('webpack');
const path = require('path');
const { CheckerPlugin } = require('awesome-typescript-loader')

module.exports = {
  entry: {
    'app': './public/app/index.ts'
  },
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, './public_gen'),
    filename: 'app/[name].bundle.js',
    chunkFilename: 'app/[name].bundle.js',
    publicPath: "public/",
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.es6', '.js', '.json'],
    alias: {
    },
    modules: [
      path.resolve('public'),
      path.resolve('node_modules')
    ],
  },
  node: {
    fs: 'empty',
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        enforce: 'pre',
        exclude: /node_modules/,
        use: {
          loader: 'tslint-loader',
          options: {
            emitErrors: false
          }
        }
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          // { loader: 'babel-loader', options:  { "presets": "es2015" } },
          { loader: "awesome-typescript-loader" }
        ]
      },
      {
        test: require.resolve('jquery'),
        use: [
          {
            loader: 'expose-loader',
            query: 'jQuery'
          },
          {
            loader: 'expose-loader',
            query: '$'
          }
        ]
      }
    ]
  },
  plugins: [
    new CheckerPlugin(),
  ]
};
