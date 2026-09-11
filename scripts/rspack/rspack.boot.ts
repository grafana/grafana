import rspack, { type Configuration } from '@rspack/core';
import path from 'node:path';

import { PUBLIC_PATH, createSwcRule, type Env } from './rspack.common.ts';

// The frontend service inlines this file into a classic <script> tag in the HTML it serves -
// see pkg/services/frontend/index.go and index.html. That is why this config stands alone
// rather than merging rspack.common.ts: the main build emits ES modules, and `output.module`
// forces `output.iife` off, which would leave boot.js as bare top-level statements. Inlined,
// those declare globals and collide with anything else the template declares.
export default (env: Env = {}): Configuration => ({
  // stats:rspack and `rspack build --config-name` select configs by this.
  name: 'boot',
  target: 'browserslist',
  mode: env.develop ? 'development' : 'production',

  // Not just a size choice: @rspack/cli defaults devtool to a source map when serving, and
  // this file is inlined into the page, so a sourceMappingURL comment is resolved against the
  // page URL rather than the build directory.
  devtool: false,

  entry: {
    boot: './public/boot/index.ts',
  },

  output: {
    // The same directory as the main build, which is where the Go side looks.
    path: path.resolve(import.meta.dirname, '../..', PUBLIC_PATH),
    // Referenced by name from Go, so it never carries a content hash.
    filename: '[name].js',
    // The main build owns this directory and cleans it, keeping boot.js.
    clean: false,
    // Deliberately no module/chunkFormat/chunkLoading, unlike every other config here.
    // The tag that carries this file is a classic script, not type="module", because a
    // module is always deferred and this file starts the /bootdata fetch. Classic output is
    // what keeps `iife` on, which is what stops the declarations becoming globals. A module
    // has its own top-level scope and would not need the wrapper, but it would also not run
    // until the document is parsed.
  },

  optimization: {
    // boot builds as part of the production array, so build:rspack:nominify reaches it too.
    minimize: Number(env.noMinify) !== 1 && !env.develop,
    minimizer: [new rspack.SwcJsMinimizerRspackPlugin()],
    runtimeChunk: false,
    splitChunks: false,
  },

  module: {
    parser: {
      javascript: {
        // Rspack raises missing ESM exports as errors which fail builds - treat them as warnings instead.
        exportsPresence: 'warn',
      },
    },
    rules: [createSwcRule()],
  },

  // No manifest or SRI plugin, unlike rspack.swagger.ts: a second manifest plugin would
  // overwrite the main build's assets-manifest.json, and an inlined script has no
  // <script src> to carry an integrity hash.

  resolve: {
    // No aliases needed - boot imports types only. conditionNames matches the other configs
    // so that a future runtime import resolves to source rather than a built package.
    conditionNames: ['@grafana-app/source', '...'],
    extensions: ['.ts'],
    modules: [
      // default value
      'node_modules',

      // required to for 'bare' imports (like 'app/core/utils' etc)
      path.resolve('public'),
    ],
  },
});
