'use strict';

const browserslist = require('browserslist');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

const CorsWorkerPlugin = require('../plugins/CorsWorkerPlugin');
const { resolveToEsbuildTarget } = require('esbuild-plugin-browserslist');
const esbuildTargets = resolveToEsbuildTarget(browserslist(), { printUnknownTargets: false });
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// esbuild-loader 3.0.0+ requires format to be set to prevent it
// from defaulting to 'iife' which breaks monaco/loader once minified.
const esbuildOptions = {
  target: esbuildTargets,
  format: undefined,
};

module.exports = {
  devtool: 'source-map',
  mode: "development",
  target: "web",
  entry: { 
    exporter: './public/app/features/panel-exporter/exporter.tsx',
    dark: './public/sass/grafana.dark.scss',
    light: './public/sass/grafana.light.scss',
},
  output: {
    path: path.resolve(__dirname, '../../../public/build/panel-exporter/'),
    filename: '[name].js',
    library: { "name": "Grafana", "type": "window" },
  },
  ignoreWarnings: [/export .* was not found in/],
  resolve: {
    extensions: ['.ts', '.tsx', '.es6', '.js', '.json', '.svg'],
    alias: {
      // some of data source plugins use global Prism object to add the language definition
      // we want to have same Prism object in core and in grafana/ui
      prismjs: require.resolve('prismjs'),
      // some sub-dependencies use a different version of @emotion/react and generate warnings
      // in the browser about @emotion/react loaded twice. We want to only load it once
      '@emotion/react': require.resolve('@emotion/react'),
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
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/^@grafana\/schema\/dist\/esm\/(.*)$/, (resource) => {
      resource.request = resource.request.replace('@grafana/schema/dist/esm', '@grafana/schema/src');
    }),
    new CorsWorkerPlugin(),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new MiniCssExtractPlugin({
        filename: 'grafana.panel-exporter.[name].css',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          context: path.join(require.resolve('monaco-editor/package.json'), '../min/vs/'),
          from: '**/*',
          to: '../lib/monaco/min/vs/', // inside the public/build folder
          globOptions: {
            ignore: [
              '**/*.map', // debug files
            ],
          },
        },
        {
          context: path.join(require.resolve('@kusto/monaco-kusto/package.json'), '../release/min'),
          from: '**/*',
          to: '../lib/monaco/min/vs/language/kusto/',
        },
      ],
    }),
  ],
  module: {
    // Note: order is bottom-to-top and/or right-to-left
    rules: [
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
            loader: 'ngtemplate-loader?relativeTo=' + path.resolve(__dirname, '../../public') + '&prefix=public',
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
      // for pre-caching SVGs as part of the JS bundles
      {
        test: /(unicons|mono|custom)[\\/].*\.svg$/,
        type: 'asset/source',
      },
      {
        // Required for msagl library (used in Nodegraph panel) to work
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.tsx?$/,
        use: {
          loader: 'esbuild-loader',
          options: esbuildOptions,
        },
      },
      require('./sass.rule.js')({
        sourceMap: false,
        preserveUrl: true,
      }),
    ],
  },
  // single big chunk
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  }
}
