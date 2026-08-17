import { type Configuration } from '@rspack/core';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import CorsWorkerPlugin from './CorsWorkerPlugin.ts';
import { compile, readAssets } from './testUtils.ts';

const OUTPUT_PATH = '/dist';
const PUBLIC_PATH = '/public/build/';

function createConfig(publicPath: string): Configuration {
  return {
    context: path.join(import.meta.dirname, '__fixtures__', 'cors-worker'),
    entry: './index.js',
    mode: 'development',
    devtool: false,
    // Explicit target so the compilation doesn't depend on the repo's .browserslistrc,
    // which rspack's bundled browserslist database cannot parse.
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

describe('CorsWorkerPlugin', () => {
  it('injects the __webpack_worker_public_path__ fallback into worker chunks without a later override', async () => {
    const { outputFs } = await compile(createConfig(PUBLIC_PATH));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    const workerAssets = Object.entries(assets).filter(([filename, content]) => {
      return filename !== 'main.js' && content.includes('__webpack_worker_public_path__');
    });
    expect(workerAssets).toHaveLength(1);

    const [, workerContent] = workerAssets[0];
    const fallbackAssignment = `__webpack_require__.p = __webpack_worker_public_path__ || '${PUBLIC_PATH}';`;
    expect(workerContent).toContain(fallbackAssignment);

    const contentAfterFallback = workerContent.slice(
      workerContent.indexOf(fallbackAssignment) + fallbackAssignment.length
    );
    expect(contentAfterFallback).not.toContain('__webpack_require__.p =');
  });

  it('does not inject the fallback into non-worker chunks', async () => {
    const { outputFs } = await compile(createConfig(PUBLIC_PATH));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    expect(assets['main.js']).toBeDefined();
    expect(assets['main.js']).not.toContain('__webpack_worker_public_path__');
  });

  it('is a no-op when publicPath is auto', async () => {
    const { outputFs } = await compile(createConfig('auto'));
    const assets = readAssets(outputFs, OUTPUT_PATH);

    for (const content of Object.values(assets)) {
      expect(content).not.toContain('__webpack_worker_public_path__');
    }
  });
});
