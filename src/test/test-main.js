require.config({
    baseUrl:'base'
});

require([
  'test/specs/lexer-specs',
  'test/specs/parser-specs',
], function () {
  window.__karma__.start();
});