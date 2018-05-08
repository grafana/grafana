const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

config = merge(common, {
  devtool: 'cheap-module-source-map',
  externals: {
    'react/addons': true,
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          { loader: "awesome-typescript-loader" }
        ]
      },
    ]
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({
      filename: null, // if no value is provided the sourcemap is inlined
      test: /\.(ts|js)($|\?)/i // process .js and .ts files only
    }),
  ]
});

module.exports = config;
