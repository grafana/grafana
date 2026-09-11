import rspack, { type Configuration } from '@rspack/core';
import path from 'node:path';

import { PUBLIC_PATH, createSwcRule, type Env } from './rspack.common.ts';

// The frontend service inlines boot.js into a classic <script> tag (see
// pkg/services/frontend/index.go), so it has to be one self-contained IIFE. This config stands
// alone because the main build emits ES modules, and `output.module` turns `output.iife` off.
export default (env: Env = {}): Configuration => ({
  name: 'boot',
  target: 'browserslist',
  mode: env.develop ? 'development' : 'production',

  // A sourceMappingURL comment gets inlined into the page and resolved against the page URL.
  devtool: false,

  entry: {
    boot: './public/boot/index.ts',
  },

  output: {
    path: path.resolve(import.meta.dirname, '../..', PUBLIC_PATH),
    // Go reads this file by name, so it carries no content hash.
    filename: '[name].js',
    // The main build cleans this directory and keeps boot.js.
    clean: false,
    // No module/chunkFormat/chunkLoading: classic output is what keeps `iife` on.
  },

  optimization: {
    // Part of the production array, so build:rspack:nominify reaches it.
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

  // No manifest or SRI plugin: a second manifest plugin would overwrite the one the main build
  // writes, and an inlined script has no <script src> to hash.

  resolve: {
    conditionNames: ['@grafana-app/source', '...'],
    extensions: ['.ts'],
    modules: ['node_modules', path.resolve('public')],
  },
});
