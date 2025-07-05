import type { Configuration } from '@rspack/core';
import { resolve } from 'node:path';

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
  nodePolyfills,
} from './rspack.parts.ts';

export default function (env: Record<string, unknown> = {}): Configuration {
  const experiments = getExperiments(env);
  const moduleRules = getModuleRules(env);
  const optimizations = getOptimizations(env);
  const output = getOutput(env);
  const resolveAlias = getAliases(env);
  const plugins = getPlugins(env);

  const config: Configuration = {
    amd: {},
    context: resolve(import.meta.dirname, '../..'),
    cache: true,
    entry: entries,
    experiments,
    ignoreWarnings: [
      (warning: Error) => {
        if (warning.message.includes('Critical dependency: the request of a dependency is an expression')) {
          return true;
        }
        if (warning.message.includes("export 'Routes' (imported as 'Routes') was not found in 'react-router-dom'")) {
          return true;
        }
        return false;
      },
    ],
    mode: env.production ? 'production' : 'development',
    module: {
      rules: moduleRules,
    },
    optimization: optimizations,
    output: output,
    resolve: {
      extensions,
      alias: resolveAlias,
      modules: modules,
      fallback: nodePolyfills,
    },
    target: 'web',
    plugins,
  };

  if (env.development) {
    config.devServer = devServer(Boolean(env.development));
  }

  return config;
}
