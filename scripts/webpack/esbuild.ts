import browserslist from 'browserslist';
import type { LoaderOptions } from 'esbuild-loader';
import { resolveToEsbuildTarget } from 'esbuild-plugin-browserslist';

const esbuildTargets = resolveToEsbuildTarget(browserslist(), { printUnknownTargets: false });

// esbuild-loader 3.0.0+ requires format to be set to prevent it
// from defaulting to 'iife' which breaks monaco/loader once minified.
const esbuildOptions: LoaderOptions = {
  target: esbuildTargets,
  format: undefined,
  jsx: 'automatic',
};

export default esbuildOptions;
