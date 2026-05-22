import { RsdoctorWebpackPlugin } from '@rsdoctor/webpack-plugin';
import type { Configuration } from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { merge } from 'webpack-merge';

import { FilterStatsPlugin } from './plugins/FilterStatsPlugin.ts';
import type { Env } from './webpack.common.ts';
import prodConfig from './webpack.prod.ts';

export default (env: Env = {}) => {
  const bundleAnalyzerOpts: BundleAnalyzerPlugin.Options = env.filtered
    ? {
        analyzerMode: 'static',
        reportFilename: 'bundle-stats.html',
        openAnalyzer: false,
        generateStatsFile: false,
      }
    : {};

  const config: Configuration = {
    plugins: [new BundleAnalyzerPlugin(bundleAnalyzerOpts)],
  };

  // yarn build:smolstats
  if (env.filtered) {
    config.plugins?.push(
      new FilterStatsPlugin({
        exclude: /@kusto|monaco-editor|public\/locales/,
        minDominance: 0.75,
      })
    );
  }

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
