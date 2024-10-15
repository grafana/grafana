'use strict';
const { RsdoctorWebpackPlugin } = require('@rsdoctor/webpack-plugin');
const { merge } = require('webpack-merge');

const prodConfig = require('./webpack.prod.js');

module.exports = (env = {}) => {
  return merge(prodConfig(env), {
    // disable hashing in output filenames to make them easier to identify
    output: {
      filename: '[name].js',
      chunkFilename: '[name].js',
    },
    optimization: {
      chunkIds: 'named',
    },
    plugins: [new RsdoctorWebpackPlugin()],
  });
};
