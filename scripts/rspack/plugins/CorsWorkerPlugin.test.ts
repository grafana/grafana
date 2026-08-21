import { type Configuration } from '@rspack/core';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import CorsWorkerPlugin from './CorsWorkerPlugin.ts';
import { compile, readAssets } from './testUtils.ts';

const OUTPUT_PATH = '/dist';
const LITERAL_PUBLIC_PATH = '/public/build/';

// Kept as literals so a change in either the plugin or in rspack's own auto publicPath runtime
// module fails the test rather than passing silently.
const AUTO_ASSIGNMENT = '__webpack_require__.p = scriptUrl';
const OVERRIDE = `if (typeof __webpack_worker_public_path__ !== 'undefined') __webpack_require__.p = __webpack_worker_public_path__;`;

function createConfig(publicPath: string): Configuration {
  return {
    context: path.join(import.meta.dirname, '__fixtures__', 'cors-worker'),
    entry: './index.js',
    mode: 'development',
    devtool: false,
    // The repo's .browserslistrc has no section for NODE_ENV=test, so rspack would resolve an
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

async function getWorkerChunk(publicPath: string): Promise<string> {
  const { outputFs } = await compile(createConfig(publicPath));
  const assets = readAssets(outputFs, OUTPUT_PATH);

  const workerChunks = Object.entries(assets).filter(
    ([filename, content]) => filename !== 'main.js' && content.includes('__webpack_worker_public_path__')
  );
  expect(workerChunks).toHaveLength(1);
  return workerChunks[0][1];
}

describe('CorsWorkerPlugin', () => {
  describe("when publicPath is 'auto'", () => {
    it("overrides rspack's derivation, which resolves to the blob URL rather than the chunk URL", async () => {
      const workerChunk = await getWorkerChunk('auto');

      // Both must be present: rspack derives a value, then the blob-provided one wins.
      expect(workerChunk).toContain(AUTO_ASSIGNMENT);
      expect(workerChunk).toContain(OVERRIDE);

      // Order is the whole point. Rspack renders its auto publicPath module after every stage
      // below STAGE_TRIGGER; if that ever changes, the derivation clobbers the blob value and
      // workers resolve chunks against the wrong origin.
      expect(workerChunk.indexOf(OVERRIDE)).toBeGreaterThan(workerChunk.indexOf(AUTO_ASSIGNMENT));

      // Nothing may reassign the public path afterwards, and the entry must not run first.
      const afterOverride = workerChunk.slice(workerChunk.indexOf(OVERRIDE) + OVERRIDE.length);
      expect(afterOverride).not.toContain('__webpack_require__.p =');
      expect(afterOverride).toContain('__webpack_require__("./worker.js")');
    });

    it('leaves the derivation in place for workers that never set the global', async () => {
      const workerChunk = await getWorkerChunk('auto');

      // A natively constructed worker gets no global, and there rspack's derivation is already
      // correct — hence the typeof guard rather than an unconditional assignment.
      expect(workerChunk).not.toContain('__webpack_require__.p = __webpack_worker_public_path__ ||');
      expect(workerChunk).toContain('Automatic publicPath is not supported');
    });
  });

  describe('when publicPath is a literal', () => {
    it('injects the fallback and no derivation', async () => {
      const workerChunk = await getWorkerChunk(LITERAL_PUBLIC_PATH);

      const fallback = `__webpack_require__.p = __webpack_worker_public_path__ || '${LITERAL_PUBLIC_PATH}';`;
      expect(workerChunk).toContain(fallback);
      expect(workerChunk).not.toContain('Automatic publicPath is not supported');
      expect(workerChunk).not.toContain(OVERRIDE);

      const afterFallback = workerChunk.slice(workerChunk.indexOf(fallback) + fallback.length);
      expect(afterFallback).not.toContain('__webpack_require__.p =');
    });
  });

  it('leaves non-worker chunks alone', async () => {
    const { outputFs } = await compile(createConfig('auto'));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    expect(assets['main.js']).toBeDefined();
    expect(assets['main.js']).not.toContain('__webpack_worker_public_path__');
  });
});
