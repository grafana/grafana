'use strict';
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = function(options) {
  const loaders = [
    {
      loader: 'css-loader',
      options: {
        importLoaders: 2,
        url: options.preserveUrl,
        sourceMap: options.sourceMap,
        minimize: options.minimize,
      },
    },
    {
      loader: 'postcss-loader',
      options: {
        sourceMap: options.sourceMap,
        config: { path: __dirname + '/postcss.config.js' },
      },
    },
    {
      loader: 'sass-loader',
      options: {
        sourceMap: options.sourceMap,
      },
    },
  ];

  if (options.lazy) {
    loaders.unshift({
      loader: 'style-loader/useable',
    });
  } else {
    loaders.unshift(MiniCssExtractPlugin.loader);
  }

  return {
    test: /\.scss$/,
    use: loaders,
  };
};
