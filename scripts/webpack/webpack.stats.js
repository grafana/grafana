const { RsdoctorWebpackPlugin } = require('@rsdoctor/webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { merge } = require('webpack-merge');

const { FilterStatsPlugin } = require('./plugins/FilterStatsPlugin');
const prodConfig = require('./webpack.prod.js');

module.exports = (env = {}) => {
  const bundleAnalyzerOpts = env.filtered
    ? {
        analyzerMode: 'static',
        reportFilename: 'bundle-stats.html',
        openAnalyzer: false,
        generateStatsFile: false,
      }
    : {};

  const config = {
    plugins: [new BundleAnalyzerPlugin(bundleAnalyzerOpts)],
  };

  // yarn build:smolstats
  if (env.filtered) {
    config.plugins.push(
      new FilterStatsPlugin({
        exclude: /@kusto|monaco-editor|public\/locales/,
        minDominance: 0.75,
      })
    );
  }

  // yarn build:stats --env doctor
  if (env.doctor) {
    config.plugins.push(
      new RsdoctorWebpackPlugin({
        supports: {
          // disable rsdoctor bundle-analyser
          generateTileGraph: false,
        },
      })
    );
  }

  // disable hashing in output filenames to make them easier to identify
  // yarn build:stats --env doctor --env namedChunks
  if (env.namedChunks) {
    config.optimization = {
      chunkIds: 'named',
    };
    config.output = {
      filename: '[name].js',
      chunkFilename: '[name].js',
    };
  }

  return merge(prodConfig(env), config);
};
