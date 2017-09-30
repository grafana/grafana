const path = require('path');
const webpack = require('webpack');
const {CheckerPlugin} = require('awesome-typescript-loader')
var HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: {
    app: './public/app/index.ts',
  },
  output: {
    path: path.resolve(__dirname, '../../public/build'),
    filename: '[name].[chunkhash].js',
    publicPath: "public/build/",
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
          // { loader: "ng-annotate-loader", options: { es6: true } },
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
      },
      {
        test: /\.html$/,
        exclude: /index\.template.html/,
        use: [
          { loader:'ngtemplate-loader?relativeTo=' + (path.resolve(__dirname, '../../public')) + '&prefix=public'},
          {
            loader: 'html-loader',
            options: {
              attrs: [],
              minimize: true,
              removeComments: false,
              collapseWhitespace: false
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new CheckerPlugin(),
    new HtmlWebpackPlugin({
      filename: path.resolve(__dirname, '../../public/views/index.html'),
      template: path.resolve(__dirname, '../../public/views/index.template.html'),
      inject: 'body',
    }),
  ]
};
