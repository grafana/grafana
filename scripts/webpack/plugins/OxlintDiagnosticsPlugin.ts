import DiagnosticsWebpackPlugin from 'diagnostics-webpack-plugin';
import { type Compiler } from 'webpack';

// Lints the modules webpack rebuilds with oxlint and reports problems as build warnings.
export class OxlintDiagnosticsPlugin {
  private readonly plugin = new DiagnosticsWebpackPlugin({
    lintOnStart: false, // don't lint on start, only lint changed files
    reportAs: 'warning',
    checks: [{ use: 'oxlint', extensions: ['ts', 'tsx'] }],
  });

  apply(compiler: Compiler) {
    // diagnostics-webpack-plugin uses compiler.hooks.validate to assert the plugin options passed in
    // match its schema. webpack only added that hook in 5.106, so until we upgrade we provide a no-op.
    const validate = { tap: () => {} };
    const hooks = new Proxy(compiler.hooks, {
      get: (target, prop) => (prop === 'validate' ? validate : Reflect.get(target, prop, target)),
    });
    const compilerWithValidate = new Proxy(compiler, {
      get: (target, prop) => (prop === 'hooks' ? hooks : Reflect.get(target, prop, target)),
    });
    this.plugin.apply(compilerWithValidate);
  }
}
