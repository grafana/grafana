import { build } from 'esbuild';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

await build({
  absWorkingDir: dirname(fileURLToPath(import.meta.url)),
  entryPoints: { server: 'src/server.ts', worker: 'src/worker.ts' },
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
  logLevel: 'info',
});
