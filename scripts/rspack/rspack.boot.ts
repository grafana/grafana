import rspack, { type Configuration } from '@rspack/core';
import path from 'node:path';

import { PUBLIC_PATH, createSwcRule, type Env } from './rspack.common.ts';

// The frontend service inlines boot.js into a classic <script> tag (see
// pkg/services/frontend/index.go), so it has to be one self-contained IIFE rather than ESM.
export default (env: Env = {}): Configuration => ({
  name: 'boot',
  target: 'browserslist',
  mode: env.develop ? 'development' : 'production',

  // Prevent sourceMappingURL comment being inlined
  devtool: false,

  entry: {
    boot: './public/boot/index.ts',
  },

  output: {
    path: path.resolve(import.meta.dirname, '../..', PUBLIC_PATH),
    // Go reads this file by name.
    filename: '[name].js',
    clean: false,
  },

  optimization: {
    minimize: Number(env.noMinify) !== 1 && !env.develop,
    minimizer: [new rspack.SwcJsMinimizerRspackPlugin()],
    runtimeChunk: false,
    splitChunks: false,
  },

  module: {
    parser: {
      javascript: {
        // See rspack.common.ts.
        exportsPresence: 'warn',
      },
    },
    rules: [createSwcRule()],
  },

  resolve: {
    conditionNames: ['@grafana-app/source', '...'],
    extensions: ['.ts'],
    modules: ['node_modules', path.resolve('public')],
  },
});
