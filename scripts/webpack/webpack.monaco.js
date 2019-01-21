const path = require('path');
const webpack = require('webpack');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  // output: {
  //   filename: 'monaco.min.js',
  //   path: path.resolve(__dirname, 'dist'),
  //   libraryTarget: 'umd',
  //   library: 'monaco',
  //   globalObject: 'self'
  // },
  entry: {
    // monaco: './public/app/plugins/datasource/grafana-azure-monitor-datasource/monaco/monaco-loader.ts',
  },
  output: {
    // filename: 'monaco.min.js',
    // chunkFilename: '[name].bundle.js',
    globalObject: 'self',
  },
  resolveLoader: {
    alias: {
      'blob-url-loader': require.resolve('./loaders/blobUrl'),
      'compile-loader': require.resolve('./loaders/compile'),
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [ 'style-loader', 'css-loader' ]
      },
      // {
      //   // https://github.com/bridgedotnet/Bridge/issues/3097
      //   test: /bridge\.js$/,
      //   loader: 'regexp-replace-loader',
      //   options: {
      //     match: {
      //       pattern: "globals\\.System\\s=\\s\\{\\};"
      //     },
      //     replaceWith: "$& System = globals.System; "
      //   }
      // },
      // {
      //   test: /Kusto\.JavaScript\.Client\.js$/,
      //   loader: 'regexp-replace-loader',
      //   options: {
      //     match: {
      //       pattern: '"use strict";'
      //     },
      //     replaceWith: "$& System = globals.System; "
      //   }
      // },
      // {
      //   test: /Kusto\.Language\.Bridge\.js$/,
      //   loader: 'regexp-replace-loader',
      //   options: {
      //     match: {
      //       pattern: '"use strict";'
      //     },
      //     replaceWith: "$& System = globals.System; "
      //   }
      // },
      // {
      //   test: /newtonsoft\.json\.js$/,
      //   loader: 'regexp-replace-loader',
      //   options: {
      //     match: {
      //       pattern: '"use strict";'
      //     },
      //     replaceWith: "$& System = globals.System; "
      //   }
      // },
      // {
      //   test: /monaco\.contribution\.js$/,
      //   loader: 'regexp-replace-loader',
      //   options: {
      //     match: {
      //       pattern: 'vs/language/kusto/kustoMode',
      //       flags: 'g'
      //     },
      //     replaceWith: "./kustoMode"
      //   }
      // },
    ]
  },
  optimization: {
    splitChunks: {
      // chunks: 'all',
      cacheGroups: {
        // monacoContribution: {
        //   test: /(src)|(node_modules(?!\/@kusto))/,
        //   name: 'monaco.contribution',
        //   enforce: false,
        //   // chunks: 'all',
        // },
        // bridge: {
        //   test: /bridge/,
        //   name: 'bridge',
        //   chunks: 'all',
        // },
        // KustoJavaScriptClient: {
        //   test: /Kusto\.JavaScript\.Client/,
        //   name: 'kusto.javaScript.client',
        //   chunks: 'all',
        // },
        // KustoLanguageBridge: {
        //   test: /Kusto\.Language\.Bridge/,
        //   name: 'kusto.language.bridge',
        //   chunks: 'all',
        // },
      }
    }
  },
  plugins: [
    new webpack.IgnorePlugin(/^((fs)|(path)|(os)|(crypto)|(source-map-support))$/, /vs\/language\/typescript\/lib/),
    // new webpack.optimize.LimitChunkCountPlugin({
    //   maxChunks: 1,
    // }),
    // new UglifyJSPlugin()
  ],
};
