import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';
import type { Configuration } from '@rspack/core';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { merge } from 'webpack-merge';

import { StatsViewerPlugin } from '../webpack/statsViewer.ts';

import { widenStatsForAnalyzer } from './plugins/webpackStatsCompat.ts';
import type { Env } from './rspack.common.ts';
import prodConfig from './rspack.prod.ts';

export default (env: Env = {}) => {
  const config: Configuration = {
    plugins: [
      // Must come before BundleAnalyzerPlugin so its `done` tap runs first.
      widenStatsForAnalyzer,
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: 'bundle-stats.html',
        openAnalyzer: false,
        generateStatsFile: false,
      }),
      new StatsViewerPlugin(),
    ],
  };

  // yarn build:stats:rspack --env doctor
  if (env.doctor) {
    config.plugins?.push(new RsdoctorRspackPlugin());
  }

  // disable hashing in output filenames to make them easier to identify
  // yarn build:stats:rspack --env doctor --env namedChunks
  if (env.namedChunks) {
    config.optimization = {
      chunkIds: 'named',
    };
    config.output = {
      filename: '[name].js',
      chunkFilename: '[name].js',
    };
  }

  // Only the grafana config takes part. BundleAnalyzerPlugin writes a single
  // reportFilename, so a second config would overwrite the report.
  const [grafanaConfig] = prodConfig(env);

  return merge(grafanaConfig, config);
};
