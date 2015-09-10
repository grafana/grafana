// Lint and build CSS
module.exports = function(grunt) {
  'use strict';

  grunt.registerTask('css', ['less', 'concat:cssDark', 'concat:cssLight']);
  grunt.registerTask('default', [
    'jscs',
    'jshint',
<<<<<<< 1d80184393eeceb8b85607609946c8057b6ef299
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
