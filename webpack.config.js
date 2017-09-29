
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
        use: {
          loader: 'tslint-loader',
          options: {
            emitErrors: false
          }
        }
      },
      {
        test: /\.tsx?$/,
        use: [
          // { loader: 'babel-loader', options:  { "presets": "es2015" } },
          { loader: "awesome-typescript-loader" }
        ]
      },
      { test: /\.json$/, loader: 'json-loader' },
      { test: /\.css$/, loader: 'style-loader!css-loader' },
      { test: /\.(gif|png|jpe?g)$/i, loader: 'file-loader?name=dist/images/[name].[ext]' },
      { test: /\.woff2?$/, loader: 'url-loader?name=dist/fonts/[name].[ext]&limit=10000&mimetype=application/font-woff' },
      { test: /\.(ttf|eot|svg)$/, loader: 'file-loader?name=dist/fonts/[name].[ext]' },
      // {
      //   test: require.resolve(__dirname + '/public/vendor/tagsinput/bootstrap-tagsinput.js'),
      //   use: 'imports-loader?$=>jquery'
      // }
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
