'use strict';

const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');
const { HotModuleReplacementPlugin, DefinePlugin } = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const getBabelConfig = require('./babel.config');
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (env = {}) =>
  merge(common, {
    devtool: 'inline-source-map',
    mode: 'development',

    entry: {
      app: './public/app/index.ts',
      dark: './public/sass/grafana.dark.scss',
      light: './public/sass/grafana.light.scss',
    },

    // If we enabled watch option via CLI
    watchOptions: {
      ignored: /node_modules/,
    },

    module: {
      // Note: order is bottom-to-top and/or right-to-left
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'esbuild-loader',
          options: {
            loader: 'tsx',
            target: 'es2015',
          },
          exclude: /node_modules/,
        },
        require('./sass.rule.js')({
          sourceMap: false,
          preserveUrl: false,
        }),
      ],
    },

    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },

    plugins: [
      parseInt(env.noTsCheck, 10)
        ? new DefinePlugin({}) // bogus plugin to satisfy webpack API
        : new ForkTsCheckerWebpackPlugin({
            // enabling eslint blocks type checking which results in slow dev builds
            // https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/issues/612
            typescript: {
              mode: 'write-references',
              memoryLimit: 4096,
              diagnosticOptions: {
                semantic: false,
                syntactic: true,
              },
            },
          }),
      new ESLintPlugin({
        lintDirtyModulesOnly: true,
        extensions: ['.ts', '.tsx'],
      }),
      new MiniCssExtractPlugin({
        filename: 'grafana.[name].[fullhash].css',
      }),
      new HtmlWebpackPlugin({
        filename: path.resolve(__dirname, '../../public/views/error.html'),
        template: path.resolve(__dirname, '../../public/views/error-template.html'),
        inject: false,
        chunksSortMode: 'none',
        excludeChunks: ['dark', 'light'],
        // templateParameters: templateParametersGenerator,
      }),
      new HtmlWebpackPlugin({
        filename: path.resolve(__dirname, '../../public/views/index.html'),
        template: path.resolve(__dirname, '../../public/views/index-template.html'),
        hash: true,
        inject: false,
        chunksSortMode: 'none',
        excludeChunks: ['dark', 'light'],
        // templateParameters: templateParametersGenerator,
      }),
      new HotModuleReplacementPlugin(),
      new DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('development'),
        },
      }),
      // new BundleAnalyzerPlugin({
      //   analyzerPort: 8889
      // })
    ],
  });

function templateParametersGenerator(compilation, assets, assetTags, options) {
  console.log(assets);
  return {
    compilation: compilation,
    webpackConfig: compilation.options,
    htmlWebpackPlugin: {
      tags: assetTags,
      files: assets,
      options: options,
    },
  };
}
