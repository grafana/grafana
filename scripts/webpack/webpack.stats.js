'use strict';

const StatoscopeWebpackPlugin = require('@statoscope/webpack-plugin').default;
const { merge } = require('webpack-merge');

const prodConfig = require('./webpack.prod.js');

module.exports = (env = {}) => {
  return merge(prodConfig(env), {
    plugins: [new StatoscopeWebpackPlugin()],
  });
};
