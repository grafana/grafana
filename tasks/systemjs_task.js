module.exports = function(grunt) {
  "use strict";

  // optional constructor options
  // sets the baseURL and loads the configuration file
  var Builder = require('systemjs-builder');
  var builder = new Builder('public_gen', 'public_gen/app/system.conf.js');
  
  grunt.registerTask('systemjs:buildCommon', function () {
    var done = this.async();

    var thirdparty = [
      'angular',
      'angular-bindonce',
      'angular-dragdrop',
      'vendor/angular-other/*',
      'angular-route',
      'angular-sanitize',
      'angular-ui',
      'ui.calendar',
      'bootstrap',
      'vendor/flot/*',
      'fullcalendar',
      'jquery',
      'bootstrap-tagsinput',
      'lodash',
      'moment',
      'spectrum',
      'eventemitter3'
    ].join(' + ');

    // thirdparty expected to be 'vendor/**/*', but the 'vendor' dir is toooo messy
    builder
      .bundle(thirdparty, 'public_gen/app/vendor.js')
      .then(function() {
        console.log('Build 3rd-party complete');
        done();
      })
      .catch(function(err) {
        console.log('Build error');
        console.log(err);
        done(false);
      });
  });
  
  grunt.registerTask('systemjs:build', function() {
    var done = this.async();

    console.log('Starting systemjs-builder');

    var modules = [
      'app/app',
      'app/features/all',
      'app/plugins/panel/**/module',
      'app/plugins/datasource/graphite/module',
      'app/plugins/datasource/influxdb/module',
      'app/plugins/datasource/elasticsearch/module',
    ];

    var expression = modules.join(' + ');

    builder
      .bundle(expression + ' - app/vendor', 'public_gen/app/app_bundle.js')
      .then(function() {
        console.log('Build complete');
        done();
        grunt.task.run('concat:bundle_and_boot');
      })
      .catch(function(err) {
        console.log('Build error');
        console.log(err);
        done(false);
      });
  });
};
