import rspack, {
  CssExtractRspackPlugin,
  type Optimization,
  type RuleSetRules,
  type ExperimentCacheOptions,
  type ResolveOptions,
} from '@rspack/core';
import type { Configuration as DevServerConfiguration } from '@rspack/dev-server';
import { ReactRefreshRspackPlugin } from '@rspack/plugin-react-refresh';
import AssetsPlugin from 'assets-webpack-plugin';
import ESLintPlugin from 'eslint-rspack-plugin';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';

const require = createRequire(import.meta.url);
const getEnvConfig = require('../webpack/env-util');

const envConfig = getEnvConfig();

export const entries = {
  app: './public/app/index.ts',
  swagger: './public/swagger/index.tsx',
  dark: './public/sass/grafana.dark.scss',
  light: './public/sass/grafana.light.scss',
};

export function getOutput(env: Record<string, unknown> = {}) {
  return {
    clean: true,
    path: resolve(import.meta.dirname, '../../public/build'),
    filename: env.production ? '[name].[contenthash].js' : '[name].js',
    cssFilename: env.production ? '[name].[contenthash].css' : '[name].css',
  };
}

export const extensions = ['.ts', '.tsx', '.es6', '.js', '.json', '.svg'];

export function getAliases(env: Record<string, unknown> = {}) {
  const developmentAliases = {
    // Packages linked for development need react to be resolved from the same location
    react: resolve('./node_modules/react'),

    // This is required to correctly resolve react-router-dom when linking with
    //  local version of @grafana/scenes
    'react-router-dom': resolve('./node_modules/react-router-dom'),
  };

  return {
    ...(env.development ? developmentAliases : {}),
    prismjs: require.resolve('prismjs'),
    '@locker/near-membrane-dom/custom-devtools-formatter': require.resolve(
      '@locker/near-membrane-dom/custom-devtools-formatter.js'
    ),
  };
}

export const modules = ['node_modules', resolve('node_modules'), resolve('public')];

export function getPlugins(env: Record<string, unknown> = {}) {
  const commonPlugins = [
    new rspack.ProgressPlugin(),
    new rspack.NormalModuleReplacementPlugin(/^@grafana\/schema\/dist\/esm\/(.*)$/, (resource) => {
      resource.request = resource.request.replace('@grafana/schema/dist/esm', '@grafana/schema/src');
    }),
    new rspack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new rspack.CopyRspackPlugin({
      patterns: [
        {
          from: 'public/img',
          to: 'public/build/img',
        },
      ],
    }),
    new rspack.DefinePlugin({
      'process.env': {
        NODE_ENV: env.production ? JSON.stringify('production') : JSON.stringify('development'),
      },
    }),
    new rspack.CssExtractRspackPlugin({
      filename: env.production ? 'grafana.[name].[contenthash].css' : 'grafana.[name].css',
    }),
    new rspack.EnvironmentPlugin(envConfig),
    new AssetsPlugin({
      entrypoints: true,
      removeFullPathAutoPrefix: true,
      path: resolve(import.meta.dirname, '../../public/build'),
      filename: 'assets-manifest.json',
      processOutput: (assets) => {
        const arrayify = (value) => (Array.isArray(value) ? value : [value]);
        const entrypoints = Object.entries(assets).reduce(
          (acc, [key, value]) => {
            const valuesAsArray = Object.entries(value).reduce((acc, [key, value]) => {
              const devServerAssets = arrayify(value).map((asset) => `${asset}`);
              acc[key] = arrayify(devServerAssets);
              return acc;
            }, {});

            acc.entrypoints[key] = {
              assets: valuesAsArray,
            };
            return acc;
          },
          { entrypoints: {} }
        );
        return JSON.stringify(entrypoints, null, 2);
      },
    }),
  ];

  const developmentPlugins = [
    new ReactRefreshRspackPlugin(),
    new TsCheckerRspackPlugin({
      async: true, // don't block webpack emit
      typescript: {
        mode: 'write-references',
        diagnosticOptions: {
          semantic: true,
          syntactic: true,
        },
      },
    }),
    new ESLintPlugin({
      cache: true,
      lintDirtyModulesOnly: true, // don't lint on start, only lint changed files
      extensions: ['.ts', '.tsx'],
      configType: 'flat',
    }),
  ];

  if (env.development) {
    return [...commonPlugins, ...developmentPlugins];
  }

  return commonPlugins;
}

export function getExperiments(env: Record<string, unknown> = {}) {
  // This doesn't work reliably right now so disabling.
  const cache: ExperimentCacheOptions = {
    buildDependencies: [import.meta.filename, join(import.meta.dirname, '../../tsconfig.json')],
    storage: {
      directory: env.production ? 'grafana-default-rspack-production' : 'grafana-default-rspack-development',
      type: 'filesystem',
    },
    type: 'persistent',
  };
  return {
    asyncWebAssembly: true,
    cache,
  };
}

export function getModuleRules(env: Record<string, unknown> = {}) {
  const commonModuleRules: RuleSetRules = [
    {
      test: /\.(jsx?|tsx?)$/,
      use: [
        {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  development: Boolean(env.development),
                  // refresh: Boolean(env.development),
                },
              },
            },
            // env: { targets: 'defaults' },
          },
        },
      ],
    },
    {
      test: /\.(sa|sc|c)ss$/,
      use: [
        {
          loader: CssExtractRspackPlugin.loader,
        },
        {
          loader: 'css-loader',
          options: {
            importLoaders: 2,
            sourceMap: false,
            preserveUrl: true,
          },
        },
        {
          loader: 'postcss-loader',
          options: {
            sourceMap: false,
            postcssOptions: {
              config: resolve(import.meta.dirname, '../webpack'),
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
    },
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
      generator: { filename: 'img/[name].[hash:8][ext]' },
    },
    {
      // Required for msagl library (used in Nodegraph panel) to work
      test: /\.m?js$/,
      resolve: {
        fullySpecified: false,
      },
    },
  ];

  return commonModuleRules;
}

export const nodePolyfills: ResolveOptions['fallback'] = {
  // buffer: false,
  fs: false,
  stream: false,
  // http: false,
  // https: false,
  // string_decoder: false,
};

export function devServer(isDevelopment: boolean): DevServerConfiguration {
  if (!isDevelopment || !envConfig.frontend_dev_server) {
    return {};
  }
  return {
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    client: {
      overlay: false,
    },
    historyApiFallback: true,
    static: false,
    // static: ['public/fonts', 'public/img'],
    // devMiddleware: {
    // publicPath: `/public/build`,
    // },
  };
}

export function getOptimizations(env: Record<string, unknown> = {}) {
  if (env.development) {
    return {
      moduleIds: 'named',
      // runtimeChunk: true,
      // removeEmptyChunks: false,
      // splitChunks: false,
    } as Optimization;
  }

  return {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      minChunks: 1,
      cacheGroups: {
        moment: {
          test: /[\\/]node_modules[\\/]moment[\\/].*[jt]sx?$/,
          chunks: 'initial',
          priority: 20,
          enforce: true,
        },
        defaultVendors: {
          test: /[\\/]node_modules[\\/].*[jt]sx?$/,
          chunks: 'initial',
          priority: -10,
          reuseExistingChunk: true,
          enforce: true,
        },
        default: {
          priority: -20,
          chunks: 'all',
          test: /.*[jt]sx?$/,
          reuseExistingChunk: true,
        },
      },
    },
    nodeEnv: 'production',
    minimize: Boolean(env.noMinify),
  } as Optimization;
}
