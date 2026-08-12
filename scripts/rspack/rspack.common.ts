import rspack, { type Configuration, type RuleSetRule } from '@rspack/core';
import browserslist from 'browserslist';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getEnvConfig } from '../cli/env-util.ts';

import CorsWorkerPlugin from './plugins/CorsWorkerPlugin.ts';

const require = createRequire(import.meta.url);
const grafanaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// getEnvConfig returns the parsed ini values as `unknown` (the ini parser turns
// `true`/`false` into booleans). rspack's EnvironmentPlugin types its defaults as strings
// where webpack's accepts anything, but both just JSON.stringify the value, so the
// non-string values it already receives under webpack stay correct.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const envConfig = getEnvConfig(grafanaRoot) as Record<string, string>;

export type Env = Record<string, string | true | undefined>;

// Parity with resolveToEsbuildTarget(browserslist()) in scripts/webpack/rules.ts — swc's
// env.targets accepts a browserslist query directly.
// NOTE: the webpack esbuild rule sets `format: undefined` to stop esbuild defaulting to
// 'iife', which broke monaco/loader once minified. swc has no equivalent option; the risk
// moves to the prod minifier.
export const swcRule: RuleSetRule = {
  test: /\.tsx?$/,
  use: {
    loader: 'builtin:swc-loader',
    options: {
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        // `development` defaults to the compiler mode, which would compile JSX through
        // react/jsx-dev-runtime in dev. esbuild-loader never opts into that, so pinning
        // it off keeps both bundlers on the same runtime. It also keeps the output
        // machine-independent: jsxDEV embeds the absolute source path of every call
        // site, so the dev bundle would hash differently per checkout directory.
        transform: { react: { runtime: 'automatic', development: false } },
      },
      env: { targets: browserslist().join(', ') },
    },
  },
  type: 'javascript/auto',
};

// Port of sassRule in scripts/webpack/rules.ts with CssExtractRspackPlugin.loader in
// place of MiniCssExtractPlugin.loader.
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
          // postcss.config.js is shared with the webpack build and lives next to it
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

  // Rspack does not parse AMD `define` branches unless this is set; webpack does by
  // default. Without it the UMD wrappers in node_modules (json-logic-js, papaparse,
  // file-saver, …) keep their runtime `define.amd` check, and in the browser that check
  // passes because systemjs/dist/extras/amd installs a global `define` for plugin
  // loading. Those modules then register as AMD, export nothing, and Grafana crashes at
  // boot. The build stays green either way — count `define.amd` guards in the output to
  // verify (1 with this set).
  amd: {},

  entry: {
    app: './public/app/index.ts',
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
    // `path` and `publicPath` deliberately disagree. Each bundler owns its own output
    // directory, so `clean: true` here cannot wipe the webpack build, but both serve
    // under the same URL. Everything that resolves a URL at runtime — the public path
    // derivation in public/app/index.ts, the CDN path in public/views/index.html, chunk
    // and worker loading — is written against `public/build/`, so keeping the URL fixed
    // means the rspack bundle needs no frontend changes of its own.
    clean: true,
    path: path.resolve(import.meta.dirname, '../../public/build-rspack'),
    filename: (pathData) => {
      if (pathData.chunk?.name === 'boot') {
        return '[name].js';
      }
      return '[name].[contenthash].js';
    },
    chunkFilename: '[name].[contenthash].js',
    publicPath: 'public/build/',
  },
  resolve: {
    conditionNames: ['@grafana-app/source', '...'],
    extensions: ['.ts', '.tsx', '.es6', '.js', '.json', '.svg'],
    alias: {
      // some of data source plugins use global Prism object to add the language definition
      // we want to have same Prism object in core and in grafana/ui
      prismjs: require.resolve('prismjs'),
      // due to our bundler configuration not understanding package.json `exports`
      // correctly we must alias this package to the correct file
      // the alternative to this alias is to copy-paste the file into our
      // source code and miss out in updates
      '@locker/near-membrane-dom/custom-devtools-formatter': require.resolve(
        '@locker/near-membrane-dom/custom-devtools-formatter.js'
      ),
    },
    modules: [
      // default value
      'node_modules',

      // required for grafana enterprise resolution
      path.resolve('node_modules'),

      // required to for 'bare' imports (like 'app/core/utils' etc)
      path.resolve('public'),
    ],
    fallback: {
      buffer: false,
      fs: false,
      stream: false,
      http: false,
      https: false,
      string_decoder: false,
    },
  },
  ignoreWarnings: [
    /export .* was not found in/,
    // The webpack config matches this one with the `{ module, message }` object form.
    // Rspack's warning message carries extra formatting, so an anchored message regex
    // never matches — hence the function form.
    (warning) =>
      warning.message.includes('Critical dependency: the request of a dependency is an expression') &&
      warning.module != null &&
      /@kusto[\\/]language-service[\\/]bridge\.min\.js/.test(warning.module.readableIdentifier()),
  ],
  plugins: [
    new CorsWorkerPlugin(),
    new rspack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: 'public/img', to: 'img' },
        { from: 'public/maps', to: 'maps' },
        { from: 'public/gazetteer', to: 'gazetteer' },
      ],
    }),
    new rspack.CssExtractRspackPlugin({
      filename: 'grafana.[name].[contenthash].css',
    }),
    new rspack.EnvironmentPlugin(envConfig),
  ],
  module: {
    parser: {
      javascript: {
        // webpack reports missing ESM exports as warnings (swallowed by
        // ignoreWarnings[0] above); rspack raises them as hard errors
        // (ESModulesLinkingError, 19 of them from @opentelemetry/exporter-collector).
        // Downgraded globally to keep parity with the webpack build.
        exportsPresence: 'warn',
      },
    },
    rules: [
      swcRule,
      sassRule,
      {
        test: require.resolve('jquery'),
        loader: 'expose-loader',
        options: {
          exposes: ['$', 'jQuery'],
        },
      },
      {
        test: /\.(svg|ico|jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
        type: 'asset/resource',
        generator: { filename: 'static/img/[name].[hash:8][ext]' },
      },
      {
        // Required for msagl library (used in Nodegraph panel) to work
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
});
