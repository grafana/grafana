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
  // reportFilename, so a second config would overwrite the report. Found by name rather than
  // by position: picking up the wrong config yields a plausible-looking report of the wrong
  // bundle, which nobody would question.
  const grafanaConfig = prodConfig(env).find((prodEntry) => prodEntry.name === 'grafana');
  if (!grafanaConfig) {
    throw new Error('rspack.prod.ts no longer exports a config named "grafana"');
  }

  return merge(grafanaConfig, config);
};
