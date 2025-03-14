// @ts-check
const path = require('path');

const makeBaseConfig = require('./webpack.prod.js');

module.exports = (env = {}) => {
  const baseConfig = makeBaseConfig(env);

  return {
    ...baseConfig,

    entry: {
      app: './public/swagger/index.tsx',
      light: './public/sass/grafana.light.scss',
    },

    // Output to a different directory so each build doesn't clobber each other
    output: {
      ...baseConfig.output,
      clean: true,
      path: path.resolve(__dirname, '../../public/build-swagger'),
      filename: '[name].[contenthash].js',
      // Keep publicPath relative for host.com/grafana/ deployments
      publicPath: 'public/build-swagger/',
    },
  };
};
