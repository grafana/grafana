import { RsdoctorWebpackPlugin } from '@rsdoctor/webpack-plugin';
import type { Configuration } from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { merge } from 'webpack-merge';

import { StatsViewerPlugin } from './statsViewer.ts';
import type { Env } from './webpack.common.ts';
import prodConfig from './webpack.prod.ts';

export default (env: Env = {}) => {
  const config: Configuration = {
    plugins: [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: 'bundle-stats.html',
        openAnalyzer: false,
        generateStatsFile: false,
      }),
      new StatsViewerPlugin(),
    ],
  };

  // yarn build:stats --env doctor
  if (env.doctor) {
    config.plugins?.push(new RsdoctorWebpackPlugin());
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
