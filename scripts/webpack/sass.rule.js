'use strict';

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

module.exports = function (options) {
  return {
    test: /\.(sa|sc|c)ss$/,
    use: [
      {
        loader: MiniCssExtractPlugin.loader,
        options: {
          publicPath: './',
        },
      },
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
          postcssOptions: {
            config: path.resolve(__dirname),
          },
        },
      },
      {
        loader: 'sass-loader',
        options: {
          sourceMap: options.sourceMap,
          sassOptions: {
            // silencing these warnings since we're planning to remove sass when angular is gone
            silenceDeprecations: ['import', 'global-builtin'],
          },
        },
      },
    ],
  };
};
