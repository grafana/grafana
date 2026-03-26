import CopyWebpackPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { createRequire } from 'node:module';
import path from 'node:path';
import webpack, { type Configuration } from 'webpack';

import CorsWorkerPlugin from './plugins/CorsWorkerPlugin.ts';
import { esbuildRule, sassRule } from './rules.ts';

const require = createRequire(import.meta.url);

export type Env = Record<string, string | true | undefined>;

export default (env: Env = {}): Configuration => ({
  target: 'web',
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
      // some of data source plugins use global Prism object to add the language definition
      // we want to have same Prism object in core and in grafana/ui
      prismjs: require.resolve('prismjs'),
      // due to our webpack configuration not understanding package.json `exports`
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
    {
      module: /@kusto\/language-service\/bridge\.min\.js$/,
      message: /^Critical dependency: the request of a dependency is an expression$/,
    },
  ],
  plugins: [
    ...(env.react19
      ? [
          new webpack.NormalModuleReplacementPlugin(/^react$/, (resource) => {
            resource.request = resource.request.replace('react', 'react-19');
          }),
          new webpack.NormalModuleReplacementPlugin(/^react-dom/, (resource) => {
            resource.request = resource.request.replace('react-dom', 'react-dom-19');
          }),
          new webpack.NormalModuleReplacementPlugin(/^react\/jsx-runtime$/, (resource) => {
            resource.request = resource.request.replace('react/jsx-runtime', 'react-19/jsx-runtime');
          }),
          new webpack.NormalModuleReplacementPlugin(/^react\/jsx-dev-runtime/, (resource) => {
            resource.request = resource.request.replace('react/jsx-dev-runtime', 'react-19/jsx-dev-runtime');
          }),
        ]
      : []),
    new CorsWorkerPlugin(),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/img', to: 'img' },
        { from: 'public/maps', to: 'maps' },
        { from: 'public/gazetteer', to: 'gazetteer' },
      ],
    }),
    new MiniCssExtractPlugin({
      filename: env.react19 ? 'grafana.[name]-react19.[contenthash].css' : 'grafana.[name].[contenthash].css',
    }),
  ],
  module: {
    rules: [
      esbuildRule,
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
