import rspack, { type Configuration, type RuleSetRule } from '@rspack/core';
import browserslist from 'browserslist';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getEnvConfig } from '../cli/env-util.ts';

import CorsWorkerRspackPlugin from './plugins/CorsWorkerRspackPlugin.ts';

const require = createRequire(import.meta.url);
const grafanaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envConfig = getEnvConfig(grafanaRoot);

export type Env = Record<string, string | true | undefined>;

// Parity with resolveToEsbuildTarget(browserslist()) in scripts/webpack/rules.ts — swc's
// env.targets accepts a browserslist query/result directly.
// NOTE: the webpack esbuild rule sets `format: undefined` to avoid esbuild defaulting to
// 'iife' which broke monaco/loader once minified. swc has no equivalent option; the risk
// moves to the Phase 2 minifier choice.
export const swcRule: RuleSetRule = {
  test: /\.tsx?$/,
  use: {
    loader: 'builtin:swc-loader',
    options: {
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
      },
      env: { targets: browserslist().join(', ') },
    },
  },
  type: 'javascript/auto',
};

// Port of sassRule in scripts/webpack/rules.ts with CssExtractRspackPlugin.loader in place
// of MiniCssExtractPlugin.loader. postcssOptions.config must keep pointing at the
// scripts/webpack directory — that's where postcss.config.js lives (and stays).
export const sassRule: RuleSetRule = {
  test: /\.(sa|sc|c)ss$/,
  use: [
    {
      loader: rspack.CssExtractRspackPlugin.loader,
      options: {
        publicPath: './',
      },
    },
    {
      loader: 'css-loader',
      options: {
        importLoaders: 2,
        url: true,
        sourceMap: false,
      },
    },
    {
      loader: 'postcss-loader',
      options: {
        sourceMap: false,
        postcssOptions: {
          config: path.resolve(import.meta.dirname, '../webpack'),
        },
      },
    },
    {
      loader: 'sass-loader',
      options: {
        sourceMap: false,
        sassOptions: {
          // silencing these warnings since we're planning to remove sass when angular is gone
          silenceDeprecations: ['import', 'global-builtin'],
        },
      },
    },
  ],
};

export default (env: Env = {}): Configuration => ({
  target: 'web',
  // Enable rspack's AMD parsing (off by default, unlike webpack) so UMD wrappers in
  // node_modules (json-logic-js, papaparse, file-saver, …) get their define branch
  // statically resolved at build time. Without this the check runs in the browser,
  // where systemjs/dist/extras/amd has installed a global `define` for plugin
  // loading, so those modules register as AMD and export nothing — bootstrap crash.
  amd: {},
  entry: {
    app: './public/app/index.ts',
    swagger: './public/swagger/index.tsx',
    boot: {
      import: './public/boot/index.ts',
      runtime: false,
    },
    dark: './public/sass/grafana.dark.scss',
    light: './public/sass/grafana.light.scss',
  },
  experiments: {
    // Required to load WASM modules.
    asyncWebAssembly: true,
  },
  output: {
    clean: env.react19 ? false : true,
    path: path.resolve(import.meta.dirname, '../../public/build'),
    filename: (pathData) => {
      if (pathData.chunk?.name === 'boot') {
        return '[name].js';
      }
      return env.react19 ? '[name]-react19.[contenthash].js' : '[name].[contenthash].js';
    },
    chunkFilename: env.react19 ? '[name]-react19.[contenthash].js' : '[name].[contenthash].js',
    publicPath: 'public/build/',
  },
  resolve: {
    conditionNames: ['@grafana-app/source', '...'],
    extensions: ['.ts', '.tsx', '.es6', '.js', '.json', '.svg'],
    alias: {
      prismjs: require.resolve('prismjs'),
      '@locker/near-membrane-dom/custom-devtools-formatter': require.resolve(
        '@locker/near-membrane-dom/custom-devtools-formatter.js'
      ),
    },
    modules: ['node_modules', path.resolve('node_modules'), path.resolve('public')],
    fallback: { buffer: false, fs: false, stream: false, http: false, https: false, string_decoder: false },
  },
  ignoreWarnings: [
    /export .* was not found in/,
    // The webpack config uses the `{ module, message }` object form here, but rspack's
    // message match is anchored-regex-hostile (the warning message carries extra
    // formatting), so the function form is used instead.
    (warning) =>
      warning.message.includes('Critical dependency: the request of a dependency is an expression') &&
      warning.module != null &&
      /@kusto[\\/]language-service[\\/]bridge\.min\.js/.test(warning.module.readableIdentifier()),
  ],
  plugins: [
    ...(env.react19
      ? [
          new rspack.NormalModuleReplacementPlugin(/^react$/, (resource) => {
            resource.request = resource.request.replace('react', 'react-19');
          }),
          new rspack.NormalModuleReplacementPlugin(/^react-dom/, (resource) => {
            resource.request = resource.request.replace('react-dom', 'react-dom-19');
          }),
          new rspack.NormalModuleReplacementPlugin(/^react\/jsx-runtime$/, (resource) => {
            resource.request = resource.request.replace('react/jsx-runtime', 'react-19/jsx-runtime');
          }),
          new rspack.NormalModuleReplacementPlugin(/^react\/jsx-dev-runtime/, (resource) => {
            resource.request = resource.request.replace('react/jsx-dev-runtime', 'react-19/jsx-dev-runtime');
          }),
        ]
      : []),
    new CorsWorkerRspackPlugin(),
    new rspack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: 'public/img', to: 'img' },
        { from: 'public/maps', to: 'maps' },
        { from: 'public/gazetteer', to: 'gazetteer' },
      ],
    }),
    new rspack.CssExtractRspackPlugin({
      filename: env.react19 ? 'grafana.[name]-react19.[contenthash].css' : 'grafana.[name].[contenthash].css',
    }),
    new rspack.EnvironmentPlugin(envConfig),
  ],
  module: {
    parser: {
      javascript: {
        // webpack surfaces missing ESM exports in these node_modules as *warnings*
        // (suppressed by ignoreWarnings[0]); rspack raises hard errors
        // (ESModulesLinkingError, seen for @opentelemetry/exporter-collector).
        // Downgrade to warnings for behavioural parity with the webpack build.
        exportsPresence: 'warn',
      },
    },
    rules: [
      swcRule,
      sassRule,
      { test: require.resolve('jquery'), loader: 'expose-loader', options: { exposes: ['$', 'jQuery'] } },
      {
        test: /\.(svg|ico|jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
        type: 'asset/resource',
        generator: { filename: 'static/img/[name].[hash:8][ext]' },
      },
      { test: /\.m?js$/, resolve: { fullySpecified: false } },
    ],
  },
});
