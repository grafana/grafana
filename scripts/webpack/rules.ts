import browserslist from 'browserslist';
import type { LoaderOptions } from 'esbuild-loader';
import { resolveToEsbuildTarget } from 'esbuild-plugin-browserslist';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import type { RuleSetRule } from 'webpack';

const esbuildTargets = resolveToEsbuildTarget(browserslist(), { printUnknownTargets: false });

// esbuild-loader 3.0.0+ requires format to be set to prevent it
// from defaulting to 'iife' which breaks monaco/loader once minified.
export const esbuildOptions: LoaderOptions = {
  target: esbuildTargets,
  format: undefined,
  jsx: 'automatic',
};

export const esbuildRule: RuleSetRule = {
  test: /\.tsx?$/,
  resourceQuery: { not: [/text-panel-runtime/] },
  use: {
    loader: 'esbuild-loader',
    options: esbuildOptions,
  },
};

export const cssRule: RuleSetRule = {
  test: /\.css$/,
  use: [
    {
      loader: MiniCssExtractPlugin.loader,
      options: {
        publicPath: './',
      },
    },
    {
      loader: 'css-loader',
      options: {
        url: true,
        sourceMap: false,
      },
    },
  ],
};
