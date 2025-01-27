import type { Configuration } from '@rspack/core';

import {
  getAliases,
  entries,
  extensions,
  getExperiments,
  getModuleRules,
  getPlugins,
  modules,
  output,
} from './rspack.parts.ts';

export default function (env: Record<string, unknown> = {}): Configuration {
  return {
    entry: entries,
    experiments: getExperiments(env),
    mode: env.production ? 'production' : 'development',
    module: {
      rules: getModuleRules(env),
    },
    output,
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
    plugins: getPlugins(env),
  };
}
