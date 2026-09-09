import rspack, { type Configuration, type RuleSetRule } from '@rspack/core';
import { ReactRefreshRspackPlugin } from '@rspack/plugin-react-refresh';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getEnvConfig } from '../cli/env-util.ts';

import CorsWorkerPlugin from './plugins/CorsWorkerPlugin.ts';
import E2ESelectorsPlugin from './plugins/E2ESelectorsPlugin.ts';

const require = createRequire(import.meta.url);
const grafanaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The ini parser also returns booleans, which EnvironmentPlugin types as strings but
// JSON.stringifies the same way.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const envConfig = getEnvConfig(grafanaRoot) as Record<string, string>;

export type Env = Record<string, string | true | undefined>;

// Disk layout, URL and CDN path are one string. The backend rebuilds it too - see
// webassets.PublicPathFor on the Go side.
export const PUBLIC_PATH = 'public/build/rspack/';

// `reactRefresh` emits calls into a runtime that only ReactRefreshRspackPlugin injects, so the
// caller must register that plugin too. The `hmr` branch below does both; nothing else should
// set this. It also needs the development JSX transform, which is why the flag turns both on.
export function createSwcRule({ reactRefresh = false } = {}): RuleSetRule {
  return {
    test: /\.tsx?$/,
    use: {
      loader: 'builtin:swc-loader',
      options: {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: {
            react: reactRefresh ? { runtime: 'automatic', development: true, refresh: true } : { runtime: 'automatic' },
          },
        },
      },
    },
    type: 'javascript/auto',
  };
}

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

export interface CommonOptions {
  // Hot module replacement is incompatible with content hashes, so HMR builds fall back to
  // plain names. Nothing caches them: they are served straight from the dev server.
  //
  // Only rspack.dev.ts may set this. It is deliberately not read from `env`: `--env` is a
  // user-facing CLI surface, and an HMR-flavoured production build compiles clean but ships
  // unhashed filenames and Fast Refresh calls with no runtime to receive them.
  hmr?: boolean;
}

export default (env: Env = {}, { hmr = false }: CommonOptions = {}): Configuration => {
  // Content hashes let the CDN cache immutably; HMR needs stable names to patch instead.
  const contentHash = hmr ? '' : '.[contenthash]';

  return {
    target: 'browserslist',

    // We need this so Rspack processes AMD modules that live in our npm dependencies otherwise the SystemJS define
    // function will be used and the module will end up in the SystemJS registry instead of Rspack's module registry.
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
      clean: true,
      // keep `path` and `publicPath` aligned otherwise 404s will occur.
      path: path.resolve(import.meta.dirname, '../..', PUBLIC_PATH),
      filename: (pathData) => {
        // boot.js is referenced by name from the Go template, so it never carries a hash.
        if (pathData.chunk?.name === 'boot') {
          return '[name].js';
        }
        return `[name]${contentHash}.js`;
      },
      chunkFilename: `[name]${contentHash}.js`,
      publicPath: PUBLIC_PATH,
      // Dynamic imports can run before Grafana's default Trusted Types policy is initialized.
      trustedTypes: { policyName: 'grafana#rspack' },
      // Enable es module output
      module: true,
      chunkFormat: 'module',
      chunkLoading: 'import',
      workerChunkLoading: 'import',
      crossOriginLoading: 'anonymous',
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
        // TODO: Remove once Rspack replaces Webpack.
        // Rspack emits worker chunks as ES modules (workerChunkLoading: 'import' below), which
        // resolve to module-worker variants instead of the importScripts based originals used by
        // the webpack build.
        'app/core/utils/CorsWorker$': path.resolve(grafanaRoot, 'public/app/core/utils/CorsWorker.rspack.ts'),
        'app/core/utils/CorsSharedWorker$': path.resolve(
          grafanaRoot,
          'public/app/core/utils/CorsSharedWorker.rspack.ts'
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
      // Has to be a function, not a regex - rspack's warning text has extra formatting that an anchored regex won't match.
      (warning) =>
        warning.message.includes('Critical dependency: the request of a dependency is an expression') &&
        warning.module != null &&
        /@kusto[\\/]language-service[\\/]bridge\.min\.js/.test(warning.module.readableIdentifier()),
    ],
    plugins: [
      new CorsWorkerPlugin(),
      new E2ESelectorsPlugin(),
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
        filename: `grafana.[name]${contentHash}.css`,
      }),
      new rspack.EnvironmentPlugin(envConfig),
      // Paired with `createSwcRule({ reactRefresh })` below: the transform emits calls this
      // plugin's runtime receives, so the two are registered from the same flag.
      ...(hmr ? [new ReactRefreshRspackPlugin()] : []),
    ],
    module: {
      parser: {
        javascript: {
          // Rspack raises missing ESM exports as errors which fail builds - treat them as warnings instead.
          exportsPresence: 'warn',
        },
      },
      rules: [
        createSwcRule({ reactRefresh: hmr }),
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
  };
};
