import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// apache-arrow sets Symbol.isConcatSpreadable on its Vector, Table and RecordBatch prototypes at
// load time. Any such assignment permanently turns off V8's fast path for Array.prototype.concat in
// that isolate, which made the reduce transformation (it concatenates per-series rows) about 8x
// slower in the worker. The sidecar never concatenates Arrow objects with Array.prototype.concat,
// so the assignments are dropped.
const SPREADABLE = 'proto[Symbol.isConcatSpreadable] = true;';
const keepConcatFastPath = {
  name: 'keep-concat-fast-path',
  setup(b) {
    b.onLoad({ filter: /apache-arrow[\\/](vector|table|recordbatch)\.mjs$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8');
      if (!source.includes(SPREADABLE)) {
        throw new Error(`${path} no longer contains "${SPREADABLE}"; re-check keepConcatFastPath`);
      }
      return { contents: source.replace(SPREADABLE, ''), loader: 'js' };
    });
  },
};

// The sidecar runs in Node, so browser-only code in the bundle is a mistake: a transformation module
// importing UI or runtime code would either crash at load or silently drag in megabytes. Plain react
// is allowed: the @grafana/data barrel imports it, and it runs in Node.
const BROWSER_ONLY =
  /node_modules\/(react-dom|react-i18next|i18next-browser-languagedetector|monaco-editor)\/|packages\/grafana-(ui|runtime|i18n)\//;

const result = await build({
  absWorkingDir: dirname(fileURLToPath(import.meta.url)),
  entryPoints: {
    server: 'src/server.ts',
    worker: 'src/worker.ts',
    'parity-compare': 'parity/compare.ts',
    'bench-browser': 'bench/browser.ts',
  },
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  sourcemap: true,
  // Resolve workspace packages (@grafana/schema) to their TypeScript source, not a possibly stale dist.
  conditions: ['@grafana-app/source'],
  // transformDataFrame reads this browser global to decide whether Scenes already interpolated
  // variables. The sidecar always interpolates itself.
  define: { 'window.__grafanaSceneContext': 'undefined' },
  alias: {
    // public/app/features/transformers imports app code as app/* (the frontend's path alias), and
    // only uses t() from @grafana/i18n, whose real module pulls in React.
    app: '../../public/app',
    '@grafana/i18n': './src/i18n-shim.ts',
  },
  plugins: [keepConcatFastPath],
  metafile: true,
  logLevel: 'info',
});

const browserOnly = Object.keys(result.metafile.inputs).filter((input) => BROWSER_ONLY.test(input));
if (browserOnly.length > 0) {
  throw new Error(`the sidecar bundle includes browser-only modules:\n  ${browserOnly.join('\n  ')}`);
}
