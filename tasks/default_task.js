// Lint and build CSS
module.exports = function(grunt) {
  'use strict';

  grunt.registerTask('css', ['less', 'concat:cssDark', 'concat:cssLight']);
  grunt.registerTask('default', [
    'jscs',
    'jshint',
    'clean:gen',
    'copy:everything_but_ts_and_less',
    'css',
    'typescript:build'
  ]);

  grunt.registerTask('test', ['default', 'karma:test']);
};
