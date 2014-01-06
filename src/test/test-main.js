require.config({
  baseUrl: 'base',

  paths: {
    underscore:            'app/components/underscore.extended',
    'underscore-src':      'vendor/underscore',
  },

  shim: {
    underscore: {
      exports: '_'
    },
  }
});

require([
  'test/specs/lexer-specs',
  'test/specs/parser-specs',
  'test/specs/gfunc-specs',
], function () {
  window.__karma__.start();
});