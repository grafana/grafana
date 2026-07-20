declare module 'webpack-livereload-plugin' {
  import type { Compiler } from 'webpack';

  interface LiveReloadPluginOptions {
    appendScriptTag?: boolean;
    useSourceHash?: boolean;
    hostname?: string;
    protocol?: string;
    port?: number;
  }

  export default class LiveReloadPlugin {
    constructor(options?: LiveReloadPluginOptions);
    apply(compiler: Compiler): void;
  }
}
