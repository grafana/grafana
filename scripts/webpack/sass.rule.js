'use strict';

const ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = function(options) {
  return {
    test: /\.scss$/,
    use: ExtractTextPlugin.extract({
      use: [
        {
          loader: 'css-loader',
          options: {
            importLoaders: 2,
            url: false,
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
        { loader:'sass-loader', options: { sourceMap: options.sourceMap } }
      ],
    })
  };
}

