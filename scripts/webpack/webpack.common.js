const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

const CorsWorkerPlugin = require('./plugins/CorsWorkerPlugin');

module.exports = (env = {}) => ({
  target: 'web',
  entry: {
    app: './public/app/index.ts',
    swagger: './public/swagger/index.tsx',
  },
  experiments: {
    // Required to load WASM modules.
    asyncWebAssembly: true,
  },
  output: {
    clean: env.react19 ? false : true,
    path: path.resolve(__dirname, '../../public/build'),
    filename: env.react19 ? '[name]-react19.[contenthash].js' : '[name].[contenthash].js',
    // Keep publicPath relative for host.com/grafana/ deployments
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
        {
          from: 'public/img',
          to: 'img',
        },
        {
          from: 'public/maps',
          to: 'maps',
        },
        {
          from: 'public/gazetteer',
          to: 'gazetteer',
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
  // https://webpack.js.org/plugins/split-chunks-plugin/#split-chunks-example-3
  optimization: {
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
  },
});
