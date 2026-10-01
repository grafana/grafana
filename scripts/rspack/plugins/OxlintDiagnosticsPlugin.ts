import { type Compiler } from '@rspack/core';
import DiagnosticsWebpackPlugin from 'diagnostics-webpack-plugin';

// Lints the modules rspack rebuilds with oxlint and reports problems as build warnings.
export class OxlintDiagnosticsPlugin {
  private readonly plugin = new DiagnosticsWebpackPlugin({
    lintOnStart: false, // don't lint on start, only lint changed files
    reportAs: 'warning',
    checks: [{ use: 'oxlint', extensions: ['ts', 'tsx'] }],
  });

  apply(compiler: Compiler) {
    // diagnostics-webpack-plugin uses compiler.hooks.validate to assert the plugin options passed in
    // match it's schema. rspack doesn't have that hook so we provide a no-op.
    const validate = { tap: () => {} };
    const hooks = new Proxy(compiler.hooks, {
      get: (target, prop) => (prop === 'validate' ? validate : Reflect.get(target, prop, target)),
    });
    const compilerWithValidate = new Proxy(compiler, {
      get: (target, prop) => (prop === 'hooks' ? hooks : Reflect.get(target, prop, target)),
    });
    // @ts-expect-error -- the plugin is typed against webpack's Compiler
    this.plugin.apply(compilerWithValidate);
  }
}
