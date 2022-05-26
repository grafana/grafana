const HtmlWebpackPlugin = require('html-webpack-plugin');

/*
 * This plugin returns the css associated with entrypoints. Those chunks can be found
 * in `htmlWebpackPlugin.files.cssChunks`.
 * The HTML Webpack plugin removed the chunks object in v5 in favour of an array however if we want
 * to do anything smart with hashing (e.g. [contenthash]) we need a map of { themeName: chunkNameWithHash }.
 */
class HTMLWebpackCSSChunks {
  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply(compiler) {
    compiler.hooks.compilation.tap(
      'HTMLWebpackCSSChunks',
      /**
       * @param {import('webpack').Compilation} compilation
       */
      (compilation) => {
        HtmlWebpackPlugin.getHooks(compilation).beforeAssetTagGeneration.tapAsync(
          'HTMLWebpackCSSChunks',
          (data, cb) => {
            data.assets.cssChunks = {};

            for (const entryPoint of compilation.entrypoints.values()) {
              for (const chunk of entryPoint.chunks) {
                const cssFile = [...chunk.files].find((file) => file.endsWith('.css'));
                if (cssFile !== undefined) {
                  data.assets.cssChunks[chunk.name] = cssFile;
                }
              }
            }

            cb(null, data);
          }
        );
      }
    );
  }
}

module.exports = HTMLWebpackCSSChunks;
