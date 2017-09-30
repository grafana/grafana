const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');
var HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = merge(common, {
  devtool: "source-map",

  plugins: [
    new HtmlWebpackPlugin({
      filename: path.resolve(__dirname, '../../public/views/index.html'),
      template: path.resolve(__dirname, '../../public/views/index.template.html'),
      inject: 'body',
    }),
  ]
});
