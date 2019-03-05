const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

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
    alias: {},
    modules: [path.resolve('public'), path.resolve('node_modules')],
  },
  stats: {
    children: false,
    warningsFilter: /export .* was not found in/,
  },
  node: {
    fs: 'empty',
  },
  module: {
    rules: [
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
      // Section for node_modules libs that are ES6 and need to be transpiled to ES5. Make sure to use `include` only.
      {
        test: /\.js/,
        include: /node_modules\/ansicolor/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              babelrc: false,
              presets: [
                [
                  '@babel/preset-env',
                  {
                    targets: { browsers: 'last 3 versions' },
                    useBuiltIns: 'entry',
                  },
                ],
              ],
            },
          },
        ],
      },
      {
        test: /\.html$/,
        exclude: /(index|error)\-template\.html/,
        use: [
          { loader: 'ngtemplate-loader?relativeTo=' + path.resolve(__dirname, '../../public') + '&prefix=public' },
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
    ],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      checkSyntacticErrors: true,
    }),
  ],
};
