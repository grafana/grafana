import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Compiler } from 'webpack';

// plugins/ -> webpack/ -> scripts/ -> repo root
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
// selector source that, when changed in watch mode, should trigger a regenerate
const selectorsSrc = path.join('packages', 'grafana-e2e-selectors', 'src');

// regenerates public/e2e-selectors.json, the data-only file @grafana/plugin-e2e fetches at test
// runtime. running it from the app build keeps the file present in dev, prod and docker images, not
// only when the e2e-selectors package is built on its own.
function generate(): void {
  execFileSync('yarn', ['workspace', '@grafana/e2e-selectors', 'generate-e2e-selectors-json'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

export default class E2ESelectorsPlugin {
  apply(compiler: Compiler): void {
    // one-shot builds (yarn build, yarn dev, docker image): generate once before the build runs
    compiler.hooks.beforeRun.tap('E2ESelectorsPlugin', () => generate());

    // watch mode (yarn start): the first compile has no modifiedFiles, so generate once; on later
    // rebuilds only regenerate when a selector source file changed
    compiler.hooks.watchRun.tap('E2ESelectorsPlugin', (watchCompiler: Compiler) => {
      const modified = watchCompiler.modifiedFiles;
      const selectorsChanged = !modified || [...modified].some((file) => file.includes(selectorsSrc));
      if (selectorsChanged) {
        generate();
      }
    });
  }
}
