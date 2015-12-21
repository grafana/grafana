module.exports = function(grunt) {
  "use strict";

  grunt.registerTask('systemjs:build', function() {
    var Builder = require('systemjs-builder');
    var done = this.async();

    // optional constructor options
    // sets the baseURL and loads the configuration file
    var builder = new Builder('public_gen', 'public_gen/app/systemjs.conf.js');
    console.log('Starting systemjs-builder');

    var modules = [
      'app/app',
      'app/features/all',
      'app/plugins/panels/**/*',
      'app/plugins/datasource/graphite/**/*',
      'app/plugins/datasource/influxdb/**/*',
      'app/plugins/datasource/elasticsearch/**/*',
    ];

    var expression = modules.join(' + ');

    builder
      .bundle(expression, 'public_gen/app/app_bundle.js')
      .then(function() {
        console.log('Build complete');
        done();
        grunt.task.run('concat:bundle_and_boot');
      })
      .catch(function(err) {
        console.log('Build error');
        console.log(err);
        done();
      });
  });
};
