const merge = require('webpack-merge');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const common = require('./webpack.common.js');
var ngAnnotatePlugin = require('ng-annotate-webpack-plugin');

module.exports = merge(common, {
  plugins: [
    new ngAnnotatePlugin(),
    new UglifyJSPlugin()
  ]
});
