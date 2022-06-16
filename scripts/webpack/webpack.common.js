const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

const CopyUniconsPlugin = require('./plugins/CopyUniconsPlugin');
const CorsWorkerPlugin = require('./plugins/CorsWorkerPlugin');

module.exports = {
  target: 'web',
  entry: {
    app: './public/app/index.ts',
  },
  output: {
    clean: true,
    path: path.resolve(__dirname, '../../public/build'),
    filename: '[name].[contenthash].js',
    // Keep publicPath relative for host.com/grafana/ deployments
    publicPath: 'public/build/',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.es6', '.js', '.json', '.svg'],
    alias: {
      // some of data source plugins use global Prism object to add the language definition
      // we want to have same Prism object in core and in grafana/ui
      prismjs: require.resolve('prismjs'),
    },
    modules: ['node_modules', path.resolve('public')],
    fallback: {
      buffer: false,
      fs: false,
      stream: false,
      http: false,
      https: false,
      string_decoder: false,
    },
    symlinks: false,
  },
  ignoreWarnings: [/export .* was not found in/],
  stats: {
    children: false,
    source: false,
  },
  plugins: [
    new CorsWorkerPlugin(),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new CopyUniconsPlugin(),
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
          context: path.join(require.resolve('@kusto/monaco-kusto'), '../'),
          from: '**/*',
          to: '../lib/monaco/min/vs/language/kusto/',
        },
      ],
    }),
  ],
  module: {
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
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      // for pre-caching SVGs as part of the JS bundles
      {
        test: /\.svg$/,
        use: 'raw-loader',
      },
      {
        test: /\.(svg|ico|jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
        loader: 'file-loader',
        options: { name: 'static/img/[name].[contenthash:8].[ext]' },
      },
    ],
  },
  // https://webpack.js.org/plugins/split-chunks-plugin/#split-chunks-example-3
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      minChunks: 1,
      cacheGroups: {
        unicons: {
          test: /[\\/]node_modules[\\/]@iconscout[\\/]react-unicons[\\/].*[jt]sx?$/,
          chunks: 'initial',
          priority: 20,
          enforce: true,
        },
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
  },
};
