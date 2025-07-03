import type { Configuration } from '@rspack/core';

import {
  devServer,
  entries,
  extensions,
  getAliases,
  getExperiments,
  getModuleRules,
  getOptimizations,
  getOutput,
  getPlugins,
  modules,
} from './rspack.parts.ts';

export default function (env: Record<string, unknown> = {}): Configuration {
  console.log({ env });
  const config: Configuration = {
    amd: {},
    entry: entries,
    experiments: getExperiments(env),
    ignoreWarnings: [
      (warning: Error) => {
        if (warning.message.includes('Critical dependency: the request of a dependency is an expression')) {
          return true;
        }
        return false;
      },
    ],
    mode: env.production ? 'production' : 'development',
    module: {
      rules: getModuleRules(env),
    },
    optimization: getOptimizations(env),
    output: getOutput(env),
    resolve: {
      extensions,
      alias: getAliases(env),
      modules: modules,
      fallback: {
        // buffer: false,
        fs: false,
        stream: false,
        // http: false,
        // https: false,
        // string_decoder: false,
      },
    },
    target: 'web',
    plugins: getPlugins(env),
  };

  if (env.development) {
    config.devServer = devServer;
  }

  return config;
}
