'use strict';

const merge = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const common = require('./webpack.common.js');
const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',

  entry: {
    dark: './public/sass/grafana.dark.scss',
    light: './public/sass/grafana.light.scss',
  },

  module: {
    // Note: order is bottom-to-top and/or right-to-left
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              babelrc: false,
              // Note: order is top-to-bottom and/or left-to-right
              plugins: [
                [
                  require('@rtsao/plugin-proposal-class-properties'),
                  {
                    loose: true,
                  },
                ],
                '@babel/plugin-proposal-nullish-coalescing-operator',
                '@babel/plugin-proposal-optional-chaining',
                '@babel/plugin-syntax-dynamic-import', // needed for `() => import()` in routes.ts
                'angularjs-annotate',
              ],
              // Note: order is bottom-to-top and/or right-to-left
              presets: [
                [
                  '@babel/preset-env',
                  {
                    targets: {
                      browsers: 'last 3 versions',
                    },
                    useBuiltIns: 'entry',
                    corejs: 3,
                    modules: false,
                  },
                ],
                [
                  '@babel/preset-typescript',
                  {
                    allowNamespaces: true,
                  },
                ],
                '@babel/preset-react',
              ],
            },
          },
        ],
      },
      require('./sass.rule.js')({
        sourceMap: false,
        preserveUrl: false,
      }),
    ],
  },
  optimization: {
    nodeEnv: 'production',
    minimizer: [
      new TerserPlugin({
        cache: false,
        parallel: false,
        sourceMap: true,
      }),
      new OptimizeCSSAssetsPlugin({}),
    ],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      eslint: {
        enabled: true,
        files: [
          'public/app/**/*.{ts,tsx}',
          // this can't be written like this packages/**/src/**/*.ts because it throws an error
          'packages/grafana-ui/src/**/*.{ts,tsx}',
          'packages/grafana-data/src/**/*.{ts,tsx}',
          'packages/grafana-runtime/src/**/*.{ts,tsx}',
          'packages/grafana-e2e-selectors/src/**/*.{ts,tsx}',
          'packages/jaeger-ui-components/src/**/*.{ts,tsx}',
        ],
      },
      typescript: {
        mode: 'write-references',
        memoryLimit: 4096,
        diagnosticOptions: {
          semantic: true,
          syntactic: true,
        },
      },
    }),
    new MiniCssExtractPlugin({
      filename: 'grafana.[name].[hash].css',
    }),
    new HtmlWebpackPlugin({
      filename: path.resolve(__dirname, '../../public/views/error.html'),
      template: path.resolve(__dirname, '../../public/views/error-template.html'),
      inject: false,
      excludeChunks: ['dark', 'light'],
      chunksSortMode: 'none',
    }),
    new HtmlWebpackPlugin({
      filename: path.resolve(__dirname, '../../public/views/index.html'),
      template: path.resolve(__dirname, '../../public/views/index-template.html'),
      inject: false,
      excludeChunks: ['manifest', 'dark', 'light'],
      chunksSortMode: 'none',
    }),
    function() {
      this.hooks.done.tap('Done', function(stats) {
        if (stats.compilation.errors && stats.compilation.errors.length) {
          console.log(stats.compilation.errors);
          process.exit(1);
        }
      });
    },
  ],
});
