import rspack, { CssExtractRspackPlugin, type ExperimentCacheOptions, type RuleSetRules } from '@rspack/core';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
// import WebpackAssetsManifest from 'webpack-assets-manifest';

const require = createRequire(import.meta.url);
const getEnvConfig = require('../webpack/env-util');

const envConfig = getEnvConfig();

export const entries = {
  app: './public/app/index.ts',
  swagger: './public/swagger/index.tsx',
  dark: './public/sass/grafana.dark.scss',
  light: './public/sass/grafana.light.scss',
};

export const output = {
  clean: true,
  path: resolve(import.meta.dirname, '../../public/build'),
  filename: '[name].[contenthash].js',
  publicPath: 'auto',
};

export const extensions = ['.ts', '.tsx', '.es6', '.js', '.json', '.svg'];

export function getAliases(env: Record<string, unknown> = {}) {
  const developmentAliases = {
    // Packages linked for development need react to be resolved from the same location
    react: resolve('./node_modules/react'),

    // Also Grafana packages need to be resolved from the same location so they share
    // the same singletons
    '@grafana/runtime': resolve(import.meta.dirname, '../../packages/grafana-runtime'),
    '@grafana/data': resolve(import.meta.dirname, '../../packages/grafana-data'),

    // This is required to correctly resolve react-router-dom when linking with
    //  local version of @grafana/scenes
    'react-router-dom': resolve('./node_modules/react-router-dom'),
  };

  return {
    prismjs: require.resolve('prismjs'),
    '@locker/near-membrane-dom/custom-devtools-formatter': require.resolve(
      '@locker/near-membrane-dom/custom-devtools-formatter.js'
    ),
    ...(env.development ? developmentAliases : {}),
  };
}

export const modules = ['node_modules', resolve('public')];

export function getPlugins(env: Record<string, unknown> = {}) {
  const commonPlugins = [
    new rspack.NormalModuleReplacementPlugin(/^@grafana\/schema\/dist\/esm\/(.*)$/, (resource) => {
      resource.request = resource.request.replace('@grafana/schema/dist/esm', '@grafana/schema/src');
    }),
    // new CorsWorkerPlugin(),
    new rspack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new rspack.DefinePlugin({
      'process.env': {
        NODE_ENV: env.production ? JSON.stringify('production') : JSON.stringify('development'),
      },
    }),
    new rspack.CssExtractRspackPlugin({
      filename: 'grafana.[name].[contenthash].css',
    }),
    new rspack.EnvironmentPlugin(envConfig),
  ];

  const productionPlugins = [
    // new WebpackAssetsManifest({
    //   entrypoints: true,
    //   publicPath: true,
    // }),
  ];

  const developmentPlugins = [];

  if (env.development) {
    return [...commonPlugins, ...developmentPlugins];
  }

  return [...commonPlugins, ...productionPlugins];
}

export function getExperiments(env: Record<string, unknown> = {}) {
  // const cache = {
  //   cache: {
  //     buildDependencies: [import.meta.filename],
  //     name: env.production ? 'grafana-default-production' : 'grafana-default-development',
  //     type: 'persistent',
  //   } as ExperimentCacheOptions,
  // };
  return {
    asyncWebAssembly: true,
    // ...cache,
  };
}

export function getModuleRules(env: Record<string, unknown> = {}): RuleSetRules {
  const commonModuleRules = [
    {
      test: /\.(j|t)s$/,
      exclude: [/[\\/]node_modules[\\/]/],
      loader: 'builtin:swc-loader',
      options: {
        jsc: {
          parser: {
            syntax: 'typescript',
          },
          externalHelpers: true,
          transform: {
            react: {
              runtime: 'automatic',
              development: !env.production,
              refresh: !env.production,
            },
          },
        },
        // env: {
        //   targets: 'Chrome >= 48',
        // },
      },
    },
    {
      test: /\.(j|t)sx$/,
      loader: 'builtin:swc-loader',
      exclude: [/[\\/]node_modules[\\/]/],
      options: {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
              development: !env.production,
              refresh: !env.production,
            },
          },
          externalHelpers: true,
        },
        // env: {
        //   targets: 'Chrome >= 48', // browser compatibility
        // },
      },
    },
    {
      test: /\.(sa|sc|c)ss$/,
      use: [
        {
          loader: CssExtractRspackPlugin.loader,
          options: {
            publicPath: './',
          },
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
      test: /\.html$/,
      exclude: /(index|error)\-template\.html/,
      use: [
        {
          loader: 'ngtemplate-loader?relativeTo=' + resolve(import.meta.dirname, '../../public') + '&prefix=public',
        },
        {
          loader: 'html-loader',
          options: {
            sources: false,
            minimize: {
              removeComments: false,
              collapseWhitespace: false,
            },
          },
        },
      ],
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
  ];

  return commonModuleRules;
}

export const nodePolyfills = {
  buffer: false,
  fs: false,
  stream: false,
  http: false,
  https: false,
  string_decoder: false,
};

export function getOptimizations(env: Record<string, unknown> = {}) {
  if (env.development) {
    return {
      moduleIds: 'named',
      runtimeChunk: true,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false,
    };
  }
  if (env.production) {
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
          angular: {
            test: /[\\/]node_modules[\\/]angular[\\/].*[jt]sx?$/,
            chunks: 'initial',
            priority: 50,
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
    };
  }
}
