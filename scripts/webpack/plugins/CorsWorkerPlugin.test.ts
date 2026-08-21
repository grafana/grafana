import { createFsFromVolume, Volume } from 'memfs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import webpack, { type Configuration, type OutputFileSystem, type Stats } from 'webpack';

import CorsWorkerPlugin from './CorsWorkerPlugin.ts';

const OUTPUT_PATH = '/dist';
const LITERAL_PUBLIC_PATH = '/public/build/';

// Kept as literals so a change in either the plugin or in webpack's own
// AutoPublicPathRuntimeModule fails the test rather than passing silently.
const AUTO_ASSIGNMENT = '__webpack_require__.p = scriptUrl';
const OVERRIDE = `if (typeof __webpack_worker_public_path__ !== 'undefined') __webpack_require__.p = __webpack_worker_public_path__;`;

type MemFs = ReturnType<typeof createFsFromVolume>;

function createConfig(publicPath: string): Configuration {
  return {
    context: path.join(import.meta.dirname, '__fixtures__', 'cors-worker'),
    entry: './index.js',
    mode: 'development',
    devtool: false,
    // The repo's .browserslistrc has no section for NODE_ENV=test, so webpack would resolve an
    // empty browserslist and throw.
    target: ['web', 'es2022'],
    output: {
      path: OUTPUT_PATH,
      publicPath,
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
    },
    plugins: [new CorsWorkerPlugin()],
  };
}

async function compile(config: Configuration): Promise<Record<string, string>> {
  const compiler = webpack(config);
  const outputFs = createFsFromVolume(new Volume());
  // memfs stat types allow bigint variants that webpack's OutputFileSystem doesn't model,
  // but the runtime shapes are compatible (webpack-dev-middleware pairs them the same way).
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  compiler.outputFileSystem = outputFs as unknown as OutputFileSystem;

  const stats = await new Promise<Stats>((resolve, reject) => {
    compiler.run((runError, result) => {
      compiler.close((closeError) => {
        if (runError || closeError) {
          reject(runError ?? closeError);
          return;
        }
        if (!result) {
          reject(new Error('Compilation produced no stats'));
          return;
        }
        if (result.hasErrors()) {
          reject(new Error(result.toString({ errors: true })));
          return;
        }
        resolve(result);
      });
    });
  });

  return readAssets(outputFs, stats.compilation.outputOptions.path ?? OUTPUT_PATH);
}

function readAssets(outputFs: MemFs, outputPath: string): Record<string, string> {
  const assets: Record<string, string> = {};
  for (const filename of outputFs.readdirSync(outputPath)) {
    assets[String(filename)] = outputFs.readFileSync(path.join(outputPath, String(filename)), 'utf-8').toString();
  }
  return assets;
}

function getWorkerChunk(assets: Record<string, string>): string {
  const workerChunks = Object.entries(assets).filter(
    ([filename, content]) => filename !== 'main.js' && content.includes('__webpack_worker_public_path__')
  );
  expect(workerChunks).toHaveLength(1);
  return workerChunks[0][1];
}

describe('CorsWorkerPlugin', () => {
  describe("when publicPath is 'auto'", () => {
    it("overrides webpack's derivation, which resolves to the blob URL rather than the chunk URL", async () => {
      const workerChunk = getWorkerChunk(await compile(createConfig('auto')));

      // Both must be present: webpack derives a value, then the blob-provided one wins.
      expect(workerChunk).toContain(AUTO_ASSIGNMENT);
      expect(workerChunk).toContain(OVERRIDE);

      // Order is the whole point. The override is a STAGE_ATTACH runtime module so it
      // generates after webpack's STAGE_BASIC one; if that ever flips, the derivation
      // clobbers the blob value and workers resolve chunks against the wrong origin.
      expect(workerChunk.indexOf(OVERRIDE)).toBeGreaterThan(workerChunk.indexOf(AUTO_ASSIGNMENT));

      // Nothing may reassign the public path afterwards.
      const afterOverride = workerChunk.slice(workerChunk.indexOf(OVERRIDE) + OVERRIDE.length);
      expect(afterOverride).not.toContain('__webpack_require__.p =');
    });

    it('leaves the derivation in place for workers that never set the global', async () => {
      const workerChunk = getWorkerChunk(await compile(createConfig('auto')));

      // A natively constructed worker gets no global, and there webpack's derivation is
      // already correct — hence the typeof guard rather than an unconditional assignment.
      expect(workerChunk).not.toContain('__webpack_require__.p = __webpack_worker_public_path__ ||');
      expect(workerChunk).toContain('Automatic publicPath is not supported');
    });
  });

  describe('when publicPath is a literal', () => {
    it('injects the fallback and no derivation', async () => {
      const workerChunk = getWorkerChunk(await compile(createConfig(LITERAL_PUBLIC_PATH)));

      expect(workerChunk).toContain(
        `__webpack_require__.p = __webpack_worker_public_path__ || '${LITERAL_PUBLIC_PATH}';`
      );
      expect(workerChunk).not.toContain('Automatic publicPath is not supported');
      expect(workerChunk).not.toContain(OVERRIDE);
    });
  });

  it('leaves non-worker chunks alone', async () => {
    const assets = await compile(createConfig('auto'));

    expect(assets['main.js']).toBeDefined();
    expect(assets['main.js']).not.toContain('__webpack_worker_public_path__');
  });
});
