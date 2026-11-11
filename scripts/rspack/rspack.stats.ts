import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';
import type { Configuration } from '@rspack/core';
import { merge } from 'webpack-merge';

import type { Env } from './rspack.common.ts';
import prodConfig from './rspack.prod.ts';

export default (env: Env = {}) => {
  const config: Configuration = {
    optimization: {
      chunkIds: 'named',
    },
    output: {
      filename: '[name].js',
      chunkFilename: '[name].js',
    },
    plugins: [new RsdoctorRspackPlugin()],
  };

  // Found by name, not position: the wrong config would give a plausible report of the wrong
  // bundle.
  const grafanaConfig = prodConfig(env).find((prodEntry) => prodEntry.name === 'grafana');
  if (!grafanaConfig) {
    throw new Error('rspack.prod.ts no longer exports a config named "grafana"');
  }

  return merge(grafanaConfig, config);
};
