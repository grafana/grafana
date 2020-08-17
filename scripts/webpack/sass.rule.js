'use strict';

const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = function(options) {
  return {
    test: /\.scss$/,
    use: [
      MiniCssExtractPlugin.loader,
      {
        loader: 'css-loader',
        options: {
          importLoaders: 2,
          url: options.preserveUrl,
          sourceMap: options.sourceMap,
        },
      },
      {
        loader: 'postcss-loader',
        options: {
          sourceMap: options.sourceMap,
          config: { path: __dirname },
        },
      },
      {
        loader: 'sass-loader',
        options: {
          sourceMap: options.sourceMap,
        },
      },
    ],
  };
};
