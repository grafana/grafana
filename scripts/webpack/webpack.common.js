const path = require('path');

const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

// https://github.com/visionmedia/debug/issues/701#issuecomment-505487361
function shouldExclude(filename) {
  // There is external js code inside this which needs to be processed by babel.
  if (filename.indexOf(`jaeger-ui-components`) > 0) {
    return false;
  }

  const packagesToProcessbyBabel = [
    'debug',
    'lru-cache',
    'yallist',
    'apache-arrow',
    'react-hook-form',
    'rc-trigger',
    '@iconscout/react-unicons',
    'monaco-editor',
  ];
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
    new MonacoWebpackPlugin({
      // available options are documented at https://github.com/Microsoft/monaco-editor-webpack-plugin#options
      filename: 'monaco-[name].worker.js',
      languages: ['json', 'markdown', 'html', 'sql', 'mysql', 'pgsql'],
      features: [
        '!accessibilityHelp',
        'bracketMatching',
        'caretOperations',
        '!clipboard',
        '!codeAction',
        '!codelens',
        '!colorDetector',
        '!comment',
        '!contextmenu',
        '!coreCommands',
        '!cursorUndo',
        '!dnd',
        '!find',
        'folding',
        '!fontZoom',
        '!format',
        '!gotoError',
        '!gotoLine',
        '!gotoSymbol',
        '!hover',
        '!iPadShowKeyboard',
        '!inPlaceReplace',
        '!inspectTokens',
        '!linesOperations',
        '!links',
        '!multicursor',
        'parameterHints',
        '!quickCommand',
        '!quickOutline',
        '!referenceSearch',
        '!rename',
        '!smartSelect',
        '!snippets',
        'suggest',
        '!toggleHighContrast',
        '!toggleTabFocusMode',
        '!transpose',
        '!wordHighlighter',
        '!wordOperations',
        '!wordPartOperations',
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
            options: {
              presets: [['@babel/preset-env']],
            },
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
        // include: MONACO_DIR, // https://github.com/react-monaco-editor/react-monaco-editor
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(svg|ico|jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
        loader: 'file-loader',
        options: { name: 'static/img/[name].[hash:8].[ext]' },
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
