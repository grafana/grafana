module.exports = function(config) {
  return {
    grafana: {
      cwd:  '<%= genDir %>',
      src:  ['app/**/*.html'],
      dest: '<%= genDir %>/app/components/partials.js',
      options: {
        bootstrap: function(module, script) {
          return "define('app/components/partials', ['angular'], function(angular) { \n" +
            "angular.module('grafana').run(['$templateCache', function($templateCache) { \n" +
                script +
            '\n}]);' +
          '\n});';
        }
      }
    }
  };
};
