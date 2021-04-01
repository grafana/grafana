module.exports = function getBabelConfig(options = {}) {
  return {
    cacheDirectory: true,
    babelrc: false,
    // Note: order is top-to-bottom and/or left-to-right
    // Note: order is bottom-to-top and/or right-to-left
    presets: [
      [
        '@babel/preset-env',
        {
          bugfixes: true,
          browserslistEnv: process.env.BABEL_ENV || options.BABEL_ENV || 'production',
          useBuiltIns: 'entry',
          corejs: '3.10',
        },
      ],
      [
        '@babel/preset-typescript',
        {
          allowNamespaces: true,
          allowDeclareFields: true,
        },
      ],
      [
        '@babel/preset-react',
        {
          runtime: 'automatic',
        },
      ],
    ],
    plugins: [
      [
        '@babel/plugin-transform-typescript',
        {
          allowNamespaces: true,
          allowDeclareFields: true,
        },
      ],
      ['@babel/plugin-proposal-class-properties', { loose: true }],
      ['@babel/plugin-proposal-private-methods', { loose: true }],
      ['@babel/plugin-proposal-object-rest-spread', { loose: true }],
      // Waiting with this need to refactoring timeSrv & locationUtil.init
      // '@babel/plugin-transform-react-constant-elements',
      '@babel/plugin-proposal-nullish-coalescing-operator',
      '@babel/plugin-proposal-optional-chaining',
      '@babel/plugin-syntax-dynamic-import', // needed for `() => import()` in routes.ts
      'angularjs-annotate',
    ],
  };
};
