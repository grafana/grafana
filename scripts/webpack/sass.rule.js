'use strict';

const ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = function (options, extractSass) {
  return {
    test: /\.scss$/,
    use: (extractSass || ExtractTextPlugin).extract({
      use: [
        {
          loader: 'css-loader',
          options: {
            importLoaders: 2,
            url: options.preserveUrl,
            sourceMap: options.sourceMap,
            minimize: options.minimize,
          }
        },
        {
          loader: 'postcss-loader',
          options: {
            sourceMap: options.sourceMap,
            config: { path: __dirname + '/postcss.config.js' }
          }
        },
        { loader: 'sass-loader', options: { sourceMap: options.sourceMap } }
      ],
      fallback: [{
        loader: 'style-loader',
        options: {
          sourceMap: true
        }
      }]
    })
  };
}

