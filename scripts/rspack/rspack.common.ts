import rspack, { type Configuration, type RuleSetRule } from '@rspack/core';
import browserslist from 'browserslist';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getEnvConfig } from '../cli/env-util.ts';

import CorsWorkerPlugin from './plugins/CorsWorkerPlugin.ts';

const require = createRequire(import.meta.url);
const grafanaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The ini parser also returns booleans, which EnvironmentPlugin types as strings but
// JSON.stringifies the same way.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const envConfig = getEnvConfig(grafanaRoot) as Record<string, string>;

export type Env = Record<string, string | true | undefined>;

export const swcRule: RuleSetRule = {
  test: /\.tsx?$/,
  use: {
    loader: 'builtin:swc-loader',
    options: {
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        // `development` defaults to the compiler mode. Leaving it on routes JSX through
        // jsxDEV, which embeds the absolute source path of every call site and makes the
        // bundle hash differently per checkout directory.
        transform: { react: { runtime: 'automatic', development: false } },
      },
      env: { targets: browserslist().join(', ') },
    },
  },
  type: 'javascript/auto',
};

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

  // Rspack only parses AMD `define` branches when this is set. Without it, UMD wrappers in
  // node_modules keep their runtime `define.amd` check, which passes because systemjs
  // installs a global `define`. Those modules register as AMD, export nothing, and Grafana
  // crashes at boot with a green build.
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
    // `path` and `publicPath` must agree: disk layout, URL and CDN path are one string.
    clean: true,
    path: path.resolve(import.meta.dirname, '../../public/build/rspack'),
    filename: (pathData) => {
      if (pathData.chunk?.name === 'boot') {
        return '[name].js';
      }
      return '[name].[contenthash].js';
    },
    chunkFilename: '[name].[contenthash].js',
    publicPath: 'public/build/rspack/',
    // Dynamic imports can run before Grafana's default Trusted Types policy is initialized.
    trustedTypes: { policyName: 'grafana#rspack' },
  },
  resolve: {
    conditionNames: ['@grafana-app/source', '...'],
    extensions: ['.ts', '.tsx', '.es6', '.js', '.json', '.svg'],
    alias: {
      // some of data source plugins use global Prism object to add the language definition
      // we want to have same Prism object in core and in grafana/ui
      prismjs: require.resolve('prismjs'),
      // Core injects the real implementation during bootstrap only when Luxon is disabled.
      'moment-timezone$': path.resolve(grafanaRoot, 'public/app/core/legacyMomentShim.ts'),
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
    // Function form because rspack's warning message carries extra formatting, which an
    // anchored message regex never matches.
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
        // Rspack raises missing ESM exports as hard errors. Downgraded so ignoreWarnings
        // above can swallow them, as it does under webpack.
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
