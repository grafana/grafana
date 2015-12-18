module.exports = function(grunt) {
  "use strict";

  grunt.registerTask('systemjs:build', function() {
    var path = require("path");
    var Builder = require('systemjs-builder');
    var done = this.async();

    // optional constructor options
    // sets the baseURL and loads the configuration file
    var builder = new Builder('public_gen', 'public_gen/app/systemjs.conf.js');
    console.log('Starting systemjs-builder');

    builder
      .bundle('app/app + app/features/all', 'public_gen/app/app.js')
      .then(function() {
        console.log('Build complete');
        done();
      })
      .catch(function(err) {
        console.log('Build error');
        console.log(err);
        done();
      });
  });

};
