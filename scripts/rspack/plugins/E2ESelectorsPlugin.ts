import rspack, { type Compiler } from '@rspack/core';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// rspack exposes these as properties of the default export
const { sources, Compilation } = rspack;

// plugins/ -> rspack/ -> scripts/ -> repo root
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
// selector source that, when changed in watch mode, should trigger a regenerate
const selectorsSrc = path.join('packages', 'grafana-e2e-selectors', 'src');

// runs the generator in a subprocess (tsx) and captures the JSON on stdout. we shell out rather than
// import the generator directly because the rspack config is loaded by native node, which can't resolve
// the selector source's extensionless imports; tsx (esbuild resolution) can.
function generate(): string {
  return execFileSync('yarn', ['workspace', '@grafana/e2e-selectors', 'generate-e2e-selectors-json', '--stdout'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

// emits e2e-selectors.json into the build output so @grafana/plugin-e2e can fetch it at test runtime,
// version-matched (from the CDN in MT, from the origin in single-binary). emitting it as a build asset
// (rather than writing to public/ as a side effect) keeps it tracked: it survives output.clean and
// rides the same asset pipeline that uploads the bundles to the CDN.
export default class E2ESelectorsPlugin {
  private json = '';

  apply(compiler: Compiler): void {
    // one-shot builds (yarn build, yarn dev, docker image): generate once before the build runs
    compiler.hooks.beforeRun.tap('E2ESelectorsPlugin', () => {
      this.json = generate();
    });

    // watch mode (yarn start): the first compile has no modifiedFiles, so generate once; on later
    // rebuilds only regenerate when a selector source file changed
    compiler.hooks.watchRun.tap('E2ESelectorsPlugin', (watchCompiler: Compiler) => {
      const modified = watchCompiler.modifiedFiles;
      const selectorsChanged = !modified || [...modified].some((file) => file.includes(selectorsSrc));
      if (selectorsChanged || !this.json) {
        this.json = generate();
      }
    });

    compiler.hooks.thisCompilation.tap('E2ESelectorsPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'E2ESelectorsPlugin', stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          if (this.json) {
            compilation.emitAsset('e2e-selectors.json', new sources.RawSource(this.json));
          }
        }
      );
    });
  }
}
