// Lint and build CSS
module.exports = function(grunt) {
  'use strict';

  grunt.registerTask('css', ['less', 'concat:cssDark', 'concat:cssLight']);
  grunt.registerTask('default', [
    'jscs',
    'jshint',
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386
    'tslint',
    'clean:gen',
    'copy:public_to_gen',
    'phantomjs',
=======
    'clean:gen',
    'copy:everything_but_ts_and_less',
>>>>>>> tech(typescript): its looking good
    'css',
    'typescript:build'
  ]);

  grunt.registerTask('test', ['default', 'karma:test']);
};
