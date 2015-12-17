module.exports = function(config) {
  return {
    grafana: {
      cwd:  '<%= genDir %>',
      src:  ['app/**/*.html'],
      dest: '<%= genDir %>/app/core/partials.js',
      options: {
        bootstrap: function(module, script) {
          return "define('app/core/partials', ['app/core/core_module'], function(coreModule) { \n" +
            "coreModule.run(['$templateCache', function($templateCache) { \n" +
                script +
            '\n}]);' +
          '\n});';
        }
      }
    }
  };
};
