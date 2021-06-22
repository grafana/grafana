const fs = require('fs-extra');
const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const getBabelConfig = require('./babel.config');

class CopyUniconsPlugin {
  apply(compiler) {
    compiler.hooks.afterEnvironment.tap('CopyUniconsPlugin', () => {
      let destDir = path.resolve(__dirname, '../../public/img/icons/unicons');

      if (!fs.pathExistsSync(destDir)) {
        let srcDir = path.resolve(__dirname, '../../node_modules/iconscout-unicons-tarball/unicons/svg/line');
        fs.copySync(srcDir, destDir);
      }
    });
  }
}

// https://github.com/visionmedia/debug/issues/701#issuecomment-505487361
function shouldExclude(filename) {
  // There is external js code inside this which needs to be processed by babel.
  if (filename.indexOf(`jaeger-ui-components`) > 0) {
    return false;
  }

  const packagesToProcessbyBabel = ['debug', 'lru-cache', 'yallist', 'react-hook-form', 'rc-trigger'];
  for (const package of packagesToProcessbyBabel) {
    if (filename.indexOf(`node_modules/${package}`) > 0) {
      return false;
    }
  }
  return true;
}

console.log(path.resolve());
module.exports = {
  target: 'web',
  entry: {
    app: './public/app/index.ts',
  },
  output: {
    path: path.resolve(__dirname, '../../public/build'),
    filename: '[name].[hash].js',
    // Keep publicPath relative for host.com/grafana/ deployments
    publicPath: 'public/build/',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.es6', '.js', '.json', '.svg'],
    alias: {
      // rc-trigger uses babel-runtime which has internal dependency to core-js@2
      // this alias maps that dependency to core-js@t3
      'core-js/library/fn': 'core-js/stable',
      // storybook v6 bump caused the app to bundle multiple versions of react breaking hooks
      // make sure to resolve only from the project: https://github.com/facebook/react/issues/13991#issuecomment-435587809
      react: path.resolve(__dirname, '../../node_modules/react'),
      // some of data source pluginis use global Prism object to add the language definition
      // we want to have same Prism object in core and in grafana/ui
      prismjs: path.resolve(__dirname, '../../node_modules/prismjs'),
    },
    modules: [
      'node_modules',
      path.resolve('public'),
      // we need full path to root node_modules for grafana-enterprise symlink to work
      path.resolve('node_modules'),
    ],
  },
  stats: {
    children: false,
    warningsFilter: /export .* was not found in/,
    source: false,
  },
  node: {
    fs: 'empty',
  },
  plugins: [
    new CopyUniconsPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        {
          context: path.resolve(__dirname, '../../node_modules/monaco-editor/'),
          from: 'min/vs/**',
          to: '../lib/monaco/', // inside the public/build folder
          globOptions: {
            ignore: [
              '**/language/typescript/**', // 10mb
              '**/*.map', // debug files
            ],
          },
        },
        {
          from: './node_modules/@kusto/monaco-kusto/release/min/',
          to: '../lib/monaco/min/vs/language/kusto/',
        },
      ],
    }),
  ],
  module: {
    rules: [
      /**
       * Some npm packages are bundled with es2015 syntax, ie. debug
       * To make them work with PhantomJS we need to transpile them
       * to get rid of unsupported syntax.
       */
      {
        test: /\.js$/,
        exclude: shouldExclude,
        use: [
          {
            loader: 'babel-loader',
            options: getBabelConfig(),
          },
        ],
      },
      {
        test: require.resolve('jquery'),
        use: [
          {
            loader: 'expose-loader',
            query: 'jQuery',
          },
          {
            loader: 'expose-loader',
            query: '$',
          },
        ],
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
              attrs: [],
              minimize: true,
              removeComments: false,
              collapseWhitespace: false,
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
        options: { name: 'static/img/[name].[hash:8].[ext]' },
      },
      {
        test: /\.worker\.js$/,
        use: {
          loader: 'worker-loader',
          options: {
            inline: 'fallback',
          },
        },
      },
    ],
  },
  // https://webpack.js.org/plugins/split-chunks-plugin/#split-chunks-example-3
  optimization: {
    moduleIds: 'hashed',
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
        vendors: {
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
