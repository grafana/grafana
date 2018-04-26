'use strict';

const ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = function (options, extractSass) {
  return {
    css: {
      test: /\.css$/,
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
        ],
        fallback: [{
          loader: 'style-loader',
          options: {
            sourceMap: options.sourceMap,
          }
        }]
      })
    },
    scss: {
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
    }
  };
}
