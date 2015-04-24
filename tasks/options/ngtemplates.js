module.exports = function(config) {
  return {
    grafana: {
      cwd:  '<%= tempDir %>',
      src:  ['app/**/*.html', 'plugins/**/*.html'],
      dest: '<%= tempDir %>/app/components/partials.js',
      options: {
        bootstrap: function(module, script) {
          return "define('components/partials', ['angular'], function(angular) { \n" +
            "angular.module('grafana').run(['$templateCache', function($templateCache) { \n" +
                script +
            '\n}]);' +
          '\n});';
        }
      }
    }
  };
};
