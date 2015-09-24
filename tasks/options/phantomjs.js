module.exports = function(config,grunt) {
  'use strict';
  grunt.registerTask('phantomjs', 'Copy phantomjs binary from node', function() {
    var m=grunt.file.read("./node_modules/karma-phantomjs-launcher/node_modules/phantomjs/lib/location.js")
    var p=/= \"([^\"]*)\"/.exec(m);
    if (grunt.file.exists(p[1])) {
      grunt.log.writeln('Using '+ p[1]);
      grunt.file.copy(p[1],'vendor/phantomjs/phantomjs');
    }
  });
};